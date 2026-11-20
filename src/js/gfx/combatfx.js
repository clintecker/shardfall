'use strict';
/*
 * Combat effects, all pooled: beam and bolt shots (shoot), point-light flashes (flash),
 * explosions (burst) and the light column that marks a captured city or a newly trained
 * unit (column).
 */
function mkPools() {
  const b = [];
  for (let i = 0; i < 12; i++) {
    const m = new T3.Mesh(
      GL.A.gBeam,
      new T3.MeshBasicMaterial({
        transparent: true,
        blending: T3.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: T3.DoubleSide
      })
    );
    m.visible = false;
    m.renderOrder = 4;
    GL.scene.add(m);
    b.push({
      m,
      t: 0,
      life: 0,
      c: new T3.Color(),
      r: 0,
      a: new T3.Vector3(),
      d: new T3.Vector3(),
      bolt: false,
      done: null
    });
  }
  GL.beams = b;
  GL.flash = [0, 1].map(() => {
    const l = new T3.PointLight(0xffffff, 0, 5, 2);
    GL.scene.add(l);
    return { l, t: 1, life: 1, pow: 0 };
  });
  GL.selLight = new T3.PointLight(lin('#dff6ff'), 0, 2.8, 2);
  GL.scene.add(GL.selLight);
  GL.shake = 0;
}
function flash(x, y, z, hex, pow, life) {
  const f = GL.flash.find(f => f.t >= f.life) || GL.flash[0];
  f.l.position.set(x, y, z);
  f.l.color.copy(lin(hex));
  f.pow = pow;
  f.t = 0;
  f.life = life;
}
function shoot(x1, y1, z1, x2, y2, z2, hex, rad, life, bolt, done) {
  const b = GL.beams.find(b => !b.m.visible) || GL.beams[0];
  b.a.set(x1, y1, z1);
  b.d.set(x2 - x1, y2 - y1, z2 - z1);
  const len = b.d.length() || 0.01;
  b.d.multiplyScalar(1 / len);
  b.m.quaternion.setFromUnitVectors(UP, b.d);
  b.len = len;
  b.r = rad;
  b.t = 0;
  b.life = life;
  b.c.copy(lin(hex, bolt ? 4.5 : 3));
  b.bolt = !!bolt;
  b.done = done || null;
  b.m.scale.set(0.001, 0.001, 0.001);
  b.m.visible = true;
}
function stepBeams(dt) {
  for (const b of GL.beams) {
    if (!b.m.visible) continue;
    b.t += dt;
    const k = b.t / b.life;
    if (k >= 1) {
      b.m.visible = false;
      if (b.done) {
        const f = b.done;
        b.done = null;
        f();
      }
      continue;
    }
    if (b.bolt) {
      const k0 = Math.max(0, k - 0.38);
      b.m.position.copy(b.a).addScaledVector(b.d, ((k0 + k) / 2) * b.len);
      b.m.scale.set(b.r, Math.max(0.02, (k - k0) * b.len), b.r);
      b.m.material.color.copy(b.c);
      if (!reduce && Math.random() < 0.7) {
        _p.copy(b.a).addScaledVector(b.d, k * b.len);
        spark(
          _p.x,
          _p.y,
          _p.z,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          0.25,
          0.05,
          b.c,
          0
        );
      }
    } else {
      const f = Math.pow(1 - k, 1.5);
      b.m.position.copy(b.a).addScaledVector(b.d, b.len / 2);
      b.m.material.color.copy(b.c).multiplyScalar(f);
      b.m.scale.set(b.r * (0.4 + 0.6 * f), b.len, b.r * (0.4 + 0.6 * f));
    }
  }
  for (const f of GL.flash) {
    if (f.t >= f.life) {
      f.l.intensity = 0;
      continue;
    }
    f.t += dt;
    const k = Math.min(1, f.t / f.life);
    f.l.intensity = f.pow * (1 - k) * (1 - k);
  }
}
function burst(x, z, hex, big) {
  const c = lin(hex, 2.6),
    w = lin('#ffffff', 2.2),
    n = big ? 38 : 16;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283,
      sp = 0.5 + Math.random() * 1.7;
    spark(
      x,
      0.3,
      z,
      Math.cos(a) * sp,
      0.5 + Math.random() * 2.3,
      Math.sin(a) * sp,
      0.45 + Math.random() * 0.55,
      0.085,
      i % 3 ? c : w,
      3.4
    );
  }
  if (big)
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * 6.283;
      spark(x, 0.07, z, Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9, 0.45, 0.07, c, 0);
    }
  flash(x, 0.55, z, hex, big ? 7 : 4, big ? 0.45 : 0.25);
  if (big) GL.shake = Math.max(GL.shake, 0.07);
}
function column(tx, ty, hex) {
  const o = G.N / 2 - 0.5,
    x = tx - o,
    z = ty - o,
    c = lin(hex, 2.2);
  shoot(x, 0, z, x, 2.6, z, hex, 0.16, 0.7);
  flash(x, 0.7, z, hex, 3.5, 0.5);
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * 6.283;
    spark(
      x + Math.cos(a) * 0.3,
      0.05,
      z + Math.sin(a) * 0.3,
      0,
      0.8 + Math.random() * 1.4,
      0,
      0.6 + Math.random() * 0.5,
      0.06,
      c,
      0
    );
  }
}
