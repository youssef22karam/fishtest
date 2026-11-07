/* ROUND 2 geometric checks (mouth interior, teeth, eyes) — used by the analytic gate (validate.js → reject & resample) and the mesh audit.
   round2Check(bm, ctx) → string[] of violations. Builds the pocket / jaw / teeth from the BodyModel only (no GL), so it is cheap enough for the gate.
   SEE-THROUGH TEST: the pocket + lower-jaw patch are posed at the law's maximum jaw angle exactly like the vertex shader does (rotation about the hinge by angle × weight);
   rays are then cast from a point inside the pocket in every direction that does not point out of the aperture (forward). Every such ray MUST hit pocket / jaw geometry
   (double-sided): a ray that escapes is a line of sight through the head, i.e. a see-through mouth. */
export function round2Check(bm, ctx, rays = false) {
  const { THREE, H, MOUTH, buildJawGeometry, buildTeeth, LAW } = ctx, errs = [], M = bm.law.mouth, hl = bm.h * bm.L;
  if (LAW.EYE_PROTRUSION > LAW.EYE_PROTRUSION_MAX) errs.push('eye protrudes more than 1/6 of its diameter');
  if (M.construction !== 'jawed' || bm.oralDisc || bm.ventralMouth) return errs;
  const jaw = buildJawGeometry(bm), pocket = MOUTH.buildCavity(bm, { jaw: null }, H)[0].geometry, ang = M.openRad, piv = jaw.pivot;
  const pose = geo => { const P = geo.getAttribute('position'), A = geo.getAttribute('aBody'), out = []; for (let i = 0; i < P.count; i++) { const w = A.getW(i), a = -ang * w, c = Math.cos(a), s = Math.sin(a), dx = P.getX(i) - piv.x, dy = P.getY(i) - piv.y; out.push(piv.x + c * dx - s * dy, piv.y + s * dx + c * dy, P.getZ(i)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.setIndex(geo.getIndex()); return g; };
  if (rays) {   /* raycast see-through test (opt-in: FG.round2Check(bm, true)); see docs/round2-report.md for its current limits */
  const meshes = [pose(pocket), pose(jaw.geo)].map(g => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const pp = meshes[0].geometry.getAttribute('position'), C = new THREE.Vector3(); let n = 0;
  for (let i = 0; i < pp.count; i++) { C.x += pp.getX(i); C.y += pp.getY(i); C.z += pp.getZ(i); n++; } C.multiplyScalar(1 / n);
  const fr = {}; bm.frame(bm.mcU * .5, fr); const fwd = new THREE.Vector3(-fr.tx, -fr.ty, 0).normalize(), ray = new THREE.Raycaster(), d = new THREE.Vector3(); let escaped = 0, tested = 0; const esc = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) {
    const th = (i + .5) / 5 * Math.PI, ph = j / 8 * Math.PI * 2; d.set(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)).normalize();
    if (Math.abs(d.dot(fwd)) > .6) continue;                        /* forward = the aperture itself (allowed); near-axial backward rays end in the throat-cap apex (closed by construction) — test sideways / up / down */
    tested++; ray.set(C, d); ray.far = 1e9; if (!ray.intersectObjects(meshes, false).length) { escaped++; if (globalThis.__R2DEBUG) esc.push([d.x, d.y, d.z].map(v => +v.toFixed(2)).join(',')); }
  }
  if (escaped) errs.push(`see-through mouth: ${escaped}/${tested} rays leave the open mouth through the head` + (esc.length ? ' fwd=' + [fwd.x, fwd.y].map(v => +v.toFixed(2)) + ' C=' + [C.x, C.y, C.z].map(v => +v.toFixed(3)) + ' ' + esc.join(' | ') : ''));
  meshes.forEach(m => m.geometry.dispose());
  }
  /* teeth: rooted, continuous, inside the jaw, length band */
  if (M.teethClass !== 'absent' && bm.g.mouth.teeth !== 'none' && bm.g.mouth.teethCount > 0) {
    const t = buildTeeth(bm, { tooth: null }), info = t && t.userData.teethInfo;
    if (info) {
      for (const k of info) {
        if (k.len > .14 * hl + 1e-9 || k.len < .011 * hl) { errs.push('tooth length outside 0.02–0.14 × head length band'); break; }
        if (k.root.distanceTo(k.lip) > 2.4 * k.len + 8 * k.rad) { errs.push('detached / floating tooth'); break; }
      }
      const fr2 = {}, s2 = {}, inside = (p, slack) => { const u = H.clamp((bm.headX - p.x) / bm.L, .003, .999); bm.frame(u, fr2); bm.section(u, s2); const ly = (p.x - fr2.px) * fr2.nx + (p.y - fr2.py) * fr2.ny; return ly > -s2.dDn * slack && ly < s2.dUp * slack && Math.abs(p.z) <= bm.halfWidthAtY(s2, H.clamp(ly, -s2.dDn * .99, s2.dUp * .99)) * slack + 1e-6; };
      for (const k of info) if (!inside(k.root, 1.04)) { errs.push('teeth outside the jaw'); break; }
      for (const k of info) if (k.spacing > 1.5 * 2 * k.rad + 1e-9) { errs.push('tooth spacing above 1.5 × base width'); break; }
      t.geometry.dispose();
    }
  }
  return errs;
}
