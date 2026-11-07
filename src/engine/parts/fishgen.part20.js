    o.log = (Array.isArray(e.log) ? e.log : []).slice(-8).map(x => ({ n: Math.round(clamp(Number(x && x.n) || 0, 0, 100000)), k: str(x && x.k, 16), t: str(x && x.t, 120), l: strs(x && x.l, 3, 150) }));
    dst.evo = o;
  }
}

/** share-URL payload: drops derived data that the engine can regenerate (reports, notes, mutation diff, long logs, habitat target tables) */
function slimGenome(g) {
  const c = stripGenome(g), m = c.meta; delete m.mutation; delete m.notes; delete m.adaptBase;
  if (m.hybrid) { m.hybrid.syn = (m.hybrid.syn || []).slice(0, 6).map(s => ({ id: s.id, t: String(s.t).slice(0, 200) })); delete m.hybrid.chain; }
  if (m.evo) { m.evo.log = (m.evo.log || []).slice(-2).map(e => ({ n: e.n, k: e.k, t: e.t, l: (e.l || []).slice(0, 1) })); if (m.evo.hab) { delete m.evo.hab.t; delete m.evo.hab.notes; delete m.evo.hab.base; } if (m.evo.don) { delete m.evo.don.th; } }
  return c;
}

/* ── regression tests for the hybrid + evolution engines (run from the Tests tab) ── */
// @@PART js/app.part19.js (19/19) lines 3750-3821 of the original module script -- stripped by build.mjs
function runHybridTests(test, assert) {
  const sp = (id, hab) => generate({ species: id, habitat: hab || SPECIES.find(s => s.id === id).habitat, seed: 'ht', noAdapt: true });
  const sound = (c, label) => { assert(!violations(c).length, label + ': unrepaired constraints'); const a = structuralAudit(c); assert(!a.length, label + ': ' + a.join('; ')); };
  test('Hybrid: a seahorse cross never leaves a swimming body without its tail', () => {
    const pairs = [['atlantic-herring', 'lined-seahorse', 'openOcean'], ['red-bellied-piranha', 'lined-seahorse', 'coralReef'], ['common-carp', 'weedy-seadragon', 'floodplain'], ['goldfish', 'leafy-seadragon', 'lake']];
    for (const [a, b, hab] of pairs) for (const ratio of [.25, .5, .75]) for (let k = 0; k < 6; k++) {
      const c = adaptFinish(hybridize(sp(a), sp(b), ratio, 'tail' + k), hab, 'tail' + k); sound(c, `${a}×${b}`);
      if (planOf(c) === 'std') assert(c.fins.caudal.present && c.swim.mode !== 'hippocampiform', `${a}×${b}: swimming plan lost its caudal fin`);
      if (planOf(c) === 'upright') assert(c.swim.mode === 'hippocampiform' && !c.fins.caudal.present, `${a}×${b}: upright plan is inconsistent`);
    }
  });
  test('Hybrid: structural organs never cross between incompatible body plans', () => {
    for (let k = 0; k < 12; k++) {
      const A = sp('great-white-shark'), B = sp('lined-seahorse'), h = hybridize(A, B, .5, 'plan' + k), up = h.meta.hybrid.plan === 'upright';
      assert(!h.meta.hybrid.compat, 'shark and seahorse reported as compatible');
      const chassis = up ? B : A; for (const p of ORG_PATHS.tail) assert(JSON.stringify(getP(h, p)) === JSON.stringify(getP(chassis, p)), 'tail organ moved across plans: ' + p);
    }
  });
  test('Hybrid: 300 random crosses stay anatomically valid in every habitat', () => {
    const rng = new RNG('hybrid-bulk'), habs = Object.keys(HABITATS), niches = Object.keys(NICHES), pick = () => { const x = rng.next(); return x < .6 ? 'sp:' + rng.pick(SPECIES).id : x < .8 ? 'ni:' + rng.pick(niches) : 'inv'; };
    for (let i = 0; i < 300; i++) { const hab = rng.pick(habs), s = 'hb' + i; const c = adaptFinish(hybridize(parentFrom(pick(), hab, s + 'a'), parentFrom(pick(), hab, s + 'b'), rng.range(.15, .85), s), hab, s); sound(c, 'cross ' + i + ' in ' + hab); }
  });
  test('Habitat adaptation depends on the fish: an ambusher and a hunter diverge in the abyss', () => {
    const amb = adaptFinish(deepClone(sp('reef-stonefish')), 'abyssal', 'a1'), hun = adaptFinish(deepClone(sp('great-barracuda')), 'abyssal', 'a1');
    sound(amb, 'ambusher'); sound(hun, 'hunter'); assert(JSON.stringify(amb.meta.notes) !== JSON.stringify(hun.meta.notes), 'Both fish received identical adaptations');
  });
  test('Evolution: 12 generations of mixed events stay valid and the tail survives', () => {
    for (const id of ['goldfish', 'great-white-shark', 'red-lionfish', 'atlantic-herring']) {
      let g = sp(id); const hadTail = g.fins.caudal.present;
      for (let i = 0; i < 12; i++) { g = evolve(g, { mode: 'auto', donor: 'sp:blue-tang', habId: 'abyssal', seed: id + i }); sound(g, `${id} gen ${i + 1}`); }
      assert(g.meta.evo.step === 12 && (!hadTail || g.fins.caudal.present), id + ': generation counter or tail wrong');
    }
  });
  test('Evolution: gene flow reaches the donor gradually (ancestry rises, no step is a jump)', () => {
    let g = sp('goldfish', 'lake'), last = 0;
    for (let i = 0; i < 16; i++) { const n = evolve(g, { mode: 'donor', donor: 'sp:great-white-shark', seed: 'gf' + i }); if (n.meta.mutation.event.kind === 'gene flow') { const a = n.meta.evo.don.anc; assert(a >= last, 'ancestry fell'); last = a; } assert(stepJump(g, n) < .5, 'a single step changed the body by ' + Math.round(stepJump(g, n) * 100) + '%'); g = n; }
    assert(last >= .9, 'gene flow stalled at ' + Math.round(last * 100) + '%');
  });
  test('Evolution: every offered innovation can be developed and finishes in 3 stages', () => {
    const g0 = sp('convict-cichlid', 'lake'), X = ecoCtx(g0);
    for (const n of NOVELTIES.filter(x => x.can(g0, X))) { let g = g0; for (let i = 0; i < 3 && (g.meta.evo ? g.meta.evo.nov[n.id] || 0 : 0) < n.st.length; i++) { g = evolve(g, { mode: 'innovate', only: n.id, seed: 'nv' + n.id + i }); sound(g, n.n); } assert(g.meta.evo.nov[n.id] === n.st.length, n.n + ' did not finish (' + g.meta.evo.nov[n.id] + '/' + n.st.length + ')'); }
  });
  test('Evolution: undo-safe, serialisable state survives a JSON round trip', () => {
    let g = sp('goldfish', 'lake'); for (let i = 0; i < 5; i++) g = evolve(g, { mode: 'auto', donor: 'sp:betta', habId: 'floodplain', seed: 'rt' + i });
    const { genome } = validateGenome(JSON.parse(JSON.stringify(stripGenome(g)))); assert(genome.meta.evo && genome.meta.evo.step === 5, 'evolution state lost on import'); assert(genome.meta.evo.don && genome.meta.evo.don.val === 'sp:betta', 'donor lost on import');
    const n = evolve(genome, { mode: 'auto', donor: 'sp:betta', habId: 'floodplain', seed: 'rt5' }); sound(n, 'continued after import'); assert(n.meta.evo.step === 6, 'could not continue the lineage after import');
  });
  test('Random wonder: 20 draws are valid, hybrid and varied', () => {
    const names = new Set(); for (let i = 0; i < 20; i++) { const w = wonderCandidate(['coralReef', 'abyssal', 'fastRiver', 'openOcean'][i % 4], 'wt' + i); sound(w.c, 'wonder ' + i); assert(w.c.meta.hybrid, 'not a hybrid'); names.add(w.c.meta.name); }
    assert(names.size >= 15, 'wonders are too repetitive (' + names.size + ' distinct of 20)');
  });
}


function bindUI() {
  $('btnGenerate').onclick = () => doGenerate();
  document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.act; if (a === 'generate') { $('seed').value = ''; doGenerate(); } else if (a === 'discover') doDiscover(); else if (a === 'mutate') doMutate(); else if (a === 'undo') undoFish(); else if (a === 'breed') doBreed(); else if (a === 'school') { App.schoolOn ? stopSchool() : startSchool(); } else if (a === 'mode') { App.mode = App.mode === 'studio' ? 'habitat' : 'studio'; applyMode(); applyTier(); } }));
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => currentTab === b.dataset.tab ? closeSheet() : openSheet(b.dataset.tab)));
  $('sheetClose').onclick = closeSheet; $('errClose').onclick = () => { $('errOverlay').classList.add('hidden'); $('errText').textContent = ''; };
  $('selSpecies').onchange = () => { const id = $('selSpecies').value; if (id) { $('selClade').value = ''; $('selNiche').value = ''; doGenerate({ species: id, habitat: $('selHabitat').value || undefined, seed: $('seed').value.trim() || undefined }); } };
  $('selHabitat').onchange = () => { if ($('selSpecies').value) doGenerate({ species: $('selSpecies').value, habitat: $('selHabitat').value, seed: $('seed').value.trim() || undefined }); };
  $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') doGenerate(); });
  $('btnRandom').onclick = doDiscover; $('btnConvert').onclick = convertFromName; $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') convertFromName(); });
  renderer.domElement.addEventListener('dblclick', () => { if (App.genome && App.genome.skin.inflate) App.inflateTarget = App.inflateTarget > 0.5 ? 0 : 1; });
  addEventListener('hashchange', () => { if (!App.dirtyHash) loadFromHash(); });
}
function boot() {
  try { initScene(); populateSelects(); bindUI(); bindHybrid(); if (!loadFromHash()) { FG.proc.bootFish(); } requestAnimationFrame(animate); }
  catch (e) { showError(e); }
}
installProcUI({ FG, App, THREE, ENV, PANELS, setFish, buildFish, openSheet, toast, $, esc, closeSheet, view: () => ({ camera, controls }) });
FG.centreAudit = (bm, pose) => MCHK.centrePlaneAudit(bm, { THREE, H: GH, MOUTH, buildJawGeometry, buildTeeth, LAW }, pose == null ? 1 : pose);
FG.round2Check = bm => MCHK.round2Check(bm, { THREE, H: GH, MOUTH, buildJawGeometry, buildTeeth, LAW });
Object.assign(FG, { App, setFish, buildEnvironment, runSelfTest, HABITATS, NICHES, CLADES, SPECIES, FORM_RULES, SCHEMA, ENV });
export { boot, FG };
export default boot;
/* round 4.2: the eye blend patch samples the SAME skin-coordinate field as the loft. The loft's angular coordinate is the section's PARAMETRIC angle theta (ang = (theta + pi/2) / tau), which is not the
   geometric angle atan2(y, z) on a non-circular section - so the patch's proxy points (the head-surface points beneath each patch vertex) are inverted to theta on their own section (nearest point of the
   section curve, on the eye's side), exactly the coordinate the loft vertices carry. Result: the pigment pattern (spots, bands, stripes) crosses the patch with no seam. */
function patchBodyCoords(bm, prox, side, geo) {
  const n = prox.length / 3, nv = new THREE.Vector3(), nA = geo && geo.getAttribute('normal'), eA = geo && geo.getAttribute('aEye'), a = new Float32Array(n * 4), fr = {}, s = {}, p = {}; const half = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const x = prox[i * 3], y0 = prox[i * 3 + 1], z = prox[i * 3 + 2], u = clamp((bm.headX - x) / bm.L, .003, .999);
    bm.frame(u, fr); bm.section(u, s); const yp = (x - fr.px) * fr.nx + (y0 - fr.py) * fr.ny;
    const cost = th => { bm.point(u, th, p, fr, s, true); return (p.ly - yp) ** 2 + (p.lz - z) ** 2; };
    let bt = half, bc = Infinity, st = Math.PI / 48; for (let k = 0; k <= 48; k++) { const th = half + k * st, c = cost(th); if (c < bc) { bc = c; bt = th; } }
    for (let it = 0; it < 4; it++) { st /= 3; for (const d of [-1, 1]) { const th = bt + d * st, c = cost(th); if (c < bc) { bc = c; bt = th; } } }
    a[i * 4] = u; a[i * 4 + 1] = (((bt + Math.PI / 2) / TAU) % 1 + 1) % 1; a[i * 4 + 2] = 0; a[i * 4 + 3] = 0;
    /* round 5B: SHADING normal = the real skin's normal under this vertex (blend k: .65 at the eyeball edge -> 1 from a third of the way out). The patch keeps its geometry (silhouette, occlusion) but is lit exactly like the
       skin around it, so no pale wedge / gloss step and no pattern wash-out at the patch edge: one pigment field, one shading field. */
    if (nA) { bm.surfaceNormal(u, bt, nv); const t = eA.getX(i), k = 1 - .35 * (1 - sstep(0, .35, t)); const gx = nA.getX(i) * (1 - k) + nv.x * k, gy = nA.getY(i) * (1 - k) + nv.y * k, gz = nA.getZ(i) * (1 - k) + nv.z * k, l = Math.hypot(gx, gy, gz) || 1; nA.setXYZ(i, gx / l, gy / l, gz / l); }
  }
  if (nA) nA.needsUpdate = true;
  return a;
}
/* (moved from part10 in round 6H.1 to keep every part <= 30,000 bytes: hoisted function declarations, order-independent) */
function buildNostrils(bm, mats) {
  if (bm.disc) return DISC.buildMarks(bm, mats, GH);
  /* round 5B: the only marks that may sit on the cheek / snout are the paired nares (every plan) and the spiracle (plans that carry one: cartilaginous / flattened — never a bony plan). Both are SOFT, low-contrast
     pits (tag 8: the skin colour darkened at most ~30 %, falling to zero at the rim — vBody.w), sized from the EYE (never from body depth), at the positions the plan puts them. No hard dark disk exists. */
  const geos = [], g = bm.g, points = {}, normal = new THREE.Vector3(), bony = bm.a.gills === 'lateral';
  const theta = bm.a.gills === 'lateral' || bm.a.gills === 'ventral' ? -.82 : .23, nostrilInfo = [];
  for (const side of [-1, 1]) for (const type of [0, ...(g.head.spiracles && !bony ? [1] : [])]) {
    const u = type ? bm.lm.eye + bm.h * .12 : bm.a.gills === 'lateral' ? Math.max(.008, bm.jawStartU * .5) : Math.max(.024, bm.lm.eye * .52), base = type && bm.law.flat ? 1.2 : theta + (type ? .4 : 0), th = side > 0 ? base : Math.PI - base;
    bm.rawSurface(u, th, points); bm.surfaceNormal(u, th, normal);
    const rad = Math.min(bm.maxD * (type ? .035 : .021) * (.45 + g.head.nostrils), bm.eyeR * (type ? .5 : .3));
    const disk = new THREE.SphereGeometry(rad, 10, 6); disk.scale(.65, .25, 1);
    const P = disk.getAttribute('position'), wv = new Float32Array(P.count); for (let i = 0; i < P.count; i++) wv[i] = Math.max(0, Math.min(1, P.getY(i) / (rad * .25)));   /* 1 at the pit's centre, 0 at its rim */
    disk.userData.w = wv;
    disk.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal));
    disk.translate(points.x + normal.x * rad * .1, points.y + normal.y * rad * .1, points.z + normal.z * rad * .1);
    geos.push(disk); nostrilInfo.push({ type, side, y: points.y, ny: normal.y, rad });
  }
  const geo = mergeGeos(geos); skinAttributes(geo, bm, 8); const ab = geo.getAttribute('aBody'); let o = 0; for (const d of geos) { const wv = d.userData.w; for (let i = 0; i < wv.length; i++) ab.setW(o + i, wv[i]); o += wv.length; }
  const mesh = new THREE.Mesh(geo, mats.body); mesh.frustumCulled = false; mesh.userData.nostrils = nostrilInfo; return mesh;
}
function buildTeeth(bm, mats) {   /* round 2: rooted continuous rows on the lip line (teethgeo.js) */
  const m = bm.g.mouth; if (m.teethCount <= 0 || m.teeth === 'none') return null; return TEETHGEO.buildTeethRows(bm, mats, GH, m.teeth);
}
/* barbels: rooted, tapered, capped strands (appendages.js); stations and lengths come from the barbel law */
function buildBarbels(bm, mats) { return APP.buildBarbels(bm, mats, GH); }
// @@PART js/app.part11.js (11/19) lines 2151-2428 of the original module script -- stripped by build.mjs
function buildSpecials(bm, mats) {
  const g = bm.g, sp = g.head.special, L = bm.L, out = [], fr = {}, s = {};
  if (sp === 'none' || sp === 'horns' || bm.billStart !== null) return out;
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; out.push(m); return m; };
  bm.frame(0.003, fr); bm.section(0.03, s); const snX = fr.px, snY = fr.py;
  const loftSpike = (uBase, len, taperY, taperZ, droop, widen) => {
    /* base ring sampled ON the skin at uBase → the junction is vertex-coincident with the body, no seam */
    const M = 18, N = 14, ring = [], pos = [], idx = [], p = {}, frB = {}; bm.frame(uBase, frB);
    let cy = 0, cz = 0;
    for (let j = 0; j < M; j++) { bm.rawSurface(uBase, -Math.PI / 2 + j / M * TAU, p); ring.push([p.x, p.y, p.z]); cy += p.y / M; cz += p.z / M; }
    const fwdX = -frB.tx, fwdY = -frB.ty, tipX = frB.px + fwdX * len, tipY = cy + fwdY * len - droop * len;
    for (let i = 0; i <= N; i++) {
      const f = i / N, ease = Math.pow(f, .9), shrink = Math.pow(1 - f, .9) * (1 - f * .15) + .02;
      const axX = lerp(frB.px, tipX, ease), axY = lerp(cy, tipY, ease) - droop * len * f * f;
      for (let j = 0; j < M; j++) {
        const [bx, by, bz] = ring[j];
        const sy = shrink * lerp(1, taperY, f), szf = shrink * lerp(1, taperZ, f) * (1 + widen * Math.sin(Math.PI * f) * .6);
        pos.push(i === 0 ? bx : axX, i === 0 ? by : axY + (by - cy) * sy, i === 0 ? bz : (bz - cz) * szf + cz);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c = a + M, d = b + M; idx.push(a, b, c, b, d, c); }
    const rings = []; for (let i = 0; i <= N; i++) { const r = []; for (let j = 0; j < M; j++) { const o = (i * M + j) * 3; r.push([pos[o], pos[o + 1], pos[o + 2]]); } rings.push(r); }   /* round 6H: ring samples, rostral teeth root IN this edge */
    const tip = pos.length / 3; pos.push(tipX + fwdX * len * .015, tipY, 0);
    for (let j = 0; j < M; j++) idx.push(tip, N * M + j, N * M + (j + 1) % M);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); skinAttributes(geo, bm); geo.userData.rings = rings; return geo;
  };
  if (sp === 'bill' || sp === 'sword') { add(loftSpike(.006, g.head.specialLen * L, sp === 'sword' ? .3 : .55, sp === 'sword' ? 1.1 : .6, .05, 0), mats.body); }
  else if (sp === 'rostrum' || sp === 'paddle') { const len = g.head.specialLen * L, w = g.head.specialWidth * L * (sp === 'paddle' ? 2 : 1); const blade = add(loftSpike(.008, len, sp === 'paddle' ? .22 : .14, Math.max(.6, w / Math.max(.001, bm.bp.width(.06) * L)), .01, sp === 'paddle' ? .5 : .15), mats.body);
    if (sp === 'rostrum') out.push(ROSTRUM.buildRostralTeeth(THREE, blade, len, L, mats.tooth)); }
  else if (sp === 'esca') { for (const m of APP.buildLure(bm, mats, GH)) { out.push(m); } }
  else if (sp === 'whip') { for (const m of APP.buildWhip(bm, mats, GH)) out.push(m); }
  return out;
}
function landmarks3D(bm) { const lm = bm.lm, p = {}, out = []; const spec = { snout: [0.004, 0], mouthCorner: [lm.mouthCorner, 'm'], eye: [lm.eye, 'e'], preopercle: [lm.preopercle, 0], operculum: [lm.operculum, 0], pectoralBase: [lm.pectoralBase, 0], pelvicBase: [lm.pelvicBase, -Math.PI / 2], vent: [lm.vent, -Math.PI / 2], analOrigin: [lm.analOrigin, -Math.PI / 2], analEnd: [lm.analEnd, -Math.PI / 2], dorsalOrigin: [lm.dorsalOrigin, Math.PI / 2], dorsalEnd: [lm.dorsalEnd, Math.PI / 2], peduncleStart: [lm.peduncleStart, Math.PI / 2], caudalBase: [0.999, Math.PI / 2] };
  const fr = {}, s = {}; for (const k in spec) { const [u, th] = spec[k]; if (th === 'm') { bm.frame(u, fr); bm.section(u, s); const ym = bm.mouthLineY(u, s); out.push({ name: k, x: fr.px + fr.nx * ym, y: fr.py + fr.ny * ym, z: bm.halfWidthAtY(s, ym) }); } else if (th === 'e') { bm.frame(u, fr); bm.section(u, s); out.push({ name: k, x: fr.px + fr.nx * bm.eyeY, y: fr.py + fr.ny * bm.eyeY, z: bm.halfWidthAtY(s, bm.eyeY) }); } else { bm.surface(u, th, p); out.push({ name: k, x: p.x, y: p.y, z: p.z }); } } return out; }
/**
 * Build a renderable fish from a genome.
 * @returns {{group:THREE.Group, uniforms:Object, materials:Object, bm:BodyModel, info:Object, dispose:()=>void}}
 */
