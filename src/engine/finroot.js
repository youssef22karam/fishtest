/* FIN ROOTS — every attached fin grows out of a FLESHY BASE (a low mound of body tissue). Pure JS (no THREE): used by the geometry builder, the audit and the node checks.
   Every rule is a function of the generator's axes only (body plan, swim mode, feeding niche, depth band, body size) through the fin's own geometry:
   the mound height scales with the free fin height, its width with the fin's own root flare, and its surface is the body's own skin field (the mound is rendered
   with the BODY material and the BODY (u, angle) coordinates, so colour, pattern and lighting are the flank's). Frame: x forward, y up, z out of the right side. */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

export const ROOT = {
  hK: .085,         /* mound crest height / free fin height */
  hMin: .0012,      /* ... but never below this fraction of body length */
  hCap: .5,         /* ... and never above this share of the local half depth */
  cR: .375,         /* fin root flare sits at this fraction of the mound half width */
  slope: 2.6,       /* mound half width >= slope x crest height (gentle flank, no step) */
  ext: .16,         /* the mound runs this far past each end of the fin base (fraction of the base) */
  fitK: [1, 1.5, 2.2, 3.2],   /* crest height multipliers tried by the clearance fit (side fins) */
  tol: .001,        /* penetration tolerance / body length (0.1 % L: loft chord sag + degenerate fin-tip triangles) */
};

/** minimal vector with the two methods the body model calls on an `out` argument */
export class Vec {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
}

/** Plan of one fin's mound from its spec (same spec object FinBuilder.add takes). k scales the crest height (clearance fit). */
export function planMound(sp, k = 1) {
  const bm = sp.bm, R = sp.R, r1 = new Vec(), r2 = new Vec(), b = new Vec(), e = new Vec(), st = [];
  let hmax = 1e-9, d0max = 0;
  for (let i = 0; i < R; i++) {
    const t = i / (R - 1); sp.root(t, 1, r1); const u1 = r1.u, th1 = r1.theta; sp.root(t, -1, r2);
    sp.base(t, b); sp.edge(t, e);
    const o = { t, u: (u1 + r2.u) / 2, th: (th1 + r2.theta) / 2, off: [th1 - (th1 + r2.theta) / 2, r2.theta - (th1 + r2.theta) / 2], hf: Math.hypot(e.x - b.x, e.y - b.y, e.z - b.z) };
    { const nv = new Vec(); bm.surfaceNormal(clamp(o.u, .003, .995), o.th, nv); o.n = [nv.x, nv.y, nv.z]; }
    hmax = Math.max(hmax, o.hf); d0max = Math.max(d0max, Math.abs(o.off[0])); st.push(o);
  }
  const mid = st[st.length >> 1], sec = {}; bm.section(mid.u, sec);
  const zl = sp.zLift || 0, zs = sp.zSide || 0;   /* side fins: the whole fin stands out laterally on its peduncle by zl (clearance fit), mound lifted along z */
  let H = clamp(ROOT.hK * k * hmax, ROOT.hMin * bm.L, Math.max(ROOT.hMin * bm.L, ROOT.hCap * Math.min(sec.dUp, sec.dDn)));
  if (sp.noLift) H = 0; H = Math.max(H, zl);
  let Dm = Math.max(d0max / ROOT.cR, .05);
  { const pa = {}, pb = {}; bm.surface(mid.u, mid.th, pa); bm.surface(mid.u, mid.th + Dm, pb); const phys = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z); if (phys > 1e-9 && phys < ROOT.slope * H) Dm = Math.min(1.1, Dm * ROOT.slope * H / phys); }
  for (const o of st) o.H = Math.max(H * (.3 + .7 * o.hf / hmax), zl);
  const wc = c => { const a = Math.abs(c); return a >= 1 ? 0 : Math.pow(Math.cos(Math.PI * a / 2), 2); };
  return { bm, st, H, Dm, wc, kind: sp.kind, zs, zl,
    /** crest lift at station i (centre line) and at root side s (0 = +, 1 = -) */
    crest: i => st[i].H, rootLift: (i, s) => st[i].H * wc(st[i].off[s] / Dm) };
}

/** Mound surface patch (positions + body coordinates + the lift normal at every vertex). nt x nc grid over the extended base. */
export function moundGeometry(plan, nt, nc) {
  const { bm, st, Dm, wc } = plan, n = st.length, E = ROOT.ext, ext = Math.max(1, Math.round(nt * E / (1 + 2 * E)));
  const at = tau => {    /* centre-line station at base parameter tau (linear extrapolation of u / theta past the ends) */
    const f = clamp(tau, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), q = f - i, A = st[i], B = st[i + 1];
    let u = lerp(A.u, B.u, q), th = lerp(A.th, B.th, q), H = lerp(A.H, B.H, q);
    if (tau < 0) { const d = tau * (n - 1); u += (st[1].u - st[0].u) * d; th += (st[1].th - st[0].th) * d; H = st[0].H; }
    if (tau > 1) { const d = (tau - 1) * (n - 1); u += (st[n - 1].u - st[n - 2].u) * d; th += (st[n - 1].th - st[n - 2].th) * d; H = st[n - 1].H; }
    return { u: clamp(u, .004, .995), th, H };
  };
  const NT = nt + 2 * ext, pos = [], ab = [], nrm = [], idx = [], p = {}, ln = new Vec();
  for (let j = 0; j <= NT; j++) {
    const x = j / NT, tau = lerp(-E, 1 + E, x), s = at(tau), wt = sstep(0, .38, x) * sstep(0, .38, 1 - x);
    for (let k = 0; k <= nc; k++) {
      const c = -1 + 2 * k / nc, th = s.th + c * Dm, h = s.H * wt * wc(c);
      bm.attachedSurface(s.u, th, p); bm.surfaceNormal(s.u, th, ln);
      if (plan.zs) pos.push(p.x, p.y, p.z + plan.zs * h); else pos.push(p.x + ln.x * h, p.y + ln.y * h, p.z + ln.z * h);
       nrm.push(ln.x, ln.y, ln.z, h / Math.max(1e-9, plan.H));
      ab.push(s.u, ((th + Math.PI / 2) / TAU + 1) % 1, 0, 0);
    }
  }
  for (let j = 0; j < NT; j++) for (let k = 0; k < nc; k++) { const a = j * (nc + 1) + k, b = a + nc + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  /* orientation: faces must look along the lift normal */
  let dot = 0; for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; dot += (uy * vz - uz * vy) * nrm[idx[t] * 4] + (uz * vx - ux * vz) * nrm[idx[t] * 4 + 1] + (ux * vy - uy * vx) * nrm[idx[t] * 4 + 2]; }
  if (dot < 0) for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }
  return { pos, ab, nrm, idx };
}

/* ───────── motion model of the side fin (mirrors VS_FIN) and the body-volume test ───────── */
export const MOTION = { sweep: [-25, 5, 35], abd: [5, 20, 55] };   /* degrees: hard clamps of finmotion.PEC_LIM at both ends + mid */
const D2R = Math.PI / 180;
function rotA(v, a, g) { const c = Math.cos(g), s = Math.sin(g), d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2], k = d * (1 - c);
  return [v[0] * c + (a[1] * v[2] - a[2] * v[1]) * s + a[0] * k, v[1] * c + (a[2] * v[0] - a[0] * v[2]) * s + a[1] * k, v[2] * c + (a[0] * v[1] - a[1] * v[0]) * s + a[2] * k]; }
/** One side-fin vertex after the joint rotation. P = model-space position, H = [hx,hy,hz,sg] (aHinge), A = [ax,ay,az] (aAxis), lenT = aFin.y */
export function pecMove(P, H, A, lenT, sweepDeg, abdDeg, restDeg, out = [0, 0, 0], dz = 0) {
  const sg = H[3], w = sstep(0, .4, lenT);
  let rr = [P[0] - H[0], P[1] - H[1], P[2] * sg + dz - H[2]];
  rr = rotA(rr, A, (abdDeg - restDeg) * D2R * w); rr = rotA(rr, [0, 0, 1], sweepDeg * D2R * w);
  out[0] = H[0] + rr[0]; out[1] = H[1] + rr[1]; out[2] = (H[2] + rr[2]) * sg; return out;
}
/** Depth (>0 = inside) of a model-space point below the body wall; 0 when outside. Analytic body model (same law as the loft). */
export function depthInBody(bm, x, y, z, ctx) {
  const L = bm.L, fr = ctx.fr, s = ctx.s;
  let u = clamp((bm.headX - x) / L, .003, 1 + bm.capU * .99);
  for (let it = 0; it < 3; it++) { bm.frame(u, fr); const d = (x - fr.px) * fr.tx + (y - fr.py) * fr.ty; u = clamp(u + d / L, .003, 1 + bm.capU * .99); }
  bm.frame(u, fr); bm.section(u, s);
  const ly = (x - fr.px) * fr.nx + (y - fr.py) * fr.ny, lz = Math.abs(z);
  if (ly >= s.dUp || ly <= -s.dDn || lz >= s.w) return 0;
  const up = ly > 0, yR = up ? s.dUp : s.dDn, nn = up ? s.nD : s.nV;
  let yb = yR * Math.pow(Math.max(0, 1 - Math.pow(lz / s.w, s.n)), 1 / nn);
  if (bm.law.flat) yb *= 1 - (bm.disc ? .90 : .78) * sstep(.08, .96, lz / Math.max(s.w, 1e-8));   /* flattened plans: the wall is squashed toward the margin (same law as BodyModel.point) */
  const vd = yb - Math.abs(ly); if (vd <= 0) return 0;
  const ld = bm.halfWidthAtY(s, clamp(ly, -s.dDn * .99, s.dUp * .99)) - lz;
  return Math.max(0, Math.min(vd, ld));
}
/** Worst penetration (length) of a hinged fin's vertices over the full sweep x abduction range. d = { pos, fin, hinge, axis } flat arrays (FinBuilder layout), vertex range [v0, v1). */
export function pecWorst(bm, d, v0, v1, restDeg, grid = MOTION) {
  const ctx = { fr: {}, s: {} }, P = [0, 0, 0], H = [0, 0, 0, 0], A = [0, 0, 0], o = [0, 0, 0]; let worst = 0, count = 0;
  for (let v = v0; v < v1; v++) {
    if (d.hinge[v * 4 + 3] === 0) continue;
    P[0] = d.pos[v * 3]; P[1] = d.pos[v * 3 + 1]; P[2] = d.pos[v * 3 + 2]; for (let q = 0; q < 4; q++) H[q] = d.hinge[v * 4 + q]; for (let q = 0; q < 3; q++) A[q] = d.axis[v * 3 + q];
    const lenT = d.fin[v * 4 + 1]; let vw = 0;
    for (const sw of grid.sweep) for (const ab of grid.abd) { pecMove(P, H, A, lenT, sw, ab, restDeg, o); vw = Math.max(vw, depthInBody(bm, o[0], o[1], o[2], ctx)); }
    if (vw > ROOT.tol * bm.L) count++; worst = Math.max(worst, vw);
  }
  return { worst, count };
}

/* ───────── hooks used by FinBuilder (parts/fishgen.part10.js) ───────── */
/** lift the fin's centre line (v: any {x,y,z}) at station i onto the mound crest */
export function liftCentre(plan, i, v) { const o = plan.st[i], h = o.H; if (plan.zs) { v.z += plan.zs * h; return v; } v.x += o.n[0] * h; v.y += o.n[1] * h; v.z += o.n[2] * h; return v; }
/** lift a root point (already on the wall, with its station param root.u / root.theta) onto the mound; returns the lift length */
export function liftRoot(plan, i, side, v) {
  const h = plan.rootLift(i, side > 0 ? 0 : 1), nv = new Vec(); if (plan.zs) { v.z += plan.zs * h; return h; } plan.bm.surfaceNormal(clamp(v.u, .003, .995), v.theta, nv);
  v.x += nv.x * h; v.y += nv.y * h; v.z += nv.z * h; return h;
}
/** all mounds of one fish as one BufferGeometry: positions on the wall + lift, body coordinates (u, angle, tag 0), normals eased to the loft normal over the border */
export function buildMoundGeo(THREE, plans, nt, nc) {
  const pos = [], ab = [], nr = [], idx = [], hf = [];
  for (const pl of plans) { const g = moundGeometry(pl, nt, nc), o = pos.length / 3; pos.push(...g.pos); ab.push(...g.ab); for (let i = 0; i < g.nrm.length; i += 4) { nr.push(g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]); hf.push(g.nrm[i + 3]); } for (const k of g.idx) idx.push(k + o); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aBody', new THREE.Float32BufferAttribute(ab, 4)); geo.setIndex(idx); geo.computeVertexNormals();
  const n = geo.getAttribute('normal'), v = new Vec();
  for (let i = 0; i < n.count; i++) { const w = sstep(0, .3, hf[i]); v.set(nr[i * 3] * (1 - w) + n.getX(i) * w, nr[i * 3 + 1] * (1 - w) + n.getY(i) * w, nr[i * 3 + 2] * (1 - w) + n.getZ(i) * w).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return geo;
}

/** Largest inward z shift the fin shader can add to a vertex (mirrors VS_FIN: p.z += rip * mobile). kind 1/2 (dorsal / anal) have a stronger flutter law in two swim modes. */
export function rippleAmp(kind, flex, lenT, L) {
  const mob = sstep(.12, .8, lenT), a = flex * mob * mob * mob * .008;
  return L * ((kind === 1 || kind === 2) ? Math.max(a, .03 * lenT * lenT * mob) : a);
}
/** Lateral gap a model-space point still has to be moved out (+z side) to leave the body: 0 when outside. */
export function needZ(bm, x, y, z, ctx) {
  const L = bm.L, fr = ctx.fr, s = ctx.s;
  let u = clamp((bm.headX - x) / L, .003, 1 + bm.capU * .99);
  for (let it = 0; it < 3; it++) { bm.frame(u, fr); const d = (x - fr.px) * fr.tx + (y - fr.py) * fr.ty; u = clamp(u + d / L, .003, 1 + bm.capU * .99); }
  bm.frame(u, fr); bm.section(u, s);
  const ly = (x - fr.px) * fr.nx + (y - fr.py) * fr.ny, lz = Math.abs(z);
  if (ly >= s.dUp * .995 || ly <= -s.dDn * .995 || lz >= s.w) return 0;
  return Math.max(0, bm.halfWidthAtY(s, clamp(ly, -s.dDn * .99, s.dUp * .99)) - lz);
}
/** Extra lateral lift a hinged fin still needs: max over vertices x full motion grid x worst-case ripple of the lateral gap (length). */
export function pecNeed(bm, d, v0, v1, restDeg, grid = MOTION) {
  const ctx = { fr: {}, s: {} }, P = [0, 0, 0], H = [0, 0, 0, 0], A = [0, 0, 0], o = [0, 0, 0]; let need = 0;
  for (let v = v0; v < v1; v++) {
    if (d.hinge[v * 4 + 3] === 0) continue;
    P[0] = d.pos[v * 3]; P[1] = d.pos[v * 3 + 1]; P[2] = d.pos[v * 3 + 2]; for (let q = 0; q < 4; q++) H[q] = d.hinge[v * 4 + q]; for (let q = 0; q < 3; q++) A[q] = d.axis[v * 3 + q];
    const lenT = d.fin[v * 4 + 1], dz = -rippleAmp(3, d.fin[v * 4 + 2], lenT, bm.L);
    for (const sw of grid.sweep) for (const ab of grid.abd) { pecMove(P, H, A, lenT, sw, ab, restDeg, o, dz); need = Math.max(need, needZ(bm, o[0], o[1], o[2], ctx)); }
  }
  return need;
}

/** Ripple guard: per-vertex suppression sigma (0 = full flutter, 1 = none) written to aSkin.w so the shader's z ripple can never push a vertex into the body (non-hinged fins). */
export function rippleGuard(bm, pos, fin, skin, v0, v1) {
  const ctx = { fr: {}, s: {} }, tol = ROOT.tol * bm.L;
  for (let v = v0; v < v1; v++) {
    const amp = rippleAmp(fin[v * 4 + 3], fin[v * 4 + 2], fin[v * 4 + 1], bm.L); if (amp <= tol * .5) continue;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], dirs = Math.abs(z) < amp ? [-1, 1] : [z > 0 ? -1 : 1]; let f = 1;
    for (let it = 0; it < 6; it++) { let d = 0; for (const dr of dirs) d = Math.max(d, depthInBody(bm, x, y, z + dr * amp * f, ctx)); if (d <= tol * .5) break; f = it === 5 ? 0 : f * .5; }
    skin[v * 4 + 3] = 1 - f;
  }
}
