/* EYE ORGAN — one real 3D eyeball per eye, identical from every viewpoint (no billboard, decal, sprite or view-dependent trick).
   A sphere of radius R is SEATED in the head (centre EYE_SEAT radii below the skin, so the dome protrudes ≤ 1/3 diameter) and carries its anatomy in geometry:
     · sclera shell  — the sphere with the corneal cap removed (limbus at polar angle LIMBUS)
     · limbal funnel — short collar from the limbus down to the recessed iris plane (the iris sits UNDER the cornea)
     · iris disc     — annulus recessed behind the limbus plane, inner boundary = pupil outline (round / vertical slit / horizontal)
     · pupil cup     — dark concave lens seen through the pupil opening (part of the eyeball itself)
     · cornea dome   — transparent cap, lit only by scene lighting
     · covers (clean on/off by plan/niche): clear adipose window over the front and rear edges; nictitating lower lid over the lower third.
   Vertex attribute aEye = (a, b, kind): kind 0 sclera · 1 iris (a = radial 0..1, b = angle) · 2 pupil · 3 cornea · 4 adipose · 5 limbal funnel · 6 nictitating lid.
   Everything is built in the head's own coordinates, so the eye moves with the head and mirrors exactly between sides. */
import { EYE_SEAT } from './laws.js';

export const LIMBUS = .78;            /* polar angle (rad) of the corneal rim measured from the optical axis */
export const IRIS_RECESS = .12;       /* iris plane depth behind the limbus plane, in eyeball radii */

/** pupil half-extents (fraction of the iris radius) along the head-forward (tu) and head-up (tv) directions */
export function pupilExtents(pupil) {
  return pupil === 'vertical' ? [.17, .62] : pupil === 'horizontal' ? [.64, .18] : [.38, .38];
}
const pupilRadius = (ext, phi) => { const a = ext[0], b = ext[1], c = Math.cos(phi), s = Math.sin(phi); return 1 / Math.sqrt((c / a) * (c / a) + (s / b) * (s / b)); };

/** orthonormal eye frame: a = optical axis (outward), tu = head-forward tangent, tv = head-up tangent */
export function eyeFrame(THREE, axis, forward, up) {
  const a = axis.clone().normalize(), tu = forward.clone().addScaledVector(a, -forward.dot(a));
  if (tu.lengthSq() < 1e-8) tu.set(1, 0, 0).addScaledVector(a, -a.x); tu.normalize();
  const tv = new THREE.Vector3().crossVectors(a, tu).normalize(); if (tv.dot(up) < 0) tv.negate();
  return { a, tu, tv };
}

function makePart(THREE, rows, cols, wrap, fn, kind) {
  const pos = [], nor = [], eye = [], idx = [], nc = wrap ? cols : cols + 1;
  for (let i = 0; i <= rows; i++) for (let j = 0; j < nc; j++) { const r = fn(i / rows, wrap ? j / cols : j / cols); pos.push(r.p[0], r.p[1], r.p[2]); if (r.n) nor.push(r.n[0], r.n[1], r.n[2]); eye.push(r.e[0], r.e[1], kind === undefined ? r.e[2] : kind); }
  for (let i = 0; i < rows; i++) for (let j = 0; j < (wrap ? cols : cols); j++) { const a = i * nc + j, b = i * nc + (j + 1) % nc, c = (i + 1) * nc + j, d = (i + 1) * nc + (j + 1) % nc; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aEye', new THREE.Float32BufferAttribute(eye, 3)); geo.setIndex(idx);
  if (nor.length === pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else geo.computeVertexNormals();
  return geo;
}
/** make triangle winding agree with the intended outward direction fn(position) */
function orient(THREE, geo, fn) {
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal'), v = new THREE.Vector3(); let s = 0;
  for (let i = 0; i < P.count; i++) { const o = fn(v.set(P.getX(i), P.getY(i), P.getZ(i))); s += N.getX(i) * o.x + N.getY(i) * o.y + N.getZ(i) * o.z; }
  if (s < 0) { const I = geo.getIndex(); for (let i = 0; i < I.count; i += 3) { const t = I.getX(i + 1); I.setX(i + 1, I.getX(i + 2)); I.setX(i + 2, t); } for (let i = 0; i < N.count; i++) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); }
  return geo;
}
function merge(THREE, list) {
  const pos = [], nor = [], eye = [], idx = []; let off = 0;
  for (const g of list) { const P = g.getAttribute('position'), N = g.getAttribute('normal'), E = g.getAttribute('aEye'), I = g.getIndex();
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); eye.push(E.getX(i), E.getY(i), E.getZ(i)); }
    for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off); off += P.count; g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('aEye', new THREE.Float32BufferAttribute(eye, 3)); geo.setIndex(idx); return geo;
}

/** spherical patch around polar axis P (cap region alpha ∈ [a0,a1] from P, azimuth β ∈ ±bHalf about the outward axis) at radius Rl */
function capPatch(THREE, c, Rl, P, A, Q, a0, a1, bHalf, kind, seg) {
  const nA = Math.max(3, Math.round(seg * .25)), nB = Math.max(6, Math.round(seg * .9));
  const g = makePart(THREE, nA, nB, false, (f, h) => {
    const al = a0 + (a1 - a0) * f, be = (h * 2 - 1) * bHalf, d = P.clone().multiplyScalar(Math.cos(al)).addScaledVector(A, Math.sin(al) * Math.cos(be)).addScaledVector(Q, Math.sin(al) * Math.sin(be));
    return { p: [c.x + d.x * Rl, c.y + d.y * Rl, c.z + d.z * Rl], n: [d.x, d.y, d.z], e: [al, be, kind] };
  });
  return orient(THREE, g, v => v.clone().sub(c));
}

/**
 * Build the organ for one eye.
 * spec = { center, axis, R, forward, up }; E = eye law ({pupil, covers}); seg = sphere segment count.
 * Returns { opaque: [geo…], glass: [geo…], info } (all in head coordinates).
 */
export function buildOrgan(THREE, spec, E, seg) {
  const { center: c, R } = spec, F = eyeFrame(THREE, spec.axis, spec.forward, spec.up), { a, tu, tv } = F, TAU = Math.PI * 2;
  const nP = seg <= 8 ? 8 : Math.max(12, Math.min(40, Math.round(seg * 1.6))), at = (z, r, phi) => [c.x + a.x * z + (tu.x * Math.cos(phi) + tv.x * Math.sin(phi)) * r, c.y + a.y * z + (tu.y * Math.cos(phi) + tv.y * Math.sin(phi)) * r, c.z + a.z * z + (tu.z * Math.cos(phi) + tv.z * Math.sin(phi)) * r];
  const dir = (th, phi) => { const s = Math.sin(th); return [a.x * Math.cos(th) + (tu.x * Math.cos(phi) + tv.x * Math.sin(phi)) * s, a.y * Math.cos(th) + (tu.y * Math.cos(phi) + tv.y * Math.sin(phi)) * s, a.z * Math.cos(th) + (tu.z * Math.cos(phi) + tv.z * Math.sin(phi)) * s]; };
  const opaque = [], glass = [], zLimb = R * Math.cos(LIMBUS), rLimb = R * Math.sin(LIMBUS), zIris = zLimb - IRIS_RECESS * R, zPup = zIris - .05 * R, ext = pupilExtents(E.pupil);
  /* sclera: the sphere minus the corneal cap */
  opaque.push(orient(THREE, makePart(THREE, Math.max(5, Math.round(nP * .5)), nP, true, (f, h) => { const th = LIMBUS + (Math.PI - LIMBUS) * f, phi = h * TAU, d = dir(th, phi); return { p: [c.x + d[0] * R, c.y + d[1] * R, c.z + d[2] * R], n: d, e: [th, phi, 0] }; }), v => v.clone().sub(c)));
  /* limbal funnel: collar from the limbus rim down to the recessed iris plane */
  opaque.push(orient(THREE, makePart(THREE, 2, nP, true, (f, h) => { const phi = h * TAU, z = lerp(zLimb, zIris, f), r = lerp(rLimb, rLimb * .985, f); return { p: at(z, r, phi), e: [0, phi, 5] }; }),
    v => { const d = v.clone().sub(c); d.addScaledVector(a, -d.dot(a)); return d.negate(); }));
  /* iris: annulus between the pupil outline and the limbal radius, on the recessed plane with a shallow conical dish toward the pupil */
  opaque.push(orient(THREE, makePart(THREE, nP <= 8 ? 2 : 6, nP, true, (f, h) => { const phi = h * TAU, ri = rLimb * .985, rp = rLimb * pupilRadius(ext, phi) * .985, r = lerp(rp, ri, f), z = lerp(zPup, zIris, Math.pow(f, .6)); return { p: at(z, r, phi), e: [f, phi, 1] }; }), v => a.clone()));
  /* pupil: concave dark lens cup behind the pupil opening */
  opaque.push(orient(THREE, makePart(THREE, nP <= 8 ? 2 : 4, nP, true, (f, h) => { const phi = h * TAU, rp = rLimb * pupilRadius(ext, phi) * .985, r = rp * (1 - f), z = zPup - .11 * R * Math.sin(f * Math.PI * .5); return { p: at(z, Math.max(r, 1e-6), phi), e: [f, phi, 2] }; }), v => a.clone()));
  /* cornea: transparent dome continuing the sphere, a touch proud of it */
  glass.push(orient(THREE, makePart(THREE, Math.max(4, Math.round(nP * .3)), nP, true, (f, h) => { const th = (LIMBUS + .02) * f, phi = h * TAU, d = dir(th, phi), Rc = R * (1.012 + .012 * Math.cos(th * 1.9)); return { p: [c.x + d[0] * Rc, c.y + d[1] * Rc, c.z + d[2] * Rc], n: d, e: [th, phi, 3] }; }), v => v.clone().sub(c)));
  /* covers */
  const Rl = R * 1.045, Q = new THREE.Vector3();
  if (E.covers && E.covers.adipose) for (const sgn of [1, -1]) { const P = tu.clone().multiplyScalar(sgn); Q.crossVectors(P, a).normalize(); glass.push(capPatch(THREE, c, Rl, P, a, Q.clone(), 0, Math.PI / 2 - LIMBUS - .1, 1.5, 4, seg)); }
  if (E.covers && E.covers.nictitating) { const P = tv.clone().negate(); Q.crossVectors(P, a).normalize(); glass.push(capPatch(THREE, c, Rl, P, a, Q.clone(), 0, Math.acos(.33), 1.55, 6, seg)); }
  return { opaque, glass, merge: l => merge(THREE, l), info: { center: c.clone(), axis: a.clone(), R, protrusion: (R - R * EYE_SEAT) / (2 * R), pupil: E.pupil, irisRecess: IRIS_RECESS, limbus: LIMBUS, covers: Object.assign({}, E.covers) } };
}
function lerp(a, b, t) { return a + (b - a) * t; }

/** skin-covered vestigial orbit: a seated body-coloured dome (still exactly two) */
export function buildVestigial(THREE, spec, seg) {
  const g = new THREE.SphereGeometry(spec.R, seg, Math.max(5, Math.round(seg * .65))); g.translate(spec.center.x, spec.center.y, spec.center.z); return g;
}

export function mergeParts(THREE, list) { return merge(THREE, list); }
