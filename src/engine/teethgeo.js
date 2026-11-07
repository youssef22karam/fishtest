/* TEETH (round 2) — continuous, ROOTED rows along both lip edges, built on the SAME lip line as the jaw patch / pocket rim (mouthgeo.lipPoint).
   · every tooth base is buried ≥ 1/3 of its length INSIDE the jaw edge (above the upper lip line / below the lower one) and tucked just inside the lip, so with
     the mouth closed the rows are hidden inside the seam, and teeth are never silhouetted outside the head;
   · rows are continuous: spacing between neighbours = 1.3 × base width (law ≤ 1.5), graded smoothly (largest at the front/middle of the jaw, smaller toward the corners);
   · length 0.02–0.10 × head length by tooth class (0.14 hard max, only for the widest-gape niche in the dark band); height ±20 %, tilt ±6° by position;
   · round-to-slightly-flattened cones (never cards, never zero-thickness pins); a second, shorter inner row only for the widest-gape niche;
   · one InstancedMesh; the lower row carries the lower jaw's movement weight (aJaw), identical to the lip it grows from.
   Fused plates (beak), sucker discs and tubes get no jaw teeth (the caller does not build them). */
import { jawU0, jawU1, jawW, lipPoint } from './mouthgeo.js';

export const TOOTH_LEN = { villiform: .02, rasp: .02, molar: .026, triangular: .06, needle: .07, fang: .10 };   /* × head length */
export const TOOTH_LEN_MAX = .14, TOOTH_SPACING_MAX = 1.5;
const hash = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

/** lip arc of the upper jaw (static): right corner → chin → left corner, as dense points with frame data; teeth ride on it for both jaws */
export function lipArc(bm, H, NS = 80) {
  const u0 = jawU0(bm), uc = Math.min(bm.mcU * .97, jawU1(bm)), pts = [], o = {};
  for (const side of [1, -1]) for (let i = 0; i <= NS; i++) {
    const k = side > 0 ? NS - i : i, u = H.lerp(u0, uc, Math.pow(k / NS, 1.4)); lipPoint(bm, u, side, H, 0, o);
    pts.push({ x: o.x, y: o.y, z: o.z, ly: o.ly, lz: o.lz, tx: o.tx, ty: o.ty, nx: o.nx, ny: o.ny, u });
  }
  let s = 0; pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z); pts[i].s = s; }
  return { pts, total: s };
}
function at(arc, s) {
  const p = arc.pts; let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s <= s) lo = m; else hi = m; }
  const a = p[lo], b = p[hi], f = (s - a.s) / Math.max(1e-12, b.s - a.s), L = k => a[k] + (b[k] - a[k]) * f;
  return { x: L('x'), y: L('y'), z: L('z'), tx: L('tx'), ty: L('ty'), nx: L('nx'), ny: L('ny'), u: L('u') };
}

/** returns { mesh (InstancedMesh), info } or null */
export function buildTeethRows(bm, mats, H, form) {
  const { THREE } = H, M = bm.law.mouth; if (!form || form === 'none' || form === 'beak') return null;
  const hl = bm.h * bm.L, widest = !!M.widest, arc = lipArc(bm, H);
  let base = (TOOTH_LEN[form] || .03) * hl; if (form === 'fang' && widest) base = Math.min(TOOTH_LEN_MAX, .14) * hl; if (base < .02 * hl) base = .02 * hl;
  const slender = form === 'needle' || form === 'fang', blunt = form === 'molar';
  const radK = blunt ? .85 : form === 'triangular' ? .42 : slender ? .17 : .3, flat = form === 'triangular' ? .5 : blunt ? .9 : .82;
  const rowsN = widest && (form === 'needle' || form === 'fang' || form === 'triangular') ? 2 : 1;
  const cone = new THREE.ConeGeometry(1, 1, form === 'triangular' ? 4 : 6, 1); cone.translate(0, .5, 0);
  const list = [], seed = (M.openDeg || 1) * .37 + bm.L;
  const up = new THREE.Vector3(0, 1, 0), D = new THREE.Vector3(), B = new THREE.Vector3(), Pm = new THREE.Vector3(), Md = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Mx = new THREE.Matrix4();
  let idx = 0;
  for (let row = 0; row < rowsN; row++) for (const lower of [false, true]) {
    let pos = arc.total * (.012 + .5 * (row ? .5 : 0) * 0) + (row ? .5 : 0) * base * .1;
    const end = arc.total * .988; let n = 0;
    while (pos < end && n < 200) {
      const sN = pos / arc.total, grade = .38 + .62 * Math.pow(Math.sin(Math.PI * H.clamp(sN, 0, 1)), .8), jit = 1 + (hash(idx, seed) - .5) * .4;   /* ±20 % */
      const P = at(arc, pos), sc = bm._ts || (bm._ts = {}); bm.section(P.u, sc);
      let len = Math.min(TOOTH_LEN_MAX * hl, base * grade * jit * (row ? .62 : 1), .26 * (sc.dUp + sc.dDn));   /* never longer than the local jaw depth allows */
      if (len < .012 * hl) { pos += .02 * hl; continue; }
      const rad = Math.max(len * radK, .0012 * bm.L);
      /* medial (inward) direction: toward the head axis a little behind the root, in the root's own height */
      const back = hl * .1; Md.set(P.x + P.tx * back - P.x, P.y + P.ty * back - P.y, -P.z).normalize();
      const sgn = lower ? -1 : 1, front = 1 - H.sstep(0, .14, (P.u - jawU0(bm)) / Math.max(1e-6, Math.min(bm.mcU * .97, jawU1(bm)) - jawU0(bm))), inset = rad * 1.25 + (row ? len * .5 + rad : 0) + (len * .55 + rad * 2) * front;   /* near the snout tip the skin falls away behind the lip: bury deeper */
      D.set(-P.nx * sgn, -P.ny * sgn, 0).addScaledVector(Md, .08).add(new THREE.Vector3(P.tx * .06 + (hash(idx + 7, seed) - .5) * .21, 0, (hash(idx + 13, seed) - .5) * .21)).normalize();   /* tilt ±6° */
      B.set(P.x + Md.x * inset + P.nx * sgn * len / 3, P.y + Md.y * inset + P.ny * sgn * len / 3, P.z + Md.z * inset);   /* base centre buried len/3 inside the jaw edge */
      Q.setFromUnitVectors(up, D); S.set(rad, len, rad * flat); Mx.compose(B, Q, S);
      list.push({ m: Mx.clone(), w: lower ? jawW(bm, P.u, H) : 0, lower, u: P.u, len, rad, root: B.clone(), lip: Pm.set(P.x, P.y, P.z).clone(), row });
      pos += 2 * rad * 1.3 + (row ? rad * .6 : 0); n++; idx++;
    }
  }
  const inst = new THREE.InstancedMesh(cone, mats.tooth, list.length), aJaw = new Float32Array(list.length);
  list.forEach((t, i) => { inst.setMatrixAt(i, t.m); aJaw[i] = t.w; });
  cone.setAttribute('aJaw', new THREE.InstancedBufferAttribute(aJaw, 1)); inst.frustumCulled = false; inst.instanceMatrix.needsUpdate = true;
  inst.userData.teethInfo = list.map(t => ({ u: t.u, len: t.len, rad: t.rad, lower: t.lower, row: t.row, root: t.root, lip: t.lip, spacing: 2.6 * t.rad })); inst.userData.hl = hl;
  return inst;
}
