'use strict';
/*
 * The board for one game: created by initWorld(), thrown away when the game ends.
 *
 * Terrain is drawn with instanced meshes that are refilled from G on every frame in which
 * anything is mid-transition (and left alone otherwise). A 13x13 board is a few hundred
 * instances, and refilling them is what makes every transition free: a tile coming out of the
 * fog, changing owner or being harvested is just a different scale, height or color on the
 * next frame, eased by the per-tile clocks in W3 (rev, chg). tileShown() is the single source
 * of truth for "how visible is this tile".
 */
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && o.geometry.userData.own) o.geometry.dispose();
    if (o.material && o.material.userData && o.material.userData.own) o.material.dispose();
  });
}
function initWorld() {
  if (!ensureGL()) return;
  const { scene, A } = GL,
    N = G.N,
    T = N * N;
  if (W3) {
    scene.remove(W3.root);
    disposeGroup(W3.root);
    W3.root.traverse(o => {
      if (o.isInstancedMesh) o.dispose();
    });
    for (const ob of W3.units.values()) killUnitObj(ob);
  }
  const root = new T3.Group();
  scene.add(root);
  const im = {},
    IM = (k, g, m, n, cast, recv) => {
      const x = new T3.InstancedMesh(g, m, n);
      x.count = 0;
      x.frustumCulled = false;
      x.castShadow = cast;
      x.receiveShadow = recv;
      root.add(x);
      im[k] = x;
    };
  IM('fog', A.gFog, A.mFog, T, true, true);
  const bio = G.factions.map(f => {
    const b = bioAssets(f.key),
      k = f.key + ':';
    IM(k + 'plainA', A.gTile, b.mPlain[0], T, true, true);
    IM(k + 'plainB', A.gTile, b.mPlain[1], T, true, true);
    IM(k + 'grove', A.gTile, b.mGrove, T, true, true);
    IM(k + 'ridge', A.gTile, b.mRidge, T, true, true);
    IM(k + 'water', A.gTile, b.mWater, T, false, true);
    IM(k + 'peak0', b.gPeak[0], A.mPeak, T, true, true);
    IM(k + 'peak1', b.gPeak[1], A.mPeak, T, true, true);
    return {
      key: f.key,
      S: b.S,
      b,
      plain: [im[k + 'plainA'], im[k + 'plainB']],
      grove: im[k + 'grove'],
      ridge: im[k + 'ridge'],
      water: im[k + 'water'],
      peak: [im[k + 'peak0'], im[k + 'peak1']]
    };
  });
  IM('dCyl', A.gUCyl, A.mDecor, T * 8, true, false);
  IM('dBox', A.gUBox, A.mDecor, T * 6, true, false);
  IM('gCone', A.gCone, A.mDecorGlow, T * 8, true, false);
  IM('gSph', A.gSph, A.mDecorGlow, T * 4, true, false);
  IM('gDome', A.gDome, A.mDecorGlow, T * 5, true, false);
  IM('gCyl', A.gUCyl, A.mDecorGlow, T * 6, true, false);
  IM('hSph', A.gSph, A.mDecorHDR, T * 8, false, false);
  IM('hBox', A.gUBox, A.mDecorHDR, T * 5, false, false);
  IM('ore', A.gOct, A.mOre, T * 6, true, false);
  IM('pod', A.gSph, A.mPod, T * 5, true, false);
  IM('dish', A.gDish, A.mDish, T * 2, true, true);
  IM('dome', A.gDome, A.mGlass, T, false, false);
  IM('fall', A.gFall, A.mFall, N * 4 + 4, false, false);
  im.fall.renderOrder = 2;
  im.dome.renderOrder = 1;
  IM('pool', A.gFlat, A.mPool, T * 3, false, false);
  im.pool.renderOrder = 1;
  IM('drone', A.gSph, A.mDrone, 96, false, false);
  const edges = new T3.Group();
  root.add(edges);
  const B = Builder(),
    s = N + 0.5,
    q = Math.PI / 4;
  B.b(new T3.BoxGeometry(s, 0.4, s), '#141833', 0, -0.5, 0);
  for (const [x, z, w, d, hx_] of [
    [0, s / 2, s + 0.05, 0.04, '#27e0ff'],
    [0, -s / 2, s + 0.05, 0.04, '#27e0ff'],
    [s / 2, 0, 0.04, s + 0.05, '#ff3fd0'],
    [-s / 2, 0, 0.04, s + 0.05, '#ff3fd0']
  ])
    B.g(new T3.BoxGeometry(w, 0.035, d), hx_, x, -0.42, z, { m: 3 });
  B.b(new T3.CylinderGeometry(s * 0.69, s * 0.42, 1.1, 4), '#161a38', 0, -1.25, 0, {
    ry: q,
    flat: 1
  });
  B.g(new T3.CylinderGeometry(s * 0.425, s * 0.425, 0.045, 4), '#27e0ff', 0, -1.82, 0, {
    ry: q,
    m: 2.6
  });
  B.b(new T3.CylinderGeometry(s * 0.42, s * 0.2, 0.9, 4), '#10132c', 0, -2.29, 0, {
    ry: q,
    flat: 1
  });
  B.g(new T3.CylinderGeometry(s * 0.13, s * 0.13, 0.05, 24), '#bff1ff', 0, -2.76, 0, { m: 4 });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      B.b(new T3.CylinderGeometry(0.34, 0.2, 0.8, 12), DK, sx * s * 0.36, -1.05, sz * s * 0.36);
      B.g(
        new T3.CylinderGeometry(0.17, 0.17, 0.03, 16),
        '#ff3fd0',
        sx * s * 0.36,
        -1.47,
        sz * s * 0.36,
        { m: 4 }
      );
    }
  const mg = B.out();
  root.add(new T3.Mesh(mg.body, A.mBody), new T3.Mesh(mg.glow, A.mGlow));
  const eb = new T3.Mesh(
    new T3.CylinderGeometry(s * 0.12, s * 0.34, 7, 24, 1, true).translate(0, -3.5, 0),
    A.beam('#6fd8ff', 1.1, 0)
  );
  eb.geometry.userData.own = true;
  eb.position.y = -2.78;
  eb.renderOrder = 2;
  root.add(eb);
  const terr = new T3.Mesh(new T3.BufferGeometry(), A.mTerr);
  terr.frustumCulled = false;
  terr.renderOrder = 2;
  root.add(terr);
  const mk = [];
  for (let i = 0; i < 36; i++) {
    const m = new T3.Mesh(A.gFlat, A.mMove);
    m.visible = false;
    m.renderOrder = 3;
    root.add(m);
    mk.push(m);
  }
  W3 = {
    root,
    N,
    im,
    bio,
    edges,
    terr,
    mk,
    units: new Map(),
    cities: new Map(),
    oh: null,
    fresh: true,
    fc: G.factions.map(f => lin(cult(f.i).color, 3)),
    fc1: G.factions.map(f => lin(cult(f.i).color)),
    rev: new Float64Array(T).fill(-1e9),
    chg: new Float64Array(T).fill(-1e9),
    seen: new Uint8Array(T),
    rfx: new Uint8Array(T),
    tsig: new Int32Array(T).fill(-1),
    own: new Int8Array(T).fill(-2),
    ownT: new Float64Array(T),
    epool: [],
    wasAnim: false,
    mvRef: null,
    mvT: 0,
    selKey: '',
    selT: 0,
    overSeen: !!G.over,
    veil: true,
    hover: null
  };
  if (GL.rainObj) GL.rainObj.material.uniforms.uHalf.value = N / 2 + 0.3;
  const sn = GL.sun,
    c = sn.shadow.camera,
    R = N * 0.78;
  applyAtmo(G.atmo || 'storm');
  applySet();
  sn.position.copy(GL.sunDir).multiplyScalar(N * 1.3);
  c.left = -R;
  c.right = R;
  c.top = R;
  c.bottom = -R;
  c.near = 1;
  c.far = N * 3.4;
  c.updateProjectionMatrix();
  size();
  resetView();
}
const REV = 820,
  CHG = 480;
let SCAN = null;
const eOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
  eBack = t => {
    t = clamp(t, 0, 1) - 1;
    return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
  };
function tileShown(x, y, now) {
  const k = idx(x, y);
  return !!W3.seen[k] && now >= W3.rev[k] + REV * 0.42;
}
function put(im, x, y, z, ry, sx, sy, sz, color) {
  if (im.count >= im.instanceMatrix.count) return;
  const i = im.count++;
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sx, sy, sz));
  im.setMatrixAt(i, _m);
  if (color) im.setColorAt(i, color);
}
/* terrain is rebuilt every frame while any tile is mid-transition: fog blocks sink away, the tile rises out of the deck, then its scenery pops up */
function rebuildTerrain(now) {
  const { N, im, rev, chg, seen, epool, bio } = W3,
    A = GL.A,
    o = N / 2 - 0.5;
  for (const k in im) if (k !== 'drone') im[k].count = 0;
  let ei = 0,
    ds = 1,
    ty = 0;
  const P = (m, x, y, z, ry, sx, sy, sz, c) => put(m, x, y + ty, z, ry, sx, sy, sz, c);
  const pool = (x, y, z, r, c) => {
    if (ds > 0.6) put(im.pool, x, y + ty + 0.02, z, 0, r * 2, 1, r * 2, c);
  };
  const rig = (x, z) => {
    const s = ds;
    pool(x, 0, z, 0.3, LC('#7fdcff', 0.2));
    if (s < 0.03) return;
    P(im.dish, x, 0.02, z, 0, 0.2 * s, 1, 0.2 * s);
    P(im.dome, x, 0.04, z, 0, 0.17 * s, 0.17 * s, 0.17 * s);
    P(im.hSph, x, 0.04 + 0.05 * s, z, 0, 0.035 * s, 0.035 * s, 0.035 * s, LC('#b8fff0', 3));
  };
  const TREE = {
    helion(x, z, s, i, hs) {
      if (i === 3 && hs > 0.5) {
        P(im.dBox, x, 0, z, hs * 3, 0.036 * s, 0.36 * s, 0.036 * s, LC('#b8862e'));
        P(im.hSph, x, 0.38 * s, z, 0, 0.02 * s, 0.02 * s, 0.02 * s, LC('#ffd76a', 3));
        return;
      }
      P(im.dCyl, x, 0, z, 0, 0.016 * s, 0.26 * s, 0.016 * s, LC('#6a4520'));
      P(im.gCone, x, 0.24 * s, z, hs * 6 + i, 0.18 * s, 0.045 * s, 0.18 * s, LC('#f0b030'));
      P(im.gCone, x, 0.29 * s, z, hs * 6 + i + 0.5, 0.1 * s, 0.04 * s, 0.1 * s, LC('#ffd76a'));
      P(im.hSph, x, 0.345 * s, z, 0, 0.013 * s, 0.013 * s, 0.013 * s, LC('#fff0c0', 3));
    },
    verdant(x, z, s, i, hs) {
      const pink = (i + ((hs * 7) | 0)) % 3 === 0;
      P(im.dCyl, x, 0, z, 0, 0.022 * s, 0.2 * s, 0.022 * s, LC('#dfe8cc'));
      P(
        im.gDome,
        x,
        0.19 * s,
        z,
        hs * 6,
        0.135 * s,
        0.09 * s,
        0.135 * s,
        LC(pink ? '#ff6fd0' : '#3fe0a0')
      );
      P(
        im.hSph,
        x,
        0.305 * s,
        z,
        0,
        0.012 * s,
        0.012 * s,
        0.012 * s,
        LC(pink ? '#ffc0ee' : '#c8ffe6', 2.6)
      );
      P(im.gCone, x + 0.075 * s, 0, z + 0.05 * s, i, 0.04 * s, 0.11 * s, 0.04 * s, LC('#1f8a5a'));
      if (pink) pool(x, 0, z, 0.28, LC('#ff7ad9', 0.26));
    },
    choir(x, z, s, i, hs) {
      const h = (0.26 + ((hs * 13 + i * 0.37) % 1) * 0.32) * s;
      P(im.dBox, x, 0, z, 0, 0.05 * s, h, 0.05 * s, LC('#15131f'));
      P(
        im.hBox,
        x,
        0.03 * s,
        z + 0.027 * s,
        0,
        0.012 * s,
        h - 0.06 * s,
        0.004 * s,
        LC('#ff4fd8', 2.4)
      );
      P(im.hBox, x, h, z, 0, 0.03 * s, 0.008 * s, 0.03 * s, LC('#ff9cf0', 3));
      if (i === 1)
        P(im.dBox, x + 0.09 * s, 0, z - 0.03 * s, 0, 0.1 * s, 0.06 * s, 0.07 * s, LC('#1c1930'));
    },
    tide(x, z, s, i, hs) {
      if (i % 2 === 0)
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + hs * 6,
            rr = 0.045 * s,
            hh = (0.12 + ((hs * 9 + k * 0.31) % 1) * 0.14) * s,
            cx = x + Math.cos(a) * rr,
            cz = z + Math.sin(a) * rr;
          P(im.gCyl, cx, 0, cz, 0, 0.02 * s, hh, 0.02 * s, LC(k === 1 ? '#ff5fa8' : '#ff8a5a'));
          P(im.hSph, cx, hh, cz, 0, 0.014 * s, 0.014 * s, 0.014 * s, LC('#8ff6ff', 2.6));
        }
      else {
        P(im.gSph, x, 0.05 * s, z, hs * 6, 0.075 * s, 0.055 * s, 0.075 * s, LC('#ff5fa8'));
        P(
          im.gCone,
          x + 0.06 * s,
          0,
          z - 0.04 * s,
          i,
          0.025 * s,
          0.27 * s,
          0.025 * s,
          LC('#27b3a0')
        );
        P(
          im.gCone,
          x - 0.05 * s,
          0,
          z + 0.05 * s,
          i + 1,
          0.02 * s,
          0.2 * s,
          0.02 * s,
          LC('#2fc9b0')
        );
      }
    }
  };
  const PROP = {
    helion(x, z, big, hs) {
      if (big) {
        P(im.dCyl, x, 0, z, 0, 0.02, 0.1 * ds, 0.02, LC('#6a4520'));
        P(im.gCone, x, 0.1 * ds, z, 0, 0.05 * ds, 0.03 * ds, 0.05 * ds, LC('#b8862e'));
        P(im.hSph, x, 0.15 * ds, z, 0, 0.022 * ds, 0.03 * ds, 0.022 * ds, LC('#ffb347', 3));
        pool(x, 0, z, 0.25, LC('#ffb347', 0.3));
      } else P(im.gDome, x, 0, z, hs * 6, 0.15 * ds, 0.035 * ds, 0.1 * ds, LC('#c9954a'));
    },
    verdant(x, z, big, hs) {
      if (big) {
        P(im.dCyl, x, 0, z, 0, 0.008, 0.12 * ds, 0.008, LC('#3fa878'));
        P(im.hSph, x, 0.13 * ds, z, 0, 0.026 * ds, 0.02 * ds, 0.026 * ds, LC('#ff7ad9', 2.6));
        pool(x, 0, z, 0.22, LC('#ff7ad9', 0.26));
      } else
        for (let k = 0; k < 3; k++)
          P(
            im.gCone,
            x + Math.cos(k * 2.1 + hs * 6) * 0.06,
            0,
            z + Math.sin(k * 2.1 + hs * 6) * 0.06,
            k,
            0.03 * ds,
            0.09 * ds,
            0.03 * ds,
            LC('#2fb37a')
          );
    },
    choir(x, z, big, hs) {
      if (big) {
        P(im.dBox, x, 0, z, 0, 0.03, 0.2 * ds, 0.03, LC('#15131f'));
        P(im.hBox, x, 0.2 * ds, z, 0, 0.04 * ds, 0.012 * ds, 0.04 * ds, LC('#ff4fd8', 3));
      } else {
        P(im.dBox, x, 0, z, hs * 3, 0.16 * ds, 0.025, 0.1 * ds, LC('#1c1930'));
        P(im.hBox, x, 0.025, z, hs * 3, 0.12 * ds, 0.004, 0.008, LC('#7a5cff', 2.6));
      }
    },
    tide(x, z, big, hs) {
      if (big) {
        P(im.dCyl, x, 0, z, 0, 0.035 * ds, 0.03, 0.035 * ds, LC('#173f4c'));
        for (let k = 0; k < 3; k++)
          P(
            im.hSph,
            x + (k - 1) * 0.012,
            0.06 + k * 0.06 * ds,
            z,
            0,
            (0.014 - k * 0.003) * ds,
            (0.014 - k * 0.003) * ds,
            (0.014 - k * 0.003) * ds,
            LC('#bff4ff', 2.2)
          );
      } else P(im.gDome, x, 0, z, hs * 6, 0.06 * ds, 0.04 * ds, 0.05 * ds, LC('#f3e6d8'));
    }
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y),
        t = G.tiles[k],
        wx = x - o,
        wz = y - o,
        hs = hash(x, y),
        h2 = hash(y + 11, x + 5),
        rot = (((hs * 4) | 0) * Math.PI) / 2,
        a = seen[k] ? (now - rev[k]) / REV : -1;
      if (a < 1) {
        const f = a <= 0 ? 0 : clamp(a / 0.45, 0, 1),
          h = 0.34 + hs * 0.3;
        if (f < 1) {
          const q = eOut(f);
          put(
            im.fog,
            wx,
            (h / 2 - 0.3) * (1 - q) - q * 0.32,
            wz,
            rot + q * 1.2,
            1 - q * 0.85,
            (h / 0.3) * (1 - q * 0.6),
            1 - q * 0.85
          );
        }
        if (a <= 0) continue;
        put(
          im.pool,
          wx,
          ELEV[t.t] + 0.06,
          wz,
          0,
          1.7,
          1,
          1.7,
          _c.copy(SCAN).multiplyScalar(Math.sin(Math.min(1, a * 1.3) * Math.PI) * 0.42)
        );
      }
      ty = a >= 1 ? 0 : -(1 - eOut((a - 0.1) / 0.6)) * 0.6;
      ds = a >= 1 ? 1 : eBack((a - 0.5) / 0.5);
      const cq = (now - chg[k]) / CHG;
      if (cq < 1) ds *= eBack(cq);
      const e = ELEV[t.t],
        H = 0.3 + e,
        B = bio[t.b] || bio[0],
        S = B.S;
      if (t.t === WATER) {
        put(B.water, wx, e - H / 2 + ty, wz, 0, 1, H / 0.3, 1);
        if (a >= 1)
          for (const [nx, nz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ])
            if (!inb(x + nx, y + nz))
              put(
                im.fall,
                wx + nx * 0.487,
                e,
                wz + nz * 0.487,
                Math.atan2(nx, nz),
                1,
                1,
                1,
                LC(S.fall)
              );
      } else
        put(
          t.t === PLAIN ? B.plain[hs < 0.5 ? 0 : 1] : t.t === GROVE ? B.grove : B.ridge,
          wx,
          e - H / 2 + ty,
          wz,
          rot,
          1,
          H / 0.3,
          1,
          _c.setScalar(0.82 + h2 * 0.36)
        );
      if (t.c >= 0) {
        const c = G.cities[t.c];
        pool(
          wx,
          0.03,
          wz,
          1.15,
          c.owner >= 0 ? _c.copy(W3.fc[c.owner]).multiplyScalar(0.085) : LC('#ffd9a0', 0.12)
        );
        continue;
      }
      if (t.t === GROVE) {
        pool(wx, 0, wz, 0.62, LC(S.pool[0], 0.17));
        const tr = TREE[B.key];
        if (t.used) {
          if (ds > 0.03) tr(wx - 0.2, wz - 0.06, 0.95 * ds, 0, hs);
          rig(wx + 0.16, wz + 0.12);
        } else if (ds > 0.03)
          [
            [0.04, -0.22, 1.05],
            [-0.28, 0.04, 0.82 + hs * 0.2],
            [0.27, 0.16, 0.78],
            [-0.08, 0.3, 0.62]
          ].forEach(([ox, oz, s], i) => tr(wx + ox, wz + oz, s * ds, i, hs));
      } else if (t.t === RIDGE) {
        const v = (hs * 2) | 0;
        if (ds > 0.03) {
          put(B.peak[v], wx, e + ty, wz, rot, ds, ds, ds);
          let ls = epool[ei];
          if (!ls) {
            ls = epool[ei] = new T3.LineSegments(B.b.gPeakE[v], B.b.mEdge);
            W3.edges.add(ls);
          }
          ei++;
          ls.geometry = B.b.gPeakE[v];
          ls.material = B.b.mEdge;
          ls.position.set(wx, e + ty, wz);
          ls.rotation.y = rot;
          ls.scale.setScalar(ds);
          ls.visible = true;
        }
        if (t.res === 'ore') {
          pool(wx, e, wz, 0.62, LC('#ff9a1f', 0.3));
          for (let i = 0; i < 3; i++) {
            const an = i * 2.1 + hs * 6,
              cx = wx + Math.cos(an) * 0.4,
              cz = wz + Math.sin(an) * 0.4;
            put(im.ore, cx, e + ty + 0.07 * ds, cz, an, 0.035 * ds, 0.09 * ds, 0.035 * ds);
            put(
              im.ore,
              cx + 0.05,
              e + ty + 0.04 * ds,
              cz + 0.03,
              an + 1,
              0.022 * ds,
              0.055 * ds,
              0.022 * ds
            );
          }
        }
      } else if (t.res === 'algae') {
        put(im.dish, wx, 0.02 + ty, wz, 0, 0.3 * ds, 1, 0.3 * ds);
        pool(wx, 0, wz, 0.52, LC('#a8ff3e', 0.24));
        for (const [ox, oz, r] of [
          [-0.1, 0.02, 0.075],
          [0.09, -0.07, 0.065],
          [0.05, 0.12, 0.055],
          [-0.06, -0.13, 0.05]
        ])
          put(
            im.pod,
            wx + ox * ds,
            0.03 + ty + r * 0.8 * ds,
            wz + oz * ds,
            0,
            r * ds,
            r * 0.85 * ds,
            r * ds
          );
      } else if (t.used && t.t === PLAIN) rig(wx, wz);
      else if (t.t === PLAIN && hs > 0.74 && ds > 0.03)
        PROP[B.key](wx + (h2 - 0.5) * 0.5, wz + (hs - 0.87) * 2.4, hs > 0.88, hs);
    }
  for (; ei < epool.length; ei++) epool[ei].visible = false;
  for (const k in im)
    if (k !== 'drone') {
      im[k].instanceMatrix.needsUpdate = true;
      if (im[k].instanceColor) im[k].instanceColor.needsUpdate = true;
    }
}
function rebuildTerritory(now) {
  const { N, terr, seen, rev, own, ownT } = W3,
    o = N / 2 - 0.5,
    P = [],
    C = [],
    U = [],
    Tm = [],
    ts = now / 1000;
  for (let k = 0; k < N * N; k++) {
    const f = seen[k] && now >= rev[k] + REV * 0.55 ? tileFaction(G.tiles[k]) : -1;
    if (f !== own[k]) {
      own[k] = f;
      ownT[k] = W3.fresh || reduce ? -99 : ts;
    }
  }
  const quad = (a, b, c, d, col, al, wall, t0) => {
    for (const [p, v] of [
      [a, 0],
      [b, 0],
      [c, 1],
      [a, 0],
      [c, 1],
      [d, 1]
    ]) {
      P.push(p[0], p[1], p[2]);
      C.push(col.r * al, col.g * al, col.b * al);
      U.push(wall, v);
      Tm.push(t0);
    }
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y),
        f = own[k];
      if (f < 0) continue;
      const t = G.tiles[k],
        col = W3.fc1[f],
        wx = x - o,
        wz = y - o,
        h = ELEV[t.t] + (t.c >= 0 ? 0.04 : 0.012),
        T = ownT[k];
      quad(
        [wx - 0.47, h, wz - 0.47],
        [wx + 0.47, h, wz - 0.47],
        [wx + 0.47, h, wz + 0.47],
        [wx - 0.47, h, wz + 0.47],
        col,
        0.045,
        0,
        T
      );
      for (const [nx, nz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const X = x + nx,
          Y = y + nz,
          nk = inb(X, Y) ? idx(X, Y) : -1;
        if (nk >= 0 && own[nk] === f) continue;
        const te = nk >= 0 ? Math.max(T, ownT[nk]) : T,
          tx = -nz,
          tz = nx,
          ax = wx + nx * 0.45 - tx * 0.47,
          az = wz + nz * 0.45 - tz * 0.47,
          bx = wx + nx * 0.45 + tx * 0.47,
          bz = wz + nz * 0.45 + tz * 0.47;
        quad(
          [ax, h + 0.003, az],
          [bx, h + 0.003, bz],
          [bx - nx * 0.07, h + 0.003, bz - nz * 0.07],
          [ax - nx * 0.07, h + 0.003, az - nz * 0.07],
          col,
          1.3,
          0,
          te
        );
        quad([ax, h, az], [bx, h, bz], [bx, h + 0.2, bz], [ax, h + 0.2, az], col, 0.5, 1, te);
      }
    }
  const g = terr.geometry;
  g.dispose();
  g.setAttribute('position', new T3.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new T3.Float32BufferAttribute(C, 3));
  g.setAttribute('uv', new T3.Float32BufferAttribute(U, 2));
  g.setAttribute('aT', new T3.Float32BufferAttribute(Tm, 1));
}
function levelFx(c) {
  const o = G.N / 2 - 0.5,
    x = c.x - o,
    z = c.y - o,
    hex = c.owner >= 0 ? cult(c.owner).color : '#ffffff',
    col = lin(hex, 2.6);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * 6.283;
    spark(x, 0.08, z, Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5, 0.55, 0.07, col, 0);
  }
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * 6.283,
      r = 0.15 + Math.random() * 0.3;
    spark(
      x + Math.cos(a) * r,
      0.1,
      z + Math.sin(a) * r,
      0,
      1 + Math.random() * 1.6,
      0,
      0.6 + Math.random() * 0.5,
      0.06,
      col,
      0
    );
  }
  flash(x, 0.8, z, hex, 4, 0.5);
}
function mkCity(c) {
  const A = GL.A,
    g = new T3.Group(),
    key = c.owner >= 0 ? G.factions[c.owner].key : '',
    col = c.owner >= 0 ? cult(c.owner).color : '#8f98c4',
    L = Math.min(c.level, 6),
    B = Builder(),
    tw = [],
    o = W3.N / 2 - 0.5,
    r = rng(c.id * 7 + 3);
  g.position.set(c.x - o, 0, c.y - o);
  B.b(gC(0.46, 0.475, 0.035, 8), DK, 0, 0.017, 0, { ry: Math.PI / 8 });
  B.g(gT(0.445, 0.01, 40), col, 0, 0.038, 0, { rx: Math.PI / 2, m: c.owner >= 0 ? 2.6 : 0.9 });
  const spec = [
    [-0.27, -0.27, 0.2, 0.4 + L * 0.11],
    [0.28, -0.26, 0.17, 0.3 + L * 0.075],
    [-0.28, 0.27, 0.16, 0.24 + L * 0.06],
    [0.27, 0.28, 0.15, 0.18 + L * 0.05]
  ];
  if (L >= 2) spec.push([0, -0.35, 0.13, 0.3 + L * 0.06]);
  if (L >= 3) spec.push([0.35, 0.02, 0.12, 0.26 + L * 0.06]);
  if (L >= 4) spec.push([-0.35, 0.02, 0.11, 0.34 + L * 0.05]);
  if (L >= 5) spec.push([0, 0.35, 0.12, 0.34]);
  let top = 0;
  for (const [x, z, w, h] of spec) {
    top = Math.max(top, h);
    const y0 = 0.035,
      round = key === 'verdant';
    let tg = round
      ? new T3.CylinderGeometry(w / 2, (w / 2) * 1.08, h, 14)
      : new T3.BoxGeometry(w, h, w);
    const uv = tg.attributes.uv,
      nm = tg.attributes.normal,
      cu = Math.max(1, Math.round((round ? 3.14 * w : w) / 0.045)) / 6,
      rv = Math.max(1, Math.round(h / 0.05)) / 24,
      ou = ((r() * 6) | 0) / 6,
      ov = ((r() * 24) | 0) / 24;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(nm.getY(i)) > 0.9) uv.setXY(i, 0.01, 0.004);
      else uv.setXY(i, uv.getX(i) * cu + ou, uv.getY(i) * rv + ov);
    }
    tg.translate(x, h / 2 + y0, z);
    tw.push(tg);
    const ty = h + y0;
    if (key === 'helion') {
      B.b(gO(w * 0.72, w * 0.7, 4), col, x, ty + w * 0.35, z, { ry: Math.PI / 4, flat: 1 });
      B.g(gS(0.014), col, x, ty + w * 0.72, z, { m: 4 });
    } else if (key === 'tide') {
      B.b(new T3.SphereGeometry(w * 0.5, 14, 8, 0, 6.2832, 0, 1.5708), col, x, ty, z);
      B.g(gT(w * 0.5, 0.006, 24), col, x, ty + 0.006, z, { rx: Math.PI / 2, m: 3 });
    } else if (key === 'choir') {
      B.b(gC(0.004, 0.012, h * 0.45, 6), DK, x, ty + h * 0.225, z);
      B.g(gS(0.014), col, x, ty + h * 0.45, z, { m: 5 });
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ])
        B.g(
          new T3.BoxGeometry(dx ? 0.004 : 0.012, h * 0.8, dz ? 0.004 : 0.012),
          col,
          x + dx * (w / 2 + 0.002),
          h * 0.5 + y0,
          z + dz * (w / 2 + 0.002),
          { m: 3 }
        );
    } else if (key === 'verdant') {
      B.b(gS(w * 0.55, 12, 8), '#1d8f6a', x, ty + w * 0.12, z, { sy: 0.7 });
      B.g(gS(w * 0.2), col, x, ty + w * 0.42, z, { m: 2.2 });
    } else B.b(gB(w * 0.5, 0.03, w * 0.5, 0.008), MD, x, ty + 0.015, z);
  }
  const tm = new T3.Mesh(T3.BufferGeometryUtils.mergeBufferGeometries(tw), towerMat(key, col));
  tm.geometry.userData.own = true;
  tw.forEach(x => x.dispose());
  tm.castShadow = tm.receiveShadow = true;
  g.add(tm);
  const out = B.out(),
    bm = new T3.Mesh(out.body, A.mBody);
  bm.castShadow = bm.receiveShadow = true;
  g.add(bm, new T3.Mesh(out.glow, A.mGlow));
  if (c.owner >= 0) {
    const bh = c.capital ? 4.2 : 1.6,
      beam = new T3.Mesh(
        new T3.CylinderGeometry(
          c.capital ? 0.035 : 0.02,
          c.capital ? 0.035 : 0.02,
          bh,
          10,
          1,
          true
        ).translate(0, bh / 2, 0),
        A.beam(col, c.capital ? 2 : 1.2, 1)
      );
    beam.geometry.userData.own = true;
    beam.position.set(-0.27, 0.4 + L * 0.11 + 0.1, -0.27);
    beam.renderOrder = 2;
    g.add(beam);
  }
  if (c.capital && c.owner >= 0) {
    const mat = new T3.MeshBasicMaterial({ color: lin(col, 2.6) });
    mat.userData.own = true;
    const r1 = new T3.Mesh(new T3.TorusGeometry(0.36, 0.009, 6, 48, 5.2), mat),
      r2 = new T3.Mesh(new T3.TorusGeometry(0.25, 0.007, 6, 40, 4.4), mat);
    r1.geometry.userData.own = r2.geometry.userData.own = true;
    r1.rotation.x = r2.rotation.x = Math.PI / 2;
    r1.position.y = top + 0.3;
    r2.position.y = top + 0.42;
    g.add(r1, r2);
    g.userData.r1 = r1;
    g.userData.r2 = r2;
  }
  return g;
}
