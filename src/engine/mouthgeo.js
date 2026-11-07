/* MOUTH CONSTRUCTOR — one assembly for every creature. The mouth is a SEAM in the head surface (lips meet, resting opening = 0) plus a hinged
   lower jaw (and a sliding upper jaw where the niche protrudes); there is NO lip ring/tube/torus. The layered interior (inner walls capped at the
   throat, tongue floor mass, first gill arches) only shows when the jaw opens. Special constructions
   (fused plate, underside sucker disc, short tube cap, flattened-plan ventral slot) come from the mouth law only.
   H = { THREE, clamp, lerp, sstep, smoother, TAU, skinAttributes, mergeGeos }. */
import { CAVITY_MAX, DISC_DEPTH_MAX } from './laws.js';

/* mouth-line level in vert = sin(theta) units, identical to the skin shader's crease line */
export function mouthLevel(bm, u, H) {
  const t = H.sstep(bm.jawStartU, bm.mcU, u);
  return H.lerp(bm.tipF, bm.cornerF, t) - .025 * Math.sin(Math.PI * t);
}
/* aperture half-height (vert units) of the opened mouth along the jaw */
export function apertureAt(bm, u, H) {
  const u0 = Math.max(bm.jawStartU, .006), u1 = bm.mcU * .92, tt = H.clamp((u - u0) / Math.max(1e-6, u1 - u0), 0, 1);
  return (.08 + .3 * bm.g.mouth.gape) * Math.pow(Math.sin(Math.PI * tt), .6);
}
const thetaOf = (vert, side) => { const th = Math.asin(Math.max(-.985, Math.min(.985, vert))); return side > 0 ? th : Math.PI - th; };
function skinPoint(bm, u, vert, side, out, lift = 0) {
  const fr = bm._mfr || (bm._mfr = {}), s = bm._ms || (bm._ms = {}), p = bm._mp || (bm._mp = {});
  bm.frame(u, fr); bm.section(u, s); bm.point(u, thetaOf(vert, side), p, fr, s, true);
  const l = Math.hypot(p.ly, p.lz) || 1, off = lift / l;
  out.set(p.x + fr.nx * p.ly * off, p.y + fr.ny * p.ly * off, p.z + p.lz * off); return out;
}
const jawWeight = (bm, u, H) => 1 - H.sstep(Math.max(.004, bm.jawStartU) + (bm.mcU - Math.max(.004, bm.jawStartU)) * .85, bm.mcU, u);

/** Fused-plate (beak) mouths only: two thin plate RIBBONS lying in the head surface along the seam (upper static, lower with the jaw). No tube, no ring. */
export function buildBeak(bm, mats, H, M) {
  const { THREE } = H, g = bm.g, u0 = Math.max(bm.jawStartU, .006), u1 = bm.mcU, K = 16, out = [];
  const w = .05 + .05 * g.mouth.lips;
  for (const [sign, lower] of [[1, false], [-1, true]]) {
    const pos = [], idx = [], rows = 2 * K + 1, cols = 4, v = new THREE.Vector3();
    for (let i = 0; i < rows; i++) {
      const side = i <= K ? 1 : -1, k = i <= K ? K - i : i - K - 1 + 1, u = H.lerp(u1, u0, (i <= K ? i : 2 * K - i) / K);
      for (let j = 0; j <= cols; j++) {
        const f = j / cols, lift = bm.maxD * .007 * Math.sin(Math.PI * f) * Math.sin(Math.PI * (.08 + .84 * (i / (rows - 1))));
        skinPoint(bm, u, mouthLevel(bm, u, H) + sign * (.004 + w * f), side, v, lift); pos.push(v.x, v.y, v.z);
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    H.skinAttributes(geo, bm, 0, lower);
    const mesh = new THREE.Mesh(geo, mats.tooth); mesh.frustumCulled = false; mesh.userData.beak = true; out.push(mesh);
  }
  return out;
}

/** Interior cavity: a pocket rooted on the aperture outline, closed by a throat cap with a floor. Depth ≤ CAVITY_MAX × head length. */
export function buildCavity(bm, mats, H) {
  const { THREE } = H, g = bm.g, u0 = Math.max(bm.jawStartU, .006), u1 = bm.mcU * .92, um = (u0 + u1) / 2, hs = (u1 - u0) / 2 * .98;
  const Mr = 22, N = 5, depth = Math.min(g.mouth.cavityDepth, CAVITY_MAX) * bm.h * bm.L;
  const pos = [], ab = [], idx = [], rim = [], fr = {};
  const uc = u1; bm.frame(uc, fr);
  const rimC = new THREE.Vector3();
  /* closed outline on the skin: right corner → tip → left corner along the upper lip (lower=false), back along the lower lip */
  for (let j = 0; j < Mr; j++) {
    const phi = j / Mr * H.TAU, lower = phi > Math.PI, lam = lower ? (phi - Math.PI) / Math.PI : phi / Math.PI;
    const side = (lam < .5) === !lower ? 1 : -1, u = u1 - (u1 - u0) * Math.sin(Math.PI * lam), ap = apertureAt(bm, u, H);
    const vert = mouthLevel(bm, u, H) + (lower ? -1 : 1) * ap * 1.04;
    const p = skinPoint(bm, u, vert, side, new THREE.Vector3(), -bm.maxD * .004);
    rim.push({ p, u, phi, lower, lam }); rimC.add(p);
  }
  rimC.multiplyScalar(1 / Mr);
  const throat = rimC.clone().add(new THREE.Vector3(fr.tx * depth, fr.ty * depth, 0));
  { /* the throat cap stays inside the head section at its own station (laterally expanded / thin heads included) */
    const ut = H.clamp(uc + depth / bm.L, .004, .999), ft = {}, st = {}; bm.frame(ut, ft); bm.section(ut, st);
    const ly = H.clamp((throat.x - ft.px) * ft.nx + (throat.y - ft.py) * ft.ny, -st.dDn * .55, st.dUp * .55);
    throat.set(ft.px + ft.nx * ly, ft.py + ft.ny * ly, 0); }
  let v = 0;
  for (let i = 0; i <= N; i++) {
    const d = i / N, e = H.smoother(d), shrink = 1 - .25 * e;
    for (let j = 0; j < Mr; j++) {
      const r = rim[j], q = r.p.clone().lerp(throat, e).sub(throat).multiplyScalar(shrink).add(throat);
      if (i > 0) { /* structural containment: interior vertices never leave the head section at their own station */
        const uq = H.clamp((bm.headX - q.x) / bm.L, .004, .999), fq = {}, sq = {}; bm.frame(uq, fq); bm.section(uq, sq);
        const ly = H.clamp((q.x - fq.px) * fq.nx + (q.y - fq.py) * fq.ny, -sq.dDn * .9, sq.dUp * .9), hw = bm.halfWidthAtY(sq, ly) * .92;
        q.set(fq.px + fq.nx * ly, fq.py + fq.ny * ly, H.clamp(q.z, -hw, hw)); }
      const w = r.lower ? Math.pow(1 - d, 1.4) * jawWeight(bm, r.u, H) * Math.min(1, Math.sin(Math.PI * r.lam) * 1.6 + .2) : 0;
      pos.push(q.x, q.y, q.z); ab.push(r.u, .5, 1, w); v++;
    }
  }
  const centre = v; pos.push(throat.x, throat.y, 0); ab.push(u1, .5, 1, 0);
  for (let i = 0; i < N; i++) for (let j = 0; j < Mr; j++) { const a = i * Mr + j, b = i * Mr + (j + 1) % Mr, c = a + Mr, d = b + Mr; idx.push(a, c, b, b, c, d); }
  for (let j = 0; j < Mr; j++) idx.push(N * Mr + j, centre, N * Mr + (j + 1) % Mr);
  /* medial septum: the pocket is closed in the mid-plane by a floor/palate sheet (rim outline → throat), so the open mouth is never see-through; the lower half follows the jaw */
  { const nb = v + 1; for (let j = 0; j < Mr; j++) { const r = rim[j], w0 = r.lower ? jawWeight(bm, r.u, H) * Math.min(1, Math.sin(Math.PI * r.lam) * 1.6 + .2) : 0; pos.push(r.p.x, r.p.y, 0); ab.push(r.u, .5, 1, w0); }
    pos.push(throat.x, throat.y, 0); ab.push(u1, .5, 1, 0);
    for (let j = 0; j < Mr; j++) idx.push(nb + Mr, nb + j, nb + (j + 1) % Mr); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aBody', new THREE.Float32BufferAttribute(ab, 4)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.jaw); mesh.frustumCulled = false; mesh.renderOrder = 1; return [mesh];
}

/* keep any interior vertex inside the head section at its own station (a cavity, never a tunnel) */
function contain(bm, q, H, slack = .9) {
  const uq = H.clamp((bm.headX - q.x) / bm.L, .004, .999), fq = {}, sq = {}; bm.frame(uq, fq); bm.section(uq, sq);
  const ly = H.clamp((q.x - fq.px) * fq.nx + (q.y - fq.py) * fq.ny, -sq.dDn * slack, sq.dUp * slack), hw = bm.halfWidthAtY(sq, ly) * slack * .96;
  return q.set(fq.px + fq.nx * ly, fq.py + fq.ny * ly, H.clamp(q.z, -hw, hw));
}
function blobMesh(bm, mats, H, centre, ax, ay, az, fr, tag, wFn, rows = 8, cols = 12) {
  const { THREE } = H, geo = new THREE.SphereGeometry(1, cols, rows), P = geo.getAttribute('position'), ab = [], q = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    q.set(centre.x + fr.tx * ax * x + fr.nx * ay * y, centre.y + fr.ty * ax * x + fr.ny * ay * y, centre.z + az * z);
    contain(bm, q, H); P.setXYZ(i, q.x, q.y, q.z);
    ab.push(H.clamp((bm.headX - q.x) / bm.L, .004, .999), .5, tag, wFn(x, y, z));
  }
  geo.setAttribute('aBody', new THREE.Float32BufferAttribute(ab, 4)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.jaw); mesh.frustumCulled = false; mesh.renderOrder = 1; return mesh;
}
/** Layered interior (visible only when the jaw opens): inner walls (the capped pocket), tongue as a floor mass, and the first gill arches hinted in shadow at the back. */
export function buildInterior(bm, mats, H) {
  const { THREE } = H, g = bm.g, walls = buildCavity(bm, mats, H), out = [...walls]; walls.forEach(w => { w.userData.layer = "walls"; });
  const u0 = Math.max(bm.jawStartU, .006), u1 = bm.mcU * .92, depth = Math.min(g.mouth.cavityDepth, CAVITY_MAX) * bm.h * bm.L, fr = {}, sl = new THREE.Vector3(), su = new THREE.Vector3();
  bm.frame(bm.mcU, fr);
  const ap = apertureAt(bm, (u0 + u1) / 2, H), ym = skinPoint(bm, (u0 + u1) / 2, mouthLevel(bm, (u0 + u1) / 2, H), 1, new THREE.Vector3(), 0);
  const lowY = skinPoint(bm, (u0 + u1) / 2, mouthLevel(bm, (u0 + u1) / 2, H) - ap * .98, 1, sl, 0).clone(), upY = skinPoint(bm, (u0 + u1) / 2, mouthLevel(bm, (u0 + u1) / 2, H) + ap * .98, 1, su, 0).clone();
  const hy = Math.max(1e-5, Math.abs((upY.x - lowY.x) * fr.nx + (upY.y - lowY.y) * fr.ny)) * .5, hw = Math.max(1e-5, bm.halfWidthAtY(bm.section(bm.mcU, {}), 0));
  const mid = new THREE.Vector3((lowY.x + upY.x) / 2, (lowY.y + upY.y) / 2, 0), L = bm.L;
  /* tongue: a floor mass resting on the lower jaw floor, its front following the jaw, its root fixed */
  const tc = mid.clone().addScaledVector(new THREE.Vector3(fr.nx, fr.ny, 0), -hy * .62).addScaledVector(new THREE.Vector3(fr.tx, fr.ty, 0), depth * .25);
  out.push(Object.assign(blobMesh(bm, mats, H, tc, depth * .55 + (u1 - u0) * L * .3, hy * .42, Math.min(hw * .45, hy * 1.5 + 1e-5), fr, 1.5, (x) => Math.max(0, .5 - x * .5) * (1 - H.sstep(.2, 1, x * .5 + .5) * .4), 8, 14), { userData: { layer: 'tongue' } }));
  /* first gill arches: thin ribs standing across the throat at the very back, hinted in shadow */
  const nA = 3 + (g.mouth.gape > .6 ? 1 : 0);
  for (let k = 0; k < nA; k++) {
    const back = depth * (.62 + .1 * k), c = mid.clone().addScaledVector(new THREE.Vector3(fr.tx, fr.ty, 0), back);
    out.push(Object.assign(blobMesh(bm, mats, H, c, depth * .028, hy * .85, Math.min(hw * .5, hy * 1.2 + 1e-5), fr, 1.25, () => 0, 5, 10), { userData: { layer: 'arches' } }));
  }
  return out;
}

/** Shallow floored disc with a lip ring: underside sucker (construction 'sucker') or front cap of a short tube ('tube'). */
export function buildDisc(bm, mats, H, M) {
  const { THREE } = H, g = bm.g, front = M.construction === 'tube';
  const u = front ? .006 : bm.h * .3, theta = front ? 0 : -Math.PI / 2, fr = {}, p = {}; bm.frame(u, fr);
  const normal = new THREE.Vector3();
  if (front) normal.set(-fr.tx, -fr.ty, 0).normalize(); else bm.surfaceNormal(u, theta, normal);
  const centre = new THREE.Vector3();
  if (front) centre.set(fr.px, fr.py, 0).addScaledVector(normal, bm.L * .0007); else { bm.rawSurface(u, theta, p); centre.set(p.x, p.y, 0).addScaledVector(normal, bm.L * .0008); }
  const headL = bm.h * bm.L, radius = front ? Math.min(bm.maxD * .07, headL * .12) : Math.min(bm.maxD * .22, headL * .3);
  const depth = Math.min(DISC_DEPTH_MAX * headL * .95, radius * .35) * (front ? .4 : 1);
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const lip = new THREE.RingGeometry(radius * .8, radius * 1.03, 28, 1); lip.applyQuaternion(rot);   /* flat annulus flush with the head surface: no torus, no protruding lip */
   lip.translate(centre.x, centre.y, centre.z); H.skinAttributes(lip, bm);
  /* floored dish: concave rings sinking to a flat floor at `depth`, never a hole */
  const NR = 6, NA = 24, pos = [], ab = [], idx = [];
  for (let i = 0; i <= NR; i++) { const rr = radius * .92 * (1 - i / NR), z = -depth * (1 - Math.pow(rr / (radius * .92), 2)); for (let j = 0; j < NA; j++) { const a = j / NA * H.TAU; pos.push(Math.cos(a) * rr, Math.sin(a) * rr, z); ab.push(u, .25, 1, 0); } }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA, c = a + NA, d = b + NA; idx.push(a, b, c, b, d, c); }
  const dish = new THREE.BufferGeometry(); dish.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dish.setAttribute('aBody', new THREE.Float32BufferAttribute(ab, 4)); dish.setIndex(idx); dish.computeVertexNormals();
  dish.applyQuaternion(rot); dish.translate(centre.x, centre.y, centre.z);
  const out = [new THREE.Mesh(lip, mats.body), new THREE.Mesh(dish, mats.jaw)];
  out[0].userData.disc = { depth, headL, radius, front, normalY: normal.y, centreY: centre.y };   /* measured by the law audit */
  if (g.mouth.teeth === 'rasp' && !front) {
    const teeth = [];
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 18; i++) { const a = (i + ring * .5) / 18 * H.TAU, rr = radius * (.7 - ring * .25), geo = new THREE.ConeGeometry(radius * .035, radius * .1, 4); geo.rotateX(Math.PI / 2); geo.translate(Math.cos(a) * rr, Math.sin(a) * rr, -depth * (1 - (rr / radius) ** 2) + radius * .05); geo.applyQuaternion(rot); geo.translate(centre.x, centre.y, centre.z); teeth.push(geo); }
    out.push(new THREE.Mesh(H.mergeGeos(teeth), mats.simple));
  }
  out.forEach(m => { m.frustumCulled = false; }); return out;
}

/** Flattened plan: a shallow curved mouth on the BOTTOM surface (two lip arcs around a dark slot). */
export function buildVentralMouth(bm, mats, H) {
  const { THREE } = H, g = bm.g, u = bm.h * .42, s = {}, fr = {}, p = {}; bm.section(u, s); bm.frame(u, fr);
  const w = s.coreW * .62, K = 16, out = [];
  const bottom = (uu, z, out2, lift) => { bm.frame(uu, fr); bm.section(uu, s); const ct = Math.sign(z) * Math.pow(Math.min(1, Math.abs(z) / Math.max(1e-8, s.w)), s.n / 2); bm.point(uu, -Math.acos(H.clamp(ct, -1, 1)), p, fr, s, true); const l = Math.hypot(p.ly, p.lz) || 1; out2.set(p.x + fr.nx * p.ly / l * lift, p.y + fr.ny * p.ly / l * lift, p.z + p.lz / l * lift); return out2; };
  for (const sign of [-1, 1]) {   /* lips: flat ribbons lying IN the skin (no tube, no ridge) */
    const rp = [], ri = [], q = new THREE.Vector3();
    for (let i = 0; i <= K; i++) for (const e of [-1, 1]) { const z = H.lerp(-w, w, i / K), uu = u + .05 * bm.h * (z / w) ** 2 + sign * .02 * bm.h + e * .006 * bm.h * (1 + g.mouth.lips); bottom(uu, z, q, bm.maxD * .0012); rp.push(q.x, q.y, q.z); }
    for (let i = 0; i < K; i++) { const a = i * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); geo.setIndex(ri); geo.computeVertexNormals(); H.skinAttributes(geo, bm); const m = new THREE.Mesh(geo, mats.body); m.frustumCulled = false; out.push(m);
  }
  /* slot: a thin dark strip between the lips, closed (a floor), depth ≤ CAVITY_MAX by construction (it lies on the skin) */
  const pos = [], ab = [], idx = [];
  for (let i = 0; i <= K; i++) { const z = H.lerp(-w, w, i / K) * .95; for (const sgn of [-1, 1]) { const uu = u + .05 * bm.h * (z / w) ** 2 + sgn * .009 * bm.h; const q = bottom(uu, z, new THREE.Vector3(), -bm.maxD * .003); pos.push(q.x, q.y, q.z); ab.push(uu, .25, 1, 0); } }
  for (let i = 0; i < K; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const slot = new THREE.BufferGeometry(); slot.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); slot.setAttribute('aBody', new THREE.Float32BufferAttribute(ab, 4)); slot.setIndex(idx); slot.computeVertexNormals();
  const sm = new THREE.Mesh(slot, mats.jaw); sm.frustumCulled = false; sm.userData.ventral = { y: pos.filter((_, i) => i % 3 === 1).reduce((a, b, _, r) => a + b / r.length, 0) }; out.push(sm);
  return out;
}

/** Flattened plan: optional defensive spine on the top of the slender tail (niche flag). */
export function buildTailSpine(bm, mats, H) {
  const { THREE } = H, u = .8, p = {}, n = new THREE.Vector3(), fr = {}; bm.rawSurface(u, Math.PI / 2, p); bm.surfaceNormal(u, Math.PI / 2, n); bm.frame(u, fr);
  const len = bm.L * .09, geo = new THREE.ConeGeometry(bm.maxD * .02, len, 6); geo.translate(0, len * .5, 0);
  const dir = new THREE.Vector3(fr.tx, fr.ty, 0).multiplyScalar(.9).add(n.multiplyScalar(.35)).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); geo.translate(p.x, p.y, p.z);
  const m = new THREE.Mesh(geo, mats.tooth); m.frustumCulled = false; return [m];
}
