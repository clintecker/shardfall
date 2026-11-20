'use strict';
/*
 * The frame loop and everything that hangs off it: adaptive quality, the settings that map to
 * renderer features, hover picking, the minimap, and the 2D overlay drawn on top of the WebGL
 * canvas (health bars, damage forecasts, floating numbers, city labels).
 *
 * frame() runs on requestAnimationFrame. If frames stay slow it steps quality down by itself;
 * `window.__keepQuality = true` (used by the tests) turns that off.
 */
function noDepth() {
  const { composer, hdr } = GL;
  GL.depth = false;
  composer.reset(
    new T3.WebGLRenderTarget(4, 4, {
      type: hdr ? T3.HalfFloatType : T3.UnsignedByteType,
      samples: coarse ? 2 : 4
    })
  );
  composer.setPixelRatio(PR);
  composer.setSize(VW, VH);
  GL.fin.uniforms.uMode.value = 0;
}
function setQ(q) {
  GL.q = q;
  GL.bloom.enabled = q < 2;
  const s = q < 2 && !coarse ? 2048 : 1024,
    sh = GL.sun.shadow;
  if (sh.mapSize.x !== s) {
    sh.mapSize.set(s, s);
    if (sh.map) {
      sh.map.dispose();
      sh.map = null;
    }
  }
}
function applySet() {
  if (!GL) return;
  if (SET.quality === 'low') setQ(2);
  else if (SET.quality === 'high') setQ(0);
  if (GL.rainObj && GL.at) GL.rainObj.visible = SET.weather && !!PRECIP[GL.at.precip];
}
function focusOn(x, y) {
  if (!GL || !G) return;
  const o = G.N / 2 - 0.5,
    fd = fitDist();
  want.x = x - o;
  want.z = y - o;
  if (want.dist > fd * 0.8) want.dist = Math.max(8, fd * 0.55);
  clampView();
}
function fitView() {
  if (!GL || !G) return;
  want.x = want.z = 0;
  want.pitch = 0.86;
  want.dist = fitDist();
}
let hoverPt = null,
  hoverKey = '';
function updateHover() {
  const tip = $('#tip'),
    t = hoverPt && !drag && !busy && !G.over ? pickTile(hoverPt.x, hoverPt.y) : null;
  if (!t) {
    if (W3.hover) {
      W3.hover = null;
      tip.hidden = true;
      cv.style.cursor = '';
      hoverKey = '';
    }
    return;
  }
  W3.hover = t;
  const k = t[0] + ',' + t[1] + '|' + (sel ? sel.kind + (sel.id ?? '') : '') + '|' + G.turn,
    r = cv.getBoundingClientRect(),
    x = hoverPt.x - r.left,
    y = hoverPt.y - r.top;
  if (k !== hoverKey) {
    hoverKey = k;
    tip.innerHTML = tipHTML(t[0], t[1]);
    const u = unitAt(t[0], t[1]),
      ki = idx(t[0], t[1]);
    cv.style.cursor =
      (moves && moves.has(ki)) ||
      (atks && u && atks.includes(u)) ||
      (u && u.owner === 0) ||
      cityAt(t[0], t[1])
        ? 'pointer'
        : '';
  }
  tip.hidden = false;
  tip.style.left = Math.min(x + 16, VW - 258) + 'px';
  tip.style.top = (y > VH - 150 ? y - tip.offsetHeight - 12 : y + 20) + 'px';
}
const mini = $('#mini'),
  mx = mini.getContext('2d'),
  MINIC = {
    helion: ['#8a6426', '#b8902e', '#5a3a1c', '#ff8a1a'],
    verdant: ['#1f5a40', '#2f8a5c', '#123a2a', '#19e08a'],
    choir: ['#221e3c', '#3d2c62', '#0b0912', '#b03ad0'],
    tide: ['#1f6a78', '#2f9a9a', '#123f4c', '#19c8e0']
  };
let miniT = 0;
function drawMini(now) {
  if (now - miniT < 110) return;
  miniT = now;
  const N = G.N,
    S = mini.clientWidth,
    d = Math.min(window.devicePixelRatio || 1, 2);
  if (!S) return;
  if (mini.width !== Math.round(S * d)) mini.width = mini.height = Math.round(S * d);
  mx.setTransform(d, 0, 0, d, 0, 0);
  mx.clearRect(0, 0, S, S);
  const c = S / N;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y),
        t = G.tiles[k];
      if (!W3.seen[k]) {
        mx.fillStyle = '#0d1026';
        mx.fillRect(x * c, y * c, c - 0.6, c - 0.6);
        continue;
      }
      mx.fillStyle =
        MINIC[G.factions[t.b || 0].key][
          t.t === PLAIN ? 0 : t.t === GROVE ? 1 : t.t === RIDGE ? 2 : 3
        ];
      mx.fillRect(x * c, y * c, c - 0.6, c - 0.6);
      const of = tileFaction(t);
      if (of >= 0) {
        mx.globalAlpha = 0.42;
        mx.fillStyle = cult(of).color;
        mx.fillRect(x * c, y * c, c - 0.6, c - 0.6);
        mx.globalAlpha = 1;
      }
    }
  for (const ct of G.cities) {
    if (!W3.seen[idx(ct.x, ct.y)]) continue;
    mx.fillStyle = '#070916';
    mx.fillRect(ct.x * c + c * 0.1, ct.y * c + c * 0.1, c * 0.8, c * 0.8);
    mx.fillStyle = ct.owner >= 0 ? cult(ct.owner).color : '#aab0cc';
    mx.fillRect(ct.x * c + c * 0.24, ct.y * c + c * 0.24, c * 0.52, c * 0.52);
  }
  for (const u of G.units) {
    if (!W3.seen[idx(u.x, u.y)]) continue;
    mx.beginPath();
    mx.arc(u.x * c + c / 2, u.y * c + c / 2, c * 0.3, 0, 7);
    mx.fillStyle = cult(u.owner).color;
    mx.fill();
    mx.lineWidth = 1;
    mx.strokeStyle = u.owner === 0 ? '#fff' : '#070916';
    mx.stroke();
  }
  const P = [];
  for (const [nx, ny] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ]) {
    RC.setFromCamera({ x: nx, y: ny }, GL.camera);
    const h = RC.ray.intersectPlane(GROUND, _d);
    if (!h) {
      P.length = 0;
      break;
    }
    P.push([(h.x + N / 2) * c, (h.z + N / 2) * c]);
  }
  mx.strokeStyle = 'rgba(255,255,255,.85)';
  mx.lineWidth = 1.2;
  mx.beginPath();
  if (P.length === 4) {
    mx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < 4; i++) mx.lineTo(P[i][0], P[i][1]);
    mx.closePath();
  } else {
    const x = (view.x + N / 2) * c,
      y = (view.z + N / 2) * c;
    mx.moveTo(x - 5, y);
    mx.lineTo(x + 5, y);
    mx.moveTo(x, y - 5);
    mx.lineTo(x, y + 5);
  }
  mx.stroke();
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!G || !GL || !W3 || gameEl.hidden || !size()) return;
  const raw = (now - lastT) / 1000 || 0,
    dt = Math.min(0.05, raw);
  lastT = now;
  TIME.value = now / 1000;
  if (SET.quality === 'auto' && !window.__keepQuality && GL.q < 2 && raw < 0.5) {
    slow = raw > 0.034 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 70) {
      slow = 0;
      setQ(GL.q + 1);
    }
  }
  if (G.over && !W3.overSeen) {
    W3.overSeen = true;
    want.x = want.z = 0;
    want.pitch = 0.8;
    want.dist = fitDist();
    GL.glideT = 2.6;
  }
  if (rotVel) want.yaw += rotVel * dt;
  if (KEYS.size) {
    let kx = 0,
      ky = 0;
    for (const k of KEYS) {
      kx += PAN[k][0];
      ky += PAN[k][1];
    }
    const sp = view.dist * 0.9 * dt,
      cy = Math.cos(view.yaw),
      sy = Math.sin(view.yaw);
    want.x += (cy * kx - sy * ky) * sp;
    want.z += (-sy * kx - cy * ky) * sp;
    clampView();
  }
  if (snapCam) GL.glideT = 0;
  const k = reduce || snapCam ? 1 : 1 - Math.exp(-dt * (GL.glideT > 0 ? 2.2 : 10));
  if (GL.glideT > 0) GL.glideT -= dt;
  for (const key of ['yaw', 'pitch', 'dist', 'x', 'z']) view[key] += (want[key] - view[key]) * k;
  const cam = GL.camera;
  placeCam(cam, view);
  if (GL.shake > 0.002) {
    if (!reduce) {
      cam.position.x += (Math.random() - 0.5) * GL.shake;
      cam.position.y += (Math.random() - 0.5) * GL.shake;
      cam.updateMatrixWorld();
    }
    GL.shake *= Math.exp(-dt * 10);
  }
  updateHover();
  syncWorld(now, dt);
  stepAction(now, dt);
  stepParticles(dt);
  stepBeams(dt);
  const U = GL.fin.uniforms;
  _d.set(view.x, 0, view.z);
  const F = GL.depth
    ? -_d.applyMatrix4(_m.copy(cam.matrixWorld).invert()).z
    : cam.position.distanceTo(_d);
  U.uTime.value = TIME.value % 97;
  U.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
  U.uInvP.value.copy(cam.projectionMatrixInverse);
  U.uCam.value.copy(cam.position);
  U.uFocus.value = F;
  U.uHalf.value = G.N / 2 + 0.35;
  U.uDead.value = 0.12 + 0.33 * clamp((F - 7) / 12, 0, 1);
  U.uDof.value = GL.q || !SET.dof ? 0 : (15 * VH * PR) / 1000;
  U.uStreak.value = GL.bloom.enabled ? 0.05 : 0;
  U.uAo.value = GL.q || !SET.ao || !GL.depth || coarse ? 0 : 1.2;
  U.uAoR.value = 0.34 * cam.projectionMatrix.elements[5] * 0.5;
  U.uAsp.value = VW / VH;
  const A = GL.A;
  A.waves.offset.set(now * 0.00005, now * 0.000035);
  A.mFog.emissiveIntensity = reduce ? 0.55 : 0.45 + 0.18 * Math.sin(now / 900);
  if (GL.traffic) {
    const { tm, cars } = GL.traffic;
    cars.forEach((c, i) => {
      c.p += c.v * dt;
      if (c.p > 180) c.p -= 360;
      if (c.p < -180) c.p += 360;
      _m.compose(
        _p.set(c.ax ? c.p : c.lane, c.y, c.ax ? c.lane : c.p),
        _q.setFromEuler(_e.set(0, c.ax ? 0 : Math.PI / 2, 0)),
        _s.set(1, 1, 1)
      );
      tm.setMatrixAt(i, _m);
    });
    tm.instanceMatrix.needsUpdate = true;
  }
  for (const n of Object.values(NUM))
    if (n.cur !== n.tgt && n.cur !== null) {
      const d = n.tgt - n.cur;
      n.cur += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * 0.16));
      n.el.textContent = n.cur;
    }
  if (!GL.checked) {
    const gl = GL.renderer.getContext();
    while (gl.getError());
    GL.composer.render(dt);
    GL.checked = true;
    if (GL.depth && gl.getError()) noDepth();
  } else GL.composer.render(dt);
  if (W3.veil) {
    W3.veil = false;
    $('#veil').classList.add('off');
  }
  if (W3.banner) {
    showBanner(W3.banner[0], W3.banner[1]);
    W3.banner = null;
  }
  drawHud(now);
  drawMini(now);
}
function drawHud(now) {
  const N = G.N,
    o = N / 2 - 0.5,
    cam = GL.camera;
  hx.setTransform(PR, 0, 0, PR, 0, 0);
  hx.clearRect(0, 0, VW, VH);
  const proj = (x, y, z) => {
    _p.set(x, y, z).project(cam);
    return _p.z < 1 && _p.z > -1 ? [(_p.x * 0.5 + 0.5) * VW, (-_p.y * 0.5 + 0.5) * VH] : null;
  };
  hx.textBaseline = 'middle';
  for (const c of G.cities) {
    const co = W3.cities.get(c.id);
    if (!co || !co.g) continue;
    const s = proj(c.x - o, 0, c.y - o);
    if (!s) continue;
    const col = c.owner >= 0 ? cult(c.owner).color : '#aab0cc',
      named = view.dist < 20,
      sy = s[1] + 10 + 300 / view.dist;
    hx.font = "600 11px 'Chakra Petch',sans-serif";
    const tw = named ? hx.measureText(c.name.toUpperCase()).width + 9 : 0,
      bw = 18 + tw,
      bx = s[0] - bw / 2;
    hx.fillStyle = 'rgba(8,10,26,.86)';
    hx.beginPath();
    hx.moveTo(bx + 5, sy - 9);
    hx.lineTo(bx + bw, sy - 9);
    hx.lineTo(bx + bw, sy + 4);
    hx.lineTo(bx + bw - 5, sy + 9);
    hx.lineTo(bx, sy + 9);
    hx.lineTo(bx, sy - 4);
    hx.closePath();
    hx.fill();
    hx.strokeStyle = col;
    hx.lineWidth = 1;
    hx.stroke();
    hx.fillStyle = col;
    hx.fillRect(bx + 3, sy - 6, 12, 12);
    hx.fillStyle = INK;
    hx.textAlign = 'center';
    hx.fillText(c.level, bx + 9, sy + 0.5);
    if (named) {
      hx.fillStyle = '#e8ebf7';
      hx.textAlign = 'left';
      hx.fillText(c.name.toUpperCase(), bx + 20, sy + 0.5);
    }
    if (c.owner === 0 && named) {
      hx.fillStyle = 'rgba(8,10,26,.86)';
      hx.fillRect(bx, sy + 11, bw, 5);
      hx.fillStyle = col;
      hx.fillRect(bx + 1, sy + 12, ((bw - 2) * c.pop) / (c.level + 1), 3);
    }
  }
  for (const ob of W3.units.values()) {
    if (!ob.g.visible || ob.dead) continue;
    const u = ob.u,
      U = UT[u.type],
      p = ob.g.position,
      s = proj(p.x, p.y + RIG[u.type].h, p.z);
    if (!s) continue;
    const w = clamp(400 / view.dist, 22, 48),
      h = Math.max(4, w * 0.14),
      x = s[0] - w / 2,
      y = s[1] - h,
      fr = Math.max(0, u.hp / U.hp),
      fs = clamp(ob.hpS / U.hp, 0, 1);
    hx.fillStyle = 'rgba(8,10,24,.88)';
    hx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    if (fs > fr) {
      hx.fillStyle = '#ffffff';
      hx.fillRect(x, y, w * fs, h);
    }
    hx.fillStyle = fr > 0.5 ? '#5fe0a0' : fr > 0.25 ? '#ffb347' : '#ff5d73';
    hx.fillRect(x, y, w * Math.min(fr, fs), h);
    hx.fillStyle = 'rgba(8,10,24,.88)';
    for (let i = 2; i < U.hp; i += 2) hx.fillRect(x + (w * i) / U.hp - 0.5, y, 1, h);
    hx.fillStyle = cult(u.owner).color;
    hx.fillRect(x - 1.5, y + h + 2.5, w + 3, 1.5);
  }
  const au =
    sel &&
    sel.kind === 'unit' &&
    atks &&
    atks.length &&
    !busy &&
    G.units.find(u => u.id === sel.id);
  if (au)
    for (const t of atks) {
      const ob = W3.units.get(t.id);
      if (!ob || !ob.g.visible) continue;
      const p = ob.g.position,
        s = proj(p.x, p.y + RIG[t.type].h + 0.26, p.z);
      if (!s) continue;
      const f = forecast(au, t),
        txt = f.kill ? 'DESTROY' : '−' + f.dmg,
        sub = f.kill ? '' : f.ret ? 'takes −' + f.ret : 'no counter';
      hx.font = "700 13px 'Chakra Petch',sans-serif";
      let w = hx.measureText(txt).width;
      hx.font = "600 10px 'Chakra Petch',sans-serif";
      if (sub) w = Math.max(w, hx.measureText(sub).width);
      w += 16;
      const hgt = sub ? 33 : 21,
        x = s[0] - w / 2,
        y = s[1] - hgt - 3;
      hx.fillStyle = 'rgba(44,6,16,.92)';
      hx.fillRect(x, y, w, hgt);
      hx.strokeStyle = '#ff5d73';
      hx.lineWidth = 1;
      hx.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1);
      hx.textAlign = 'center';
      hx.font = "700 13px 'Chakra Petch',sans-serif";
      hx.fillStyle = '#ffa3b0';
      hx.fillText(txt, s[0], y + 11);
      if (sub) {
        hx.font = "600 10px 'Chakra Petch',sans-serif";
        hx.fillStyle = f.ret ? '#ffb347' : '#9fc6e6';
        hx.fillText(sub, s[0], y + 24.5);
      }
    }
  for (const f of fx) {
    if (f.kind || !W3.seen[idx(f.x, f.y)]) continue;
    const s = proj(f.x - o, 0.95, f.y - o);
    if (!s) continue;
    const a = (now - f.t) / 950;
    hx.globalAlpha = Math.max(0, 1 - a * a);
    hx.font = `700 ${clamp(300 / view.dist, 15, 30)}px 'Chakra Petch',sans-serif`;
    hx.textAlign = 'center';
    const tx = clamp(s[0], 36, VW - 36),
      ty = s[1] - a * 34;
    hx.lineWidth = 4;
    hx.lineJoin = 'round';
    hx.strokeStyle = INK;
    hx.strokeText(f.text, tx, ty);
    hx.fillStyle = f.color;
    hx.fillText(f.text, tx, ty);
    hx.globalAlpha = 1;
  }
}
