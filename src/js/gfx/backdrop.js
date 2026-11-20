'use strict';
/*
 * The city the board floats above: megatowers with holographic signs, rings of air traffic,
 * dogfights between squadrons in the cultures' colors, searchlights, and lightning.
 * All of it is decoration: it never reads or changes the game state.
 */
function mkAction() {
  const { scene, A } = GL,
    r = rng(77),
    Bm = o => new T3.MeshBasicMaterial(o),
    pal = ['#27e0ff', '#ff3fd0', '#ffb347', '#b9c4ff'],
    AC = (GL.AC = { tw: [], air: [], duels: [], tr: [], sl: [], fp: FPOS.value });
  const IMs = (g, m, n) => {
      const x = new T3.InstancedMesh(g, m, n);
      x.frustumCulled = false;
      scene.add(x);
      return x;
    },
    add = { transparent: true, blending: T3.AdditiveBlending, depthWrite: false };
  {
    const n = 1700,
      ps = new Float32Array(n * 3),
      cl = new Float32Array(n * 3),
      sd = new Float32Array(n),
      g = new T3.BufferGeometry();
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283,
        d = 22 + Math.pow(r(), 0.7) * 260,
        c = lin(pal[(r() * 4) | 0], 1.2 + r() * 2.2);
      ps.set([Math.cos(a) * d, -45.5 + r() * r() * 22, Math.sin(a) * d], i * 3);
      cl.set([c.r, c.g, c.b], i * 3);
      sd[i] = r();
    }
    g.setAttribute('position', new T3.BufferAttribute(ps, 3));
    g.setAttribute('aCol', new T3.BufferAttribute(cl, 3));
    g.setAttribute('aSeed', new T3.BufferAttribute(sd, 1));
    const pts = (AC.pts = new T3.Points(
      g,
      new T3.ShaderMaterial(
        Object.assign(
          {
            uniforms: { uTime: TIME, uScale: GL.pm.uniforms.uScale, uI: { value: 1 } },
            vertexShader: `attribute vec3 aCol;attribute float aSeed;uniform float uTime,uScale,uI;varying vec3 vC;void main(){vC=aCol*uI*(.55+.45*sin(uTime*(1.+aSeed*3.)+aSeed*40.));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.5,(.45+aSeed*.8)*uScale/-mv.z);gl_Position=projectionMatrix*mv;}`,
            fragmentShader:
              'varying vec3 vC;void main(){float a=smoothstep(.5,0.,length(gl_PointCoord-.5));gl_FragColor=vec4(vC*a*a,1.);}'
          },
          add
        )
      )
    ));
    pts.frustumCulled = false;
    scene.add(pts);
  }
  const nT = 8,
    box = new T3.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const tb = IMs(box, Bm({ map: GL.cityTex }), nT),
    ant = IMs(box, Bm({ color: lin('#0a0c1c') }), nT),
    bea = IMs(A.gSph, Bm({ color: 0xffffff }), nT);
  const sg = IMs(
    new T3.PlaneGeometry(1, 1),
    new T3.ShaderMaterial(
      Object.assign(
        {
          uniforms: { uTime: TIME },
          vertexShader: VS_SIGN,
          fragmentShader: FS_SIGN,
          side: T3.DoubleSide
        },
        add
      )
    ),
    nT * 2
  );
  sg.renderOrder = 1;
  AC.bea = bea;
  for (let i = 0; i < nT; i++) {
    const a = (i / nT) * 6.283 + r() * 0.5,
      d = 25 + r() * 16,
      w = 3 + r() * 2.6,
      top = -11 + r() * r() * 9,
      x = Math.cos(a) * d,
      z = Math.sin(a) * d,
      ry = Math.atan2(-x, -z),
      ah = 3 + r() * 4;
    _m.compose(_p.set(x, -46, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(w, top + 46, w));
    tb.setMatrixAt(i, _m);
    tb.setColorAt(i, _c.copy(lin(pal[(r() * 4) | 0])).multiplyScalar(1.1 + r()));
    _m.compose(_p.set(x, top, z), _q.identity(), _s.set(0.14, ah, 0.14));
    ant.setMatrixAt(i, _m);
    _m.compose(_p.set(x, top + ah, z), _q.identity(), _s.set(0.2, 0.2, 0.2));
    bea.setMatrixAt(i, _m);
    bea.setColorAt(i, _c.setRGB(4, 0.3, 0.3));
    for (let j = 0; j < 2; j++) {
      const sh = 7 + r() * 6,
        sw = w * (0.55 + r() * 0.25),
        yy = top - sh / 2 - 1 - r() * 5,
        an = ry + (j * Math.PI) / 2,
        ox = Math.sin(an) * (w / 2 + 0.08),
        oz = Math.cos(an) * (w / 2 + 0.08);
      _m.compose(_p.set(x + ox, yy, z + oz), _q.setFromEuler(_e.set(0, an, 0)), _s.set(sw, sh, 1));
      sg.setMatrixAt(i * 2 + j, _m);
      sg.setColorAt(i * 2 + j, _c.copy(lin(pal[(i + j) % 3])).multiplyScalar(1.5 + r() * 0.8));
    }
    AC.tw.push({ ph: r() * 6 });
  }
  if (reduce) return;
  const nA = 66;
  AC.airIM = IMs(new T3.BoxGeometry(1, 0.07, 0.11), Bm({ color: 0xffffff }), nA);
  for (let i = 0; i < nA; i++) {
    const lead = i % 3 === 0 ? null : AC.air[i - (i % 3)];
    AC.air.push(
      lead
        ? {
            r: lead.r,
            y: lead.y,
            a: lead.a - (((i % 3) * 1.6) / lead.r) * Math.sign(lead.w),
            w: lead.w
          }
        : {
            r: 13.5 + r() * 30,
            y: -12 + r() * 15,
            a: r() * 6.283,
            w: (r() < 0.5 ? -1 : 1) * (3 + r() * 6)
          }
    );
    AC.airIM.setColorAt(
      i,
      lead
        ? AC.airIM.getColorAt(i - (i % 3), _c) || _c
        : _c.copy(lin(pal[(r() * 4) | 0])).multiplyScalar(2.6)
    );
  }
  const nD = 5,
    fg = T3.BufferGeometryUtils.mergeBufferGeometries([
      new T3.ConeGeometry(0.13, 0.62, 5).rotateX(Math.PI / 2).scale(1, 0.5, 1),
      new T3.BoxGeometry(0.7, 0.025, 0.2).translate(0, 0, -0.12)
    ]);
  AC.ship = IMs(
    fg,
    new T3.MeshStandardMaterial({ color: lin('#2a3160'), metalness: 0.8, roughness: 0.35 }),
    nD * 2
  );
  AC.eng = IMs(A.gSph, Bm({ color: 0xffffff }), nD * 2);
  AC.trIM = IMs(new T3.BoxGeometry(0.05, 0.05, 0.9), Bm({ color: 0xffffff }), 48);
  AC.trIM.count = 0;
  for (let i = 0; i < nD; i++)
    AC.duels.push({
      R0: 14.5 + r() * 13,
      dR: 2 + r() * 4,
      y0: -5 + r() * 9,
      dy: 1.5 + r() * 3,
      w: (r() < 0.5 ? -1 : 1) * (0.34 + r() * 0.3),
      p1: r() * 6.3,
      p2: r() * 6.3,
      p3: r() * 6.3,
      lag: 0.38 + r() * 0.2,
      fa: i,
      fb: i + 1,
      fire: 1500 + r() * 4000,
      fend: 0,
      next: 0,
      kill: false,
      dead: 0
    });
  AC.booms = [0, 1, 2].map(() => {
    const sp = new T3.Sprite(
      new T3.SpriteMaterial({
        map: A.glow,
        blending: T3.AdditiveBlending,
        depthWrite: false,
        fog: false,
        transparent: true
      })
    );
    sp.visible = false;
    scene.add(sp);
    return { sp, t: 1 };
  });
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.283,
      d = 55 + r() * 60,
      m = new T3.Mesh(
        new T3.CylinderGeometry(5.5, 0.4, 75, 16, 1, true).translate(0, 37.5, 0),
        A.beam(pal[i % 3], 0.16, 1)
      );
    m.position.set(Math.cos(a) * d, -46, Math.sin(a) * d);
    m.renderOrder = 1;
    scene.add(m);
    AC.sl.push({ m, ph: r() * 6, sp: 0.15 + r() * 0.2 });
  }
  const bg = new T3.BufferGeometry();
  bg.setAttribute('position', new T3.BufferAttribute(new Float32Array(26 * 6), 3));
  AC.bolt = new T3.LineSegments(
    bg,
    new T3.LineBasicMaterial(Object.assign({ color: lin('#cfe4ff', 4), fog: false }, add))
  );
  AC.bolt.frustumCulled = false;
  AC.bolt.visible = false;
  scene.add(AC.bolt);
  AC.nextBolt = performance.now() + 4000;
  AC.boltT = -1e9;
  AC.v1 = new T3.Vector3();
  AC.v2 = new T3.Vector3();
  AC.v3 = new T3.Vector3();
  AC.vl = new T3.Vector3();
  AC.vc = new T3.Vector3();
  AC.white = lin('#ffffff', 3);
  AC.orange = lin('#ffb347', 3);
}
function boom(p, c) {
  const AC = GL.AC;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 6.283,
      e = Math.acos(Math.random() * 2 - 1),
      sp = 2 + Math.random() * 6;
    spark(
      p.x,
      p.y,
      p.z,
      Math.sin(e) * Math.cos(a) * sp,
      Math.cos(e) * sp,
      Math.sin(e) * Math.sin(a) * sp,
      0.45 + Math.random() * 0.7,
      0.26 + Math.random() * 0.3,
      i % 3 === 0 ? AC.white : i % 3 === 1 ? AC.orange : c,
      2
    );
  }
  const b = AC.booms.find(b => b.t >= 1) || AC.booms[0];
  b.t = 0;
  b.sp.position.copy(p);
  b.sp.material.color.copy(c).multiplyScalar(0.6);
  b.sp.visible = true;
}
function stepAction(now, dt) {
  const AC = GL.AC,
    ts = now / 1000;
  if (!AC) return;
  AC.tw.forEach((t, i) =>
    AC.bea.setColorAt(
      i,
      _c
        .setRGB(1, 0.08, 0.08)
        .multiplyScalar(reduce ? 2 : Math.sin(ts * 2.2 + t.ph) > 0.55 ? 5 : 0.25)
    )
  );
  AC.bea.instanceColor.needsUpdate = true;
  if (!AC.airIM) return;
  AC.air.forEach((c, i) => {
    c.a += (c.w / c.r) * dt;
    _m.compose(
      _p.set(Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r),
      _q.setFromEuler(_e.set(0, -c.a - Math.PI / 2, 0)),
      _s.set(1, 1, 1)
    );
    AC.airIM.setMatrixAt(i, _m);
  });
  AC.airIM.instanceMatrix.needsUpdate = true;
  AC.sl.forEach(s =>
    s.m.rotation.set(Math.sin(ts * s.sp + s.ph) * 0.5, 0, Math.cos(ts * s.sp * 0.8 + s.ph) * 0.5)
  );
  const fc = W3.fc,
    nf = fc.length,
    { v1, v2, v3, vl, vc } = AC;
  let si = 0;
  const dp = (d, s, out) => {
    const th = d.w * s + d.p1,
      R = d.R0 + d.dR * Math.sin(1.7 * d.w * s + d.p2);
    return out.set(
      Math.cos(th) * R,
      d.y0 + d.dy * Math.sin(2.3 * d.w * s + d.p3),
      Math.sin(th) * R
    );
  };
  for (const d of AC.duels) {
    const ca = fc[d.fa % nf],
      cb = fc[d.fb % nf];
    for (let j = 0; j < 2; j++) {
      const s = ts - j * d.lag;
      dp(d, s, v1);
      dp(d, s + 0.03, v2);
      v3.subVectors(v2, v1).normalize();
      const dead = j === 0 && now < d.dead,
        sc = dead ? 0.001 : j === 0 ? clamp((now - d.dead) / 400, 0.001, 1) : 1;
      _m.lookAt(v2, v1, UP);
      _m.setPosition(v1);
      _m.scale(_s.set(sc, sc, sc));
      AC.ship.setMatrixAt(si, _m);
      _m.compose(_p.copy(v1).addScaledVector(v3, -0.34), _q.identity(), _s.setScalar(0.07 * sc));
      AC.eng.setMatrixAt(si, _m);
      AC.eng.setColorAt(si, j ? cb : ca);
      if (!dead && Math.random() < 0.5)
        spark(_p.x, _p.y, _p.z, 0, 0, 0, 0.28, 0.14, j ? cb : ca, 0);
      (j ? vc : vl).copy(v1);
      si++;
    }
    if (now > d.fire) {
      d.fend = now + 450 + Math.random() * 450;
      d.fire = now + 2300 + Math.random() * 2800;
      d.kill = Math.random() < 0.4;
    }
    if (now < d.fend && now > d.next && now >= d.dead && AC.tr.length < 48) {
      d.next = now + 80;
      v3.subVectors(vl, vc).normalize();
      AC.tr.push({
        p: vc.clone().addScaledVector(v3, 0.5),
        v: v3.clone().multiplyScalar(44),
        life: 0.5,
        c: cb
      });
    }
    if (d.kill && d.fend > 0 && now >= d.fend && now >= d.dead) {
      d.kill = false;
      boom(vl, ca);
      d.dead = now + 1700;
    }
  }
  AC.ship.instanceMatrix.needsUpdate = AC.eng.instanceMatrix.needsUpdate = true;
  if (AC.eng.instanceColor) AC.eng.instanceColor.needsUpdate = true;
  for (let i = AC.tr.length - 1; i >= 0; i--) {
    const t = AC.tr[i];
    t.life -= dt;
    if (t.life <= 0) {
      AC.tr.splice(i, 1);
      continue;
    }
    t.p.addScaledVector(t.v, dt);
  }
  AC.tr.forEach((t, i) => {
    v2.copy(t.p).add(t.v);
    _m.lookAt(v2, t.p, UP);
    _m.setPosition(t.p);
    AC.trIM.setMatrixAt(i, _m);
    AC.trIM.setColorAt(i, t.c);
  });
  AC.trIM.count = AC.tr.length;
  AC.trIM.instanceMatrix.needsUpdate = true;
  if (AC.trIM.instanceColor) AC.trIM.instanceColor.needsUpdate = true;
  for (const b of AC.booms) {
    if (b.t >= 1) continue;
    b.t += dt / 0.42;
    if (b.t >= 1) {
      b.sp.visible = false;
      continue;
    }
    const s = 2 + b.t * 9;
    b.sp.scale.set(s, s, 1);
    b.sp.material.opacity = (1 - b.t) * (1 - b.t);
  }
  if (GL.at.bolt && now > AC.nextBolt) {
    AC.nextBolt = now + 5000 + Math.random() * 7000;
    AC.boltT = now;
    const a = Math.random() * 6.283,
      d = 28 + Math.random() * 50,
      P = AC.bolt.geometry.attributes.position;
    let x = Math.cos(a) * d,
      y = -7,
      z = Math.sin(a) * d;
    AC.fp.set(x, -12, z);
    for (let i = 0; i < 26; i++) {
      const nx = x + (Math.random() - 0.5) * 3.2,
        ny = y - 1.1 - Math.random() * 0.8,
        nz = z + (Math.random() - 0.5) * 3.2;
      P.setXYZ(i * 2, x, y, z);
      P.setXYZ(i * 2 + 1, nx, ny, nz);
      x = nx;
      y = ny;
      z = nz;
    }
    P.needsUpdate = true;
  }
  const e = (now - AC.boltT) / 1000,
    fl = e < 0.5 ? (e < 0.07 ? 1 : e < 0.13 ? 0.25 : e < 0.2 ? 0.85 : 1 - (e - 0.2) / 0.3) : 0;
  AC.bolt.visible = e < 0.2 && (e < 0.07 || e > 0.13);
  FLASH.value = fl;
  GL.hemi.intensity = GL.at.hemi[2] + fl * 0.3;
}
