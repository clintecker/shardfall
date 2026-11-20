'use strict';
/*
 * syncWorld(): the once-per-frame bridge from game state to scene. Works out which tiles were
 * just revealed or changed, starts their transitions, drains the `fx` queue the rules filled
 * (damage numbers, beams, bursts, harvest trails), and schedules ambient motes.
 */
function syncWorld(now, dt) {
  const { N, root, cities, mk, rev, chg, seen, tsig, rfx } = W3,
    A = GL.A,
    o = N / 2 - 0.5,
    ex = G.factions[0].explored,
    all = G.over ? 1 : 0;
  let dirty = false,
    anim = false,
    newly = null,
    oh = all;
  for (let k = 0; k < G.tiles.length; k++) {
    const t = G.tiles[k];
    if (ex[k] | all && !seen[k]) {
      seen[k] = 1;
      dirty = true;
      if (!W3.fresh && !reduce) (newly || (newly = [])).push(k);
    }
    const sg =
      t.used * 2 +
      (t.res === 'algae' ? 4 : t.res === 'ore' ? 8 : 0) +
      (t.c >= 0 ? 16 + 32 * (G.cities[t.c].owner + 2) : 0);
    if (sg !== tsig[k]) {
      if (tsig[k] >= 0 && seen[k] && !W3.fresh && !reduce && (sg ^ tsig[k]) & 15) chg[k] = now;
      tsig[k] = sg;
      dirty = true;
    }
    if (seen[k]) {
      if (now - rev[k] < REV || now - chg[k] < CHG) anim = true;
      if (!rfx[k] && now >= rev[k]) {
        rfx[k] = 1;
        if (now - rev[k] < 500) {
          const x = (k % N) - o,
            z = ((k / N) | 0) - o;
          for (let i = 0; i < 3; i++)
            spark(
              x + (Math.random() - 0.5) * 0.8,
              0.05,
              z + (Math.random() - 0.5) * 0.8,
              0,
              0.6 + Math.random() * 0.9,
              0,
              0.5 + Math.random() * 0.4,
              0.05,
              SCAN,
              0
            );
        }
      }
      oh = (oh * 31 + tileFaction(t) + 2) | 0;
    } else oh = (oh * 31) | 0;
  }
  if (newly) {
    const org = all
      ? [[o, o]]
      : [
          ...G.units.filter(u => u.owner === 0).map(u => [u.x, u.y]),
          ...G.cities.filter(c => c.owner === 0).map(c => [c.x, c.y])
        ];
    for (const k of newly) {
      const x = k % N,
        y = (k / N) | 0;
      let d = 99;
      for (const [ox, oy] of org) d = Math.min(d, Math.max(Math.abs(ox - x), Math.abs(oy - y)));
      rev[k] = now + Math.min(720, (d === 99 ? 0 : d) * 65);
    }
    anim = true;
  }
  if (dirty || anim || W3.wasAnim) rebuildTerrain(now);
  if (oh !== W3.oh || anim || W3.wasAnim) {
    W3.oh = oh;
    rebuildTerritory(now);
  }
  W3.wasAnim = anim;
  for (const c of G.cities) {
    const vis = tileShown(c.x, c.y, now),
      sig = vis ? c.owner + '|' + c.level : '';
    let ob = cities.get(c.id);
    if (!ob || ob.sig !== sig) {
      if (ob && ob.g) {
        root.remove(ob.g);
        disposeGroup(ob.g);
      }
      const was = ob && ob.sig ? ob.sig.split('|') : null,
        grew = was && was[0] === String(c.owner);
      ob = {
        sig,
        g: vis ? mkCity(c) : null,
        born: W3.fresh || reduce ? -1e9 : now,
        from: grew ? 0.62 : 0
      };
      if (ob.g) root.add(ob.g);
      cities.set(c.id, ob);
      if (was && vis && !W3.fresh) {
        if (!grew) column(c.x, c.y, c.owner >= 0 ? cult(c.owner).color : '#ffffff');
        else if (+was[1] < c.level) levelFx(c);
      }
    }
    if (ob.g) {
      ob.g.scale.set(1, Math.max(0.001, ob.from + (1 - ob.from) * eBack((now - ob.born) / 650)), 1);
      if (ob.g.userData.r1 && !reduce) {
        ob.g.userData.r1.rotation.z = now / 900;
        ob.g.userData.r2.rotation.z = -now / 600;
      }
    }
  }
  const dr = W3.im.drone,
    tm = reduce ? 0 : now / 1000;
  dr.count = 0;
  for (const c of G.cities) {
    const ob = cities.get(c.id);
    if (c.owner < 0 || !ob || !ob.g) continue;
    for (let j = 0, n = c.capital ? 4 : 2; j < n; j++) {
      const a = tm * (0.9 + j * 0.27) * (j % 2 ? -1 : 1) + c.id * 1.7 + j * 2.1,
        r = 0.5 + 0.07 * j;
      put(
        dr,
        c.x - o + Math.cos(a) * r,
        0.62 + 0.14 * j + Math.sin(tm * 1.3 + j) * 0.05,
        c.y - o + Math.sin(a) * r,
        0,
        0.02,
        0.02,
        0.02,
        W3.fc[c.owner]
      );
    }
  }
  dr.instanceMatrix.needsUpdate = true;
  if (dr.instanceColor) dr.instanceColor.needsUpdate = true;
  syncUnits(now, dt);
  /* markers pop in, staggered outward from the selected unit */
  if (moves !== W3.mvRef) {
    W3.mvRef = moves;
    W3.mvT = now;
  }
  const sk = sel ? sel.kind + ':' + (sel.kind === 'tile' ? sel.x + ',' + sel.y : sel.id) : '';
  if (sk !== W3.selKey) {
    W3.selKey = sk;
    W3.selT = now;
  }
  let i = 0,
    ux = 0,
    uy = 0;
  const su = sel && sel.kind === 'unit' && G.units.find(u => u.id === sel.id);
  if (su) {
    ux = su.x;
    uy = su.y;
  }
  const use = (x, y, mat, s, t0) => {
    const m = mk[i++];
    if (!m) return;
    const k = idx(x, y),
      t = G.tiles[k],
      q = reduce ? 1 : eBack((now - t0) / 190);
    const h = !tileShown(x, y, now)
      ? 0.06 + hash(x, y) * 0.3
      : ELEV[t.t] + (t.c >= 0 ? 0.055 : 0.02);
    m.material = mat;
    m.position.set(x - o, h, y - o);
    m.scale.setScalar(Math.max(0.001, s * q));
    m.visible = q > 0.02;
  };
  if (moves)
    for (const [, [x, y]] of moves)
      use(x, y, A.mMove, 0.95, W3.mvT + Math.max(Math.abs(x - ux), Math.abs(y - uy)) * 45 - 30);
  if (atks) for (const t of atks) use(t.x, t.y, A.mAtk, 0.98, W3.mvT + 60);
  if (sel) {
    let sx, sy;
    if (su) {
      sx = su.x;
      sy = su.y;
    } else if (sel.kind === 'city') {
      sx = G.cities[sel.id].x;
      sy = G.cities[sel.id].y;
    } else if (sel.kind === 'tile') {
      sx = sel.x;
      sy = sel.y;
    }
    if (sx !== undefined) {
      const m = mk[i];
      use(sx, sy, A.mSel, 1.03, -1e9);
      if (m && !reduce) m.scale.setScalar(1.03 * (1.4 - 0.4 * eOut((now - W3.selT) / 220)));
    }
  }
  if (W3.hover) use(W3.hover[0], W3.hover[1], A.mHover, 1, -1e9);
  for (; i < mk.length; i++) mk[i].visible = false;
  const so = sel && sel.kind === 'unit' && W3.units.get(sel.id);
  if (so && so.g.visible) {
    GL.selLight.position.copy(so.g.position);
    GL.selLight.position.y += 1.1;
    GL.selLight.intensity = 1.5 * eOut((now - W3.selT) / 250);
  } else GL.selLight.intensity = 0;
  const shown = (x, y) => tileShown(x, y, now);
  for (const f of fx) {
    if (f.sp) continue;
    f.sp = 1;
    if (f.kind === 'beam') {
      if (!shown(f.x1, f.y1) && !shown(f.x2, f.y2)) continue;
      const x1 = f.x1 - o,
        z1 = f.y1 - o,
        x2 = f.x2 - o,
        z2 = f.y2 - o,
        c = f.color;
      if (cheb(f.x1, f.y1, f.x2, f.y2) > 1) {
        flash(x1, 0.6, z1, c, 3, 0.14);
        shoot(
          x1,
          0.58,
          z1,
          x2,
          0.45,
          z2,
          c,
          0.035,
          Math.min(0.24, 0.07 + Math.hypot(x2 - x1, z2 - z1) * 0.045),
          true,
          () => burst(x2, z2, c, false)
        );
      } else {
        shoot(x1, 0.55, z1, x2, 0.45, z2, c, 0.03, 0.22);
        burst(x2, z2, c, false);
      }
    } else if (f.kind === 'burst') {
      if (shown(f.x, f.y)) burst(f.x - o, f.y - o, f.color, true);
    } else if (f.kind === 'harvest' && shown(f.x, f.y)) {
      const c = lin(f.color, 2.4),
        tx = f.cx - o,
        tz = f.cy - o,
        g = 2.6;
      for (let j = 0; j < 16; j++) {
        const L = 0.5 + Math.random() * 0.4,
          sx = f.x - o + (Math.random() - 0.5) * 0.5,
          sz = f.y - o + (Math.random() - 0.5) * 0.5,
          sy = 0.1 + Math.random() * 0.15;
        spark(
          sx,
          sy,
          sz,
          (tx - sx) / L,
          (0.5 - sy + 0.5 * g * L * L) / L,
          (tz - sz) / L,
          L,
          0.07,
          c,
          g
        );
      }
    }
  }
  fx = fx.filter(f => now - f.t < 950);
  if (!reduce && SET.weather && GL.at.precip === 'rain' && Math.random() < 0.7)
    spark(
      (Math.random() - 0.5) * N,
      0.03,
      (Math.random() - 0.5) * N,
      0,
      0.3,
      0,
      0.2,
      0.035,
      SPLASH || (SPLASH = lin('#bfe6ff', 0.9)),
      0
    );
  if (!reduce && GL.P.list.length < 140 && Math.random() < 0.6) {
    const x = (Math.random() * N) | 0,
      y = (Math.random() * N) | 0,
      k = idx(x, y),
      B = seen[k] ? W3.bio[G.tiles[k].b] : null,
      c = B ? LC(B.S.mote, 1.5) : LC('#7fdcff', 1.2),
      up = B && (B.key === 'helion' || B.key === 'tide');
    spark(
      x - o + (Math.random() - 0.5),
      B ? 0.05 : -0.5,
      y - o + (Math.random() - 0.5),
      (Math.random() - 0.5) * 0.08,
      up ? 0.25 + Math.random() * 0.3 : 0.08 + Math.random() * 0.14,
      (Math.random() - 0.5) * 0.08,
      up ? 2.5 + Math.random() * 2 : 5 + Math.random() * 4,
      B && B.key === 'choir' ? 0.035 : 0.05,
      c,
      0
    );
  }
}
