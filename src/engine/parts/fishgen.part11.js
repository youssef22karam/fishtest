    } else addRidgeFin(fb, bm, { u0: lm.dorsalOrigin, u1: lm.dorsalEnd, height: f.dorsal.height * maxD, sweep: f.dorsal.sweep, shape: f.dorsal.shape, side: 1, rays: rc(f.dorsal.spines + f.dorsal.rays), spineFrac: sf(f.dorsal), opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', kindId: 1, K: q.K });
    if (f.dorsal.count >= 2) addRidgeFin(fb, bm, { u0: lm.dorsal2Origin, u1: lm.dorsal2End, height: f.dorsal2.height * maxD, sweep: f.dorsal.sweep, shape: f.dorsal2.shape, side: 1, rays: rc(f.dorsal2.spines + f.dorsal2.rays), spineFrac: sf(f.dorsal2), opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', cfg: 'dorsal2', kindId: 1, K: q.K });
    if (f.dorsal.count === 3) addRidgeFin(fb, bm, { u0: lm.dorsal3Origin, u1: lm.dorsal3End, height: f.dorsal3.height * maxD, sweep: .2, shape: f.dorsal3.shape, side: 1, rays: rc(f.dorsal3.rays), spineFrac: 0, opacity: f.dorsal.opacity, flex: f.dorsal.flex, kind: 'dorsal', cfg: 'dorsal3', kindId: 1, K: q.K });
  }
  if (f.anal.present) addRidgeFin(fb, bm, { u0: lm.analOrigin, u1: lm.analEnd, height: f.anal.height * maxD, sweep: f.anal.sweep, shape: f.anal.shape, side: -1, rays: rc(f.anal.spines + f.anal.rays), spineFrac: sf(f.anal), opacity: f.anal.opacity, flex: f.anal.flex, kind: 'anal', kindId: 2, K: q.K });
  if (f.pectoral.present && bm.disc) DISC.registerFused(bm);   /* round 6A: the wing is the body; no translucent margin fin */
  else if (f.pectoral.present) { /* flattened plan: the same constructor builds the ray-supported disc margin */
    addPectoral(fb, bm, 1, q.K, rc(f.pectoral.rays)); addPectoral(fb, bm, -1, q.K, rc(f.pectoral.rays));
  }
  if (f.pelvic.present) { addPelvic(fb, bm, 1, q.K, rc(f.pelvic.rays)); addPelvic(fb, bm, -1, q.K, rc(f.pelvic.rays)); }
  if (f.adipose.present && q.detail) addRidgeFin(fb, bm, { u0: lm.adipose - 0.012, u1: lm.adipose + 0.012, height: f.adipose.size * bm.L * 0.8, sweep: 0.5, shape: 'rounded', side: 1, rays: 4, spineFrac: 0, opacity: 1, flex: 0.1, kind: 'adipose', kindId: 6, K: 2 });
  if (f.finlets.count > 0 && q.detail) { const n = f.finlets.count, a0 = (f.dorsal.count === 3 ? lm.dorsal3End : f.dorsal.count === 2 ? lm.dorsal2End : lm.dorsalEnd) + 0.015, a1 = lm.peduncleStart - 0.01;
    for (let i = 0; i < n; i++) { const u = lerp(a0, a1, (i + 0.5) / n); addRidgeFin(fb, bm, { u0: u - 0.006, u1: u + 0.006, height: maxD * 0.09, sweep: 0.9, shape: 'falcate', side: 1, rays: 3, spineFrac: 0, opacity: 1, flex: 0.2, kind: 'finlet', kindId: 7, K: 2 }); if (f.anal.present) addRidgeFin(fb, bm, { u0: u - 0.006, u1: u + 0.006, height: maxD * 0.09, sweep: 0.9, shape: 'falcate', side: -1, rays: 3, spineFrac: 0, opacity: 1, flex: 0.2, kind: 'finlet', kindId: 7, K: 2 }); } }
  let caudal = null; if (f.caudal.present) caudal = addCaudal(fb, bm, q.K, q.detail ? clamp(f.caudal.rays, 7, 40) : 7);
  const finGeo = fb.build(); geos.push(finGeo); tris += finGeo.index.count / 3;
  const fins = opts.instanced ? new THREE.InstancedMesh(finGeo, mats.fin, opts.instanced) : new THREE.Mesh(finGeo, mats.fin); fins.frustumCulled = false; fins.renderOrder = 2; group.add(fins); parts.fins = fins;
  if (q.detail && !opts.instanced) {
    if (!bm.oralDisc && !bm.ventralMouth && bm.law.mouth.construction !== 'fused') {   /* fused construction: one solid beak-like terminal structure, no hinged jaw, no cavity */
      const jaw = buildJawGeometry(bm); geos.push(jaw.geo); tris += jaw.geo.index.count / 3; bm.pivotX = jaw.pivot.x; uni.uJawPivot.value.set(jaw.pivot.x, jaw.pivot.y); uni.uJawOpenMax.value = bm.law.mouth.construction === 'fused' ? 0 : jaw.openAngle; uni.uJawSpread.value = MOUTH.jawSpreadRef(bm, GH);
      const jawMesh = new THREE.Mesh(jaw.geo, mats.jaw); jawMesh.frustumCulled = false; group.add(jawMesh); parts.jaw = jawMesh;
      if (jaw.upper) { geos.push(jaw.upper); tris += jaw.upper.index.count / 3; const um = new THREE.Mesh(jaw.upper, mats.jaw); um.frustumCulled = false; group.add(um); parts.upperJaw = um; }
    } else { bm.pivotX = bm.headX; uni.uJawOpenMax.value = 0; }
    if (GILL.kindOf(bm) === 'cover') { const og = GILL.buildOperculum(bm, GH); geos.push(og); tris += og.index.count / 3; const om = new THREE.Mesh(og, mats.jaw); om.frustumCulled = false; group.add(om); parts.operculum = om; }
    if (bm.disc) { for (const m of DISC.buildUnderside(bm, mats, GH)) { m.userData.mouthPart = !!(m.userData.discMouth || m.userData.discLip); geos.push(m.geometry); group.add(m); if (m.userData.discGills) parts.gills = m; if (m.userData.discMouth) parts.discMouth = m; } const nm = buildNostrils(bm, mats); geos.push(nm.geometry); group.add(nm); parts.marks = nm; if (DISC.cephalicWanted(bm)) for (const m of DISC.buildCephalic(bm, mats, GH)) { geos.push(m.geometry); group.add(m); (parts.cephalic || (parts.cephalic = [])).push(m); } }
    else for (const mesh of [...buildMouthDetails(bm, mats).map(m => { m.userData.mouthPart = true; return m; }), GILL.buildGills(bm, mats, GH), buildNostrils(bm, mats)]) { geos.push(mesh.geometry); group.add(mesh); }
    for (const e of buildEyes(bm, q.eye, mats)) { geos.push(e.geometry); tris += e.geometry.index.count / 3; group.add(e); }
    const teeth = bm.oralDisc || bm.ventralMouth || bm.law.mouth.construction === 'fused' ? null : buildTeeth(bm, mats); if (teeth) { geos.push(teeth.geometry); tris += teeth.geometry.index.count / 3 * teeth.count; group.add(teeth); parts.teeth = teeth; }
    const barb = buildBarbels(bm, mats); if (barb) { geos.push(barb.geometry); tris += barb.geometry.index.count / 3; group.add(barb); if (bm.barbelTip && g.skin.photophores > 0) { const bulb = new THREE.SphereGeometry(Math.max(0.003, 0.012 * bm.L), 8, 6); bulb.translate(bm.barbelTip.x, bm.barbelTip.y, bm.barbelTip.z); geos.push(bulb); const bm2 = new THREE.Mesh(bulb, mats.glow); group.add(bm2); } }
    for (const m of buildSpecials(bm, mats)) { geos.push(m.geometry); tris += m.geometry.index.count / 3 * (m.count || 1); group.add(m); }
  } else { bm.pivotX = bm.headX; }
  if (!q.detail) for (const e of buildEyes(bm, 7, mats)) {
    geos.push(e.geometry);
    const mesh = opts.instanced ? new THREE.InstancedMesh(e.geometry, e.material, opts.instanced) : e;
    mesh.frustumCulled = false; group.add(mesh);
  }
  if (!q.detail && g.head.special !== 'none') for (const source of buildSpecials(bm, mats)) {
    if (source.isInstancedMesh) { source.geometry.dispose(); continue; }
    if (!source.geometry.getAttribute('aBody')) skinAttributes(source.geometry, bm);
    const mesh = opts.instanced ? new THREE.InstancedMesh(source.geometry, mats.body, opts.instanced) : new THREE.Mesh(source.geometry, source.material === mats.glow ? mats.glow : mats.body);
    mesh.frustumCulled = false; geos.push(mesh.geometry); group.add(mesh);
  }
  tris = 0; group.traverse(mesh => { if (mesh.isMesh) tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh && !opts.instanced ? mesh.count : 1); });
  group.rotation.x = g.body.roll * Math.PI / 180;
  const box = new THREE.Box3().setFromObject(group);
  const info = { tris: Math.round(tris), quality: opts.quality || 'hero', anatomy: bm.a.label, caudalAR: caudal ? +caudal.ar.toFixed(2) : 0, caudalSpan: caudal ? caudal.span : 0, finAreas: fb.areas, rays: fb.rays, finBases: fb.bases, attachments: fb.attachments, landmarks3D: landmarks3D(bm), bounds: box, spine: bm.spine, pec: bm.pecInfo ? Object.assign({ restAbd: bm.law.pec.restAbd }, bm.pecInfo[1], { mirrored: bm.pecInfo.mirrored }) : null, tail: caudal, finH: bm.finH || {}, laws: { eye: bm.law.eye, mouth: bm.law.mouth, tail: { family: bm.law.tail.family, T: bm.law.tail.T, keel: bm.law.tail.keel }, flat: bm.law.flat } };
  return { group, uniforms: uni, materials: mats, bm, info, parts, geos, dispose() { geos.forEach(x => x.dispose()); for (const k in mats) { const m = mats[k]; if (m && m.dispose) m.dispose(); } (mats._eyes || []).forEach(m => m.dispose()); } };
}
