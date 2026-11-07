function landmarks3D(bm) { const lm = bm.lm, p = {}, out = []; const spec = { snout: [0.004, 0], mouthCorner: [lm.mouthCorner, 'm'], eye: [lm.eye, 'e'], preopercle: [lm.preopercle, 0], operculum: [lm.operculum, 0], pectoralBase: [lm.pectoralBase, 0], pelvicBase: [lm.pelvicBase, -Math.PI / 2], vent: [lm.vent, -Math.PI / 2], analOrigin: [lm.analOrigin, -Math.PI / 2], analEnd: [lm.analEnd, -Math.PI / 2], dorsalOrigin: [lm.dorsalOrigin, Math.PI / 2], dorsalEnd: [lm.dorsalEnd, Math.PI / 2], peduncleStart: [lm.peduncleStart, Math.PI / 2], caudalBase: [0.999, Math.PI / 2] };
  const fr = {}, s = {}; for (const k in spec) { const [u, th] = spec[k]; if (th === 'm') { bm.frame(u, fr); bm.section(u, s); const ym = bm.mouthLineY(u, s); out.push({ name: k, x: fr.px + fr.nx * ym, y: fr.py + fr.ny * ym, z: bm.halfWidthAtY(s, ym) }); } else if (th === 'e') { bm.frame(u, fr); bm.section(u, s); out.push({ name: k, x: fr.px + fr.nx * bm.eyeY, y: fr.py + fr.ny * bm.eyeY, z: bm.halfWidthAtY(s, bm.eyeY) }); } else { bm.surface(u, th, p); out.push({ name: k, x: p.x, y: p.y, z: p.z }); } } return out; }
/**
 * Build a renderable fish from a genome.
 * @returns {{group:THREE.Group, uniforms:Object, materials:Object, bm:BodyModel, info:Object, dispose:()=>void}}
 */
function buildFish(g, opts = {}) {
  const q = QUALITY[opts.quality || 'hero'], bm = new BodyModel(g), f = g.fins, lm = bm.lm, maxD = bm.maxD; const geos = [];
  bm.lod = !q.detail;
  const bodyGeo = buildBodyGeometry(bm, q.S, q.R); geos.push(bodyGeo);
  const uni = makeUniforms(g, bm), mats = makeMaterials(g, uni, !!opts.instanced);
  uni.uDetail.value = q.detail ? 1 : 0;
  const group = new THREE.Group(); let tris = bodyGeo.index.count / 3; const parts = {};
  const body = opts.instanced ? new THREE.InstancedMesh(bodyGeo, mats.body, opts.instanced) : new THREE.Mesh(bodyGeo, mats.body); body.frustumCulled = false; group.add(body); parts.body = body;
  const fb = new FinBuilder(); const rc = n => q.detail ? clamp(Math.round(n), 8, 40) : 5; const sf = d => d.spines / Math.max(1, d.spines + d.rays);
  if (f.dorsal.present && f.dorsal.count > 0) {
    if (bm.a.separatedDorsal) {
      const n = q.detail ? clamp(f.dorsal.spines, 6, 16) : 5;
      for (let i = 0; i < n; i++) { const s = lerp(lm.dorsalOrigin, lm.dorsalEnd, i / n), e = lerp(lm.dorsalOrigin, lm.dorsalEnd, (i + .65) / n); addRidgeFin(fb, bm, { u0: s, u1: e, height: f.dorsal.height * maxD, sweep: .4, shape: 'triangle', side: 1, rays: 5, spineFrac: .2, opacity: 1, flex: .25, kind: 'dorsal', kindId: 1, K: q.detail ? 3 : 1 }); }
    } else addRidgeFin(fb, bm, { u0: lm.dorsalOrigin, u1: lm.dorsalEnd, height: f.dorsal.height * maxD, sweep: f.dorsal.sweep, shape: f.dorsal.shape, side: 1, rays: rc(f.dorsal.spines + f.dorsal.rays), spineFrac: sf(f.dorsal), opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', kindId: 1, K: q.K });
    if (f.dorsal.count >= 2) addRidgeFin(fb, bm, { u0: lm.dorsal2Origin, u1: lm.dorsal2End, height: f.dorsal2.height * maxD, sweep: f.dorsal.sweep, shape: f.dorsal2.shape, side: 1, rays: rc(f.dorsal2.spines + f.dorsal2.rays), spineFrac: sf(f.dorsal2), opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', cfg: 'dorsal2', kindId: 1, K: q.K });
    if (f.dorsal.count === 3) addRidgeFin(fb, bm, { u0: lm.dorsal3Origin, u1: lm.dorsal3End, height: f.dorsal3.height * maxD, sweep: .2, shape: f.dorsal3.shape, side: 1, rays: rc(f.dorsal3.rays), spineFrac: 0, opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', cfg: 'dorsal3', kindId: 1, K: q.K });
  }
  if (f.anal.present) addRidgeFin(fb, bm, { u0: lm.analOrigin, u1: lm.analEnd, height: f.anal.height * maxD, sweep: f.anal.sweep, shape: f.anal.shape, side: -1, rays: rc(f.anal.spines + f.anal.rays), spineFrac: sf(f.anal), opacity: f.anal.opacity, flex: f.anal.flex, kind: 'anal', kindId: 2, K: q.K });
  if (f.pectoral.present) { /* flattened plan: the same constructor builds the ray-supported disc margin */
    addPectoral(fb, bm, 1, q.K, rc(f.pectoral.rays)); addPectoral(fb, bm, -1, q.K, rc(f.pectoral.rays));
  }
  if (f.pelvic.present) { addPelvic(fb, bm, 1, q.K, rc(f.pelvic.rays)); addPelvic(fb, bm, -1, q.K, rc(f.pelvic.rays)); }
  if (f.adipose.present && q.detail) addRidgeFin(fb, bm, { u0: lm.adipose - 0.012, u1: lm.adipose + 0.012, height: f.adipose.size * bm.L * 0.8, sweep: 0.5, shape: 'rounded', side: 1, rays: 4, spineFrac: 0, opacity: 1, flex: 0.1, kind: 'adipose', kindId: 6, K: 2 });
  if (f.finlets.count > 0 && q.detail) { const n = f.finlets.count, a0 = (f.dorsal.count === 3 ? lm.dorsal3End : f.dorsal.count === 2 ? lm.dorsal2End : lm.dorsalEnd) + 0.015, a1 = lm.peduncleStart - 0.01;
    for (let i = 0; i < n; i++) { const u = lerp(a0, a1, (i + 0.5) / n); addRidgeFin(fb, bm, { u0: u - 0.006, u1: u + 0.006, height: maxD * 0.09, sweep: 0.9, shape: 'falcate', side: 1, rays: 3, spineFrac: 0, opacity: 1, flex: 0.2, kind: 'finlet', kindId: 7, K: 2 }); if (f.anal.present) addRidgeFin(fb, bm, { u0: u - 0.006, u1: u + 0.006, height: maxD * 0.09, sweep: 0.9, shape: 'falcate', side: -1, rays: 3, spineFrac: 0, opacity: 1, flex: 0.2, kind: 'finlet', kindId: 7, K: 2 }); } }
  let caudal = null; if (f.caudal.present) caudal = addCaudal(fb, bm, q.K, q.detail ? clamp(f.caudal.rays, 7, 40) : 7);
  const finGeo = fb.build(); geos.push(finGeo); tris += finGeo.index.count / 3;
  const fins = opts.instanced ? new THREE.InstancedMesh(finGeo, mats.fin, opts.instanced) : new THREE.Mesh(finGeo, mats.fin); fins.frustumCulled = false; fins.renderOrder = 2; group.add(fins); parts.fins = fins;
  if (q.detail && !opts.instanced) {
    if (!bm.oralDisc && !bm.ventralMouth && bm.law.mouth.construction !== 'fused') {   /* fused construction: one solid beak-like terminal structure, no hinged jaw, no cavity */
      const jaw = buildJawGeometry(bm); geos.push(jaw.geo); tris += jaw.geo.index.count / 3; bm.pivotX = jaw.pivot.x; uni.uJawPivot.value.set(jaw.pivot.x, jaw.pivot.y); uni.uJawOpenMax.value = bm.law.mouth.construction === 'fused' ? 0 : jaw.openAngle; uni.uJawSpread.value = MOUTH.jawSpreadRef(bm, GH);
      const jawMesh = new THREE.Mesh(jaw.geo, mats.jaw); jawMesh.frustumCulled = false; group.add(jawMesh); parts.jaw = jawMesh;
      if (jaw.upper) { geos.push(jaw.upper); tris += jaw.upper.index.count / 3; const um = new THREE.Mesh(jaw.upper, mats.jaw); um.frustumCulled = false; group.add(um); parts.upperJaw = um; }
    } else { bm.pivotX = bm.headX; uni.uJawOpenMax.value = 0; }
    if (g.head.operculum) { const og = buildOperculum(bm); geos.push(og); tris += og.index.count / 3; const om = new THREE.Mesh(og, mats.jaw); om.frustumCulled = false; group.add(om); parts.operculum = om; }
    for (const mesh of [...buildMouthDetails(bm, mats).map(m => { m.userData.mouthPart = true; return m; }), buildGills(bm, mats), buildNostrils(bm, mats)]) { geos.push(mesh.geometry); group.add(mesh); }
    for (const e of buildEyes(bm, q.eye, mats)) { geos.push(e.geometry); tris += e.geometry.index.count / 3; group.add(e); }
    const teeth = bm.oralDisc || bm.ventralMouth || bm.law.mouth.construction === 'fused' ? null : buildTeeth(bm, mats); if (teeth) { geos.push(teeth.geometry); tris += teeth.geometry.index.count / 3 * teeth.count; group.add(teeth); parts.teeth = teeth; }
    const barb = buildBarbels(bm, mats); if (barb) { geos.push(barb.geometry); tris += barb.geometry.index.count / 3; group.add(barb); if (bm.barbelTip && g.skin.photophores > 0) { const bulb = new THREE.SphereGeometry(Math.max(0.003, 0.012 * bm.L), 8, 6); bulb.translate(bm.barbelTip.x, bm.barbelTip.y, bm.barbelTip.z); geos.push(bulb); const bm2 = new THREE.Mesh(bulb, mats.glow); group.add(bm2); } }
    for (const m of buildSpecials(bm, mats)) { geos.push(m.geometry); tris += m.geometry.index.count / 3 * (m.count || 1); group.add(m); }
  } else { bm.pivotX = bm.headX; }
  if (!q.detail) for (const e of buildEyes(bm, 7, mats)) {
    geos.push(e.geometry);
    const mesh = opts.instanced ? new THREE.InstancedMesh(e.geometry, e.material, opts.instanced) : e;
    mesh.frustumCulled = false; group.add(mesh);
  }
  if (!q.detail && g.head.special !== 'none') for (const source of buildSpecials(bm, mats)) {
    if (source.isInstancedMesh) { source.geometry.dispose(); continue; }
    if (!source.geometry.getAttribute('aBody')) skinAttributes(source.geometry, bm);
    const mesh = opts.instanced ? new THREE.InstancedMesh(source.geometry, mats.body, opts.instanced) : new THREE.Mesh(source.geometry, source.material === mats.glow ? mats.glow : mats.body);
    mesh.frustumCulled = false; geos.push(mesh.geometry); group.add(mesh);
  }
  tris = 0; group.traverse(mesh => { if (mesh.isMesh) tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh && !opts.instanced ? mesh.count : 1); });
  group.rotation.x = g.body.roll * Math.PI / 180;
  const box = new THREE.Box3().setFromObject(group);
  const info = { tris: Math.round(tris), quality: opts.quality || 'hero', anatomy: bm.a.label, caudalAR: caudal ? +caudal.ar.toFixed(2) : 0, caudalSpan: caudal ? caudal.span : 0, finAreas: fb.areas, rays: fb.rays, finBases: fb.bases, attachments: fb.attachments, landmarks3D: landmarks3D(bm), bounds: box, spine: bm.spine, pec: bm.pecInfo ? Object.assign({ restAbd: bm.law.pec.restAbd }, bm.pecInfo[1], { mirrored: bm.pecInfo.mirrored }) : null, laws: { eye: bm.law.eye, mouth: bm.law.mouth, tail: { family: bm.law.tail.family, T: bm.law.tail.T, keel: bm.law.tail.keel }, flat: bm.law.flat } };
  return { group, uniforms: uni, materials: mats, bm, info, parts, geos, dispose() { geos.forEach(x => x.dispose()); for (const k in mats) { const m = mats[k]; if (m && m.dispose) m.dispose(); } (mats._eyes || []).forEach(m => m.dispose()); } };
}
FG.buildFish = buildFish; FG.BodyModel = BodyModel;
/* ╔══════════════════════════════════════════════════════════════════╗
   ║ 9. SHADERS & MATERIALS (procedural skin, fins, eyes, swim wave)  ║
   ╚══════════════════════════════════════════════════════════════════╝ */
/* ── hyper-real rendering pack (ported from the FishDraw anatomical renderer) ──
   A sqrt-encoded pseudo-HDR equirectangular studio probe. Decoded in the shader as
   c*c*ENV_RANGE so a 8-bit canvas can still carry a 12x softbox highlight: that one
   detail is what turns plastic shading into wet, photographed fish skin.          */
const ENV_RANGE = 12.0;
function makeStudioProbe(W = 1024, H = 512) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const box = (dir, rad, soft, L, col) => ({ d: dir.normalize(), rad, soft, L, c: col });
  const lights = [
    box(new THREE.Vector3(0.45, 0.82, 0.60), 0.30, 0.26, ENV_RANGE, [1.0, 0.985, 0.95]),   /* key softbox   */
    box(new THREE.Vector3(-0.62, 0.34, -0.70), 0.55, 0.60, 1.5, [0.72, 0.84, 1.0]),        /* cool fill     */
    box(new THREE.Vector3(0.05, 0.22, -0.98), 0.26, 0.34, 5.0, [0.88, 0.95, 1.0]),         /* rim / kicker  */
    box(new THREE.Vector3(-0.35, 0.55, 0.75), 0.18, 0.30, 2.2, [0.85, 0.93, 1.0])          /* side strip    */
  ];
  const v3 = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const phi = (j + .5) / H * Math.PI, sp = Math.sin(phi), y = Math.cos(phi);
    for (let i = 0; i < W; i++) {
      const th = ((i + .5) / W - .5) * TAU; v3.set(Math.cos(th) * sp, y, Math.sin(th) * sp);
      /* sky dome: bright surface above, dark water below, teal band at the waterline */
      const up = clamp(y * .5 + .5, 0, 1);
      let r = lerp(0.045, 0.52, Math.pow(up, 2.1)) + 0.06 * Math.pow(up, 8.0);
      let gg = lerp(0.062, 0.66, Math.pow(up, 1.9)) + 0.08 * Math.pow(up, 8.0);
      let b = lerp(0.085, 0.88, Math.pow(up, 1.7)) + 0.10 * Math.pow(up, 8.0);
      if (y > 0) { /* surface caustic shimmer read by the specular lobe as broken highlights */
        const s = Math.pow(y, 3.0) * (0.5 + 0.5 * Math.sin(th * 9.0 + Math.cos(th * 4.0) * 2.0)) * (0.5 + 0.5 * Math.sin(phi * 26.0));
        r += s * 0.55; gg += s * 0.58; b += s * 0.6;
      }
      for (const L of lights) {
        const a = Math.acos(clamp(v3.dot(L.d), -1, 1)), f = 1 - sstep(L.rad, L.rad + L.soft, a);
        const e = L.L * f * f; r += e * L.c[0]; gg += e * L.c[1]; b += e * L.c[2];
      }
      const k = (j * W + i) * 4;
      d[k] = Math.sqrt(clamp(r / ENV_RANGE, 0, 1)) * 255; d[k + 1] = Math.sqrt(clamp(gg / ENV_RANGE, 0, 1)) * 255; d[k + 2] = Math.sqrt(clamp(b / ENV_RANGE, 0, 1)) * 255; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true; return tex;
}
let _probe = null; const studioProbe = () => (_probe || (_probe = makeStudioProbe()));
/* seamless studio backdrop: a lit sweep behind the subject, like a photographic cyclorama */
let _back = null;
function studioBackdrop() {
  if (_back) return _back;
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.fillStyle = '#0a1219'; x.fillRect(0, 0, S, S);
  let g = x.createRadialGradient(S * .5, S * .42, S * .04, S * .5, S * .5, S * .78);
  g.addColorStop(0, '#2b4152'); g.addColorStop(.45, '#17293a'); g.addColorStop(1, '#070d14');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(120,170,205,.16)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const im = x.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }   /* film grain kills banding */
  x.putImageData(im, 0, 0);
  _back = new THREE.CanvasTexture(cv); _back.colorSpace = THREE.SRGBColorSpace; return _back;
}
const ENV = { uEnvMap: { value: studioProbe() }, uEnvTint: { value: new THREE.Color(1, 1, 1) }, uEnvInt: { value: 1 }, uWet: { value: 1 }, uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0.3, 1, 0.5).normalize() }, uLightCol: { value: new THREE.Color(1, 1, 1) }, uFillDir: { value: new THREE.Vector3(-.5, .35, -.6).normalize() }, uFillCol: { value: new THREE.Color(.19, .23, .27) }, uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, uGroundCol: { value: new THREE.Color(0.15, 0.15, 0.18) }, uFogCol: { value: new THREE.Color(0.05, 0.3, 0.5) }, uFogDensity: { value: 0 } };
const FLAP = { anguilliform: .15, subcarangiform: .25, carangiform: .2, thunniform: .08, ostraciiform: .35, labriform: .8, rajiform: 0, hippocampiform: .5 };
const GLSL_SWIM = /* glsl */`
uniform float uTime, uCycle, uLen, uHeadX, uFreq, uAmp, uAmpHead, uEnvPow, uWaveK, uFlap, uBreath, uInflate, uJawAngle, uJawProtrude, uPhase, uBurst;
uniform int uMode; uniform vec2 uJawPivot;
#ifdef SCHOOL
attribute float aPhase;
#endif
float fishU(float x){ return clamp((uHeadX - x)/uLen, 0.0, 1.6); }
float waveZ(float u, float ph){ float env = mix(uAmpHead, 1.0, pow(clamp(u,0.0,1.0), uEnvPow)); if(u>1.0) env = 1.0 + (u-1.0)*0.45; return sin(u*uWaveK*6.2831853 - (uCycle+ph)*6.2831853) * uAmp * uLen * env * (1.0+0.25*uBurst); }
vec3 inflateDisp(vec3 p){ if(uInflate<=0.0) return vec3(0.0); float u=fishU(p.x); vec3 d = normalize(vec3(0.0, p.y, p.z)+vec3(0.0,1e-5,0.0)); return d * uInflate * uLen * 0.2 * exp(-pow((u-0.45)/0.28,2.0)); }
float phaseOf(){
#ifdef SCHOOL
  return aPhase;
#else
  return uPhase;
#endif
}
mat4 modelM(){
#ifdef USE_INSTANCING
  return modelMatrix * instanceMatrix;
#else
  return modelMatrix;
#endif
}
void applyWave(inout vec3 p, inout vec3 n, float ph){ float e = 0.01*uLen; float w = waveZ(fishU(p.x), ph); float dzdx = (waveZ(fishU(p.x+e),ph) - waveZ(fishU(p.x-e),ph))/(2.0*e); p.z += w; n = normalize(vec3(n.x - dzdx*n.z, n.y, n.z)); }
`;
const GLSL_COMMON_FS = /* glsl */`
uniform vec3 uLightDir, uLightCol, uFillDir, uFillCol, uSkyCol, uGroundCol, uFogCol; uniform float uFogDensity, uTime;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5; } return v; }
vec3 hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0); return c.z*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),c.y); }
float fogAmt(vec3 wp){ float d = length(cameraPosition-wp); return 1.0 - exp(-pow(d*uFogDensity,2.0)); }
uniform sampler2D uEnvMap; uniform vec3 uEnvTint; uniform float uEnvInt, uWet;
#if __VERSION__ >= 300
#define ENVLOD(s,uv,l) textureLod(s,uv,l)
#else
#define ENVLOD(s,uv,l) texture2D(s,uv,l)
#endif
/* sqrt-encoded pseudo-HDR probe: decoding restores a 12x softbox so wet skin can blow out */
vec3 envRad(vec3 d, float lod){
  vec2 uv = vec2(atan(d.z,d.x)*0.1591549+0.5, acos(clamp(d.y,-1.0,1.0))*0.3183099);
  vec3 c = ENVLOD(uEnvMap, uv, lod).rgb; return c*c*12.0*uEnvTint*uEnvInt;
}
vec3 envSpec(vec3 R, float rough){ return envRad(R, sqrt(rough)*7.2); }
vec3 envDiff(vec3 N){ return envRad(N, 8.2)*0.55 + mix(uGroundCol,uSkyCol,N.y*.5+.5)*0.22; }
vec2 envBRDF(float nv, float rough){
  /* Karis analytic approximation of the split-sum environment BRDF */
  vec4 c0=vec4(-1.0,-0.0275,-0.572,0.022), c1=vec4(1.0,0.0425,1.04,-0.04);
  vec4 r=rough*c0+c1; float a=min(r.x*r.x,exp2(-9.28*nv))*r.x+r.y; return vec2(-1.04,1.04)*a+r.zw;
}
float ggxD(float nh, float a2){ float d=nh*nh*(a2-1.0)+1.0; return a2/(3.14159265*d*d); }
/* full PBR skin lobe: GGX sun + split-sum IBL + mucus clearcoat + wrapped subsurface */
vec3 pbrSkin(vec3 albedo, vec3 N, vec3 P, float rough, float metal, float sss, float coat, vec3 sheenCol){
  rough = clamp(rough,0.035,0.98);
  vec3 V=normalize(cameraPosition-P), L=normalize(uLightDir), H=normalize(V+L), FD=normalize(uFillDir);
  float nv=clamp(dot(N,V),1e-3,1.0), nl=max(0.0,dot(N,L)), nh=max(1e-4,dot(N,H)), vh=max(1e-4,dot(V,H));
  vec3 F0=mix(vec3(0.035), albedo, metal);
  vec3 F=F0+(max(vec3(1.0-rough),F0)-F0)*pow(1.0-vh,5.0);
  float a2=pow(rough,4.0), k=pow(rough+1.0,2.0)*0.125;
  float G=(nv/(nv*(1.0-k)+k))*(nl/(nl*(1.0-k)+k));
  vec3 spec=min(vec3(14.0), F*ggxD(nh,a2)*G/max(1e-3,4.0*nv*nl+1e-3));
  float wrap=clamp((dot(N,L)+0.28)/1.28,0.0,1.0);
  float fill=clamp((dot(N,FD)+0.18)/1.18,0.0,1.0);
  vec3 kd=(1.0-F)*(1.0-metal);
  vec3 diff=albedo*(envDiff(N)*0.62 + uLightCol*wrap*0.78 + uFillCol*fill*1.1);
  vec3 R=reflect(-V,N); vec2 ab=envBRDF(nv,rough);
  vec3 ibl=envSpec(R,rough)*(F0*ab.x+ab.y);
  vec3 c=kd*diff + spec*uLightCol*nl*1.7 + ibl;
  /* mucus / epidermal clearcoat: a second, very tight lobe over everything */
  float cr=mix(0.14,0.07,uWet), ca2=pow(cr,4.0);
  float cf=0.04+0.96*pow(1.0-vh,5.0);
  c += min(8.0, ggxD(nh,ca2)*cf*0.25/max(1e-3,4.0*nv*nl+1e-3))*uLightCol*nl*coat*1.5;
  c += envSpec(R,cr)*cf*coat*0.5;
  /* wrapped translucency: light bleeding through thin tissue + back scatter */
  float back=pow(clamp(dot(V,-L)*0.5+0.5,0.0,1.0),3.0);
  c += albedo*sss*(back*0.55+pow(1.0-nv,3.0)*0.35)*(uLightCol*0.6+uSkyCol*0.4);
  /* grazing guanine sheen (iridophore layer seen edge-on) */
  c += sheenCol*pow(1.0-nv,4.5)*0.6;
  return c;
}
vec3 wetLight(vec3 col, vec3 N, vec3 P, float gloss, float sss){
  return pbrSkin(col, N, P, mix(.62,.14,gloss), 0.0, sss*0.5, 0.45, vec3(0.0));
}
`;
const GLSL_PIGMENT = /* glsl */`
uniform vec3 uBase,uBelly,uAccent,uGlow,uBandCol;
uniform float uPatScale,uPatStrength,uCounter,uSeed,uFineness,uFlat,uBand,uRay;
uniform int uPattern;
float verticalOf(float ang){ float v=uFlat>.5 ? sin(ang*6.2831853) : -cos(ang*6.2831853); return uRay>.5 ? clamp(v*5.0,-1.0,1.0) : v; }
vec3 skinPigment(float u,float ang){
  float vert=verticalOf(ang); vec2 pc=vec2(u*uFineness*.8,vert*1.2)*uPatScale+uSeed; float nz=fbm(pc*3.0);
  float cs=smoothstep(-.38,.48,vert+(nz-.5)*.12); vec3 col=mix(uBase,uBelly,uCounter*(1.0-cs)); float m=0.0;
  if(uPattern==1) m=smoothstep(.30,.40,abs(fract(vert*1.6*uPatScale+nz*.10)-.5));
  else if(uPattern==2) m=smoothstep(.27,.38,abs(fract(u*uFineness*1.1*uPatScale+nz*.045)-.5));
  else if(uPattern==3){ vec2 sp=vec2(u*uFineness*2.2,vert*2.0)*uPatScale*2.7, cell=floor(sp), l=fract(sp)-.5;
    float j=hash12(cell+uSeed); l-=(vec2(hash12(cell+1.7+uSeed),hash12(cell+3.1+uSeed))-.5)*.5;
    float rr=.1+.1*j; m=(1.0-smoothstep(rr-.03,rr+.02,length(l)))*step(.22,j)*smoothstep(-.55,-.1,vert); }
  else if(uPattern==4) m=1.0-smoothstep(.025,.07,abs(fbm(pc*2.5)-.5));
  else if(uPattern==5) m=smoothstep(.38,.65,sin(u*uFineness*1.6*uPatScale*3.1416)*.5+.5)*smoothstep(-.25,.45,vert);
  else if(uPattern==6) m=smoothstep(.38,.61,fbm(pc*2.2));
  else if(uPattern==7) m=smoothstep(.43,.51,fbm(pc*1.6));
  else if(uPattern==8){ float d=length(vec2((u-.74)*uFineness*1.2,(vert-.25)*.9)/(.35*uPatScale));
    m=(1.0-smoothstep(.75,.85,d))*.95; float ring=smoothstep(.85,.95,d)-smoothstep(1.05,1.2,d); col=mix(col,uBelly,ring*.8*uPatStrength); }
  col=mix(col,uAccent,m*uPatStrength);
  if(uBand>0.0){ float band=(1.0-smoothstep(.07,.2,abs(vert-.02)+(nz-.5)*.06))*smoothstep(.1,.3,u)*uBand; col=mix(col,uBandCol,band); }
  return col;
}
`;
const JAW_SPREAD_GLSL = /* glsl */`
uniform float uJawU0, uHingeU, uJawSpread;
vec3 jawSpread(vec3 p, float u, float w, float open){ float t=clamp((u-uJawU0)/max(1e-6,uHingeU-uJawU0),0.0,1.0); float f=sqrt(t)*(1.0-t); float zk=max(.6*uJawSpread*max(t,.02),1e-5);
  p.z += clamp(p.z/zk,-1.0,1.0)*uJawSpread*f*open*w; return p; }`;
const VS_BODY = GLSL_SWIM +  /* glsl */`
attribute vec4 aBody; uniform float uJawOpenMax;
#ifdef JAW
${JAW_SPREAD_GLSL}
#endif
varying vec3 vN, vWP, vLP; varying vec4 vBody; varying vec2 vCirc;
void main(){ vec3 p = position; vec3 n = normal; float ph = phaseOf();
  p += inflateDisp(p);
  if(aBody.z>2.9 && aBody.z<3.3) p += n*aBody.w*uBreath*uLen*.0016;
  if(aBody.z>3.45 && aBody.z<3.7 && uJawOpenMax>.001) p += n*aBody.w*clamp(uJawAngle/uJawOpenMax,0.0,1.0)*uLen*.0042;   /* gular area swells as the mouth opens */
  if(aBody.z>6.8) p += n*aBody.w*uBreath*uLen*.0005;
#ifdef JAW
  if(aBody.z < 2.0){ p = jawSpread(p, aBody.x, aBody.w, clamp(uJawAngle/max(uJawOpenMax,1e-4),0.0,1.0)); vec2 d = p.xy - uJawPivot; float a = -uJawAngle*aBody.w; float c = cos(a), s = sin(a); p.xy = uJawPivot + vec2(c*d.x - s*d.y, s*d.x + c*d.y); p.x += uJawProtrude*aBody.w; n.xy = vec2(c*n.x - s*n.y, s*n.x + c*n.y); }
  else if(aBody.z < 2.1){ p.x += uJawProtrude*aBody.w; p.y -= uJawProtrude*aBody.w*.35; }   /* upper jaw: slides forward-down with the open amount */
#endif
  applyWave(p, n, ph); mat4 mm = modelM(); vec4 wp = mm*vec4(p,1.0); vWP = wp.xyz; vLP = p; vN = normalize(mat3(mm)*n); vBody = aBody; vCirc=vec2(cos(aBody.y*6.2831853),sin(aBody.y*6.2831853)); gl_Position = projectionMatrix*viewMatrix*wp; }`;
const FS_BODY = GLSL_COMMON_FS + GLSL_PIGMENT + /* glsl */`
uniform float uLen,uScaleSize,uIrid,uGloss,uPhoto,uTrans,uHeadU,uPreU,uMouthU,uLateral,uElectric,uDetail,uMouthStart,uMouthTipF,uMouthCornerF,uManta,uJawAngle,uJawOpenMax,uGape,uJawU0,uHingeU; uniform float uMLine[40];
uniform float uSilver,uLips,uEyeU,uEyeVert,uEyeRU,uEyeRV,uNostrils,uSlits;
uniform int uScale; varying vec3 vN,vWP,vLP; varying vec4 vBody; varying vec2 vCirc;
float skinT0(float t){ return (t>2.95 && t<3.3) ? 1.0 : 0.0; }
float gCirc = 1.0;   /* circuli visibility, killed when scales fall under a pixel */
float gFine = 1.0;   /* high-frequency skin detail visibility (anti-alias guard)     */

vec2 scaleUV(vec2 sc){ vec2 p=sc; if(uScale==2 || uScale==5) p=vec2(sc.x+sc.y,sc.y-sc.x)*.7071; p.x+=mod(floor(p.y),2.0)*.5; return p; }

/* An imbricated scale: a fan whose free (posterior, +x) edge rides over the next scale.
   Real cycloid/ctenoid scales also carry concentric growth rings (circuli) around an
   anterior focus plus radii grooves - those two features are what reads as "fish" up close. */
float scaleHeight(vec2 sc){
  if(uScale==4 || uScale==6) return 0.0;
  vec2 p=scaleUV(sc); vec2 cell=floor(p), q=fract(p)-.5;
  float jitter=hash12(cell+uSeed);
  q+=(vec2(jitter,hash12(cell+uSeed+1.3))-.5)*.035;
  vec2 e=vec2(q.x*.86-.1, q.y*1.05);
  float d=(uScale==2 || uScale==5) ? abs(e.x)+abs(e.y) : length(e);
  if(uScale==1) d+=.02*sin(atan(e.y,e.x)*9.0+jitter*6.0)*step(0.0,e.x);   /* ctenoid comb edge */
  float body=1.0-smoothstep(.40,.50,d);
  float ramp=.35+.65*smoothstep(-.45,.32,e.x);                            /* rises toward the free edge */
  float lip=smoothstep(.30,.44,d)*step(-.05,e.x);                         /* shadowed step over the next scale */
  float h=body*ramp*(.85+.3*jitter)-lip*.35;
  if(gCirc>0.001){
    vec2 f=vec2(e.x+.26,e.y);                                             /* focus sits anterior of centre */
    float fr=length(f*vec2(1.0,1.22));
    float circuli=sin(fr*47.0-jitter*5.0)*.055*smoothstep(.06,.22,fr)*body;
    float radii=sin(atan(f.y,f.x)*13.0+jitter*9.0)*.016*smoothstep(.1,.5,fr)*body;
    h+=(circuli+radii)*gCirc;
  }
  return h;
}
float scaleTone(vec2 sc){ return hash12(floor(scaleUV(sc))+uSeed+9.0); }
/* per-scale guanine (iridophore) platelet coverage: strongest mid-flank, like a real silver fish */
float scaleGuanine(vec2 sc,float vert){ vec2 p=scaleUV(sc); vec2 q=fract(p)-.5; float j=hash12(floor(p)+uSeed+4.2);
  return smoothstep(.46,.12,length(q))*(.45+.55*j)*(1.0-smoothstep(.15,.95,abs(vert-.1))); }

/* non-scale skin relief: pebbled head, fleshy lips, orbital rim, opercular bone, nares */
float microH(float u,float vert,float head){
  float h=0.0;
  h += (fbm(vec2(u*300.0/max(.6,uFineness), vert*90.0)+uSeed)-.5)*.22*head*gFine;      /* head pebbling   */
  h += (fbm(vec2(u*110.0, vert*30.0)+uSeed*1.7)-.5)*.10*head;                          /* coarse wrinkles */
  /* lips: two soft pads either side of the gape, with a crease between them */
  if(u>=uMouthStart && u<=uMouthU*1.04){
    float t=smoothstep(uMouthStart,uMouthU,u);
    float lvl=mix(uMouthTipF,uMouthCornerF,t);
    float dv=(vert-lvl);
    float fade=smoothstep(uMouthStart,uMouthStart+.015,u)*(1.0-smoothstep(uMouthU*.93,uMouthU*1.04,u));
    h += (exp(-pow((dv-.055)/.055,2.0))+exp(-pow((dv+.055)/.055,2.0)))*(.18+.55*uLips)*fade;
    h -= exp(-pow(dv/.018,2.0))*(.30+.4*uLips)*fade;
  }
  /* round 2.1: no orbital relief ring — the skin-blend cap (eyegeo.buildSkinBlend) carries the transition to the eyeball */
  /* operculum: a flat bone plate with radial striae and a raised free margin */
  float op=smoothstep(uPreU,uPreU+(uHeadU-uPreU)*.3,u)*(1.0-smoothstep(uHeadU-.012,uHeadU+.006,u));
  h += op*(.03*sin((u-uPreU)*95.0/max(.12,uHeadU)+vert*7.0)*gFine+.04);
  h += (1.0-smoothstep(.0,.006,abs(u-uHeadU)))*.20;                                    /* free margin ridge */
  h += (1.0-smoothstep(.0,.008,abs(u-uPreU)))*.07;                                     /* preopercular ridge */
  /* nares: paired pits on the snout */
  float nd=length(vec2((u-uEyeU*.52)/.013,(vert-.30)/.085));
  h -= (1.0-smoothstep(.5,1.0,nd))*.5*uNostrils;
  return h;
}

void main(){
  float u=vBody.x, ang=fract(atan(vCirc.y,vCirc.x)/6.2831853+1.0), vert=verticalOf(ang);
  vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; vec3 V=normalize(cameraPosition-vWP);
  vec3 col=skinPigment(u,ang); float tissue=vBody.z;
  /* skin classes: body (0), upper-jaw patch (2) and operculum (3.0-3.2) are ONE skin system - same pigment, scales and relief; 4 = appendage strand */
  bool skinT=tissue<.5 || (tissue>1.9 && tissue<3.3);
  bool strand=tissue>3.9 && tissue<4.1;
  float rimK=clamp((tissue-3.0)/.2,0.0,1.0)*step(2.95,tissue)*step(tissue,3.3);
  if(strand) col=mix(col,mix(col,vec3(.90,.84,.76),.5),smoothstep(.55,1.0,vBody.w));   /* body-coloured, slightly lighter tip */
  float head=1.0-smoothstep(uHeadU*.5,uHeadU*1.08,u);
  /* mouth law: the skin opens only as far as the jaw drops; what shows through is the capped cavity (tissue tag 1), never the far side */
  bool cav=tissue>.9&&tissue<1.1;
  if(cav){ col=vec3(.34,.12,.11)*(.5+.5*fbm(vec2(u*40.0,ang*20.0)+uSeed)); }
#ifndef JAW
  /* round 2: the static skin of the LOWER jaw zone (below the lip line, chin → hinge) is not drawn while the jaw is open: the hinged lower-jaw patch replaces it,
     so nothing is ever cut out above the lip line and the upper lip is a plain skin edge. The discard line is the same table the patch edge is built from. */
  if(uManta<.5 && tissue<.5 && uJawOpenMax>.001 && u>=(uJawU0<.002?0.0:uJawU0) && u<=uHingeU && uJawAngle/uJawOpenMax>.02){
    float fi=clamp((u-uJawU0)/max(1e-6,uHingeU-uJawU0),0.0,1.0)*39.0; int i0=int(floor(fi)); int i1=min(i0+1,39);
    float edge=mix(uMLine[i0],uMLine[i1],fi-float(i0));
    if(vert<edge-.0005) discard;
  }
#endif

  /* screen-space surface frame, reused by every bump layer */
