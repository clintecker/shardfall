'use strict';
/*
 * Procedural textures. The game ships no image files: every surface is painted onto a canvas
 * at startup and uploaded as a texture.
 *
 * nrmFrom() derives a normal map from a height canvas; mkPlate() makes the panel-line armor and
 * ground plating; mkWindows() the lit windows of the megatowers; mkWaves() the ripple normals
 * for liquid; mkGlow() the soft sprite used for particles and halos.
 */
function nrmFrom(hc, k) {
  const n = hc.width,
    src = hc.getContext('2d').getImageData(0, 0, n, n).data,
    c = cvs(n),
    x = c.getContext('2d'),
    im = x.createImageData(n, n),
    H = (i, j) => src[(((j + n) % n) * n + ((i + n) % n)) * 4];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const dx = ((H(i + 1, j) - H(i - 1, j)) / 255) * k,
        dy = ((H(i, j + 1) - H(i, j - 1)) / 255) * k,
        l = Math.hypot(dx, dy, 1),
        o = (j * n + i) * 4;
      im.data[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      im.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      im.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      im.data[o + 3] = 255;
    }
  x.putImageData(im, 0, 0);
  return tex(c, 0);
}
function mkPlate(base, seed, kind) {
  const r = rng(seed),
    a = cvs(256),
    e = cvs(256),
    hc = cvs(256),
    rc = cvs(256),
    A = a.getContext('2d'),
    E = e.getContext('2d'),
    Hh = hc.getContext('2d'),
    R = rc.getContext('2d'),
    cl = v => Math.max(20, Math.min(236, v));
  const g = v => {
      v = Math.round(v * 255);
      return `rgb(${v},${v},${v})`;
    },
    line = (c, pts) => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
    };
  A.fillStyle = base;
  A.fillRect(0, 0, 256, 256);
  E.fillStyle = '#000';
  E.fillRect(0, 0, 256, 256);
  Hh.fillStyle = g(0.5);
  Hh.fillRect(0, 0, 256, 256);
  R.fillStyle = g(kind === 1 ? 0.8 : kind === 2 ? 0.5 : 0.62);
  R.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    const x = r() * 256,
      y = r() * 256,
      w = 1 + r() * 3,
      h = 1 + r() * 3,
      up = r() < 0.5,
      al = r();
    A.fillStyle = up ? `rgba(255,255,255,${al * 0.05})` : `rgba(0,0,24,${al * 0.09})`;
    A.fillRect(x, y, w, h);
    R.fillStyle = `rgba(${up ? '255,255,255' : '0,0,0'},${al * 0.14})`;
    R.fillRect(x, y, w, h);
    if (kind === 1) {
      Hh.fillStyle = `rgba(${up ? '255,255,255' : '0,0,0'},${al * 0.22})`;
      Hh.fillRect(x, y, w * 3, h * 3);
    }
  }
  E.strokeStyle = E.fillStyle = '#fff';
  for (const c of [A, E, Hh, R]) c.lineCap = c.lineJoin = 'round';
  if (kind === 1) {
    for (let i = 0; i < 14; i++) {
      const x = r() * 256,
        y = r() * 256,
        rad = 18 + r() * 40,
        gr = Hh.createRadialGradient(x, y, 0, x, y, rad),
        up = r() < 0.5;
      gr.addColorStop(0, `rgba(${up ? '255,255,255' : '0,0,0'},.4)`);
      gr.addColorStop(1, `rgba(${up ? '255,255,255' : '0,0,0'},0)`);
      Hh.fillStyle = gr;
      Hh.fillRect(x - rad, y - rad, rad * 2, rad * 2);
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
      A.strokeStyle = 'rgba(0,0,24,.4)';
      A.lineWidth = 1 + r() * 2;
      line(A, pts);
      Hh.strokeStyle = g(0.12);
      Hh.lineWidth = 2.5 + r() * 2;
      line(Hh, pts);
      if (i < 3) {
        E.globalAlpha = 0.55;
        E.lineWidth = 1.6;
        line(E, pts);
        R.strokeStyle = g(0.2);
        R.lineWidth = 3;
        line(R, pts);
      }
    }
  } else if (kind === 2) {
    E.globalAlpha = 0.22;
    E.lineWidth = 1;
    Hh.strokeStyle = g(0.3);
    Hh.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      const pv = [
          [i * 32, 0],
          [i * 32, 256]
        ],
        ph = [
          [0, i * 32],
          [256, i * 32]
        ];
      line(E, pv);
      line(E, ph);
      line(Hh, pv);
      line(Hh, ph);
    }
    for (let i = 0; i < 26; i++) {
      const x = ((r() * 8) | 0) * 32 + 4,
        y = ((r() * 8) | 0) * 32 + 4,
        v = r();
      E.globalAlpha = 0.12 + v * 0.5;
      E.fillRect(x, y, 24, 24);
      Hh.fillStyle = g(0.56 + v * 0.2);
      Hh.fillRect(x, y, 24, 24);
      R.fillStyle = g(0.3 + v * 0.3);
      R.fillRect(x, y, 24, 24);
    }
    E.globalAlpha = 0.8;
    E.lineWidth = 3;
    E.strokeRect(4, 4, 248, 248);
  } else {
    Hh.strokeStyle = g(0.34);
    Hh.lineWidth = 6;
    Hh.strokeRect(1, 1, 254, 254);
    A.lineWidth = 2;
    A.strokeStyle = 'rgba(0,0,24,.5)';
    A.strokeRect(9, 9, 238, 238);
    A.strokeStyle = 'rgba(255,255,255,.08)';
    A.strokeRect(11, 11, 238, 238);
    Hh.strokeStyle = g(0.2);
    Hh.lineWidth = 4;
    Hh.strokeRect(9, 9, 238, 238);
    for (let i = 0; i < 4; i++) {
      const x = (22 + r() * 110) | 0,
        y = (22 + r() * 110) | 0,
        w = (36 + r() * 86) | 0,
        h = (28 + r() * 76) | 0,
        up = r() < 0.5;
      A.fillStyle = up ? 'rgba(255,255,255,.04)' : 'rgba(0,0,30,.14)';
      A.fillRect(x, y, w, h);
      A.lineWidth = 1.5;
      A.strokeStyle = 'rgba(0,0,24,.4)';
      A.strokeRect(x, y, w, h);
      A.strokeStyle = 'rgba(255,255,255,.06)';
      A.strokeRect(x + 1.5, y + 1.5, w, h);
      Hh.fillStyle = g(up ? 0.62 : 0.4);
      Hh.fillRect(x, y, w, h);
      Hh.strokeStyle = g(0.22);
      Hh.lineWidth = 2.5;
      Hh.strokeRect(x, y, w, h);
      R.fillStyle = g(0.38 + r() * 0.45);
      R.fillRect(x, y, w, h);
    }
    for (const [x, y] of [
      [20, 20],
      [236, 20],
      [20, 236],
      [236, 236]
    ]) {
      A.fillStyle = 'rgba(0,0,24,.55)';
      A.beginPath();
      A.arc(x, y, 3.2, 0, 7);
      A.fill();
      Hh.fillStyle = g(0.92);
      Hh.beginPath();
      Hh.arc(x, y, 4.2, 0, 7);
      Hh.fill();
    }
    for (let i = 0; i < 5; i++) {
      let x = cl(r() * 256),
        y = cl(r() * 256);
      const pts = [[x, y]],
        al = 0.45 + r() * 0.55;
      for (let j = 0; j < 3; j++) {
        const d = (r() * 4) | 0,
          len = 18 + r() * 60;
        x = cl(x + [1, 0, -1, 0][d] * len);
        y = cl(y + [0, 1, 0, -1][d] * len);
        pts.push([x, y]);
      }
      Hh.strokeStyle = g(0.28);
      Hh.lineWidth = 6;
      line(Hh, pts);
      R.strokeStyle = g(0.18);
      R.lineWidth = 5;
      line(R, pts);
      E.globalAlpha = al;
      E.lineWidth = 2.2;
      line(E, pts);
      E.beginPath();
      E.arc(x, y, 4, 0, 7);
      E.fill();
    }
    E.globalAlpha = 0.3;
    E.lineWidth = 3;
    E.strokeRect(3, 3, 250, 250);
    for (let i = 0; i < 3; i++) {
      const x = 30 + r() * 196,
        y = 30 + r() * 196,
        rad = 26 + r() * 38,
        gr = R.createRadialGradient(x, y, rad * 0.35, x, y, rad);
      gr.addColorStop(0, 'rgba(0,0,0,.92)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      R.fillStyle = gr;
      R.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      const ga = A.createRadialGradient(x, y, 0, x, y, rad);
      ga.addColorStop(0, 'rgba(0,0,20,.22)');
      ga.addColorStop(1, 'rgba(0,0,20,0)');
      A.fillStyle = ga;
      A.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    R.strokeStyle = 'rgba(255,255,255,.22)';
    R.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = r() * 256,
        y = r() * 256;
      line(R, [
        [x, y],
        [x + (r() - 0.5) * 70, y + (r() - 0.5) * 70]
      ]);
    }
  }
  return {
    map: tex(a, 1),
    emissiveMap: tex(e, 1),
    normalMap: nrmFrom(hc, kind === 1 ? 3 : 2.4),
    roughnessMap: tex(rc, 0)
  };
}
function mkDetail() {
  const r = rng(404),
    hc = cvs(256),
    H = hc.getContext('2d'),
    g = v => {
      v = Math.round(v * 255);
      return `rgb(${v},${v},${v})`;
    };
  H.fillStyle = g(0.5);
  H.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    H.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.1})`;
    H.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  H.lineCap = 'round';
  H.strokeStyle = g(0.2);
  H.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    const v = r() < 0.5,
      q = 24 + r() * 208;
    H.beginPath();
    H.moveTo(v ? q : 0, v ? 0 : q);
    H.lineTo(v ? q : 256, v ? 256 : q);
    H.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = 20 + r() * 170,
      y = 20 + r() * 170;
    H.strokeRect(x, y, 30 + r() * 50, 24 + r() * 40);
  }
  H.fillStyle = g(0.85);
  for (let i = 0; i < 14; i++) {
    H.beginPath();
    H.arc(r() * 256, r() * 256, 2.2, 0, 7);
    H.fill();
  }
  H.strokeStyle = 'rgba(0,0,0,.25)';
  H.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const x = r() * 256,
      y = r() * 256;
    H.beginPath();
    H.moveTo(x, y);
    H.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
    H.stroke();
  }
  const t = nrmFrom(hc, 2);
  t.repeat.set(2, 2);
  return t;
}
function mkWindows(base, dens, seed, cols = 6, rows = 24) {
  const r = rng(seed),
    a = cvs(cols * 16, rows * 16),
    e = cvs(cols * 16, rows * 16),
    A = a.getContext('2d'),
    E = e.getContext('2d');
  A.fillStyle = base;
  A.fillRect(0, 0, cols * 16, rows * 16);
  E.fillStyle = '#000';
  E.fillRect(0, 0, cols * 16, rows * 16);
  for (let row = 0; row < rows; row++)
    for (let c = 0; c < cols; c++) {
      const x = c * 16 + 3,
        y = row * 16 + 4,
        lit = r() < dens,
        b = 0.35 + r() * 0.65;
      A.fillStyle = lit ? '#c4c4c4' : '#30303a';
      A.fillRect(x, y, 10, 9);
      if (lit) {
        E.fillStyle = `rgba(255,255,255,${b})`;
        E.fillRect(x, y, 10, 9);
      }
    }
  return { map: tex(a, 1), emissiveMap: tex(e, 1) };
}
function mkWaves() {
  const n = 128,
    c = cvs(n),
    x = c.getContext('2d'),
    im = x.createImageData(n, n),
    r = rng(5),
    w = [];
  for (let i = 0; i < 11; i++) {
    const kx = ((2 + r() * 8) | 0) * (r() < 0.5 ? -1 : 1),
      ky = ((2 + r() * 8) | 0) * (r() < 0.5 ? -1 : 1);
    w.push([kx, ky, r() * 6.28, ((0.5 + r()) * 3) / Math.hypot(kx, ky)]);
  }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let dx = 0,
        dy = 0;
      for (const [kx, ky, ph, am] of w) {
        const cc = Math.cos(((kx * i + ky * j) / n) * 6.2832 + ph) * am;
        dx += cc * kx;
        dy += cc * ky;
      }
      const nx = -dx * 0.07,
        ny = -dy * 0.07,
        l = Math.hypot(nx, ny, 1),
        o = (j * n + i) * 4;
      im.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
      im.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      im.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      im.data[o + 3] = 255;
    }
  x.putImageData(im, 0, 0);
  return tex(c, 0);
}
function mkGlow() {
  const c = cvs(64),
    x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return tex(c, 0);
}
