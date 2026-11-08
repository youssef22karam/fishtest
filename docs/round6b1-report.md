# Round 6B.1 report — fin roots (PIECE 1 of 3, SMALL)

STATUS: COMPLETE. The bar is met (numbers below). Nothing was committed or pushed.
Scope: ONE defect family — how a fin GROWS OUT of the body. Fin material (piece 2) and fin shape / size / position law (piece 3) are untouched.
Every rule is a function of the generator's global axes only (body plan, swim mode, feeding niche, depth band, body size), reached through the fin's own geometry.

## Defect (playtest evidence)
(a) Side fins leave the flank with no joint, clip into the body through their motion range, and a bright glow sits at the root. (b) The dorsal fin sits on the body with a seam along its base. (c) On the rigid plan the side-fin root shows a pale unblended patch.

## Cause (measured on the unmodified code, 150 fish)
- Fin vertices were placed exactly on, or sunk below, the loft: there was no tissue between the wall and the fin plane. 131,527 of 266,176 flank/ridge fin triangles (49.4 %) were inside the body volume somewhere in the motion range (worst 4.0 % of body length).
- On bodies that widen behind the fin base the fin tip is inside the wall even AT REST; the joint then swings it further in (sweep about z keeps z, abduction tilts toward the wall).
- The root colour was lit with the fin's own lighting (flat fin-plane normal, duller roughness, no clamp), not the flank's: 22,187 of 29,764 root samples (74.5 %) rendered brighter than the flank in a CPU port of the lighting terms. That is the glow blob / pale patch.

## Fix — a fleshy base, by construction
1. **Mound** (`src/engine/finroot.js`, built in `FinBuilder.add`, drawn by `parts.mounds`): every attached fin except the rear fin gets a low mound of tissue along its base. Height scales with the free fin height (cap: half the local depth), width with the fin's own root flare (>= 2.6 x height, cos² profile, zero value and slope at the border, runs 16 % past each end of the base). It is placed on the loft (`attachedSurface`), carries the body's `aBody` coordinates (u, angle, tag 0) and is rendered with the BODY material: pattern, colour and lighting are the flank's, and the border is flush, so there is no step, no seam and no colour discontinuity.
2. **Roots start on the mound**: the fin's centre line and both root lines are lifted onto the mound; the old burial (`sink`) is no longer used for mounded fins. Shading normals ease from the flank normal at the root to the fin plane over the first 40 % of the fin, so shading has no crease at the joint.
3. **Side fins stand out on their peduncle by the clearance deficit** (`pecNeed`): the fin and its joint are translated laterally by the smallest lift at which no fin vertex can enter the body anywhere in the full sweep (-25, 5, 35 deg) x abduction (5, 20, 55 deg) range (the hard clamps of `finmotion.PEC_LIM`) with worst-case ripple, verified on the built geometry and re-lifted if needed. A pure z translation of fin AND hinge commutes with the joint rotation, so Round 1 motion is exactly preserved and the outline seen from the side is unchanged. The left fin is the mirror.
4. **Ripple guard**: the shader's z flutter could push wall-hugging membrane into the body (pelvic / anal / dorsal). Each vertex gets a suppression factor (`aSkin.w`, free until now) = the part of the flutter that would enter the wall; elsewhere flutter is unchanged.
5. **Root colour** (`FS_FIN`, marker `ROOT_CAP`): the root zone no longer takes the membrane brightening, and is clamped per channel to the same lighting law evaluated with the flank pigment, flank normal and body roughness / coat (`c = min(c, cRef)` over the first 34 % of the fin). The root can never render brighter than the surrounding skin.

Rear fin: its root is buried inside the rounded rear cap by the round-6H termination law (L3). That is not a flank/ridge joint, so it gets no mound and is reported separately, not counted in the penetration bar.
Disc plan (its "fins" are the disc margin), mouth, eyes, gills and body loft were not touched.

## Results
| bar | result |
|---|---|
| `node tools/verify.mjs` | **OVERALL PASS** — UNIQUENESS 10,000/10,000 (min trait distance 0.0565, 0 pairs under 0.02, determinism 60/60); COHERENCE 1,000/1,000 (every invariant 1000/1000, mesh audit 1000/1000, mutate 250/250, breed 250/250); mesh build median 40.8 ms, p95 74.5 ms. `docs/verify-report.txt` refreshed from this run. |
| `node tools/randaudit.mjs after` | **PASS** — standard n=300: ZERO in every class; wonder SHIPPED n=289: ZERO. (Wonder RAW has 1 FLAT_BODY_END draw that the shipping filter removes; body loft untouched.) |
| `node tools/finrootaudit.mjs after` (N=1000 draw = verify's coherence draw; 950 audited, 50 disc plans out of scope, 0 build failures) | **PASS** |
| – penetration | **0 / 1,791,816** fin triangles intersect the body volume through the full motion range (dorsal 0/480,076, anal 0/357,776, side 0/680,200, pelvic 0/273,764); worst sample 0.09 % L against a 0.10 % L tolerance. Baseline: 49.4 %. |
| – root brightness | 200,344 root samples; **0 brighter than the flank** with the shipped cap. Without the cap 148,808 (74 %) would be: normals alone do not fix it, the cap does. |
| – fleshy base | present on 950/950 fish, 0 mound vertices with a non-body skin tag. |
| `pectest` / `tailtest` | PASS / PASS |
| `npm run build` | PASS |
| reassembly | byte-exact: `cat parts/*` and `src/engine/fishgen.js` both sha256 `9588552158df0c97169b555cf7380dfa604a0046b1365c762a69c40e6b867d8f` |
| file sizes | every text/code file <= 30,000 bytes (largest: part10 at 29,730 bytes) |

## What the audit measures (and does not)
`tools/finrootaudit.mjs`: every fin triangle (3 vertices, centroid, 3 edge midpoints) against the analytic body volume (same law as the loft), tolerance 0.10 % of body length (loft chord sag). Side fins use a JS port of the vertex-shader joint (`finroot.pecMove`) over the 3 x 3 sweep/abduction grid; every fin also gets the worst-case flutter. Root brightness is a CPU port of the lighting terms that decide brightness (diffuse wrap, GGX lobe, clearcoat lobe) for 6 view directions under the key light, fin normal vs flank normal at the same (u, angle); the "final" figure applies the same cap the shader applies, so it checks the geometry/normal side and that the shader contains the cap, it is not a pixel measurement.
**Not done:** real pixel renders. A headless Chromium could be installed in the sandbox but it cannot launch (system library `libnspr4` is missing), so none of this round's images were looked at.

## Costs / things to watch for the next pieces
- Side-fin peduncle lift: mean 2.0 % L, p95 4.5 %, max 7.55 % L. Every fish needs some lift because the full hard-clamp motion range (not just the rest pose) must clear the wall. Large values are on bodies that widen strongly behind the fin base; shrinking them is a position/size question (piece 3), not a root question.
- Mounds add about 3,300 triangles per fish at gallery quality (budget 40,000); they are off for the low-detail / instanced path, where fins keep their old roots.
- To keep every part under 30,000 bytes, `addPelvic` and three scene helpers (`onResize`, `applyTier`, `adaptQuality`) moved verbatim from part10 / part13 to part20 (function declarations, hoisted); `import * as FINROOT` was added to part01.

## Files
New: `src/engine/finroot.js`, `tools/finrootaudit.mjs`, `docs/round6b1-report.md`, `docs/census/finroot-after.txt`. Edited: parts 01, 10, 11, 13, 20; `docs/verify-report.txt`.

## Muse gate — independent rerun (2026-11-08, before commit)
Reassembly byte-exact (sha256 `9588552158df0c97169b555cf7380dfa604a0046b1365c762a69c40e6b867d8f`, parts and fishgen.js identical). `verify.mjs` OVERALL PASS (my run, `docs/verify-report.txt` refreshed from it). `randaudit.mjs after` PASS (standard 0/300, wonder SHIPPED 0/289; 1 RAW FLAT_BODY_END filter-rejected, pre-existing). `pectest` PASS, `tailtest` PASS, `npm run build` PASS. Fin-root audit, four independent draws: model 0 hits (950 fish); my run 1: 0/1,796,788 (952 fish); my run 2: 6 hits on ONE fish (MHYCCGV2, anal fin, worst exactly 0.10% L = the tolerance floor); my run 3: 0/1,784,278 (951 fish). So 3 of 4 draws are clean zero; the single failure is 6 triangles at the exact tolerance floor on one rare genome. Renders (seeds Y93Q_, Q1CW5 side+head): dorsal and pectoral fins sit on visible fleshy mounds, no white root blob, no seam. RESIDUAL (accepted, for piece 3): anal-fin boundary penetration on widening bodies at the tolerance floor; mounds are off on the low-detail/instanced path, where fins keep their old roots.
