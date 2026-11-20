'use strict';
/*
 * One pooled particle system for everything small and bright: sparks, embers, spores, motes.
 * spark() takes a slot from a fixed pool of 900 points; nothing is allocated while playing.
 */
function mkParticles() {
  const n = 900,
    g = new T3.BufferGeometry();
  const P = {
    n,
    pos: new Float32Array(n * 3),
    col: new Float32Array(n * 3),
    size: new Float32Array(n),
    list: []
  };
  g.setAttribute('position', new T3.BufferAttribute(P.pos, 3));
  g.setAttribute('aCol', new T3.BufferAttribute(P.col, 3));
  g.setAttribute('aSize', new T3.BufferAttribute(P.size, 1));
  const m = new T3.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    transparent: true,
    blending: T3.AdditiveBlending,
    depthWrite: false,
    vertexShader:
      'attribute float aSize;attribute vec3 aCol;varying vec3 vC;uniform float uScale;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uScale/-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader:
      'varying vec3 vC;void main(){float a=smoothstep(.5,0.,length(gl_PointCoord-.5));gl_FragColor=vec4(vC*a*a,1.);}'
  });
  P.pts = new T3.Points(g, m);
  P.pts.frustumCulled = false;
  P.pts.renderOrder = 5;
  GL.scene.add(P.pts);
  GL.P = P;
  GL.pm = m;
}
function spark(x, y, z, vx, vy, vz, life, size, c, grav) {
  const P = GL.P;
  if (P.list.length < P.n)
    P.list.push({ x, y, z, vx, vy, vz, life, age: 0, size, r: c.r, g: c.g, b: c.b, grav });
}
function stepParticles(dt) {
  const P = GL.P,
    L = P.list;
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i];
    p.age += dt;
    if (p.age >= p.life) {
      L[i--] = L[L.length - 1];
      L.pop();
      continue;
    }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const k = 1 - p.age / p.life,
      f = Math.min(1, p.age * 6) * k;
    P.pos[n * 3] = p.x;
    P.pos[n * 3 + 1] = p.y;
    P.pos[n * 3 + 2] = p.z;
    P.col[n * 3] = p.r * f;
    P.col[n * 3 + 1] = p.g * f;
    P.col[n * 3 + 2] = p.b * f;
    P.size[n] = p.size;
    n++;
  }
  const g = P.pts.geometry;
  g.setDrawRange(0, n);
  g.attributes.position.needsUpdate =
    g.attributes.aCol.needsUpdate =
    g.attributes.aSize.needsUpdate =
      true;
}
