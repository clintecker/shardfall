'use strict';
/*
 * Units on the board: one mesh per unit, animated in the vertex shader (see models.js).
 * syncUnits() reconciles the meshes with G.units every frame: new units get a mesh, dead ones
 * lose theirs, movers ease toward their tile, and attackers lunge or flinch on cue from the
 * `pos` map that the rules write to.
 */
const RIG = {
  trooper: { hip: 0.6, knee: 0.95, rec: 0.3, sp: 3.2, ph: 11, h: 1.12 },
  railgunner: { hip: 0.6, knee: 0.95, rec: 0.14, sp: 3.2, ph: 11, h: 1.12 },
  bulwark: { hip: 0.5, knee: 0.8, rec: 0.8, sp: 2.9, ph: 10, h: 1.15 },
  mech: { hip: 0.42, knee: -0.55, rec: 0, sp: 2.6, ph: 7, h: 1.36 },
  skimmer: { hip: 0, knee: 0, rec: 0, sp: 5.5, ph: 0, h: 0.9 },
  cannon: { hip: 0, knee: 0, rec: 0, sp: 2.6, ph: 0, h: 0.92 }
};
function unitMats() {
  const A = GL.A,
    uni = {
      uA: { value: new T3.Vector4() },
      uB: { value: new T3.Vector4() },
      uC: { value: new T3.Vector4() }
    },
    mk = src => {
      const m = src.clone();
      m.userData.u = uni;
      m.onBeforeCompile = animPatch;
      return m;
    };
  return { uni, bm: mk(A.mUnit), gm: mk(A.mUnitGlow), dm: mk(A.mUnitDepth), hm: mk(A.mUnitHolo) };
}
function mkUnitObj(u) {
  const f = G.factions[u.owner],
    geo = unitGeo(u.type, f.key),
    A = GL.A,
    g = new T3.Group(),
    inner = new T3.Group(),
    M = unitMats();
  const body = new T3.Mesh(geo.body, M.bm);
  body.castShadow = body.receiveShadow = true;
  body.customDepthMaterial = M.dm;
  inner.add(body);
  if (geo.glow) inner.add(new T3.Mesh(geo.glow, M.gm));
  if (geo.holo) {
    const h = new T3.Mesh(geo.holo, M.hm);
    h.renderOrder = 3;
    inner.add(h);
  }
  inner.scale.setScalar(1.3);
  inner.rotation.order = 'YXZ';
  g.add(inner);
  const ring = new T3.Mesh(
    A.gRing,
    new T3.MeshBasicMaterial({
      color: lin(cult(u.owner).color, 2.4),
      transparent: true,
      blending: T3.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  ring.visible = false;
  g.add(ring);
  W3.root.add(g);
  return Object.assign(M, {
    g,
    inner,
    ring,
    u,
    born: performance.now(),
    yaw: null,
    dead: 0,
    ph: Math.random() * 6,
    wk: 0,
    hpS: u.hp,
    seen: false
  });
}
function killUnitObj(ob) {
  W3.root.remove(ob.g);
  ob.bm.dispose();
  ob.gm.dispose();
  ob.dm.dispose();
  ob.hm.dispose();
  ob.ring.material.dispose();
}
function syncUnits(now, dt) {
  const { N, units } = W3,
    o = N / 2 - 0.5,
    ex = G.factions[0].explored,
    all = G.over,
    live = new Set(),
    k = reduce ? 1 : 1 - Math.exp(-dt * 11),
    ts = (now / 1000) % 1000;
  for (const u of G.units) {
    live.add(u.id);
    let ob = units.get(u.id);
    if (!ob) {
      ob = mkUnitObj(u);
      units.set(u.id, ob);
      if (W3.fresh) ob.born = -1e9;
      else if (ex[idx(u.x, u.y)]) column(u.x, u.y, cult(u.owner).color);
    }
    ob.u = u;
    let p = pos.get(u.id);
    if (!p) {
      p = { x: u.x, y: u.y };
      pos.set(u.id, p);
    }
    const rg = RIG[u.type],
      fly = u.type === 'skimmer',
      ranged = UT[u.type].rng > 1,
      dx = u.x - p.x,
      dy = u.y - p.y,
      dl = Math.hypot(dx, dy);
    if (dl > 0.001 && !reduce) {
      const st = Math.min(dl, rg.sp * dt);
      p.x += (dx / dl) * st;
      p.y += (dy / dl) * st;
    } else {
      p.x = u.x;
      p.y = u.y;
    }
    const t = G.tiles[idx(u.x, u.y)],
      vis = tileShown(u.x, u.y, now);
    ob.g.visible = vis;
    if (!vis) {
      ob.seen = false;
      continue;
    }
    if (!ob.seen) {
      ob.seen = true;
      if (!W3.fresh && now - ob.born > 400) ob.born = now;
    }
    const dist = Math.hypot(u.x - p.x, u.y - p.y);
    ob.wk += ((reduce ? 0 : Math.min(1, dist * 6)) - ob.wk) * Math.min(1, dt * 14);
    if (ob.wk > 0.02) ob.ph += dt * rg.ph;
    const base = t.c >= 0 ? 0.04 : t.t === WATER ? 0.02 : ELEV[t.t];
    ob.by = ob.by === undefined ? base : ob.by + (base - ob.by) * k;
    const sw = Math.sin(ob.ph) * ob.wk,
      cw = Math.cos(ob.ph) * ob.wk,
      idle = reduce ? 0 : 1 - ob.wk;
    const step = fly ? 0 : Math.abs(Math.cos(ob.ph)) * 0.022 * ob.wk,
      bob = fly ? 0.05 + (reduce ? 0 : Math.sin(now / 300 + u.id) * 0.025) : 0;
    ob.g.position.set(p.x - o, ob.by + step + bob, p.y - o);
    let fxv = u.fx || 0,
      fyv = u.fy || 0;
    if (!fxv && !fyv) {
      fxv = N / 2 - u.x - 0.5;
      fyv = N / 2 - u.y - 0.5;
    }
    const ty = Math.atan2(fxv, fyv);
    if (ob.yaw === null) ob.yaw = ty;
    const d = ty - ob.yaw;
    ob.yaw += Math.atan2(Math.sin(d), Math.cos(d)) * k;
    let lx = 0,
      lz = 0,
      rec = 0;
    if (p.atkT && now - p.atkT < 280) {
      rec = Math.sin(((now - p.atkT) / 280) * Math.PI);
      const q = rec * (ranged ? -0.05 : 0.2);
      lx = Math.sin(ob.yaw) * q;
      lz = Math.cos(ob.yaw) * q;
    }
    const hit = p.hitT && now >= p.hitT && now - p.hitT < 280 ? 1 - (now - p.hitT) / 280 : 0;
    if (hit && !reduce) lx += Math.sin(now / 16) * 0.035 * hit;
    const fall = ob.dead ? 0 : 0,
      br = idle * Math.sin(now / 900 + u.id) * 0.012;
    ob.inner.position.set(lx, 0, lz);
    ob.inner.rotation.set(
      ob.wk * (fly ? 0.22 : 0.07) - rec * (ranged ? 0.06 : 0) + fall,
      ob.yaw,
      (fly && !reduce ? Math.sin(now / 500 + u.id) * 0.06 : 0) + sw * 0.035
    );
    ob.inner.scale.set(1.3, 1.3 * (1 + br), 1.3);
    const st = rg.knee > 0 ? idle : 0;
    ob.uni.uA.value.set(
      sw * rg.hip - st * 0.07,
      -sw * rg.hip + st * 0.05,
      -rec * rg.rec + idle * Math.sin(now / 1100 + u.id) * 0.03,
      -sw * 0.45 + idle * Math.sin(now / 1300 + u.id * 2) * 0.05
    );
    ob.uni.uB.value.set(
      idle * Math.sin(now / 1700 + u.id * 2.3) * 0.5,
      rec * (u.type === 'cannon' ? 0.1 : 0.07),
      ts + u.id * 0.37,
      fly ? Math.max(0.35, ob.wk) : ob.wk
    );
    ob.uni.uC.value.set(
      rg.knee * Math.max(0, -cw) + (rg.knee > 0 ? 0.06 : -0.04),
      rg.knee * Math.max(0, cw) + (rg.knee > 0 ? 0.06 : -0.04),
      0,
      0
    );
    const mine = u.owner === 0 && !busy && !G.over,
      ready = mine && (canAct(u) || canCapture(u)),
      tired = mine && !ready,
      pl = reduce ? 1 : 1 + 0.16 * Math.sin(now / 420 + u.id);
    ob.bm.color.setScalar((tired ? 0.36 : 1) + hit * 1.6);
    ob.gm.color.setScalar(((tired ? 0.3 : 1) + hit * 2) * pl);
    ob.hm.color.setScalar((tired ? 0.4 : 1) * (0.85 + 0.15 * pl));
    ob.ring.visible = ready;
    if (ready) {
      const s = (rg.h > 1.3 || u.type === 'cannon' ? 1.15 : 1) * (1 + 0.07 * Math.sin(now / 260));
      ob.ring.scale.set(s, s, 1);
    }
    const b = Math.min(1, (now - ob.born) / 380);
    ob.g.scale.setScalar(reduce ? 1 : 1 - Math.pow(1 - b, 3));
    ob.hpS += (u.hp - ob.hpS) * Math.min(1, dt * 7);
  }
  for (const [id, ob] of units) {
    if (live.has(id)) continue;
    if (!ob.dead) {
      ob.dead = now;
      ob.ring.visible = false;
    }
    const q = (now - ob.dead) / 520;
    if (q >= 1 || reduce) {
      killUnitObj(ob);
      units.delete(id);
      pos.delete(id);
    } else {
      ob.inner.rotation.x = -1.35 * Math.min(1, q * 1.7) * Math.min(1, q * 1.7);
      ob.g.position.y -= dt * 0.25;
      ob.g.scale.setScalar(q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45);
      ob.gm.color.setScalar(Math.max(0, 1 - q * 1.6) * (Math.random() < 0.4 ? 0.3 : 1.6));
      ob.bm.color.setScalar(1 - q * 0.7);
    }
  }
  W3.fresh = false;
}
