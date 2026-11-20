'use strict';
/*
 * Skies. Each game is lit by one of five atmospheres (ATMO): Neon Storm, Solar Dusk, Aurora
 * Night, Crimson Eclipse and Cloud Dawn. An atmosphere sets the sun, hemisphere and rim lights, fog,
 * the color of the grid floor and haze, the sky dome, precipitation, bloom and the final color
 * grade, then re-bakes the reflection environment so metal picks up the new sky.
 */
const ATMO = {
  storm: {
    name: 'Neon Storm',
    fog: '#0e0828',
    dens: 0.012,
    sun: ['#e2e8ff', 1.4, [-0.55, 1.05, 0.42]],
    hemi: ['#8794ff', '#ff3fd0', 0.32],
    rim: ['#ff3fd0', 0.55],
    fill: ['#27e0ff', 0.32],
    grid: ['#ff1fbf', '#1abfff'],
    gi: 1,
    haze: [
      ['#4f5fe0', 0.42],
      ['#b03ad8', 0.5]
    ],
    precip: 'rain',
    bolt: true,
    exp: 1.05,
    tint: [0.9, 1.02, 1.12, 1.06, 0.98, 1.02],
    bloom: 0.62,
    sky: ['#05030f', '#1a0f3d', '#3b1466'],
    stars: 0.3,
    orb: ['#000000', '#000000', 0.001, 0],
    aur: 0
  },
  dusk: {
    name: 'Solar Dusk',
    fog: '#3a1830',
    dens: 0.011,
    sun: ['#ffb070', 1.9, [-0.9, 0.4, 0.25]],
    hemi: ['#ff9a78', '#5a2a6a', 0.38],
    rim: ['#ff5a3a', 0.5],
    fill: ['#7a6cff', 0.25],
    grid: ['#ff7a2e', '#ffc24a'],
    gi: 0.8,
    haze: [
      ['#ff8a5a', 0.5],
      ['#a03a6a', 0.55]
    ],
    precip: 'dust',
    bolt: false,
    exp: 1.08,
    tint: [1.06, 0.98, 0.94, 1.08, 1, 0.94],
    bloom: 0.6,
    sky: ['#1b1140', '#a03a5a', '#ffb060'],
    stars: 0.15,
    orb: ['#ffd9a0', '#ff8a3a', 0.05, 0],
    aur: 0
  },
  aurora: {
    name: 'Aurora Night',
    fog: '#041420',
    dens: 0.0105,
    sun: ['#bfe0ff', 1.15, [0.4, 1.1, -0.6]],
    hemi: ['#5fffc8', '#1a4a8a', 0.36],
    rim: ['#3fffb0', 0.5],
    fill: ['#4f8aff', 0.35],
    grid: ['#1fe0a0', '#3f8aff'],
    gi: 0.9,
    haze: [
      ['#1f6a7a', 0.4],
      ['#1a3a6a', 0.5]
    ],
    precip: 'snow',
    bolt: false,
    exp: 1.1,
    tint: [0.9, 1.05, 1.08, 0.96, 1.04, 1.04],
    bloom: 0.7,
    sky: ['#01060f', '#06243a', '#0e4a52'],
    stars: 1,
    orb: ['#e8f4ff', '#9fd8ff', 0.03, 0],
    aur: 1
  },
  eclipse: {
    name: 'Crimson Eclipse',
    fog: '#1a0408',
    dens: 0.013,
    sun: ['#ff6a4a', 1.3, [0.2, 0.75, 0.9]],
    hemi: ['#ff5a4a', '#2a0612', 0.3],
    rim: ['#ff2a2a', 0.7],
    fill: ['#ffb347', 0.22],
    grid: ['#ff2a2a', '#ff8a1a'],
    gi: 1,
    haze: [
      ['#8a1a1a', 0.5],
      ['#3a0a1a', 0.6]
    ],
    precip: 'embers',
    bolt: true,
    exp: 1.05,
    tint: [1.08, 0.95, 0.92, 1.1, 0.96, 0.92],
    bloom: 0.7,
    sky: ['#050103', '#2a0508', '#6a0f0f'],
    stars: 0.7,
    orb: ['#000000', '#ff3a1a', 0.06, 1],
    aur: 0
  },
  dawn: {
    name: 'Cloud Dawn',
    fog: '#93a6cf',
    dens: 0.009,
    sun: ['#fff0d8', 2.1, [-0.6, 0.8, 0.5]],
    hemi: ['#cfe0ff', '#f0c8b0', 0.62],
    rim: ['#ffd0a0', 0.4],
    fill: ['#a0c8ff', 0.4],
    grid: ['#ffffff', '#bfd8ff'],
    gi: 0.2,
    haze: [
      ['#ffffff', 0.95],
      ['#e8eeff', 0.95]
    ],
    precip: 'none',
    bolt: false,
    exp: 0.9,
    tint: [0.98, 1, 1.04, 1.02, 1, 0.98],
    bloom: 0.36,
    sky: ['#3f73c4', '#8fb4e8', '#ffd9b8'],
    stars: 0,
    orb: ['#fff6e0', '#ffe0a0', 0.045, 0],
    aur: 0,
    day: true
  }
};
const PRECIP = {
  rain: [8, 5, 0.2, 0.07, 0, 1, '#80b8ff', 0.3],
  snow: [1.1, 0.8, 0.035, 0.02, 0.35, 1, '#ffffff', 0.75],
  dust: [0.35, 0.3, 0.03, 0.9, 0.25, 1, '#ffc890', 0.5],
  embers: [1.3, 1.2, 0.05, 0.1, 0.2, -1, '#ff7a2e', 1.1]
};
function applyAtmo(key) {
  const a = ATMO[key] || ATMO.storm,
    { scene, sun, hemi, rim, fill, fin, bloom } = GL,
    C = (c, h) => c.copy(lin(h));
  GL.at = a;
  C(scene.fog.color, a.fog);
  C(scene.background, a.fog);
  scene.fog.density = a.dens;
  C(sun.color, a.sun[0]);
  sun.intensity = a.sun[1];
  GL.sunDir.set(a.sun[2][0], a.sun[2][1], a.sun[2][2]).normalize();
  C(hemi.color, a.hemi[0]);
  C(hemi.groundColor, a.hemi[1]);
  hemi.intensity = a.hemi[2];
  C(rim.color, a.rim[0]);
  rim.intensity = a.rim[1];
  C(fill.color, a.fill[0]);
  fill.intensity = a.fill[1];
  const g = GL.grid.uniforms;
  C(g.uC1.value, a.grid[0]);
  C(g.uC2.value, a.grid[1]);
  g.uGI.value = a.gi;
  GL.hz.forEach((m, i) => {
    C(m.uniforms.uCol.value, a.haze[i][0]);
    m.uniforms.uA.value = a.haze[i][1];
  });
  const p = PRECIP[a.precip];
  if (GL.rainObj) {
    GL.rainObj.visible = !!p && SET.weather;
    if (p) {
      const r = GL.rainObj.material.uniforms;
      r.uSpd.value = p[0];
      r.uVar.value = p[1];
      r.uLen.value = p[2];
      r.uSlant.value = p[3];
      r.uWob.value = p[4];
      r.uUp.value = p[5];
      r.uCol.value.copy(lin(p[6], p[7]));
    }
  }
  const s = GL.sky.uniforms;
  C(s.uTop.value, a.sky[0]);
  C(s.uMid.value, a.sky[1]);
  C(s.uHor.value, a.sky[2]);
  C(s.uOrb.value, a.orb[0]);
  C(s.uGlow.value, a.orb[1]);
  s.uSize.value = a.orb[2];
  s.uRing.value = a.orb[3];
  s.uAur.value = a.aur;
  s.uStars.value = a.stars;
  fin.uniforms.uExp.value = a.exp;
  fin.uniforms.uTS.value.set(a.tint[0], a.tint[1], a.tint[2]);
  fin.uniforms.uTH.value.set(a.tint[3], a.tint[4], a.tint[5]);
  bloom.strength = a.bloom;
  GL.AC.sl.forEach(x => {
    x.m.visible = !a.day;
  });
  if (GL.AC.pts) GL.AC.pts.material.uniforms.uI.value = a.day ? 0.2 : 1;
  /* reflections follow the mood */
  const E = GL.env;
  C(E.sky.color, a.sky[0]).multiplyScalar(a.day ? 1.4 : 1);
  C(E.key.color, a.sun[0]).multiplyScalar(a.day ? 4 : 3);
  C(E.a.color, a.rim[0]).multiplyScalar(2.4);
  C(E.b.color, a.fill[0]).multiplyScalar(2.4);
  C(E.floor.color, a.hemi[1]).multiplyScalar(0.8);
  if (E.rt) E.rt.dispose();
  E.rt = E.pm.fromScene(E.scene, 0.03);
  scene.environment = E.rt.texture;
  if (GL.port) GL.port.scene.environment = E.rt.texture;
}
const FS_SKY = `uniform vec3 uTop,uMid,uHor,uFog,uSun,uOrb,uGlow;uniform float uSize,uRing,uAur,uStars,uTime;varying vec3 vD;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 d=normalize(vD);float y=d.y;
vec3 c=mix(uHor,uMid,smoothstep(0.,.22,y));c=mix(c,uTop,smoothstep(.18,.75,y));c=mix(c,uFog,smoothstep(.02,-.1,y));
vec2 sp=d.xz/(abs(y)+.35)*90.;c+=step(.992,h2(floor(sp)))*smoothstep(.04,.3,y)*uStars*(.6+.4*sin(uTime*2.+h2(floor(sp))*40.));
float k=dot(d,uSun),disc=smoothstep(cos(uSize),cos(uSize*.9),k);
c+=uGlow*pow(max(k,0.),uRing>.5?90.:28.)*.9;
if(uRing>.5){c=mix(c,vec3(0.),disc);c+=uGlow*smoothstep(cos(uSize*1.3),cos(uSize*1.02),k)*(1.-disc)*3.;}else c=mix(c,uOrb*2.4,disc);
if(uAur>.5){float a=atan(d.z,d.x),band=sin(a*3.+uTime*.15+sin(a*7.+uTime*.3)*.6),y0=.26+.1*band,m=exp(-pow((y-y0)/.1,2.))*(.5+.5*sin(a*40.+uTime*1.5+y*30.));
c+=vec3(.15,1.,.6)*m*.9+vec3(.45,.3,1.)*m*.5*smoothstep(y0,y0+.16,y);}
gl_FragColor=vec4(c,1.);}`;
function mkAtmos() {
  const { scene } = GL,
    vs =
      'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
  GL.hz = [
    [-9, 0.05],
    [-24, 0.028]
  ].map(([y, sc]) => {
    const m = new T3.ShaderMaterial({
        uniforms: {
          uTime: TIME,
          uCol: { value: new T3.Color() },
          uA: { value: 0.4 },
          uS: { value: sc },
          uFlash: FLASH,
          uFP: FPOS
        },
        transparent: true,
        depthWrite: false,
        vertexShader: vs,
        fragmentShader: FS_HAZE
      }),
      x = new T3.Mesh(new T3.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), m);
    x.position.y = y;
    x.renderOrder = -1;
    scene.add(x);
    return m;
  });
  const sm = new T3.ShaderMaterial({
    uniforms: {
      uTop: { value: new T3.Color() },
      uMid: { value: new T3.Color() },
      uHor: { value: new T3.Color() },
      uFog: { value: scene.fog.color },
      uSun: { value: GL.sunDir },
      uOrb: { value: new T3.Color() },
      uGlow: { value: new T3.Color() },
      uSize: { value: 0.04 },
      uRing: { value: 0 },
      uAur: { value: 0 },
      uStars: { value: 0 },
      uTime: TIME
    },
    side: T3.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader:
      'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: FS_SKY
  });
  const sky = new T3.Mesh(new T3.SphereGeometry(380, 32, 16), sm);
  sky.renderOrder = -5;
  sky.frustumCulled = false;
  scene.add(sky);
  GL.sky = sm;
  if (reduce) return;
  const n = 1000,
    ps = new Float32Array(n * 6),
    en = new Float32Array(n * 2),
    sd = new Float32Array(n * 2),
    g = new T3.BufferGeometry();
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 27,
      z = (Math.random() - 0.5) * 27,
      y = Math.random() * 16,
      s = Math.random();
    ps.set([x, y, z, x, y, z], i * 6);
    en.set([0, 1], i * 2);
    sd.set([s, s], i * 2);
  }
  g.setAttribute('position', new T3.BufferAttribute(ps, 3));
  g.setAttribute('aEnd', new T3.BufferAttribute(en, 1));
  g.setAttribute('aSeed', new T3.BufferAttribute(sd, 1));
  const m = new T3.ShaderMaterial({
    uniforms: {
      uTime: TIME,
      uHalf: { value: 6 },
      uSpd: { value: 8 },
      uVar: { value: 5 },
      uLen: { value: 0.2 },
      uSlant: { value: 0.07 },
      uWob: { value: 0 },
      uUp: { value: 1 },
      uCol: { value: new T3.Color(0.15, 0.22, 0.3) }
    },
    transparent: true,
    blending: T3.AdditiveBlending,
    depthWrite: false,
    vertexShader: `attribute float aEnd,aSeed;uniform float uTime,uHalf,uSpd,uVar,uLen,uSlant,uWob,uUp;varying float vA;
void main(){float y=mod(position.y-uTime*(uSpd+aSeed*uVar)*uUp,16.)-5.;
vec3 p=vec3(position.x+y*uSlant+sin(uTime*.7+aSeed*40.+y)*uWob,y+aEnd*uLen*(.7+aSeed*.8),position.z+cos(uTime*.6+aSeed*31.)*uWob);
float ins=step(abs(p.x),uHalf)*step(abs(p.z),uHalf)*step(p.y,.06);vA=(1.-ins)*(.35+.65*aSeed)*(1.-aEnd*.6);
gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader: 'uniform vec3 uCol;varying float vA;void main(){gl_FragColor=vec4(uCol*vA,1.);}'
  });
  const rain = new T3.LineSegments(g, m);
  rain.frustumCulled = false;
  rain.renderOrder = 4;
  scene.add(rain);
  GL.rainObj = rain;
}
