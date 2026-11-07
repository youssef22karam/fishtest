/* EYE BAND (round 6H.2) — the ONE definition of where an eye may sit along the head.
   Used by: the trait sampler / mutation / breeding (genome.js), the engine's fitHead re-fit, the oral/gill repair rule and the
   lineage bound on gill start. Nothing here is keyed to a species.
   Everything is expressed as FRACTIONS OF HEAD LENGTH h, measured against the head's own landmarks:
     forward limit  = the gill-front position (a gill series may never start behind GILL_START_MAX of the head — the repair
                      rules' cap — so the gill-front edge on any built head is ≤ GILL_START_MAX·h), minus the eye's own rear
                      half-extent (+ the second eye of a one-sided plan, 2.3 R behind the first) and a fixed margin;
     rear limit     = the snout (eye radius + margin). The jaw side (mouth corner ≤ eye's front edge, jaw hinge at the eye line)
                      is enforced by the anatomy-law repair in laws.js, which raises eyeU to min(eyeCap, mouth corner + R) where
                      eyeCap = gillStart − 1.08 R − .012 < hi, i.e. always INSIDE this band — and narrows the gape, not the eye,
                      when the two cannot both fit.
   Both limits are measured on the head itself, so the band is never a fixed window that a long head outgrows. */
export const GILL_START_MAX = .78;     /* repair-rule cap on head.gillStart (oral_gill_separation + rayfin bound) */
export const EYE_R_FRAC = .69;         /* eye radius = eyeSize · h · .69 (the audit's own er) */
export const EYE_MARGIN = .004;        /* clearance (body-length units) between the eye's rear edge and the gill front */
export const SEAT_SHIFT = .3;          /* a seated eye on a tapering head sits up to .3 R behind its station (measured .27 R on gar heads) */
export const NODE_HALF = .0025;        /* half a spine node (the audit locates the eye by nearest node, 240 nodes) */
/** total rear clearance for an eye of radius er (body-length units): margin + seat shift + audit node resolution */
export const eyeMargin = er => EYE_MARGIN + SEAT_SHIFT * er + NODE_HALF;
export const SECOND_EYE = 2.3;         /* one-sided plans carry the second eye 2.3 R behind the first */

/** eyeBand(h, eyeSize, eyeSide) → { lo, hi, seat } in head-length fractions (eye centre along the head, 0 = snout tip, 1 = operculum edge).
    hi   = the enforced forward limit (station clears the gill front by the plain margin) — what fitHead / the analytic audit hold;
    seat = hi less the seating allowance (tilt shift + node resolution): the limit for an eye that must still clear the gill front once it is SEATED on
           the built head, i.e. what the sampler draws inside and what fitHead pins an over-forward eye to. */
export function eyeBand(h, eyeSize, eyeSide = 'both') {
  const er = eyeSize * h * EYE_R_FRAC, second = eyeSide === 'both' ? 0 : SECOND_EYE * er;
  const hi = (GILL_START_MAX * h - .5 * er - second - EYE_MARGIN) / h;
  const seat = (GILL_START_MAX * h - .5 * er - second - eyeMargin(er)) / h;
  const lo = (er + .004) / h;
  return { lo: Math.min(lo, seat), hi, seat };
}
