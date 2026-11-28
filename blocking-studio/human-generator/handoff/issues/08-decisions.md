title: Hands: four decisions for the maintainer before the merge
labels: question
order: 8
area: Decision
files: 
after: 
---
Part of TRACKING.

These are choices, not bugs. The branch has a default for each; the maintainer decides whether it stays.

1. **Level 0 has 332 triangles.** The brief asked for 160 to 260. They are the palm (40), a chamfered wrist
   connector (32), the ten proximal and middle phalanges (20 each) and the five distal ones (12 each): one convex
   piece per bone, which the solver tests exactly. Fewer triangles means coarser pieces; the collision test runs on
   the pieces that are drawn, so it would test the coarser hand.
2. **Which level 1 variant is the default:** `budget` (40 triangles) or `readable` (70). `budget` meets the
   triangle budget; `readable` keeps more poses recognizable.
3. **Level 3 (12 triangles) has no thumb.** At that distance the hand is a few pixels across.
4. **The library's fit changes the authored thumb angles of the Hand DNA.** The Hand DNA's own notes say its
   angles are first values, not validated; on this mesh several authored thumbs go into the palm or a finger, or
   miss their contact. `tools/fit_hand_poses.mjs` fits each pose's thumb per age knot and writes `hands/fit.js`; the
   authored values stay in `hands/poses.js`.

Comment here with a decision per item; each "change it" becomes its own issue.
