'use strict';
/*
 * GLSL. Small shaders for effects that are cheaper to write by hand than to build from stock
 * materials: selection markers, beams, territory borders, the neon grid floor, heat haze,
 * holographic signs, and FIN, the final full-screen pass.
 *
 * FIN does, in one draw: depth of field, ambient occlusion from the depth buffer, lens streaks
 * from the bloom chain, ACES tone mapping, gamma, a split-tone color grade, vignette, scanlines
 * and film grain. docs/RENDERING.md walks through it.
 */
const VS_UV = `varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const FS_MARK = `uniform vec3 uColor;uniform float uTime,uKind;varying vec2 vUv;
void main(){vec2 p=vUv-.5;float d=max(abs(p.x),abs(p.y)),line=smoothstep(.03,0.,abs(d-.44)),a;
if(uKind<.5){float dm=abs(p.x)+abs(p.y);a=line*.9+smoothstep(.13,.1,dm)*1.2+(1.-smoothstep(0.,.46,d))*.12;a*=.65+.35*sin(uTime*4.);}
else if(uKind<1.5){float cr=smoothstep(.028,0.,min(abs(p.x),abs(p.y)))*step(.1,d)*step(d,.32);a=line*1.3+cr+step(d,.46)*.22;a*=.7+.3*sin(uTime*7.);}
else if(uKind<2.5){float br=line*step(.24,min(abs(p.x),abs(p.y)));a=br*1.8+line*.3+step(d,.46)*.05;a*=.8+.2*sin(uTime*5.);}
else a=line*.55+step(d,.46)*.045;
gl_FragColor=vec4(uColor*a,1.);}`;
const FS_BEAM = `uniform vec3 uColor;uniform float uFlip,uTime;varying vec2 vUv;
void main(){float t=mix(vUv.y,1.-vUv.y,uFlip);float a=pow(t,2.2)*(.75+.25*sin(vUv.y*40.-uTime*6.));gl_FragColor=vec4(uColor*a,1.);}`;
const FS_FALL = `uniform float uTime;varying vec2 vUv;varying vec3 vC;float h(float x){return fract(sin(x*91.7)*43758.5);}
void main(){float c=floor(vUv.x*14.);float s=fract(vUv.y*1.5+uTime*(.5+h(c)*.6)+h(c+3.));float st=smoothstep(0.,.15,s)*smoothstep(.6,.15,s);
float a=pow(vUv.y,1.6)*(.3+.7*st*step(.25,h(c+7.)));gl_FragColor=vec4(vC*a*1.5,1.);}`;
const FS_TERR = `uniform float uTime;varying vec3 vC;varying vec2 vU;varying float vG;
void main(){float a=vG*(1.+2.8*(1.-vG));if(vU.x>.5)a*=step(vU.y,vG*1.05)*pow(1.-vU.y,2.)*(.6+.4*sin(uTime*2.5+vU.y*16.));gl_FragColor=vec4(vC*a,1.);}`;
const FS_GRID = `uniform vec3 uFog,uC1,uC2;uniform float uTime,uGI;varying vec3 vW;
float ln(vec2 g){vec2 f=abs(fract(g-.5)-.5)/fwidth(g);return 1.-min(min(f.x,f.y),1.);}
void main(){float d=length(vW.xz);float l=ln(vW.xz/8.)*.3+ln(vW.xz/40.)*.6;
vec3 c=mix(uC1,uC2,.5+.5*sin(vW.x*.03+vW.z*.021));
vec3 col=uFog*.2+c*l*(.75+.25*sin(d*.12-uTime*1.2))*1.2*uGI;
gl_FragColor=vec4(mix(uFog,col,exp(-d*d*.00004)),1.);}`;
const FLASH = { value: 0 },
  FPOS = { value: null };
const FS_HAZE = `uniform float uTime,uA,uS,uFlash;uniform vec3 uCol,uFP;varying vec3 vW;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
void main(){vec2 p=vW.xz*uS+vec2(uTime*.012,uTime*.007);float f=n(p)*.55+n(p*2.3+7.)*.3+n(p*5.1+3.)*.15;
float fl=uFlash*exp(-distance(vW.xz,uFP.xz)*.035);
float a=smoothstep(.4,.78,f)*uA*exp(-dot(vW.xz,vW.xz)*.00004);gl_FragColor=vec4(uCol*.5+vec3(.55,.65,1.)*fl*1.6,a+fl*.3*smoothstep(.25,.7,f));}`;
const VS_SIGN = `varying vec2 vUv;varying vec3 vC;void main(){vUv=uv;vC=vec3(1.);
#ifdef USE_INSTANCING_COLOR
vC=instanceColor;
#endif
vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const FS_SIGN = `uniform float uTime;varying vec2 vUv;varying vec3 vC;
float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
void main(){float sd=vC.r*7.+vC.b*3.;vec2 q=vUv*vec2(5.,20.)+vec2(0.,uTime*(.6+fract(sd)*1.2));vec2 c=floor(q),f=fract(q);
float gl=step(.42,h(c+sd))*step(.12,f.x)*step(f.x,.88)*step(.16,f.y)*step(f.y,.84)*(.45+.55*step(.5,h(c*3.1+floor(f*3.))));
float fr=min(1.,step(vUv.x,.035)+step(.965,vUv.x)+step(vUv.y,.01)+step(.99,vUv.y));
gl_FragColor=vec4(vC*(gl*1.5+fr*.9)*(.8+.2*sin(uTime*11.+sd*20.)),1.);}`;
const FIN = {
  uniforms: {
    tDiffuse: { value: null },
    tStreak: { value: null },
    tDepth: { value: null },
    uTime: { value: 0 },
    uRes: { value: null },
    uExp: { value: 1.05 },
    uInvVP: { value: null },
    uInvP: { value: null },
    uCam: { value: null },
    uTS: { value: null },
    uTH: { value: null },
    uFocus: { value: 10 },
    uHalf: { value: 6 },
    uDof: { value: 0 },
    uDead: { value: 0.13 },
    uStreak: { value: 0.05 },
    uMode: { value: 0 },
    uNear: { value: 0.1 },
    uFar: { value: 500 },
    uAo: { value: 0 },
    uAoR: { value: 0.5 },
    uAsp: { value: 1 }
  },
  vertexShader:
    'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `#define TAPS ${coarse ? 10 : 18}
uniform sampler2D tDiffuse,tStreak,tDepth;uniform float uTime,uExp,uFocus,uHalf,uDof,uDead,uStreak,uMode,uNear,uFar,uAo,uAoR,uAsp;uniform vec2 uRes;uniform mat4 uInvVP,uInvP;uniform vec3 uCam,uTS,uTH;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float coc(vec2 uv){float t=400.;
if(uMode>.5){float z=texture2D(tDepth,uv).x*2.-1.;t=2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
else{vec4 p=uInvVP*vec4(uv*2.-1.,1.,1.);vec3 d=normalize(p.xyz/p.w-uCam);
if(d.y<-.001){float tp=-uCam.y/d.y;vec3 q=uCam+d*tp;
if(max(abs(q.x),abs(q.z))<uHalf)t=tp;
else{vec3 inv=1./d,t0=(vec3(-uHalf,-3.,-uHalf)-uCam)*inv,t1=(vec3(uHalf,1.3,uHalf)-uCam)*inv,tn=min(t0,t1),tf=max(t0,t1);
float a=max(max(tn.x,tn.y),tn.z),b=min(min(tf.x,tf.y),tf.z);
if(a<b&&b>0.)t=(uCam.y+a*d.y>0.)?b:max(a,0.);else t=min(400.,(-46.-uCam.y)/d.y);}}}
return clamp(abs(t-uFocus)/t-uDead,0.,1.)*uDof;}
vec3 vpos(vec2 uv){float z=texture2D(tDepth,uv).x*2.-1.;vec4 p=uInvP*vec4(uv*2.-1.,z,1.);return p.xyz/p.w;}
float aoc(vec2 uv,float rot){vec3 P=vpos(uv),n=normalize(cross(dFdx(P),dFdy(P)));float rad=uAoR/max(-P.z,.5),occ=0.;
for(int i=0;i<8;i++){float fi=float(i)+.5,a=fi*2.39996+rot;vec2 o=vec2(cos(a)/uAsp,sin(a))*sqrt(fi/8.)*rad;vec3 v=vpos(uv+o)-P;float l=length(v)+1e-4;occ+=max(0.,dot(n,v)/l-.16)*smoothstep(.8,0.,l);}
return 1.-min(.8,occ/8.*uAo)*step(-P.z,160.);}
void main(){vec2 d=vUv-.5;float r2=dot(d,d),rot=h(vUv*uRes)*6.283;vec3 c;float c0=uDof>0.?coc(vUv):0.,av=1.;
if(uAo>0.)av=aoc(vUv,rot);
if(c0>.6){vec2 px=1./uRes;float ws=1.;c=texture2D(tDiffuse,vUv).rgb;
for(int i=0;i<TAPS;i++){float fi=float(i)+.5,a=fi*2.39996+rot;vec2 uv=vUv+vec2(cos(a),sin(a))*sqrt(fi/float(TAPS))*c0*px;
float w=smoothstep(0.,1.,coc(uv)/c0*2.-.3);vec3 s=texture2D(tDiffuse,uv).rgb;w*=1.+dot(s,vec3(.3,.5,.2))*.6;c+=s*w;ws+=w;}
c/=ws;}
else{vec2 o=d*r2*.004;c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);}
c*=mix(1.,av,1.-clamp(c0*.2,0.,1.));
if(uStreak>0.){vec3 st=vec3(0.);for(int i=-7;i<=7;i++){float f=float(i);st+=texture2D(tStreak,vUv+vec2(f*.012,0.)).rgb*(1.-abs(f)/8.);}c+=st*vec3(.2,.45,1.)*uStreak;}
c=aces(max(c,0.)*uExp);c=pow(c,vec3(1./2.2));
float l=dot(c,vec3(.299,.587,.114));c=mix(c,c*uTS,(1.-l)*.45);c=mix(c,c*uTH,l*.4);
c=mix(vec3(l),c,1.1);c=(c-.5)*1.05+.5;
c*=1.-smoothstep(.12,.62,r2)*.5;
c*=.985+.015*sin(vUv.y*uRes.y*3.14159);
c+=(h(vUv*uRes+fract(uTime))-.5)*.02;
gl_FragColor=vec4(c,1.);}`
};
