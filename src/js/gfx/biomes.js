'use strict';
/*
 * Homelands. Each culture's part of the board has its own ground, flora, rock, liquid and
 * light, defined by one entry in BIO:
 *
 *   helion  Sunfields      gold plate, parasol orchards, mesas, molten channels
 *   verdant Overgrowth     moss, giant mushrooms, root mounds, glowing lagoons
 *   choir   Black Lattice  obsidian glass, pylon fields, monolith stacks, mercury
 *   tide    Reef           tidal flats, coral gardens, sea stacks, turquoise water
 *
 * bioAssets() turns an entry into materials and instanced meshes, once per biome per game.
 */
const BIO = {
  helion: {
    name: 'Sunfields',
    style: 0,
    sd: 100,
    base: ['#a8762c', '#9a6a26', '#8a5f2a', '#7c4a2a'],
    rough: 0.5,
    em: '#ffc24a',
    ei: [1.1, 1.1, 0.8, 0.9],
    met: [0.55, 0.55, 0.35, 0.2],
    env: 0.8,
    water: { c: '#3e1703', e: '#ff7a12', ei: 1.15, r: 0.36, m: 0.1, ns: 0.3 },
    fall: '#ffb347',
    edge: ['#ffd27a', 0.3],
    pool: ['#ffb347', '#ff7a2e'],
    mote: '#ffb85a'
  },
  verdant: {
    name: 'Overgrowth',
    style: 1,
    sd: 200,
    base: ['#1e4a34', '#1a422e', '#173a2a', '#234536'],
    rough: 0.85,
    em: '#5dffb0',
    ei: [1, 1, 1.1, 0.8],
    met: [0.15, 0.15, 0.1, 0.15],
    env: 0.5,
    water: { c: '#04301f', e: '#19e08a', ei: 0.55, r: 0.1, m: 0.2, ns: 0.22 },
    fall: '#5dffb0',
    edge: ['#7dffb9', 0.35],
    pool: ['#3fe0a0', '#ff7ad9'],
    mote: '#9dffc8'
  },
  choir: {
    name: 'Black Lattice',
    style: 2,
    sd: 300,
    base: ['#0d0c16', '#100e1a', '#0b0a12', '#14121e'],
    rough: 0.2,
    em: '#ff4fd8',
    ei: [1.5, 1.5, 1.2, 1.1],
    met: [0.85, 0.85, 0.8, 0.6],
    env: 1.1,
    water: { c: '#07070c', e: '#ff3fd0', ei: 0.4, r: 0.04, m: 1, ns: 0.12 },
    fall: '#ff5ad0',
    edge: ['#ff4fd8', 0.85],
    pool: ['#ff4fd8', '#7a5cff'],
    mote: '#ff7ae6'
  },
  tide: {
    name: 'Reef',
    style: 3,
    sd: 400,
    base: ['#1c5a66', '#1a525e', '#1f6a62', '#24505c'],
    rough: 0.4,
    em: '#6ff0ff',
    ei: [0.9, 0.9, 0.9, 0.8],
    met: [0.3, 0.3, 0.25, 0.2],
    env: 0.9,
    water: { c: '#064a66', e: '#19c8e0', ei: 0.45, r: 0.08, m: 0.3, ns: 0.22 },
    fall: '#7fe6ff',
    edge: ['#8ff0ff', 0.4],
    pool: ['#5fe6ff', '#ff8a5a'],
    mote: '#bff4ff'
  }
};
const LCc = new Map(),
  LC = (h, m = 1) => {
    const k = h + m;
    let c = LCc.get(k);
    if (!c) {
      c = lin(h, m);
      LCc.set(k, c);
    }
    return c;
  };
function mkGround(S, seed, sub) {
  const r = rng(seed),
    a = cvs(256),
    e = cvs(256),
    hc = cvs(256),
    rc = cvs(256),
    A = a.getContext('2d'),
    E = e.getContext('2d'),
    Hh = hc.getContext('2d'),
    R = rc.getContext('2d'),
    st = S.style,
    rock = sub === 3;
  const g = v => {
      v = Math.round(clamp(v, 0, 1) * 255);
      return `rgb(${v},${v},${v})`;
    },
    line = (c, pts) => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
    };
  const blob = (c, x, y, rad, rgb, al) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${rgb},${al})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  A.fillStyle = S.base[sub];
  A.fillRect(0, 0, 256, 256);
  E.fillStyle = '#000';
  E.fillRect(0, 0, 256, 256);
  Hh.fillStyle = g(0.5);
  Hh.fillRect(0, 0, 256, 256);
  R.fillStyle = g(rock ? Math.min(0.9, S.rough + 0.3) : S.rough);
  R.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    const x = r() * 256,
      y = r() * 256,
      w = 1 + r() * 3,
      h = 1 + r() * 3,
      up = r() < 0.5,
      al = r();
    A.fillStyle = up ? `rgba(255,255,255,${al * 0.05})` : `rgba(0,0,20,${al * 0.09})`;
    A.fillRect(x, y, w, h);
    R.fillStyle = `rgba(${up ? '255,255,255' : '0,0,0'},${al * 0.14})`;
    R.fillRect(x, y, w, h);
    if (rock) {
      Hh.fillStyle = `rgba(${up ? '255,255,255' : '0,0,0'},${al * 0.22})`;
      Hh.fillRect(x, y, w * 3, h * 3);
    }
  }
  E.strokeStyle = E.fillStyle = '#fff';
  for (const c of [A, E, Hh, R]) c.lineCap = c.lineJoin = 'round';
  if (rock) {
    for (let i = 0; i < 14; i++) {
      const up = r() < 0.5;
      blob(Hh, r() * 256, r() * 256, 18 + r() * 40, up ? '255,255,255' : '0,0,0', 0.4);
    }
    for (let i = 0; i < 8; i++) {
      let x = r() * 256,
        y = r() * 256;
      const pts = [[x, y]];
      for (let j = 0; j < 5; j++) {
        x += (r() - 0.5) * 90;
        y += (r() - 0.5) * 90;
        pts.push([x, y]);
      }
      A.strokeStyle = 'rgba(0,0,20,.4)';
      A.lineWidth = 1 + r() * 2;
      line(A, pts);
      Hh.strokeStyle = g(0.12);
      Hh.lineWidth = 2.5 + r() * 2;
      line(Hh, pts);
      if (i < 3) {
        E.globalAlpha = 0.55;
        E.lineWidth = 1.6;
        line(E, pts);
      }
    }
  } else if (st === 0) {
    const n = sub === 2 ? 2 : 4,
      cs = 256 / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (r() > (sub === 2 ? 0.5 : 0.78)) continue;
        const x = i * cs + 6,
          y = j * cs + 6,
          w = cs - 12;
        A.fillStyle = 'rgba(34,22,70,.42)';
        A.fillRect(x, y, w, w);
        R.fillStyle = g(0.14 + r() * 0.12);
        R.fillRect(x, y, w, w);
        Hh.fillStyle = g(0.43);
        Hh.fillRect(x, y, w, w);
        A.strokeStyle = 'rgba(255,220,150,.2)';
        A.lineWidth = 1;
        for (let k = 1; k < 4; k++)
          line(A, [
            [x + (w * k) / 4, y],
            [x + (w * k) / 4, y + w]
          ]);
        E.globalAlpha = 0.25 + r() * 0.4;
        E.lineWidth = 1.6;
        E.strokeRect(x, y, w, w);
      }
    for (let i = 0; i < 9; i++) {
      const y0 = r() * 256,
        amp = 4 + r() * 6,
        ph = r() * 6,
        pts = [];
      for (let x = 0; x <= 256; x += 16) pts.push([x, y0 + Math.sin(x * 0.035 + ph) * amp]);
      Hh.strokeStyle = g(i % 2 ? 0.63 : 0.39);
      Hh.lineWidth = 5;
      line(Hh, pts);
      A.strokeStyle = 'rgba(255,235,190,.08)';
      A.lineWidth = 4;
      line(A, pts);
    }
    if (sub === 0) {
      const x = 60 + r() * 136,
        y = 60 + r() * 136;
      E.globalAlpha = 0.75;
      E.lineWidth = 2;
      E.beginPath();
      E.arc(x, y, 13, 0, 7);
      E.stroke();
      for (let k = 0; k < 8; k++) {
        const an = k * 0.785;
        line(E, [
          [x + Math.cos(an) * 18, y + Math.sin(an) * 18],
          [x + Math.cos(an) * 26, y + Math.sin(an) * 26]
        ]);
      }
    }
    Hh.strokeStyle = g(0.3);
    Hh.lineWidth = 5;
    Hh.strokeRect(1, 1, 254, 254);
    E.globalAlpha = 0.25;
    E.lineWidth = 3;
    E.strokeRect(3, 3, 250, 250);
  } else if (st === 1) {
    for (let i = 0; i < 26; i++) {
      const x = r() * 256,
        y = r() * 256,
        rad = 14 + r() * 36,
        up = r() < 0.5;
      blob(A, x, y, rad, up ? '90,200,120' : '0,20,10', up ? 0.16 : 0.26);
      blob(Hh, x, y, rad, up ? '255,255,255' : '0,0,0', 0.4);
      if (r() < 0.3) blob(R, x, y, rad, '0,0,0', 0.6);
    }
    for (let i = 0; i < (sub === 2 ? 9 : 6); i++) {
      let x = r() * 256,
        y = r() * 256,
        an = r() * 6.28;
      const pts = [[x, y]];
      for (let j = 0; j < 9; j++) {
        an += (r() - 0.5) * 1.3;
        x += Math.cos(an) * 20;
        y += Math.sin(an) * 20;
        pts.push([x, y]);
      }
      E.globalAlpha = 0.35 + r() * 0.5;
      E.lineWidth = 1.8 + r() * 1.5;
      line(E, pts);
      Hh.strokeStyle = g(0.67);
      Hh.lineWidth = 5;
      line(Hh, pts);
      E.beginPath();
      E.arc(x, y, 3.5, 0, 7);
      E.fill();
    }
    for (let i = 0; i < 14; i++) {
      E.globalAlpha = 0.3 + r() * 0.6;
      E.beginPath();
      E.arc(r() * 256, r() * 256, 1.5 + r() * 2, 0, 7);
      E.fill();
    }
  } else if (st === 2) {
    Hh.strokeStyle = g(0.36);
    Hh.lineWidth = 2;
    for (let i = 0; i <= 16; i++) {
      line(Hh, [
        [i * 16, 0],
        [i * 16, 256]
      ]);
      line(Hh, [
        [0, i * 16],
        [256, i * 16]
      ]);
    }
    for (let i = 0; i < 10; i++) {
      const x = ((r() * 14) | 0) * 16 + 8,
        y = ((r() * 14) | 0) * 16 + 8,
        w = 16 + ((r() * 3) | 0) * 16;
      A.fillStyle = 'rgba(120,110,170,.1)';
      A.fillRect(x, y, w, 16);
      R.fillStyle = g(0.45);
      R.fillRect(x, y, w, 16);
      Hh.fillStyle = g(0.6);
      Hh.fillRect(x, y, w, 16);
      if (r() < 0.5) {
        E.globalAlpha = 0.4 + r() * 0.5;
        E.fillRect(x + 3, y + 5, 5, 5);
      }
    }
    for (let i = 0; i < (sub === 2 ? 16 : 11); i++) {
      let x = ((r() * 15) | 0) * 16 + 8,
        y = ((r() * 15) | 0) * 16 + 8;
      const pts = [[x, y]];
      for (let j = 0; j < 4; j++) {
        const d = (r() * 4) | 0,
          len = (1 + ((r() * 4) | 0)) * 16;
        x = clamp(x + [1, 0, -1, 0][d] * len, 8, 248);
        y = clamp(y + [0, 1, 0, -1][d] * len, 8, 248);
        pts.push([x, y]);
      }
      E.globalAlpha = 0.4 + r() * 0.6;
      E.lineWidth = 1.8;
      line(E, pts);
      E.fillRect(x - 3, y - 3, 6, 6);
      R.strokeStyle = g(0.5);
      R.lineWidth = 3;
      line(R, pts);
    }
    E.globalAlpha = 0.5;
    E.lineWidth = 2.5;
    E.strokeRect(3, 3, 250, 250);
  } else {
    for (let i = 0; i < 10; i++) {
      const x = r() * 256,
        y = r() * 256,
        rad = 22 + r() * 44;
      blob(A, x, y, rad, '226,208,160', 0.3);
      blob(R, x, y, rad, '255,255,255', 0.5);
      blob(Hh, x, y, rad, '255,255,255', 0.25);
    }
    for (let i = 0; i < 7; i++) {
      const cx = r() * 256,
        cy = r() * 256;
      Hh.strokeStyle = g(0.35);
      Hh.lineWidth = 3;
      for (let k = 1; k < 4; k++) {
        const a0 = r() * 6.28;
        Hh.beginPath();
        Hh.arc(cx, cy, 10 + k * 9, a0, a0 + 2 + r() * 2);
        Hh.stroke();
      }
    }
    for (let i = 0; i < 9; i++) {
      const cx = r() * 256,
        cy = r() * 256,
        n = 5 + ((r() * 3) | 0),
        pts = [];
      for (let k = 0; k < n; k++) {
        const an = (k / n) * 6.283,
          rad = 16 + r() * 22;
        pts.push([cx + Math.cos(an) * rad, cy + Math.sin(an) * rad]);
      }
      pts.push(pts[0]);
      E.globalAlpha = 0.18 + r() * 0.3;
      E.lineWidth = 1.5 + r();
      line(E, pts);
    }
    for (let i = 0; i < 10; i++) {
      const x = r() * 256,
        y = r() * 256;
      A.fillStyle = 'rgba(255,240,220,.5)';
      A.beginPath();
      A.arc(x, y, 2 + r() * 2, 0, 7);
      A.fill();
      Hh.fillStyle = g(0.9);
      Hh.beginPath();
      Hh.arc(x, y, 3, 0, 7);
      Hh.fill();
    }
    for (let i = 0; i < 3; i++) blob(R, r() * 256, r() * 256, 30 + r() * 30, '0,0,0', 0.85);
  }
  return {
    map: tex(a, 1),
    emissiveMap: tex(e, 1),
    normalMap: nrmFrom(hc, rock ? 3 : 2.4),
    roughnessMap: tex(rc, 0)
  };
}
function mkPeakB(key, seed) {
  const r = rng(seed),
    parts = [],
    tmp = new T3.Color(),
    C = h => lin(h);
  const colorize = (g, fn) => {
    const p = g.attributes.position,
      c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      fn(p.getX(i), p.getY(i), p.getZ(i), tmp);
      c[i * 3] = tmp.r;
      c[i * 3 + 1] = tmp.g;
      c[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new T3.BufferAttribute(c, 3));
    return g;
  };
  const jit = (g, amt, h) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const t = y / h,
        k = hash(Math.round(x * 50) + seed, Math.round(z * 50) + Math.round(y * 50));
      if (t > 0.01) {
        const s = 1 + (k - 0.5) * amt;
        x *= s;
        z *= s;
        if (t < 0.98) y += (hash(Math.round(x * 40), Math.round(z * 40) + seed) - 0.5) * h * 0.08;
      }
      p.setXYZ(i, x, y, z);
    }
    return g;
  };
  if (key === 'helion') {
    const lo = C('#4a2410'),
      a = C('#9a5c1e'),
      b = C('#6e3216'),
      top = C('#c9a25e');
    const mesa = (ox, oz, rb, rt, h) => {
      const g = jit(new T3.CylinderGeometry(rt, rb, h, 8, 5).translate(0, h / 2, 0), 0.22, h);
      colorize(g, (x, y, z, o) => {
        const t = y / h;
        if (t > 0.9) o.copy(top);
        else o.copy(Math.floor(t * 6.5) % 2 ? a : b).lerp(lo, Math.max(0, 0.35 - t));
      });
      parts.push(g.translate(ox, 0, oz));
    };
    mesa(0, 0, 0.4, 0.27, 0.5 + r() * 0.2);
    const an = r() * 6.28;
    mesa(Math.cos(an) * 0.26, Math.sin(an) * 0.26, 0.17, 0.1, 0.3 + r() * 0.15);
    mesa(-Math.sin(an) * 0.27, Math.cos(an) * 0.27, 0.08, 0.035, 0.55 + r() * 0.25);
  } else if (key === 'verdant') {
    const lo = C('#0c3020'),
      hi = C('#2f9a5c'),
      stem = C('#b9c2a4'),
      cap = C('#d94fb0');
    const mound = (ox, oz, rad, h) => {
      const g = jit(
        new T3.SphereGeometry(rad, 9, 5, 0, 6.2832, 0, 1.5708).scale(1, h / rad, 1),
        0.28,
        h
      );
      colorize(g, (x, y, z, o) =>
        o
          .copy(lo)
          .lerp(hi, clamp(y / h, 0, 1) * (0.6 + hash(Math.round(x * 30), Math.round(z * 30)) * 0.6))
      );
      parts.push(g.translate(ox, 0, oz));
    };
    const h0 = 0.42 + r() * 0.2;
    mound(0, 0, 0.42, h0);
    const an = r() * 6.28;
    mound(Math.cos(an) * 0.25, Math.sin(an) * 0.25, 0.2, 0.26);
    const sx = -Math.cos(an) * 0.1,
      sz = -Math.sin(an) * 0.1,
      sh = 0.3 + r() * 0.15;
    parts.push(
      colorize(
        new T3.CylinderGeometry(0.03, 0.05, sh, 7).translate(sx, h0 * 0.85 + sh / 2, sz),
        (x, y, z, o) => o.copy(stem)
      )
    );
    parts.push(
      colorize(
        new T3.SphereGeometry(0.17, 9, 5, 0, 6.2832, 0, 1.5708)
          .scale(1, 0.6, 1)
          .translate(sx, h0 * 0.85 + sh, sz),
        (x, y, z, o) => o.copy(cap)
      )
    );
  } else if (key === 'choir') {
    const body = C('#0f0d18'),
      top = C('#3a3158');
    const slab = (ox, oz, w, d, h, ry) => {
      const g = new T3.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ry);
      colorize(g, (x, y, z, o) => o.copy(y > h * 0.97 ? top : body));
      parts.push(g.translate(ox, 0, oz));
    };
    slab(-0.08, -0.06, 0.26, 0.24, 0.7 + r() * 0.35, r() * 0.5);
    slab(0.2, 0.12, 0.18, 0.2, 0.4 + r() * 0.25, r() * 0.6);
    slab(-0.2, 0.2, 0.14, 0.14, 0.25 + r() * 0.2, r() * 0.7);
    slab(0.14, -0.24, 0.12, 0.12, 0.5 + r() * 0.3, r() * 0.4);
  } else {
    const lo = C('#0d2c38'),
      mid = C('#1c5562'),
      top = C('#b3a276'),
      cor = C('#d85a30');
    const stack = (ox, oz, rb, rt, h) => {
      const g = jit(new T3.CylinderGeometry(rt, rb, h, 7, 5).translate(0, h / 2, 0), 0.34, h);
      colorize(g, (x, y, z, o) => {
        const t = y / h,
          k = hash(Math.round(x * 37) + seed, Math.round(z * 37) + Math.round(y * 23));
        if (t > 0.92) o.copy(top);
        else if (k > 0.86) o.copy(cor);
        else o.copy(lo).lerp(mid, t);
      });
      parts.push(g.translate(ox, 0, oz));
    };
    stack(0, 0, 0.36, 0.2, 0.6 + r() * 0.25);
    const an = r() * 6.28;
    stack(Math.cos(an) * 0.25, Math.sin(an) * 0.25, 0.16, 0.08, 0.35 + r() * 0.2);
    stack(-Math.sin(an) * 0.26, Math.cos(an) * 0.26, 0.12, 0.05, 0.22 + r() * 0.1);
  }
  const g = T3.BufferGeometryUtils.mergeBufferGeometries(parts);
  g.computeVertexNormals();
  return g;
}
function bioAssets(key) {
  const A = GL.A;
  let b = A.bio[key];
  if (b) return b;
  const S = BIO[key],
    St = o => new T3.MeshStandardMaterial(o),
    w = S.water;
  const plate = sub => {
    const p = mkGround(S, S.sd + sub * 7, sub),
      m = St({
        map: p.map,
        emissiveMap: p.emissiveMap,
        normalMap: p.normalMap,
        normalScale: new T3.Vector2(0.9, 0.9),
        roughnessMap: p.roughnessMap,
        roughness: 1,
        emissive: lin(S.em),
        emissiveIntensity: S.ei[sub],
        metalness: S.met[sub],
        envMapIntensity: S.env
      });
    m.onBeforeCompile = pulsePatch;
    return m;
  };
  b = A.bio[key] = {
    S,
    mPlain: [plate(0), plate(1)],
    mGrove: plate(2),
    mRidge: plate(3),
    mWater: St({
      color: lin(w.c),
      roughness: w.r,
      metalness: w.m,
      normalMap: A.waves,
      normalScale: new T3.Vector2(w.ns, w.ns),
      emissive: lin(w.e),
      emissiveIntensity: w.ei,
      envMapIntensity: 1
    }),
    gPeak: [S.sd + 1, S.sd + 2].map(s => mkPeakB(key, s)),
    mEdge: new T3.LineBasicMaterial({
      color: lin(S.edge[0], 1.4),
      transparent: true,
      opacity: S.edge[1]
    })
  };
  b.gPeakE = b.gPeak.map(g => new T3.EdgesGeometry(g, 22));
  b.mWater.onBeforeCompile = flowPatch;
  return b;
}
