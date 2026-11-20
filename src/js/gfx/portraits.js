'use strict';
/*
 * Unit portraits for the interface. The same 3D models used on the board are rendered once
 * each into a small offscreen target and cached as images, so buttons and tooltips show the
 * actual unit in the player's colors rather than a hand-drawn icon.
 */
function mkPortrait() {
  const S = 384,
    rt = new T3.WebGLRenderTarget(S, S);
  rt.texture.encoding = T3.sRGBEncoding;
  const scene = new T3.Scene(),
    cam = new T3.PerspectiveCamera(28, 1, 0.1, 20),
    holder = new T3.Group();
  scene.environment = GL.scene.environment;
  scene.add(holder);
  const k = new T3.DirectionalLight(lin('#ffffff'), 1.7);
  k.position.set(-2, 3, 3);
  const r = new T3.DirectionalLight(lin('#ff3fd0'), 0.8);
  r.position.set(3, 1, -2);
  scene.add(k, r, new T3.HemisphereLight(lin('#aab4ff'), lin('#3a2a6a'), 0.7));
  const M = unitMats();
  M.gm.color.setScalar(0.36);
  M.hm.blending = T3.NormalBlending;
  M.hm.opacity = 0.42;
  GL.port = { S, rt, scene, cam, holder, cache: new Map(), M };
}
function portrait(type, key, full) {
  if (!ensureGL()) return null;
  const P = GL.port,
    id = type + '|' + key + (full ? '|f' : '');
  let c = P.cache.get(id);
  if (c) return c;
  const geo = unitGeo(type, key),
    { renderer } = GL,
    S = P.S,
    big = type === 'mech',
    wide = type === 'cannon' || type === 'skimmer';
  P.holder.clear();
  P.holder.add(new T3.Mesh(geo.body, P.M.bm));
  if (geo.glow) P.holder.add(new T3.Mesh(geo.glow, P.M.gm));
  if (geo.holo) P.holder.add(new T3.Mesh(geo.holo, P.M.hm));
  P.M.uni.uB.value.set(0.25, 0, 1.3, type === 'skimmer' ? 0.5 : 0.06);
  P.M.uni.uA.value.set(0.12, -0.12, 0, 0.05);
  const h = full ? (big ? 0.44 : wide ? 0.3 : 0.35) : big ? 0.6 : wide ? 0.3 : 0.47,
    d = (full ? 1.75 : 1) * (big ? 1.45 : wide ? 1.25 : 0.82);
  P.cam.position.set(Math.sin(0.62) * d, h + 0.22, Math.cos(0.62) * d);
  P.cam.lookAt(0, h, wide ? 0.05 : 0);
  renderer.setRenderTarget(P.rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(P.scene, P.cam);
  const buf = new Uint8Array(S * S * 4);
  renderer.readRenderTargetPixels(P.rt, 0, 0, S, S, buf);
  renderer.setRenderTarget(null);
  c = cvs(S);
  const x = c.getContext('2d'),
    im = x.createImageData(S, S);
  for (let y = 0; y < S; y++)
    im.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  x.putImageData(im, 0, 0);
  P.cache.set(id, c);
  return c;
}
function paintIcons() {
  document.querySelectorAll('canvas.ico').forEach(c => {
    const s = c.clientWidth || 44,
      d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.height = Math.round(s * d);
    const p = portrait(c.dataset.unit, c.dataset.key);
    if (!p) return;
    const k = c.getContext('2d');
    k.imageSmoothingQuality = 'high';
    k.drawImage(p, 0, 0, c.width, c.height);
  });
}
