'use strict';
/*
 * The orbit camera. `view` is where the camera is, `want` is where it is heading; every frame
 * the first eases toward the second, which is why pans, zooms and focus jumps all feel the same.
 */
function placeCam(cam, v) {
  const cp = Math.cos(v.pitch),
    sy = Math.sin(v.yaw),
    cy = Math.cos(v.yaw),
    k = v.dist * 0.05;
  cam.position.set(v.x + sy * cp * v.dist, Math.sin(v.pitch) * v.dist, v.z + cy * cp * v.dist);
  cam.lookAt(v.x + sy * k, 0, v.z + cy * k);
  cam.updateMatrixWorld();
}
function fitDist() {
  const cam = GL.camera,
    h = G.N / 2 + 0.3,
    v = { yaw: want.yaw, pitch: want.pitch, x: 0, z: 0, dist: 0 };
  let lo = 4,
    hi = 90;
  for (let i = 0; i < 14; i++) {
    v.dist = (lo + hi) / 2;
    placeCam(cam, v);
    let ok = true;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const y of [-1.6, 1.1]) {
          _d.set(sx * h, y, sz * h).project(cam);
          if (Math.abs(_d.x) > 0.94 || _d.y > 0.9 || _d.y < -0.9) ok = false;
        }
    if (ok) hi = v.dist;
    else lo = v.dist;
  }
  return hi;
}
function clampView() {
  const h = G.N / 2;
  want.x = clamp(want.x, -h, h);
  want.z = clamp(want.z, -h, h);
  want.pitch = clamp(want.pitch, 0.2, 1.38);
  want.dist = clamp(want.dist, 3.2, fitDist() * 1.3);
}
function resetView() {
  want.yaw = Math.PI / 4;
  want.pitch = 0.86;
  want.x = want.z = 0;
  const fd = fitDist(),
    c = G.cities.find(c => c.owner === 0 && c.capital) || G.cities.find(c => c.owner === 0);
  if (c) {
    const o = G.N / 2 - 0.5,
      cx = c.x - o,
      cz = c.y - o,
      nar = coarse || VW < 560;
    want.yaw = Math.atan2(cx, cz);
    want.dist = Math.min(fd, nar ? 10.5 : G.N * 1.05);
    want.x = cx * (nar ? 0.9 : 0.72);
    want.z = cz * (nar ? 0.9 : 0.72);
  } else want.dist = fd;
  clampView();
  Object.assign(view, want);
  if (!reduce && GL) {
    view.dist = want.dist * 2.3;
    view.pitch = 1.2;
    view.yaw = want.yaw - 1.1;
    view.x *= 0.3;
    view.z *= 0.3;
    GL.glideT = 2.6;
  }
}
function size() {
  const w = cv.clientWidth,
    h = cv.clientHeight;
  if (!w || !h) return false;
  const pr = Math.min(window.devicePixelRatio || 1, GL.q ? 1 : coarse ? 1.5 : 2);
  if (w !== VW || h !== VH || pr !== PR) {
    VW = w;
    VH = h;
    PR = pr;
    const { renderer, composer, camera, fin } = GL;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fin.uniforms.uRes.value.set(w * pr, h * pr);
    GL.pm.uniforms.uScale.value = (h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    hud.width = Math.round(w * pr);
    hud.height = Math.round(h * pr);
  }
  return true;
}
