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

/* ── ROUND 2: ONE source of truth for the lip line. The lower-jaw patch edge, the pocket rim, the teeth rows and the skin shader's discard line all use jawEdgeVert / lipPoint. ── */
export const jawU0 = bm => bm.jawStartU < .01 ? .0015 : Math.max(bm.jawStartU, .006);
export const jawU1 = bm => bm.hingeU || bm.mcU;
/** lip line as a height in sin(theta) units on the head section at station u (the lower patch edge is the asin of this) */
export function jawEdgeVert(bm, u) {
  const s = bm._es || (bm._es = {}); bm.section(u, s); const ym = bm.mouthLineY(u, s), yr = ym > 0 ? s.dUp : s.dDn, n = ym > 0 ? s.nD : s.nV;
  return Math.sign(ym) * Math.pow(Math.min(.98, Math.abs(ym) / Math.max(yr, 1e-8)), n * .5);
}
/** movement weight of the one-piece lower jaw along its length: 1 at the chin, 0 at the hinge (junction never separates) */
export const jawW = (bm, u, H) => 1 - H.sstep(.62, 1, H.clamp((u - jawU0(bm)) / Math.max(1e-6, jawU1(bm) - jawU0(bm)), 0, 1));
export const EDGE_N = 40;
export function edgeTable(bm, H) { const u0 = jawU0(bm), u1 = jawU1(bm), a = []; for (let i = 0; i < EDGE_N; i++) a.push(jawEdgeVert(bm, H.lerp(u0, u1, i / (EDGE_N - 1)))); return a; }
/** point on the lip edge of one flank (side ±1) at station u, optionally pulled `inset` under the skin. Returns {x,y,z,ly,lz,fr}. */
export function lipPoint(bm, u, side, H, inset = 0, out = {}) {
  const fr = bm._lf || (bm._lf = {}), s = bm._ls || (bm._ls = {}), p = bm._lp || (bm._lp = {}); bm.frame(u, fr); bm.section(u, s);
  const rim = Math.asin(jawEdgeVert(bm, u)), a = side > 0 ? rim : -Math.PI - rim; bm.point(u, a, p, fr, s, true);
  const l = Math.hypot(p.ly, p.lz) || 1, off = -inset / l;
  out.x = p.x + fr.nx * p.ly * off; out.y = p.y + fr.ny * p.ly * off; out.z = p.z + p.lz * off; out.ly = p.ly; out.lz = p.lz; out.tx = fr.tx; out.ty = fr.ty; out.nx = fr.nx; out.ny = fr.ny; return out;
}

/** Interior pocket (round 2): ONE closed bag rooted on the lip edge.
    rim loop = upper lip copy (static) + lower lip copy (moves with the jaw, weight jawW) joined at both corners at the hinge;
    hood (upper wall) and floor (lower wall) run from the rim to a throat cap; each flank gets a cheek wall between the upper and lower lip edge
    (inset a little, rotating by the same weight ramp), so no line of sight leaves the head sideways; the chin cap closes the lower jaw's front.
    Depth ≤ CAVITY_MAX × head length (as round 1). Rendered with the double-sided jaw material. */
export function buildCavity(bm, mats, H) {
  const { THREE } = H, g = bm.g, u0 = jawU0(bm), u1 = jawU1(bm), K = 34, S = 8, N = 5, hl = bm.h * bm.L, depth = Math.min(g.mouth.cavityDepth, CAVITY_MAX) * hl;
  const inset = bm.maxD * .004, us = []; for (let i = 0; i <= K; i++) us.push(H.lerp(u0, u1, Math.pow(i / K, 1.5)));
  const P = (u, side) => { const o = lipPoint(bm, u, side, H, inset, {}); return new THREE.Vector3(o.x, o.y, o.z); };
  const R = us.map(u => P(u, 1)), Lf = us.map(u => P(u, -1)), W = us.map(u => jawW(bm, u, H));
  /* rim loop: right hinge → front (upper copy), front → left hinge, then back along the lower copy */
  const rim = [];
  for (let i = K; i >= 0; i--) rim.push({ p: R[i], u: us[i], w: 0 });
  for (let i = 0; i <= K; i++) rim.push({ p: Lf[i], u: us[i], w: 0 });
  for (let i = K; i >= 0; i--) rim.push({ p: Lf[i], u: us[i], w: W[i] });
  for (let i = 0; i <= K; i++) rim.push({ p: R[i], u: us[i], w: W[i] });
  const Mr = rim.length, rimC = new THREE.Vector3(); rim.forEach(r => rimC.add(r.p)); rimC.multiplyScalar(1 / Mr);
  const fr = {}; bm.frame((u0 + u1) / 2, fr);
  const throat = rimC.clone().add(new THREE.Vector3(fr.tx * depth, fr.ty * depth, 0));
  { const ut = H.clamp((u0 + u1) / 2 + depth / bm.L, .004, .999), ft = {}, st = {}; bm.frame(ut, ft); bm.section(ut, st);
    const ly = H.clamp((throat.x - ft.px) * ft.nx + (throat.y - ft.py) * ft.ny, -st.dDn * .55, st.dUp * .55); throat.set(ft.px + ft.nx * ly, ft.py + ft.ny * ly, 0); }
  const pos = [], ab = [], idx = [];
  const push = (q, u, w) => { pos.push(q.x, q.y, q.z); ab.push(u, .5, 1, w); return pos.length / 3 - 1; };
  for (let i = 0; i <= N; i++) {
    const d = i / N, e = H.smoother(d), shrink = 1 - .25 * e;
    for (let j = 0; j < Mr; j++) {
      const r = rim[j], q = r.p.clone().lerp(throat, e).sub(throat).multiplyScalar(shrink).add(throat);
      if (i > 0) contain(bm, q, H, .9);
      push(q, r.u, r.w * Math.pow(1 - d, 1.4));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < Mr; j++) { const a = i * Mr + j, b = i * Mr + (j + 1) % Mr, c = a + Mr, d = b + Mr; idx.push(a, c, b, b, c, d); }
  const centre = push(throat, u1, 0); for (let j = 0; j < Mr; j++) idx.push(N * Mr + j, centre, N * Mr + (j + 1) % Mr);
  /* cheek walls: a surface from the upper lip edge down to the lower lip edge on each flank. Interior points sit at the REST lip position pulled medially
     (z → 85 % at mid-wall), then rotate by a weight ramp 0→jawW, so the wall is pinned to both lips at every jaw angle and never leaves the head. */
  for (const side of [1, -1]) {
    const base = pos.length / 3, arr = side > 0 ? R : Lf;
    for (let i = 0; i <= K; i++) for (let j = 0; j <= S; j++) {
      const f = j / S, q = arr[i].clone(); q.z *= 1 - .4 * H.sstep(0, .2, f) * H.sstep(1, .8, f) * H.sstep(0, .3, i / K + .02); push(q, us[i], W[i] * f);
    }
    for (let i = 0; i < K; i++) for (let j = 0; j < S; j++) { const a = base + i * (S + 1) + j, b = a + S + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  /* chin cap: closes the front of the lower jaw (its first ring is an open edge); a fan over the lower half-ring at u0, weight = jaw weight (1) */
  { const ring = [], u = us[0], s = {}, fr0 = {}, p = {}; bm.frame(u, fr0); bm.section(u, s); const rimA = Math.asin(jawEdgeVert(bm, u)), M = 12;
    for (let j = 0; j <= M; j++) { const a = H.lerp(-Math.PI - rimA, rimA, j / M); bm.point(u, a, p, fr0, s, true); const l = Math.hypot(p.ly, p.lz) || 1, o = -inset / l; ring.push(new THREE.Vector3(p.x + fr0.nx * p.ly * o, p.y + fr0.ny * p.ly * o, p.z + p.lz * o)); }
    const c = new THREE.Vector3(); ring.forEach(r => c.add(r)); c.multiplyScalar(1 / ring.length).add(new THREE.Vector3(fr0.tx * hl * .02, fr0.ty * hl * .02, 0));
    const b0 = pos.length / 3; ring.forEach(r => push(r, u, 1)); const cc = push(c, u, 1); for (let j = 0; j < M; j++) idx.push(b0 + j, cc, b0 + j + 1); }
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
