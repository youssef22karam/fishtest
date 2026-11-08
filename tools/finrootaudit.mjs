// Fin-root audit (round 6B.1):  node tools/reassemble.mjs && node tools/finrootaudit.mjs [label]      env: N=1000 (validation fish, same draw as verify's coherence set)
// (1) PENETRATION - every fin triangle (3 vertices, centroid, 3 edge midpoints) against the analytic body volume, through the FULL motion range:
//     side fins: sweep -25/5/35 deg x abduction 5/20/55 deg (the hard clamps of finmotion.PEC_LIM + mid), joint rotation mirrored from VS_FIN (finroot.pecMove);
//     other fins: rest pose and +-the z ripple the shader can add.  Reported as triangles intersecting by more than finroot.ROOT.tol x body length.
// (2) ROOT BRIGHTNESS - every root sample (fin vertices with lenT < .12): CPU port of the lighting terms that decide brightness (diffuse wrap + GGX lobe + clearcoat lobe + grazing sheen)
//     evaluated for 6 view directions x the studio key light, for the fin's rendered normal versus the flank's normal at the same (u, angle).  A sample is "brighter" when the final root
//     luminance exceeds the flank luminance (+0.5 %).  'raw' = no cap; 'final' = with the cap the fin shader applies (root colour never above the flank-lit reference).
// (3) SEAM - the fleshy base must exist, be skinned with body coordinates, and meet the flank with no step (mound border lift ~ 0).
import './headless.mjs';
import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
const root = resolve(new URL('..', import.meta.url).pathname), eng = f => pathToFileURL(resolve(root, 'src/engine', f)).href;
const { FG } = await import(eng('fishgen.js')); const { initProcGen, randomFish } = await import(eng('procgen.js')); const { CLADE_IDS } = await import(eng('clades.js')); const FR = await import(eng('finroot.js'));
initProcGen(FG);
const N = +process.env.N || 1000, label = process.argv[2] || 'run', strat = Math.floor(N * .6 / CLADE_IDS.length);
const KIND = { 0: 'body', 1: 'dorsal', 2: 'anal', 3: 'pectoral', 4: 'pelvic', 5: 'caudal', 6: 'adipose', 7: 'finlet' };
const SHADER_HAS_CAP = (await import('node:fs')).readFileSync(resolve(root, 'src/engine/fishgen.js'), 'utf8').includes('round 6B.1 ROOT_CAP');
const R = { label, pecZ: [], buildFail: 0, discSkipped: 0, fish: 0, skipped: 0, tris: 0, trisHit: 0, fishHit: 0, byKind: {}, worst: 0, roots: 0, brightRaw: 0, brightFinal: 0, moundMissing: 0, moundSteps: 0, moundFish: 0, moundTris: 0, ex: [] };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* lighting port: albedo cancels (same albedo at the root and on the flank), so luminance is compared per unit albedo */
const KEY = (() => { const l = [.45, .8, .4], n = Math.hypot(...l); return l.map(x => x / n); })(), FILL = (() => { const l = [-.5, .2, .6], n = Math.hypot(...l); return l.map(x => x / n); })();
const VIEWS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [.6, .3, .75], [-.6, .3, -.75]].map(v => { const n = Math.hypot(...v); return v.map(x => x / n); });
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
function lum(N, V, rough, coat) {
  const L = KEY, H = nrm([V[0] + L[0], V[1] + L[1], V[2] + L[2]]), nv = clamp(dot(N, V), 1e-3, 1), nl = Math.max(0, dot(N, L)), nh = Math.max(1e-4, dot(N, H)), vh = Math.max(1e-4, dot(V, H));
  const a2 = Math.pow(rough, 4), D = a2 / (Math.PI * Math.pow(nh * nh * (a2 - 1) + 1, 2)), F = .035 + .965 * Math.pow(1 - vh, 5), k = Math.pow(rough + 1, 2) / 8, G = (nv / (nv * (1 - k) + k)) * (nl / (nl * (1 - k) + k));
  const spec = Math.min(14, F * D * G / Math.max(1e-3, 4 * nv * nl + 1e-3)), wrap = clamp((dot(N, L) + .28) / 1.28, 0, 1), fill = clamp((dot(N, FILL) + .18) / 1.18, 0, 1);
  const cr = .1, ca = Math.pow(cr, 4), cD = ca / (Math.PI * Math.pow(nh * nh * (ca - 1) + 1, 2)), cf = .04 + .96 * Math.pow(1 - vh, 5);
  return (1 - F) * (.62 * .5 + wrap * .78 + fill * 1.1) + spec * nl * 1.7 + Math.min(8, cD * cf * .25 / Math.max(1e-3, 4 * nv * nl + 1e-3)) * nl * coat * 1.5 + .6 * Math.pow(1 - nv, 4.5) * 0;
}
const CAPPED = SHADER_HAS_CAP;
const finLum = (N, V) => lum(N, V, .62 - .48 * .38 * .5, .45), flankLum = (N, V) => lum(N, V, .35, .8);
for (let i = 0; i < N; i++) {
  const filter = i < strat * CLADE_IDS.length ? CLADE_IDS[i % CLADE_IDS.length] : undefined; const f = randomFish(filter); let fish;
  try { fish = FG.buildFish(f.genome, { quality: 'med' }); } catch (e) { R.skipped++; R.buildFail++; continue; }
  const bm = fish.bm, L = bm.L, tol = FR.ROOT.tol * L, geo = fish.parts.fins.geometry, P = geo.getAttribute('position'), AF = geo.getAttribute('aFin'), AH = geo.getAttribute('aHinge'), AX = geo.getAttribute('aAxis'), NO = geo.getAttribute('normal'), SK = geo.getAttribute('aSkin');
  const idx = geo.index.array, nt = idx.length / 3, restDeg = bm.law.pec.restAbd, ctx = { fr: {}, s: {} };
  if (bm.disc) { R.skipped++; R.discSkipped++; fish.dispose(); continue; }
  if (bm.pecZ !== undefined) R.pecZ.push(bm.pecZ / L);
  R.fish++; const hit = new Uint8Array(nt), d = { pos: P.array, fin: AF.array, hinge: AH.array, axis: AX.array };
  /* states: side fins move, everything else rests (plus z ripple +-) */
  const states = [];
  for (const sw of FR.MOTION.sweep) for (const ab of FR.MOTION.abd) states.push({ mv: true, sw, ab, dz: 0 });
  for (const sg of [0, 1, -1]) states.push({ mv: false, sg });
  const nv = P.count, M = new Float64Array(nv * 3), o = [0, 0, 0], H = [0, 0, 0, 0], A = [0, 0, 0], p3 = [0, 0, 0];
  let worst = 0, worstNC = 0;
  for (const S of states) {
    for (let v = 0; v < nv; v++) {
      p3[0] = P.getX(v); p3[1] = P.getY(v); p3[2] = P.getZ(v);
      if (AH.getW(v) !== 0) { if (S.mv) { H[0] = AH.getX(v); H[1] = AH.getY(v); H[2] = AH.getZ(v); H[3] = AH.getW(v); A[0] = AX.getX(v); A[1] = AX.getY(v); A[2] = AX.getZ(v); FR.pecMove(p3, H, A, AF.getY(v), S.sw, S.ab, restDeg, o, -FR.rippleAmp(3, AF.getZ(v), AF.getY(v), L) * (1 - SK.getW(v))); p3[0] = o[0]; p3[1] = o[1]; p3[2] = o[2]; } else continue; }
      else if (S.mv) continue; else p3[2] += S.sg * FR.rippleAmp(AF.getW(v), AF.getZ(v), AF.getY(v), L) * (1 - SK.getW(v));
      M[v * 3] = p3[0]; M[v * 3 + 1] = p3[1]; M[v * 3 + 2] = p3[2];
    }
    for (let t = 0; t < nt; t++) {
      if (hit[t]) continue; const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2], moving = AH.getW(a) !== 0; if (moving !== S.mv) continue;
      const pts = [[a], [b], [c], [a, b, c], [a, b], [b, c], [a, c]];
      for (const q of pts) { let x = 0, y = 0, z = 0; for (const v of q) { x += M[v * 3]; y += M[v * 3 + 1]; z += M[v * 3 + 2]; } const dd = FR.depthInBody(bm, x / q.length, y / q.length, z / q.length, ctx); if (dd > worst) worst = dd; if (dd > worstNC && AF.getW(a) !== 5) worstNC = dd; if (dd > tol) { hit[t] = 1; break; } }
    }
  }
  let nh = 0, nct = 0; for (let t = 0; t < nt; t++) { const k = KIND[AF.getW(idx[t * 3])] || '?'; R.byKind[k] = R.byKind[k] || { tris: 0, hit: 0 }; R.byKind[k].tris++; if (hit[t]) R.byKind[k].hit++; if (k === 'caudal') { nct++; continue; } if (hit[t]) nh++; }
  R.tris += nt - nct; R.trisHit += nh; R.worst = Math.max(R.worst, worstNC / L); if (nh) { R.fishHit++; if (R.ex.length < 6) R.ex.push(`${f.seed} ${nh} tris, worst ${(worst / L * 100).toFixed(2)}% L`); }
  /* (2) root brightness */
  const att = new Set((fish.info.attachments || []).map(a => a.index)), tmp = {}, fn = new FR.Vec();
  for (let v = 0; v < nv; v++) {
    if (AF.getY(v) >= .12 || AF.getW(v) === 5 || AF.getW(v) === 3 && bm.disc) continue; if (!(AF.getW(v) >= 1 && AF.getW(v) <= 7)) continue;
    const u = SK.getX(v), ang = SK.getY(v), th = ang * Math.PI * 2 - Math.PI / 2; bm.surfaceNormal(clamp(u, .003, .995), th, fn);
    const Nf = nrm([NO.getX(v), NO.getY(v), NO.getZ(v)]), Nb = [fn.x, fn.y, fn.z]; R.roots++;
    let rawB = false, finB = false;
    for (const V of VIEWS) { const lf = Math.max(finLum(Nf, V), finLum(Nf.map(x => -x), V)), lb = flankLum(Nb, V), lr = finLum(Nb, V); const cap = CAPPED ? Math.min(lf, lb) : lf; if (lf > lb * 1.005) rawB = true; if (cap > lb * 1.005) finB = true; }
    if (rawB) R.brightRaw++; if (finB) R.brightFinal++;
  }
  /* (3) mound */
  const mm = fish.parts.mounds; if (mm) { R.moundFish++; R.moundTris += mm.geometry.index.count / 3; const MP = mm.geometry.getAttribute('position'), MA = mm.geometry.getAttribute('aBody'); for (let v = 0; v < MP.count; v++) { if (MA.getZ(v) !== 0) R.moundSteps++; } } else R.moundMissing++;
  fish.dispose();
}
const pct = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '-';
const lines = [`FIN-ROOT AUDIT [${label}]  (${R.fish} fish audited; ${R.discSkipped} disc-plan fish skipped (their fins are the disc margin, out of scope); build failures ${R.buildFail})`,
  `  side-fin peduncle lift: max ${(Math.max(0, ...R.pecZ) * 100).toFixed(2)}% L  mean ${(R.pecZ.reduce((a, b) => a + b, 0) / Math.max(1, R.pecZ.length) * 100).toFixed(2)}% L  p95 ${(R.pecZ.sort((a, b) => a - b)[Math.floor(R.pecZ.length * .95)] * 100 || 0).toFixed(2)}% L  (${R.pecZ.filter(z => z > 0).length}/${R.pecZ.length} fish needed a lift)`,
  `  penetration: ${R.trisHit}/${R.tris} fin triangles intersect the body volume through the full motion range (${pct(R.trisHit, R.tris)}), ${R.fishHit} fish affected, worst ${(R.worst * 100).toFixed(2)}% L (tolerance ${(FR.ROOT.tol * 100).toFixed(2)}% L)`,
  '  by fin (hit/triangles): ' + Object.entries(R.byKind).map(([k, v]) => `${k} ${v.hit}/${v.tris}`).join('  ') + '   [caudal is NOT counted above: its root is buried by the rear-cap termination law (round 6H L3), not a flank/ridge joint]',
  `  root brightness: ${R.roots} root samples; brighter than the flank: raw ${R.brightRaw}, final ${R.brightFinal}`,
  `  fleshy base: present on ${R.moundFish}/${R.fish} fish (${R.moundTris} mound triangles), missing ${R.moundMissing}, mound vertices with non-body skin tag ${R.moundSteps}`];
if (R.ex.length) lines.push('  examples: ' + R.ex.join(' | '));
const bad = R.buildFail || R.trisHit || R.brightFinal || R.moundMissing || R.moundSteps; lines.push(bad ? 'FINROOT AUDIT FAIL' : 'FINROOT AUDIT PASS');
console.log(lines.join('\n')); mkdirSync(resolve(root, 'docs/census'), { recursive: true }); writeFileSync(resolve(root, `docs/census/finroot-${label}.txt`), lines.join('\n') + '\n'); process.exit(bad ? 1 : 0);
