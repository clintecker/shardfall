'use strict';
/*
 * Pointer and keyboard controls for the board: tap to select, drag to pan, right-drag or
 * Shift-drag to orbit, wheel or pinch to zoom, two-finger twist to spin, plus the minimap and
 * the keyboard shortcuts. pickTile() casts a ray from the pointer to find the tile under it.
 */
function pickTile(cx, cy) {
  if (!G || !GL || !W3) return null;
  const r = cv.getBoundingClientRect(),
    N = G.N,
    o = N / 2 - 0.5;
  RC.setFromCamera(
    { x: ((cx - r.left) / r.width) * 2 - 1, y: -(((cy - r.top) / r.height) * 2 - 1) },
    GL.camera
  );
  const ray = RC.ray;
  let best = null,
    bd = 1e9;
  for (const u of G.units) {
    if (!W3.seen[idx(u.x, u.y)]) continue;
    _d.set(u.x - o, 0.45, u.y - o);
    if (ray.distanceSqToPoint(_d) < 0.11) {
      const t = ray.origin.distanceTo(_d);
      if (t < bd) {
        bd = t;
        best = u;
      }
    }
  }
  if (best) return [best.x, best.y];
  if (!ray.intersectPlane(GROUND, _d)) return null;
  const x = Math.floor(_d.x + N / 2),
    y = Math.floor(_d.z + N / 2);
  return inb(x, y) ? [x, y] : null;
}
function tapBoard(cx, cy) {
  const t = pickTile(cx, cy);
  if (t) clickTile(t[0], t[1]);
}
function zoomBy(f) {
  if (!G || !GL) return;
  want.dist *= f;
  clampView();
}
const ptrs = new Map();
let drag = null,
  pinch = 0,
  twist = 0,
  cenY = 0;
const pdist = () => {
  const [a, b] = [...ptrs.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
};
const pang = () => {
  const [a, b] = [...ptrs.values()];
  return Math.atan2(b.y - a.y, b.x - a.x);
};
const pcen = () => {
  const [a, b] = [...ptrs.values()];
  return (a.y + b.y) / 2;
};
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  try {
    cv.setPointerCapture(e.pointerId);
  } catch (x) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1)
    drag = {
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      spin: e.button === 2 || e.button === 1 || e.shiftKey || e.altKey
    };
  else {
    if (drag) drag.moved = true;
    pinch = pdist();
    twist = pang();
    cenY = pcen();
  }
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) {
    hoverPt = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null;
    return;
  }
  if (!G || !GL) return;
  const dx = e.clientX - p.x,
    dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (ptrs.size === 1 && drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) drag.moved = true;
    if (!drag.moved) return;
    snapCam = true;
    if (drag.spin) {
      want.yaw -= dx * 0.006;
      want.pitch += dy * 0.005;
    } else {
      const wpp = (2 * view.dist * Math.tan((GL.camera.fov * Math.PI) / 360)) / VH,
        cy = Math.cos(view.yaw),
        sy = Math.sin(view.yaw),
        fy = dy / Math.sin(view.pitch);
      want.x += (-cy * dx - sy * fy) * wpp;
      want.z += (sy * dx - cy * fy) * wpp;
    }
    clampView();
  } else if (ptrs.size === 2) {
    const d = pdist(),
      a = pang(),
      c = pcen();
    let da = a - twist;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    want.yaw += da;
    want.dist *= pinch / d;
    want.pitch += (c - cenY) * 0.006;
    twist = a;
    pinch = d;
    cenY = c;
    snapCam = true;
    clampView();
  }
});
for (const ev of ['pointerup', 'pointercancel'])
  cv.addEventListener(ev, e => {
    if (!ptrs.has(e.pointerId)) return;
    const one = ptrs.size === 1;
    ptrs.delete(e.pointerId);
    if (one && drag && !drag.moved && !drag.spin && ev === 'pointerup')
      tapBoard(e.clientX, e.clientY);
    if (!ptrs.size) {
      drag = null;
      snapCam = false;
    }
  });
cv.addEventListener('pointerleave', () => {
  hoverPt = null;
});
cv.addEventListener('dblclick', e => {
  const t = pickTile(e.clientX, e.clientY);
  if (t) {
    focusOn(t[0], t[1]);
    want.dist = Math.max(4.5, Math.min(want.dist, view.dist) * 0.62);
    clampView();
  }
});
cv.addEventListener(
  'wheel',
  e => {
    if (!G || !GL) return;
    e.preventDefault();
    if (e.shiftKey) want.yaw += (e.deltaY || e.deltaX) * 0.003;
    else zoomBy(e.deltaY < 0 ? 1 / 1.12 : 1.12);
  },
  { passive: false }
);
const miniGo = e => {
  if (!G || !GL) return;
  const r = mini.getBoundingClientRect(),
    N = G.N;
  want.x = ((e.clientX - r.left) / r.width) * N - N / 2;
  want.z = ((e.clientY - r.top) / r.height) * N - N / 2;
  clampView();
};
mini.addEventListener('pointerdown', e => {
  try {
    mini.setPointerCapture(e.pointerId);
  } catch (x) {}
  miniGo(e);
});
mini.addEventListener('pointermove', e => {
  if (e.buttons || e.pointerType === 'touch') miniGo(e);
});
const zm = $('#zoom');
zm.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-r]');
  if (b) rotVel = +b.dataset.r * 1.6;
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel'])
  zm.addEventListener(ev, () => {
    rotVel = 0;
  });
zm.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !G || !GL) return;
  if (b.dataset.r) {
    if (e.detail === 0) want.yaw += (+b.dataset.r * Math.PI) / 12;
  } else if (b.dataset.z === '0') fitView();
  else zoomBy(b.dataset.z === '1' ? 1 / 1.3 : 1.3);
});
document.addEventListener('keyup', e => {
  if ('qQrR'.includes(e.key)) rotVel = 0;
});
window.addEventListener('blur', () => {
  rotVel = 0;
});
