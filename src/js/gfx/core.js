'use strict';
/*
 * Renderer foundations: handles to the canvases, the renderer-wide state, and small math and
 * color helpers used by every file in gfx/.
 *
 *  - GL holds everything created once per page (renderer, composer, materials, shared assets).
 *  - W3 holds everything created once per game (the board's meshes, per-tile animation clocks).
 *  - lin(hex, m) converts an sRGB hex color to linear and multiplies it. three.js r147 runs in
 *    its legacy color mode here, so EVERY color handed to a material goes through lin().
 *  - rng(seed) is a small deterministic generator: procedural textures and scenery must look
 *    the same on every load.
 */
const cv = $('#board'),
  hud = $('#hud'),
  hx = hud.getContext('2d'),
  gameEl = $('#game'),
  T3 = window.THREE;
let SPLASH = null,
  GL = null,
  GLfail = false,
  W3 = null,
  rotVel = 0,
  lastT = 0,
  VW = 0,
  VH = 0,
  PR = 1,
  ANISO = 4,
  snapCam = false,
  slow = 0;
const view = { yaw: 0.785, pitch: 0.86, dist: 14, x: 0, z: 0 },
  want = { yaw: 0.785, pitch: 0.86, dist: 14, x: 0, z: 0 };
const ELEV = [0, 0, 0.1, -0.08],
  INK = '#0c0e1c',
  DK = '#1b2040',
  MD = '#3b4274',
  LT = '#cdd2ec',
  TIME = { value: 0 };
const coarse = matchMedia('(pointer: coarse)').matches;
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const rng = s => () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const lin = (h, m = 1) => new T3.Color(h).convertSRGBToLinear().multiplyScalar(m);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _m = T3 && new T3.Matrix4(),
  _q = T3 && new T3.Quaternion(),
  _e = T3 && new T3.Euler(),
  _p = T3 && new T3.Vector3(),
  _s = T3 && new T3.Vector3(),
  _c = T3 && new T3.Color(),
  _d = T3 && new T3.Vector3();
const UP = T3 && new T3.Vector3(0, 1, 0),
  RC = T3 && new T3.Raycaster(),
  GROUND = T3 && new T3.Plane(new T3.Vector3(0, 1, 0), 0);
const cvs = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h || w;
  return c;
};
function tex(c, srgb) {
  const t = new T3.CanvasTexture(c);
  if (srgb) t.encoding = T3.sRGBEncoding;
  t.wrapS = t.wrapT = T3.RepeatWrapping;
  t.anisotropy = ANISO;
  return t;
}
