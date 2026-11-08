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
/* (moved from part10 to keep every part under 30,000 bytes: function declarations are hoisted) */
function addPelvic(fb, bm, side, K, rays) {
  const f = bm.g.fins.pelvic, u = bm.lm.pelvicBase, p = {}, fr = {}, fused = f.shape === 'fused', len = f.len * bm.maxD * .55, spread = fused ? .16 : .48, sec = {};
  bm.frame(u, fr); bm.section(u, sec);
  /* round 3: pelvic fins stay small — never longer than the side fins of the same fish (gliding plan excepted), ≤ .20 L, base buried like the others */
  const pecL = bm.pecInfo && bm.pecInfo[1] && bm.pecInfo[1].lenOverL ? bm.pecInfo[1].lenOverL * bm.L : 0, glide = bm.a.family === 'glider' || bm.a.family === 'ray', sink = Math.min(TAIL.CAP.sink * bm.L, .5 * sec.dDn);
  const lenCap = Math.min(TAIL.CAP.pelvicH * bm.L / .8, glide || !pecL ? 9 : pecL * .8); const lenF = Math.min(len, lenCap); (bm.finH || (bm.finH = {})).pelvic = lenF * 1.2 / bm.L; bm.finH.pecL = pecL / bm.L;
  const rootU = t => clamp(u + t * bm.bp.maxD * .12, .02, .94), rootTh = -Math.PI / 2 + side * spread;
  return fb.add({ bm, kind: 'pelvic', kindId: 4, sink, R: Math.max(rays, K > 2 ? 10 : 4), K, flex: f.flex, opacity: f.opacity, memb: f.shape === 'filament' ? .32 : 1, spineFrac: 0, solid: bm.a.solid, blend: .65, thickness: bm.maxD * bm.a.root * .22, normal: new THREE.Vector3(0, 0, side),
    base: (t, out) => { bm.surface(rootU(t), rootTh, p); out.set(p.x, p.y, p.z); },
    root: (t, skinSide, out) => { const uu = rootU(t), theta = rootTh + skinSide * .045 * Math.sin(Math.PI * t); bm.surface(uu, theta, p); out.set(p.x, p.y, p.z); out.u = uu; out.theta = theta; },
    edge: (t, out) => {
      const v = foilOutline(t, .4, .55, .5), h = f.shape === 'filament' ? Math.pow(Math.max(0, Math.sin(Math.PI * t)), 5) : v[1];
      bm.surface(rootU(t), rootTh, p); out.set(p.x + fr.tx * lenF * .8 * h, p.y - lenF * (bm.a.solid ? .3 : .68) * h, p.z + side * lenF * .6 * h);
    } });
}
function onResize() { if (!renderer) return; const width = innerWidth - (typeof currentTab !== 'undefined' && currentTab && innerWidth >= 1000 ? 420 : 0); renderer.setSize(width, innerHeight, false); $('gl').style.width = width + 'px'; camera.aspect = width / innerHeight; camera.updateProjectionMatrix(); }
function applyTier() {
  const t = TIERS[App.tier]; if (renderer) renderer.setPixelRatio(Math.min(devicePixelRatio || 1, t.pr));
  if (App.env) { if (App.env.shafts) App.env.shafts.visible = t.shafts && App.mode === 'habitat'; if (App.env.particles) { App.env.particles.visible = t.particles > 0 && App.mode === 'habitat'; App.env.particles.geometry.setDrawRange(0, t.particles); } }
  if (App.school) App.school.setCount(t.school);
  const target = App.tier >= 2 ? 'med' : 'hero';
  if (App.fish && App.fish.info.quality !== target && !App.qualityPending) { App.qualityPending = true; setTimeout(() => { App.qualityPending = false; if (App.genome && !App.contextLost) setFish(App.genome, { noHistory: true, keepCamera: true, skipPanel: true }); }, 0); }
}
function adaptQuality(dt, fps) { App.fpsEma = lerp(App.fpsEma, fps, 0.08); if (App.fpsEma < 42) { App.lowT += dt; App.highT = 0; if (App.lowT > 2 && App.tier < TIERS.length - 1) { App.tier++; App.lowT = 0; applyTier(); toast('Lowered detail (tier ' + App.tier + ') to keep 60 fps'); } } else if (App.fpsEma > 57) { App.highT += dt; App.lowT = 0; if (App.highT > 10 && App.tier > (isMobile ? 1 : 0)) { App.tier--; App.highT = 0; applyTier(); } } else { App.lowT = Math.max(0, App.lowT - dt); } }
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
