'use strict';
/*
 * Characters and hardware, built from primitives at startup. There are no model files.
 *
 * Builder() merges boxes, cylinders and spheres into one geometry per unit, tagging every vertex
 * with a body part (aPart), two pivots (aPivot, aPivot2) and a surface type (aMat). animPatch()
 * then rewrites the stock PBR vertex shader so those tags drive walk cycles, recoil, breathing
 * and cloth entirely on the GPU: one draw call per unit, no skeleton, no per-frame CPU work.
 *
 * PAL is each culture's wardrobe; kit() and head() give each one a distinct silhouette;
 * unitGeo(type, culture) is the entry point and caches its results.
 */
const gB = (w, h, d, r = 0.02) =>
  new T3.RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.05, h / 2.05, d / 2.05));
const gC = (rt, rb, h, s = 14) => new T3.CylinderGeometry(rt, rb, h, s);
const gS = (r, a = 16, b = 12) => new T3.SphereGeometry(r, a, b);
const gK = (r, l) => new T3.CapsuleGeometry(r, l, 5, 12);
const gT = (R, r, seg = 24) => new T3.TorusGeometry(R, r, 6, seg);
const gO = (r, h, s = 4) => new T3.ConeGeometry(r, h, s);
const KEEP = { position: 1, normal: 1, uv: 1, color: 1, aPart: 1, aPivot: 1, aPivot2: 1, aMat: 1 };
/* per-surface PBR: [roughness, metalness, clearcoat] carried on every vertex */
const MAT = {
  PAINT: [0.3, 0.3, 1],
  STEEL: [0.26, 0.95, 0.3],
  DARK: [0.42, 0.85, 0.25],
  RUB: [0.85, 0.05, 0],
  GLASS: [0.06, 0.9, 1],
  CLOTH: [0.92, 0, 0],
  CHROME: [0.1, 1, 0]
};
const SUIT = '#161a33',
  GUN = '#2a3054',
  STL = '#aab3d8',
  WHT = '#dfe4f5',
  BLK = '#0a0c18';
/* per-culture colour scheme: main armour, secondary plates, undersuit, dark metal, cloth, glow, accent */
const PAL = {
  helion: {
    arm: '#e89a1c',
    arm2: '#f4ead4',
    suit: '#3b1622',
    gun: '#6a4a2a',
    cloth: '#c2183a',
    glow: '#ffd76a',
    acc: '#ff5a3a'
  },
  verdant: {
    arm: '#3fcf93',
    arm2: '#eef6e6',
    suit: '#0f2e26',
    gun: '#1f4a3c',
    cloth: '#2aa37a',
    glow: '#9dffd0',
    acc: '#ff7ad9'
  },
  choir: {
    arm: '#14121e',
    arm2: '#4a4468',
    suit: '#07070c',
    gun: '#1e1b2c',
    cloth: '#e85ad0',
    glow: '#ff4fd8',
    acc: '#7a5cff'
  },
  tide: {
    arm: '#eef4f8',
    arm2: '#2f9ee8',
    suit: '#0e2244',
    gun: '#24406e',
    cloth: '#ff7a2e',
    glow: '#5fe6ff',
    acc: '#ff7a2e'
  }
};
function Builder() {
  const body = [],
    glow = [],
    holo = [];
  const add = (list, g, hex, x, y, z, o) => {
    o = o || {};
    g = g.index ? g.toNonIndexed() : g.clone();
    _m.compose(
      _p.set(x, y, z),
      _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)),
      _s.set(o.sx || 1, o.sy || 1, o.sz || 1)
    );
    g.applyMatrix4(_m);
    if (o.flat) g.computeVertexNormals();
    const c = lin(hex, o.m || 1),
      n = g.attributes.position.count,
      a = new Float32Array(n * 3),
      pa = new Float32Array(n).fill(o.p || 0),
      pv = new Float32Array(n * 3),
      pv2 = new Float32Array(n * 3),
      mt = new Float32Array(n * 3),
      M = o.mat || MAT.DARK;
    for (let i = 0; i < n; i++) {
      a[i * 3] = c.r;
      a[i * 3 + 1] = c.g;
      a[i * 3 + 2] = c.b;
      if (o.pv) pv.set(o.pv, i * 3);
      if (o.pv2) pv2.set(o.pv2, i * 3);
      mt.set(M, i * 3);
    }
    g.setAttribute('color', new T3.BufferAttribute(a, 3));
    g.setAttribute('aPart', new T3.BufferAttribute(pa, 1));
    g.setAttribute('aPivot', new T3.BufferAttribute(pv, 3));
    g.setAttribute('aPivot2', new T3.BufferAttribute(pv2, 3));
    g.setAttribute('aMat', new T3.BufferAttribute(mt, 3));
    for (const k of Object.keys(g.attributes)) if (!KEEP[k]) g.deleteAttribute(k);
    list.push(g);
  };
  const merge = l => {
    if (!l.length) return null;
    const g = T3.BufferGeometryUtils.mergeBufferGeometries(l);
    g.userData.own = true;
    l.forEach(x => x.dispose());
    return g;
  };
  return {
    b: (g, hex, x, y, z, o) => add(body, g, hex, x, y, z, o),
    g: (g, hex, x, y, z, o) => add(glow, g, hex, x, y, z, o),
    h: (g, hex, x, y, z, o) => add(holo, g, hex, x, y, z, o),
    out: () => ({ body: merge(body), glow: merge(glow), holo: merge(holo) })
  };
}
/* limbs: every vertex carries a part id and its pivots; the vertex shader swings hips, knees, arms and head and waves cloth. One draw call per unit. */
const part = (B, p, pv, pv2) => {
  const w = f => (g, hex, x, y, z, o) => f(g, hex, x, y, z, Object.assign({ p, pv, pv2 }, o));
  return { b: w(B.b), g: w(B.g), h: w(B.h) };
};
function animPatch(sh) {
  const u = this.userData.u,
    phys = sh.fragmentShader.includes('#include <roughnessmap_fragment>');
  sh.uniforms.uA = u.uA;
  sh.uniforms.uB = u.uB;
  sh.uniforms.uC = u.uC;
  sh.vertexShader = sh.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
attribute float aPart;attribute vec3 aPivot,aPivot2,aMat;uniform vec4 uA,uB,uC;${phys ? 'varying vec3 vMat;' : ''}
vec3 rx_(vec3 q,float a){float s=sin(a),c=cos(a);return vec3(q.x,q.y*c-q.z*s,q.y*s+q.z*c);}
vec3 limb(vec3 v,float piv){
if(aPart<.5)return v;
if(aPart<4.5){float a=aPart<1.5?uA.x:aPart<2.5?uA.y:aPart<3.5?uA.z:uA.w;return aPivot*piv+rx_(v-aPivot*piv,a);}
if(aPart<5.5){float s=sin(uB.x),c=cos(uB.x);vec3 q=v-aPivot*piv;return aPivot*piv+vec3(q.x*c+q.z*s,q.y,-q.x*s+q.z*c);}
if(aPart<6.5)return v-aPivot*uB.y*piv;
if(aPart<8.5){float k=aPart<7.5?uC.x:uC.y,h=aPart<7.5?uA.x:uA.y;vec3 q=aPivot*piv+rx_(v-aPivot*piv,k);return aPivot2*piv+rx_(q-aPivot2*piv,h);}
if(piv>.5){float d=max(0.,aPivot.y-v.y);v.z-=d*(.16+uB.w*.95)+sin(uB.z*3.4+d*26.+aPivot.x*20.)*.1*d*(.6+uB.w);v.x+=sin(uB.z*2.3+d*17.)*.05*d;}
return v;}`
    )
    .replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nobjectNormal=limb(objectNormal,0.);'
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed=limb(transformed,1.);' + (phys ? 'vMat=aMat;' : '')
    );
  if (phys)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMat;')
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor*=vMat.x;'
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor*=vMat.y;'
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=vMat.z;\n#endif'
      );
}
function pulsePatch(sh) {
  sh.uniforms.uTime = TIME;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvec4 wp_=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwp_=instanceMatrix*wp_;\n#endif\nvWP=(modelMatrix*wp_).xyz;'
    );
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;uniform float uTime;')
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=.5+1.15*pow(.5+.5*sin(dot(vWP.xz,vec2(.9,.6))*1.5-uTime*1.7),3.);'
    );
}
const gCl = (w, h, sx = 2, sy = 7) => new T3.BoxGeometry(w, h, 0.006, sx, sy, 1);
function flowPatch(sh) {
  sh.uniforms.uTime = TIME;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvec4 wp_=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwp_=instanceMatrix*wp_;\n#endif\nvWP=(modelMatrix*wp_).xyz;'
    );
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;uniform float uTime;')
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat fw=.5+.5*sin(vWP.x*5.+uTime*.8+sin(vWP.z*4.-uTime*.6)*1.6);fw*=.5+.5*sin(vWP.z*6.3-uTime*.5+sin(vWP.x*3.+uTime*.3)*1.3);totalEmissiveRadiance*=.22+2.3*fw*fw;'
    );
}
function head(B0, key, col, x, y, z, s) {
  const P = part(B0, 5, [x, y - 0.055 * s, z]),
    H = Math.PI / 2,
    K = PAL[key],
    glw = K.glow,
    WHT = K.arm2,
    GUN = K.gun;
  col = K.arm;
  if (key === 'choir') {
    P.b(gB(0.088 * s, 0.08 * s, 0.09 * s, 0.014), STL, x, y, z, { mat: MAT.STEEL });
    P.b(gB(0.07 * s, 0.052 * s, 0.012, 0.005), BLK, x, y, z + 0.042 * s, { mat: MAT.GLASS });
    P.g(gS(0.016 * s), glw, x, y + 0.002 * s, z + 0.046 * s, { m: 5 });
    P.b(gT(0.022 * s, 0.004 * s, 18), STL, x, y + 0.002 * s, z + 0.048 * s, { mat: MAT.CHROME });
    for (const i of [-1, 0, 1]) {
      const L = (0.05 + 0.02 * (i + 1)) * s;
      P.b(
        gC(0.003 * s, 0.003 * s, L, 5),
        GUN,
        x + i * 0.022 * s,
        y + 0.04 * s + L / 2,
        z - 0.02 * s,
        { mat: MAT.DARK }
      );
      P.g(gS(0.007 * s), glw, x + i * 0.022 * s, y + 0.04 * s + L + 0.004, z - 0.02 * s, { m: 4 });
    }
    for (const sx of [-1, 1]) {
      P.b(gC(0.02 * s, 0.02 * s, 0.012 * s, 12), GUN, x + sx * 0.05 * s, y, z, {
        rz: H,
        mat: MAT.DARK
      });
      P.g(gC(0.008 * s, 0.008 * s, 0.004, 8), glw, x + sx * 0.058 * s, y, z, { rz: H, m: 3 });
    }
  } else if (key === 'verdant') {
    P.b(gS(0.054 * s, 18, 14), WHT, x, y, z, { mat: MAT.PAINT, sy: 1.08, sz: 1.05 });
    for (const sx of [-1, 1]) {
      P.b(gS(0.02 * s), BLK, x + sx * 0.022 * s, y + 0.004 * s, z + 0.04 * s, { mat: MAT.GLASS });
      P.g(gS(0.012 * s), glw, x + sx * 0.022 * s, y + 0.004 * s, z + 0.052 * s, { m: 4 });
      P.b(
        gC(0.004 * s, 0.005 * s, 0.09 * s, 6),
        GUN,
        x + sx * 0.034 * s,
        y + 0.085 * s,
        z - 0.012 * s,
        { rz: -sx * 0.45, rx: -0.3, mat: MAT.DARK }
      );
      P.g(gS(0.011 * s), K.acc, x + sx * 0.054 * s, y + 0.125 * s, z - 0.026 * s, { m: 3.5 });
    }
    P.b(gC(0.02 * s, 0.026 * s, 0.03 * s, 12), GUN, x, y - 0.032 * s, z + 0.036 * s, {
      rx: 1.1,
      mat: MAT.DARK
    });
    P.g(gB(0.02 * s, 0.006 * s, 0.006, 0.002), glw, x, y - 0.036 * s, z + 0.058 * s, { m: 3 });
  } else if (key === 'tide') {
    P.b(gS(0.05 * s, 18, 14), WHT, x, y, z, { mat: MAT.PAINT });
    P.b(gS(0.044 * s, 18, 14), BLK, x, y + 0.002 * s, z + 0.014 * s, { mat: MAT.GLASS });
    P.g(gT(0.041 * s, 0.0035 * s, 24), glw, x, y + 0.002 * s, z + 0.03 * s, { m: 3 });
    P.b(gB(0.01 * s, 0.07 * s, 0.075 * s, 0.004), K.acc, x, y + 0.045 * s, z - 0.02 * s, {
      rx: -0.35,
      mat: MAT.PAINT
    });
    for (const sx of [-1, 1])
      P.b(
        gC(0.007 * s, 0.007 * s, 0.07 * s, 6),
        GUN,
        x + sx * 0.03 * s,
        y - 0.035 * s,
        z - 0.01 * s,
        { rx: 1, mat: MAT.RUB }
      );
  } else {
    P.b(gS(0.052 * s, 18, 14), WHT, x, y, z, { mat: MAT.PAINT });
    P.b(gB(0.078 * s, 0.03 * s, 0.04 * s, 0.01), BLK, x, y + 0.002 * s, z + 0.03 * s, {
      mat: MAT.GLASS
    });
    P.g(gB(0.062 * s, 0.008 * s, 0.008, 0.003), glw, x, y + 0.003 * s, z + 0.0505 * s, { m: 4.5 });
    P.b(gB(0.012 * s, 0.075 * s, 0.1 * s, 0.005), col, x, y + 0.04 * s, z - 0.012 * s, {
      mat: MAT.PAINT
    });
    for (const sx of [-1, 1])
      P.b(
        gB(0.03 * s, 0.034 * s, 0.05 * s, 0.01),
        col,
        x + sx * 0.045 * s,
        y - 0.015 * s,
        z + 0.012 * s,
        { mat: MAT.PAINT }
      );
    P.g(gT(0.078 * s, 0.004 * s, 36), glw, x, y + 0.012 * s, z - 0.03 * s, { m: 2.6 });
  }
}
function kit(B, key, col, s) {
  const H = Math.PI / 2,
    K = PAL[key],
    glw = K.glow,
    GUN = K.gun;
  col = K.arm;
  if (key === 'helion') {
    part(B, 9, [0, 0.535, -0.075]).b(gCl(0.19 * s, 0.27), K.cloth, 0, 0.4, -0.082, {
      mat: MAT.CLOTH,
      m: 0.8
    });
    B.b(gB(0.2 * s, 0.02, 0.03, 0.008), STL, 0, 0.535, -0.07, { mat: MAT.CHROME });
    B.b(gO(0.022, 0.06, 4), K.acc, -0.128 * s, 0.575, 0, { mat: MAT.PAINT });
  } else if (key === 'verdant') {
    B.b(gT(0.04, 0.009, 18), GUN, 0, 0.47, -0.115, { mat: MAT.DARK });
    B.g(gK(0.026, 0.05), K.acc, 0, 0.47, -0.118, { m: 2.2 });
    for (const sx of [-1, 1])
      B.b(gB(0.012, 0.075, 0.065, 0.005), col, sx * 0.15 * s, 0.555, -0.02, {
        rz: -sx * 0.5,
        mat: MAT.PAINT
      });
  } else if (key === 'choir') {
    for (const sx of [-1, 1]) {
      B.b(gB(0.012, 0.14, 0.075, 0.005), GUN, sx * 0.05, 0.5, -0.125, { rx: 0.15, mat: MAT.DARK });
      B.g(gB(0.004, 0.12, 0.01, 0.002), glw, sx * 0.058, 0.5, -0.162, { rx: 0.15, m: 3 });
    }
    for (const i of [-1, 0, 1])
      B.b(gC(0.006, 0.006, 0.16, 6), STL, i * 0.022, 0.44, -0.1, { mat: MAT.CHROME });
  } else {
    for (const sx of [-1, 1]) {
      B.b(gK(0.022, 0.085), STL, sx * 0.036, 0.47, -0.118, { mat: MAT.STEEL });
      B.g(gC(0.012, 0.012, 0.006, 10), glw, sx * 0.036, 0.537, -0.118, { m: 3 });
      part(B, 9, [sx * 0.045, 0.335, -0.055]).b(
        gCl(0.075, 0.19, 1, 6),
        K.cloth,
        sx * 0.047,
        0.24,
        -0.062,
        { mat: MAT.CLOTH, m: 0.8 }
      );
    }
  }
}
function humanoid(B, key, col, s, pose) {
  const H = Math.PI / 2,
    P = MAT.PAINT,
    R = MAT.RUB,
    D = MAT.DARK,
    ST = MAT.STEEL,
    K = PAL[key],
    glw = K.glow,
    WHT = K.arm2,
    SUIT = K.suit,
    GUN = K.gun;
  col = K.arm;
  for (const sx of [-1, 1]) {
    const hip = [sx * 0.055, 0.3, 0],
      knee = [sx * 0.058, 0.155, 0.01],
      T = part(B, sx < 0 ? 1 : 2, hip),
      S = part(B, sx < 0 ? 7 : 8, knee, hip);
    T.b(gK(0.037, 0.085), SUIT, sx * 0.056, 0.228, 0.004, { mat: R });
    T.b(gB(0.064, 0.1, 0.035, 0.014), col, sx * 0.058, 0.236, 0.03, { mat: P });
    T.b(gB(0.02, 0.085, 0.06, 0.008), GUN, sx * 0.094, 0.236, 0, { mat: D });
    S.b(gS(0.035), GUN, sx * 0.058, 0.155, 0.012, { mat: D });
    S.b(gK(0.03, 0.075), SUIT, sx * 0.058, 0.085, 0, { mat: R });
    S.b(gB(0.06, 0.1, 0.05, 0.02), WHT, sx * 0.058, 0.09, 0.014, { mat: P });
    S.g(gB(0.008, 0.07, 0.008, 0.003), glw, sx * 0.058, 0.09, 0.041, { m: 3 });
    S.b(gB(0.064, 0.036, 0.125, 0.014), GUN, sx * 0.058, 0.018, 0.022, { mat: D });
    S.b(gB(0.066, 0.016, 0.05, 0.006), STL, sx * 0.058, 0.012, 0.07, { mat: ST });
    B.b(gS(0.05), sx < 0 ? WHT : col, sx * 0.128 * s, 0.515, 0, { mat: P, sy: 0.82, sx: 1.06 });
    B.b(gB(0.036, 0.04, 0.03, 0.01), GUN, sx * 0.07, 0.322, 0.046, { mat: D });
    B.g(gB(0.022, 0.05, 0.008, 0.003), glw, sx * 0.035, 0.47, -0.117, { m: 3 });
  }
  B.b(gB(0.15, 0.065, 0.1, 0.03), GUN, 0, 0.315, 0, { mat: D });
  B.b(gB(0.156, 0.022, 0.106, 0.008), BLK, 0, 0.342, 0, { mat: R });
  B.g(gB(0.03, 0.018, 0.01, 0.004), glw, 0, 0.342, 0.056, { m: 3 });
  B.b(gK(0.056, 0.03), SUIT, 0, 0.39, 0, { mat: R, sx: 1.15, sz: 0.85 });
  B.b(gB(0.2 * s, 0.13, 0.135, 0.05), col, 0, 0.47, 0.004, { mat: P });
  B.b(gB(0.15 * s, 0.058, 0.03, 0.012), WHT, 0, 0.502, 0.068, { mat: P });
  B.b(gT(0.022, 0.006, 16), STL, 0, 0.452, 0.072, { mat: MAT.CHROME });
  B.g(gC(0.016, 0.016, 0.012, 12), glw, 0, 0.452, 0.074, { rx: H, m: 4.5 });
  B.b(gB(0.09, 0.012, 0.02, 0.004), GUN, 0, 0.412, 0.06, { mat: D });
  B.b(gB(0.13, 0.12, 0.06, 0.02), GUN, 0, 0.47, -0.085, { mat: D });
  B.b(gC(0.04, 0.05, 0.03, 14), GUN, 0, 0.547, 0, { mat: D });
  const AL = part(B, 4, [-0.128 * s, 0.5, 0]),
    W = part(B, 3, [0.128 * s, 0.5, 0]);
  W.b(gK(0.027, 0.07), SUIT, 0.138 * s, 0.472, 0.043, { rx: -1, mat: R });
  W.b(gS(0.028), GUN, 0.138 * s, 0.446, 0.086, { mat: D });
  W.b(gK(0.026, 0.06), SUIT, 0.132 * s, 0.442, 0.135, { rx: H, mat: R });
  W.b(gB(0.05, 0.05, 0.075, 0.018), col, 0.134 * s, 0.446, 0.135, { mat: P });
  W.b(gS(0.023), SUIT, 0.126 * s, 0.438, 0.185, { mat: R });
  if (pose === 'shield') {
    AL.b(gK(0.03, 0.07), SUIT, -0.14 * s, 0.472, 0.043, { rx: -1, mat: R });
    AL.b(gS(0.03), GUN, -0.14 * s, 0.446, 0.086, { mat: D });
    AL.b(gK(0.028, 0.06), SUIT, -0.13 * s, 0.442, 0.135, { rx: H, mat: R });
    AL.b(gB(0.055, 0.055, 0.08, 0.018), col, -0.132 * s, 0.446, 0.135, { mat: P });
  } else {
    AL.b(gK(0.027, 0.07), SUIT, -0.138 * s, 0.435, 0, { rx: 0.12, mat: R });
    AL.b(gS(0.028), GUN, -0.14 * s, 0.378, 0, { mat: D });
    AL.b(gK(0.026, 0.06), SUIT, -0.14 * s, 0.328, 0.022, { rx: -0.45, mat: R });
    AL.b(gB(0.05, 0.075, 0.05, 0.018), col, -0.146 * s, 0.33, 0.024, { rx: -0.45, mat: P });
    AL.b(gS(0.023), SUIT, -0.14 * s, 0.283, 0.046, { mat: R });
  }
  head(B, key, col, 0, 0.61, 0, 1);
  kit(B, key, col, s);
  return { W, AL, wx: 0.126 * s };
}
const UG = new Map();
function unitGeo(type, key) {
  const k = type + '|' + key;
  let r = UG.get(k);
  if (r) return r;
  const K = PAL[key],
    col = K.arm,
    glw = K.glow,
    WHT = K.arm2,
    SUIT = K.suit,
    GUN = K.gun,
    B = Builder(),
    H = Math.PI / 2,
    P = MAT.PAINT,
    R = MAT.RUB,
    D = MAT.DARK,
    ST = MAT.STEEL;
  if (type === 'trooper') {
    const { W, wx } = humanoid(B, key, col, 1);
    W.b(gB(0.03, 0.046, 0.17, 0.01), GUN, wx, 0.44, 0.235, { mat: D });
    W.b(gB(0.024, 0.03, 0.09, 0.008), SUIT, wx, 0.446, 0.34, { mat: D });
    W.b(gC(0.009, 0.009, 0.13, 10), STL, wx, 0.448, 0.4, { rx: H, mat: ST });
    W.g(gS(0.012), glw, wx, 0.448, 0.47, { m: 5 });
    W.b(gB(0.02, 0.055, 0.03, 0.006), GUN, wx, 0.4, 0.225, { rx: 0.2, mat: D });
    W.b(gB(0.024, 0.04, 0.07, 0.008), GUN, wx, 0.435, 0.125, { mat: D });
    W.b(gB(0.01, 0.014, 0.06, 0.004), STL, wx, 0.47, 0.25, { mat: ST });
    W.g(gS(0.006), glw, wx, 0.474, 0.285, { m: 4 });
    for (const dx of [-0.016, 0.016])
      W.g(gB(0.004, 0.012, 0.09, 0.002), glw, wx + dx, 0.442, 0.24, { m: 3 });
  } else if (type === 'railgunner') {
    const { W, wx } = humanoid(B, key, col, 0.92);
    W.b(gB(0.034, 0.05, 0.18, 0.01), GUN, wx, 0.44, 0.22, { mat: D });
    for (const dx of [-0.011, 0.011])
      W.b(gB(0.009, 0.014, 0.3, 0.004), STL, wx + dx, 0.45, 0.4, { mat: MAT.CHROME });
    for (const z of [0.3, 0.38, 0.46]) W.g(gT(0.024, 0.006, 14), glw, wx, 0.45, z, { m: 3.5 });
    W.g(gS(0.016), glw, wx, 0.45, 0.56, { m: 5.5 });
    W.b(gC(0.016, 0.02, 0.1, 12), GUN, wx, 0.487, 0.24, { rx: H, mat: D });
    W.g(gC(0.013, 0.013, 0.004, 10), glw, wx, 0.487, 0.292, { rx: H, m: 3 });
    W.b(gB(0.026, 0.045, 0.08, 0.008), GUN, wx, 0.435, 0.105, { mat: D });
    W.b(gB(0.03, 0.04, 0.05, 0.008), col, wx, 0.405, 0.2, { mat: P });
  } else if (type === 'bulwark') {
    const { W, AL, wx } = humanoid(B, key, col, 1.18, 'shield');
    for (const sx of [-1, 1])
      B.b(gB(0.09, 0.05, 0.11, 0.02), col, sx * 0.165, 0.552, 0, { mat: P });
    AL.b(gB(0.06, 0.08, 0.02, 0.008), GUN, -0.11, 0.44, 0.19, { mat: D });
    AL.h(gB(0.3, 0.42, 0.01, 0.004), glw, -0.05, 0.4, 0.215, { m: 0.9 });
    for (const y of [0.188, 0.612])
      AL.b(gB(0.31, 0.016, 0.02, 0.006), STL, -0.05, y, 0.215, { mat: ST });
    for (const dx of [-0.155, 0.155])
      AL.b(gB(0.016, 0.43, 0.02, 0.006), STL, -0.05 + dx, 0.4, 0.215, { mat: ST });
    AL.g(gB(0.2, 0.008, 0.006, 0.002), glw, -0.05, 0.4, 0.224, { m: 3 });
    AL.g(gB(0.008, 0.26, 0.006, 0.002), glw, -0.05, 0.4, 0.224, { m: 3 });
    AL.g(gC(0.03, 0.03, 0.008, 6), glw, -0.05, 0.4, 0.226, { rx: H, m: 3.5 });
    W.b(gC(0.011, 0.011, 0.22, 8), STL, wx, 0.49, 0.27, { rx: H - 0.5, mat: ST });
    W.g(gK(0.014, 0.05), glw, wx, 0.56, 0.36, { rx: H - 0.5, m: 4 });
  } else if (type === 'skimmer') {
    B.b(gK(0.055, 0.3), col, 0, 0.2, 0, { rx: H, mat: P, sx: 0.92 });
    B.b(gO(0.055, 0.15, 14), WHT, 0, 0.2, 0.275, { rx: H, mat: P, sx: 0.92 });
    B.b(gS(0.05, 16, 12), BLK, 0, 0.255, 0.12, { mat: MAT.GLASS, sy: 0.7, sz: 1.3 });
    B.b(gB(0.07, 0.03, 0.13, 0.012), SUIT, 0, 0.248, -0.045, { mat: R });
    B.b(gC(0.05, 0.06, 0.1, 14), GUN, 0, 0.2, -0.2, { rx: H, mat: D });
    B.g(gC(0.036, 0.03, 0.02, 14), glw, 0, 0.2, -0.258, { rx: H, m: 5 });
    B.h(gO(0.04, 0.26, 12), glw, 0, 0.2, -0.39, { rx: -H, m: 1.4 });
    B.b(gB(0.01, 0.11, 0.11, 0.004), col, 0, 0.3, -0.2, { mat: P });
    B.h(gC(0.19, 0.19, 0.004, 24), glw, 0, 0.07, 0, { m: 0.45 });
    for (const sx of [-1, 1]) {
      B.b(gK(0.028, 0.2), GUN, sx * 0.1, 0.17, 0, { rx: H, mat: D });
      B.g(gT(0.024, 0.006, 14), glw, sx * 0.1, 0.17, 0.115, { m: 3.5 });
      B.b(gB(0.1, 0.008, 0.09, 0.004), col, sx * 0.16, 0.18, -0.12, { rz: -sx * 0.3, mat: P });
      B.g(gB(0.006, 0.01, 0.2, 0.002), glw, sx * 0.129, 0.17, 0, { m: 3 });
      for (const z of [0.06, -0.1])
        B.g(gC(0.04, 0.04, 0.006, 14), glw, sx * 0.1, 0.128, z, { m: 2.2 });
      B.b(gK(0.03, 0.07), SUIT, sx * 0.06, 0.265, 0.03, { rx: 1.3, mat: R });
      B.b(gB(0.05, 0.035, 0.08, 0.012), col, sx * 0.064, 0.275, 0.035, { rx: -0.27, mat: P });
      B.b(gK(0.026, 0.06), SUIT, sx * 0.085, 0.205, 0.078, { mat: R });
      B.b(gB(0.05, 0.03, 0.09, 0.01), GUN, sx * 0.088, 0.152, 0.09, { mat: D });
      B.b(gK(0.024, 0.09), SUIT, sx * 0.08, 0.355, 0.09, { rx: -0.84, mat: R });
      B.b(gS(0.02), SUIT, sx * 0.075, 0.312, 0.14, { mat: R });
      B.b(gS(0.036), sx < 0 ? WHT : col, sx * 0.085, 0.405, 0.035, { mat: P, sy: 0.8 });
    }
    B.b(gB(0.15, 0.13, 0.11, 0.045), col, 0, 0.36, -0.005, { rx: 0.4, mat: P });
    B.b(gB(0.1, 0.09, 0.05, 0.02), GUN, 0, 0.375, -0.07, { rx: 0.4, mat: D });
    B.b(gC(0.006, 0.006, 0.17, 6), STL, 0, 0.31, 0.14, { rz: H, mat: ST });
    B.g(gS(0.016), '#ffffff', 0, 0.2, 0.352, { m: 4 });
    head(B, key, col, 0, 0.47, 0.05, 0.9);
    part(B, 9, [0, 0.43, -0.04]).b(gCl(0.05, 0.18, 1, 6), K.cloth, 0, 0.34, -0.06, {
      mat: MAT.CLOTH,
      m: 0.8
    });
  } else if (type === 'mech') {
    const K = part(B, 6, [0, 0, 1]);
    for (const sx of [-1, 1]) {
      const hip = [sx * 0.13, 0.42, 0],
        knee = [sx * 0.14, 0.25, -0.07],
        T = part(B, sx < 0 ? 1 : 2, hip),
        S = part(B, sx < 0 ? 7 : 8, knee, hip);
      T.b(gC(0.05, 0.05, 0.04, 16), STL, sx * 0.135, 0.42, 0, { rz: H, mat: ST });
      T.b(gB(0.085, 0.2, 0.1, 0.03), GUN, sx * 0.135, 0.335, -0.035, { rx: 0.42, mat: D });
      T.b(gB(0.03, 0.16, 0.11, 0.012), col, sx * 0.185, 0.34, -0.035, { rx: 0.42, mat: P });
      S.b(gC(0.042, 0.042, 0.05, 14), STL, sx * 0.14, 0.25, -0.07, { rz: H, mat: ST });
      S.b(gB(0.07, 0.2, 0.08, 0.025), GUN, sx * 0.14, 0.16, -0.02, { rx: -0.5, mat: D });
      S.b(gB(0.074, 0.13, 0.03, 0.012), WHT, sx * 0.14, 0.165, 0.022, { rx: -0.5, mat: P });
      S.b(gB(0.11, 0.04, 0.2, 0.018), GUN, sx * 0.14, 0.022, 0.05, { mat: D });
      for (const dx of [-0.03, 0.03])
        S.b(gB(0.04, 0.03, 0.06, 0.01), STL, sx * 0.14 + dx, 0.018, 0.165, { mat: ST });
      S.g(gS(0.016), glw, sx * 0.182, 0.075, 0.03, { m: 3.5 });
      S.b(gC(0.012, 0.012, 0.16, 8), STL, sx * 0.105, 0.17, -0.06, { rx: -0.3, mat: MAT.CHROME });
      B.b(gB(0.11, 0.14, 0.2, 0.03), GUN, sx * 0.215, 0.7, -0.01, { mat: D });
      B.b(gB(0.115, 0.03, 0.205, 0.01), col, sx * 0.215, 0.775, -0.01, { mat: P });
      for (let i = 0; i < 4; i++) {
        B.b(
          gC(0.02, 0.02, 0.03, 10),
          BLK,
          sx * (0.19 + (i % 2) * 0.05),
          0.675 + (i >> 1) * 0.055,
          0.085,
          { rx: H, mat: D }
        );
        B.g(gS(0.012), glw, sx * (0.19 + (i % 2) * 0.05), 0.675 + (i >> 1) * 0.055, 0.098, {
          m: 3.5
        });
      }
      K.b(gB(0.06, 0.07, 0.1, 0.02), GUN, sx * 0.2, 0.58, 0.07, { mat: D });
      for (const dx of [-0.018, 0.018])
        K.b(gC(0.016, 0.016, 0.26, 10), STL, sx * 0.2 + dx, 0.58, 0.24, { rx: H, mat: ST });
      K.g(gT(0.03, 0.006, 14), glw, sx * 0.2, 0.58, 0.365, { m: 3.5 });
      B.b(gC(0.02, 0.024, 0.12, 10), STL, sx * 0.09, 0.79, -0.14, { mat: ST });
      B.g(gB(0.012, 0.1, 0.008, 0.003), glw, sx * 0.03, 0.66, -0.254, { m: 3 });
    }
    B.b(gB(0.22, 0.08, 0.16, 0.03), GUN, 0, 0.44, 0, { mat: D });
    B.b(gC(0.06, 0.07, 0.05, 16), STL, 0, 0.5, 0, { mat: ST });
    B.b(gB(0.3, 0.2, 0.3, 0.06), col, 0, 0.63, 0, { mat: P });
    B.b(gB(0.2, 0.08, 0.2, 0.03), GUN, 0, 0.54, 0.05, { mat: D });
    B.b(gS(0.1, 18, 12), BLK, 0, 0.67, 0.11, { mat: MAT.GLASS, sx: 1.15, sy: 0.75 });
    B.g(gB(0.16, 0.008, 0.008, 0.003), glw, 0, 0.635, 0.212, { m: 3.5 });
    B.b(gB(0.24, 0.03, 0.1, 0.012), WHT, 0, 0.735, 0.1, { mat: P });
    B.b(gC(0.07, 0.07, 0.14, 16), GUN, 0, 0.66, -0.18, { mat: D });
    B.b(gC(0.004, 0.004, 0.2, 5), GUN, -0.12, 0.84, -0.06, { mat: D });
    B.g(gS(0.012), glw, -0.12, 0.945, -0.06, { m: 4.5 });
    B.g(gS(0.018), '#ffffff', -0.1, 0.76, 0.16, { m: 4 });
    head(B, key, col, 0.04, 0.8, 0.0, 0.78);
  } else {
    const dir = [0, 0.605, 0.796],
      K = part(B, 6, dir);
    for (const sx of [-1, 1]) {
      B.b(gB(0.09, 0.085, 0.5, 0.04), BLK, sx * 0.19, 0.05, 0, { mat: R });
      B.b(gB(0.11, 0.02, 0.5, 0.008), col, sx * 0.19, 0.102, 0, { mat: P });
      for (const z of [-0.18, -0.06, 0.06, 0.18]) {
        B.b(gC(0.035, 0.035, 0.1, 12), STL, sx * 0.2, 0.045, z, { rz: H, mat: ST });
        B.g(gC(0.012, 0.012, 0.006, 8), glw, sx * 0.252, 0.045, z, { rz: H, m: 2.5 });
      }
      B.g(gB(0.012, 0.05, 0.14, 0.004), glw, sx * 0.106, 0.23, -0.02, { m: 2.5 });
      B.b(gB(0.03, 0.03, 0.14, 0.01), GUN, sx * 0.13, 0.07, -0.27, { rx: 0.5, mat: D });
    }
    B.b(gB(0.3, 0.09, 0.46, 0.035), GUN, 0, 0.105, 0, { mat: D });
    B.b(gB(0.28, 0.06, 0.14, 0.02), col, 0, 0.15, 0.17, { rx: 0.5, mat: P });
    B.b(gB(0.26, 0.05, 0.14, 0.02), GUN, 0, 0.16, -0.17, { mat: D });
    for (const dx of [-0.06, 0, 0.06])
      B.g(gB(0.03, 0.006, 0.1, 0.002), glw, dx, 0.187, -0.17, { m: 2.5 });
    B.b(gC(0.12, 0.13, 0.03, 20), STL, 0, 0.165, 0, { mat: ST });
    B.b(gB(0.2, 0.1, 0.24, 0.04), col, 0, 0.23, -0.01, { mat: P });
    B.b(gB(0.1, 0.08, 0.06, 0.02), GUN, 0, 0.25, 0.12, { mat: D });
    K.b(gC(0.028, 0.036, 0.4, 14), STL, 0, 0.25 + dir[1] * 0.2, 0.1 + dir[2] * 0.2, {
      rx: H - 0.65,
      mat: ST
    });
    for (const t of [0.1, 0.19, 0.28])
      K.g(gT(0.044, 0.009, 14), glw, 0, 0.25 + dir[1] * t, 0.1 + dir[2] * t, { rx: -0.65, m: 3.5 });
    K.b(gC(0.042, 0.042, 0.05, 14), GUN, 0, 0.25 + dir[1] * 0.4, 0.1 + dir[2] * 0.4, {
      rx: H - 0.65,
      mat: D
    });
    K.g(gS(0.028), glw, 0, 0.25 + dir[1] * 0.44, 0.1 + dir[2] * 0.44, { m: 5.5 });
    B.b(gC(0.004, 0.004, 0.1, 5), GUN, -0.07, 0.33, -0.1, { mat: D });
    B.b(gC(0.05, 0.02, 0.02, 14), STL, -0.07, 0.385, -0.1, { rx: -0.6, mat: ST });
    B.b(gB(0.08, 0.06, 0.07, 0.02), col, 0.05, 0.3, -0.06, { mat: P });
    head(B, key, col, 0.05, 0.37, -0.06, 0.72);
  }
  r = B.out();
  UG.set(k, r);
  return r;
}
