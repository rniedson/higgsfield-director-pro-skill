title: Hands: contacts the mesh cannot meet (HP21, HP19, HP23, HP24, HP12)
labels: enhancement, help wanted
order: 9
area: Geometry
files: hands/rig.js, hands/poses.js, hands/fit.js
after: 4
---
Part of TRACKING.

Some poses ask the thumb to touch a point the mesh cannot reach without the thumb going into another piece. The
solver keeps the hand clear and says how far the contact is missed, as a `hand-contact-missed` correction on
`thumb` (the distance in `used`, the tolerance in `tolerance_m`). Nothing is silent, but the poses read worse.

Measured on the branch, on the reference hand's scale:

| Pose | Contact missed by |
|---|---|
| HP21 card grip | 8.5 to 19 mm |
| HP19 phone grip | about 7 mm |
| HP23 three fingers | on children, up to 34 mm |
| HP24 four fingers | about 6 to 7 mm |
| HP12 tripod | about 4.5 to 6 mm |

These are also the poses with the largest jumps between neighbouring ages (HP12 17.5 degrees, HP21 32, HP23 25 at
3-month steps): when no answer meets the contact, the search switches between answers that each miss it.

## What to look at

For each pose, whether the miss comes from the authored finger angles (the target is where the mesh's thumb
cannot go), from the thumb's joint limits (`rig.LIMITS`), or from the pieces' shape. A fix may be a change to the
pose's finger angles, recorded the way `hands/fit.js` records the thumb's (the authored values stay as the
maintainer wrote them), a joint limit with a source, or a change to the pieces. Measure before and after with the
contact test and the continuity numbers.

## Done when

Each pose either meets its contact within the tolerance on the test bodies or has a short written reason why it
cannot, in the README's list of limits; and no other pose gets worse.
