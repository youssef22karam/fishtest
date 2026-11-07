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
Object.assign(FG, { App, setFish, buildEnvironment, runSelfTest, HABITATS, NICHES, CLADES, SPECIES, FORM_RULES, SCHEMA, ENV });
export { boot, FG };
export default boot;
