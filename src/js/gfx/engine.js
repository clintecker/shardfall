'use strict';
/*
 * One-time WebGL setup: the renderer, the HDR post-processing chain, the shared materials and
 * geometries (mkAssets), and the image-based lighting environment.
 *
 * ensureGL() is safe to call repeatedly and returns false if WebGL is unavailable, in which
 * case the page shows a plain message instead of a black rectangle.
 */
function ensureGL() {
  if (GL) return true;
  if (GLfail) return false;
  try {
    if (!T3 || !T3.EffectComposer || !T3.RoundedBoxGeometry || !T3.UnrealBloomPass)
      throw new Error('3D library did not load');
    const renderer = new T3.WebGLRenderer({
      canvas: cv,
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.outputEncoding = T3.LinearEncoding;
    renderer.toneMapping = T3.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;
    ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const hdr =
      renderer.capabilities.isWebGL2 && !!renderer.extensions.get('EXT_color_buffer_float');
    const scene = new T3.Scene(),
      fogC = lin('#0e0828');
    scene.background = fogC;
    scene.fog = new T3.FogExp2(fogC, 0.012);
    const camera = new T3.PerspectiveCamera(34, 1.3, 0.1, 500);
    const sun = new T3.DirectionalLight(lin('#e2e8ff'), 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    const hemi = new T3.HemisphereLight(lin('#8794ff'), lin('#ff3fd0'), 0.32);
    const rim = new T3.DirectionalLight(lin('#ff3fd0'), 0.55);
    rim.position.set(8, 3, -6);
    const fill = new T3.DirectionalLight(lin('#27e0ff'), 0.32);
    fill.position.set(6, 5, 9);
    scene.add(sun, sun.target, hemi, rim, fill);
    const pm = new T3.PMREMGenerator(renderer),
      es = new T3.Scene(),
      esky = new T3.MeshBasicMaterial({ color: lin('#0c0b28'), side: T3.BackSide });
    es.add(new T3.Mesh(new T3.SphereGeometry(60, 24, 12), esky));
    const panel = (x, y, z, sx, sy) => {
      const m = new T3.MeshBasicMaterial({ side: T3.DoubleSide }),
        q = new T3.Mesh(new T3.PlaneGeometry(sx, sy), m);
      q.position.set(x, y, z);
      q.lookAt(0, 0, 0);
      es.add(q);
      return m;
    };
    const env = {
      pm,
      scene: es,
      sky: esky,
      key: panel(-20, 30, 14, 20, 20),
      a: panel(30, 5, -20, 44, 9),
      b: panel(-12, 4, 34, 44, 9),
      floor: panel(0, -30, 0, 70, 70),
      rt: null
    };
    const rt = new T3.WebGLRenderTarget(4, 4, {
        type: hdr ? T3.HalfFloatType : T3.UnsignedByteType,
        samples: coarse ? 2 : 4
      }),
      depth = renderer.capabilities.isWebGL2;
    if (depth) {
      rt.depthTexture = new T3.DepthTexture(4, 4);
      rt.depthTexture.type = T3.UnsignedIntType;
      rt.depthTexture.format = T3.DepthFormat;
    }
    const composer = new T3.EffectComposer(renderer, rt);
    composer.addPass(new T3.RenderPass(scene, camera));
    const bloom = new T3.UnrealBloomPass(new T3.Vector2(256, 256), 0.62, 0.5, hdr ? 1.15 : 0.86);
    composer.addPass(bloom);
    FIN.uniforms.uRes.value = new T3.Vector2(1, 1);
    FIN.uniforms.uInvVP.value = new T3.Matrix4();
    FIN.uniforms.uInvP.value = new T3.Matrix4();
    FIN.uniforms.uCam.value = new T3.Vector3();
    FIN.uniforms.uTS.value = new T3.Vector3(1, 1, 1);
    FIN.uniforms.uTH.value = new T3.Vector3(1, 1, 1);
    const fin = new T3.ShaderPass(FIN);
    composer.addPass(fin);
    fin.material.extensions.derivatives = true;
    fin.uniforms.tStreak.value = bloom.renderTargetsVertical[2].texture;
    fin.uniforms.uMode.value = depth ? 1 : 0;
    fin.uniforms.uNear.value = camera.near;
    fin.uniforms.uFar.value = camera.far;
    const fr = fin.render.bind(fin);
    fin.render = (a, b, rb, c, e) => {
      fin.uniforms.tDepth.value = rb.depthTexture || null;
      fr(a, b, rb, c, e);
    };
    SCAN = lin('#9fe8ff', 1.6);
    FPOS.value = new T3.Vector3();
    GL = {
      renderer,
      scene,
      camera,
      composer,
      bloom,
      fin,
      sun,
      hemi,
      rim,
      fill,
      env,
      sunDir: new T3.Vector3(-0.55, 1.05, 0.42).normalize(),
      hdr,
      depth,
      q: 0,
      glideT: 0,
      checked: false
    };
    GL.A = mkAssets();
    mkEnvironment();
    mkAtmos();
    mkParticles();
    mkAction();
    mkPools();
    mkPortrait();
    applyAtmo('storm');
    applySet();
    return true;
  } catch (err) {
    GLfail = true;
    GL = null;
    const m = $('#glfail');
    if (m) m.hidden = false;
    console.error(err);
    return false;
  }
}
function mkAssets() {
  const S = o => new T3.MeshStandardMaterial(o),
    Bm = o => new T3.MeshBasicMaterial(o),
    A = {};
  const add = {
    transparent: true,
    blending: T3.AdditiveBlending,
    depthWrite: false,
    side: T3.DoubleSide
  };
  const pf = mkPlate('#0c0f24', 64, 2);
  A.bio = {};
  A.gTile = new T3.RoundedBoxGeometry(0.97, 0.3, 0.97, 3, 0.045);
  A.gFog = new T3.RoundedBoxGeometry(0.94, 0.3, 0.94, 3, 0.07);
  const plate = (p, em, ei, met, env, pulse) => {
    const m = S({
      map: p.map,
      emissiveMap: p.emissiveMap,
      normalMap: p.normalMap,
      normalScale: new T3.Vector2(0.9, 0.9),
      roughnessMap: p.roughnessMap,
      roughness: 1,
      emissive: lin(em),
      emissiveIntensity: ei,
      metalness: met,
      envMapIntensity: env
    });
    if (pulse) m.onBeforeCompile = pulsePatch;
    return m;
  };
  A.mFog = plate(pf, '#7a5cff', 0.5, 0.7, 0.5, 0);
  A.mFog.normalScale.set(0.45, 0.45);
  A.waves = mkWaves();
  A.gUCyl = new T3.CylinderGeometry(1, 1, 1, 7).translate(0, 0.5, 0);
  A.gUBox = new T3.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  A.mDecor = S({ metalness: 0.35, roughness: 0.5, flatShading: true });
  A.mDecorGlow = S({ metalness: 0.15, roughness: 0.4, flatShading: true });
  A.mDecorHDR = Bm({ color: 0xffffff });
  A.mDecorGlow.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance+=vColor.rgb*.6;\n#endif'
    );
  };
  A.gTrunk = new T3.CylinderGeometry(0.018, 0.03, 1, 6).translate(0, 0.5, 0);
  A.gCone = new T3.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
  A.gSph = new T3.SphereGeometry(1, 14, 10);
  A.gOct = new T3.OctahedronGeometry(1, 0);
  A.gDish = new T3.CylinderGeometry(1, 1.08, 0.04, 20);
  A.gDome = new T3.SphereGeometry(1, 18, 9, 0, 6.2832, 0, 1.5708);
  A.gFlat = new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  A.gFall = new T3.PlaneGeometry(0.95, 1.6).translate(0, -0.8, 0);
  A.gRing = new T3.TorusGeometry(0.3, 0.011, 6, 40);
  A.gBeam = new T3.CylinderGeometry(1, 1, 1, 10, 1, true);
  A.mPeak = S({ vertexColors: true, flatShading: true, metalness: 0.25, roughness: 0.6 });
  A.mOre = S({
    color: lin('#ffb347'),
    emissive: lin('#ff9a1f'),
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.2,
    flatShading: true
  });
  A.mPod = S({
    color: lin('#8fe04a'),
    emissive: lin('#a8ff3e'),
    emissiveIntensity: 1.5,
    roughness: 0.3
  });
  A.mDish = S({ color: lin(DK), metalness: 0.8, roughness: 0.35 });
  A.mGlass = S({
    color: lin('#9fe8ff'),
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.38,
    envMapIntensity: 2
  });
  A.mBody = S({ vertexColors: true, metalness: 0.6, roughness: 0.34, envMapIntensity: 1.15 });
  A.mGlow = Bm({ vertexColors: true });
  A.mGlowLDR = Bm({ vertexColors: true, color: new T3.Color(0.36, 0.36, 0.36) });
  A.mUnit = new T3.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 1,
    roughness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.25,
    normalMap: mkDetail(),
    normalScale: new T3.Vector2(0.32, 0.32)
  });
  A.mUnitGlow = Bm({ vertexColors: true });
  A.mUnitDepth = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking });
  A.mUnitHolo = Bm({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: T3.AdditiveBlending,
    depthWrite: false,
    side: T3.DoubleSide
  });
  A.win = mkWindows('#9a9a9a', 0.5, 77);
  A.mTower = {};
  A.glow = mkGlow();
  A.mPool = Bm({
    map: A.glow,
    transparent: true,
    blending: T3.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  A.mDrone = Bm({ color: 0xffffff });
  const mark = (hex, m, kind) =>
    new T3.ShaderMaterial(
      Object.assign(
        {
          uniforms: { uColor: { value: lin(hex, m) }, uTime: TIME, uKind: { value: kind } },
          vertexShader: VS_UV,
          fragmentShader: FS_MARK
        },
        add
      )
    );
  A.mMove = mark('#bff4ff', 1.5, 0);
  A.mAtk = mark('#ff3d5a', 2.4, 1);
  A.mSel = mark('#ffffff', 1.8, 2);
  A.mHover = mark('#ffffff', 0.9, 3);
  A.mTerr = new T3.ShaderMaterial(
    Object.assign(
      {
        uniforms: { uTime: TIME },
        vertexShader:
          'attribute vec3 color;attribute float aT;uniform float uTime;varying vec3 vC;varying vec2 vU;varying float vG;void main(){vC=color;vU=uv;vG=clamp((uTime-aT)/.9,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: FS_TERR
      },
      add
    )
  );
  A.mFall = new T3.ShaderMaterial(
    Object.assign(
      { uniforms: { uTime: TIME }, vertexShader: VS_SIGN, fragmentShader: FS_FALL },
      add
    )
  );
  A.beam = (hex, m, flip) => {
    const x = new T3.ShaderMaterial(
      Object.assign(
        {
          uniforms: { uColor: { value: lin(hex, m) }, uFlip: { value: flip }, uTime: TIME },
          vertexShader: VS_UV,
          fragmentShader: FS_BEAM
        },
        add
      )
    );
    x.userData.own = true;
    return x;
  };
  return A;
}
const TW = {
  helion: ['#b08a55', 0.25, 0.55],
  verdant: ['#2f6a52', 0.3, 0.5],
  choir: ['#1b1828', 0.9, 0.2],
  tide: ['#b9d2e2', 0.3, 0.25],
  '': ['#39406e', 0.7, 0.3]
};
function towerMat(key, col) {
  const A = GL.A,
    t = TW[key];
  return (
    A.mTower[key] ||
    (A.mTower[key] = new T3.MeshStandardMaterial({
      map: A.win.map,
      color: lin(t[0]),
      emissiveMap: A.win.emissiveMap,
      emissive: lin(key ? col : '#ffd9a0'),
      emissiveIntensity: key ? 2.6 : 0.9,
      metalness: t[1],
      roughness: t[2]
    }))
  );
}
function mkEnvironment() {
  const { scene, A } = GL,
    r = rng(9);
  const grid = new T3.Mesh(
    new T3.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2),
    new T3.ShaderMaterial({
      uniforms: {
        uFog: { value: scene.fog.color },
        uTime: TIME,
        uC1: { value: new T3.Color(1, 0.12, 0.75) },
        uC2: { value: new T3.Color(0.1, 0.75, 1) },
        uGI: { value: 1 }
      },
      extensions: { derivatives: true },
      vertexShader:
        'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: FS_GRID
    })
  );
  grid.position.y = -46;
  scene.add(grid);
  GL.grid = grid.material;
  const ct = mkWindows('#05060f', 0.28, 31, 12, 48);
  GL.cityTex = ct.emissiveMap;
  const n = 760,
    bm = new T3.InstancedMesh(
      new T3.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new T3.MeshBasicMaterial({ map: ct.emissiveMap }),
      n
    );
  const pal = [lin('#27e0ff'), lin('#ff3fd0'), lin('#ffb347'), lin('#b9c4ff'), lin('#7a5cff')];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283,
      d = 46 + Math.pow(r(), 0.75) * 260,
      w = 3 + r() * 4,
      dp = 3 + r() * 4,
      h = 4 + r() * r() * 17 + (r() < 0.07 ? 8 : 0);
    _m.compose(
      _p.set(
        Math.round((Math.cos(a) * d) / 8) * 8 + 4,
        -46,
        Math.round((Math.sin(a) * d) / 8) * 8 + 4
      ),
      _q.identity(),
      _s.set(w, h, dp)
    );
    bm.setMatrixAt(i, _m);
    bm.setColorAt(i, _c.copy(pal[(r() * pal.length) | 0]).multiplyScalar(0.5 + r() * 0.9));
  }
  bm.frustumCulled = false;
  scene.add(bm);
  for (let i = 0; i < 8; i++) {
    const sp = new T3.Sprite(
      new T3.SpriteMaterial({
        map: A.glow,
        color: pal[i % 3].clone().multiplyScalar(0.4),
        blending: T3.AdditiveBlending,
        depthWrite: false,
        fog: false,
        transparent: true,
        opacity: 0.24
      })
    );
    const a = r() * 6.283,
      d = 18 + r() * 60;
    sp.position.set(Math.cos(a) * d * 2.2, -44, Math.sin(a) * d * 2.2);
    sp.scale.setScalar(90 + r() * 70);
    scene.add(sp);
  }
  const tn = reduce ? 0 : 80,
    cars = [];
  if (tn) {
    const tm = new T3.InstancedMesh(
      new T3.BoxGeometry(3, 0.18, 0.3),
      new T3.MeshBasicMaterial({ color: 0xffffff }),
      tn
    );
    tm.frustumCulled = false;
    scene.add(tm);
    for (let i = 0; i < tn; i++) {
      cars.push({
        ax: r() < 0.5,
        lane: Math.round((r() * 280 - 140) / 8) * 8,
        y: -45 + r() * 16,
        p: r() * 360 - 180,
        v: (12 + r() * 26) * (r() < 0.5 ? -1 : 1)
      });
      tm.setColorAt(i, _c.copy(pal[(r() * 3) | 0]).multiplyScalar(2.6));
    }
    GL.traffic = { tm, cars };
  }
}
