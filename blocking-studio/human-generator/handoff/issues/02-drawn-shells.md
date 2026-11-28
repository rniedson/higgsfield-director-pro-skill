title: Hands: the drawn-shell overlap check finds nothing on level 1 "budget" and level 2
labels: bug
order: 2
area: Geometry
files: hands/shells.js, hands/mesh1.js, hands/mesh2.js, tests/test_hands.mjs
after: 
---
Part of TRACKING.

Levels 1 and 2 draw other shapes than level 0's convex pieces (wedges, tubes, one finger mass), so the solver's
exact collision test cannot see where they go into each other. `blocking-studio/human-generator/hands/shells.js`
checks what is drawn: every vertex and samples along every edge of a shell against every other shell, "inside" by the
winding number (`winding > 0.5`), the depth as the distance to that shell's surface. A digit's base ring (its first
`base = 3` vertices) is hidden in the palm and not counted against the palm.

The test **"the drawn shells of levels 1 and 2 are checked against each other: a shell moved into its neighbour is
found"** (`tests/test_hands.mjs`) builds HP01 on the reference body, moves one shell toward a neighbour and expects
`SHELLS.overlaps` to find the overlap deeper than 0.3 mm on the reference hand's scale. It fails, for two reasons.

## 1. The test does not move the shell far enough

It moves every vertex but the base ring by half the distance between the two shells' centres. On the open hand the
fingers are spread, so half way only reaches the gap between them. Measured on level 1 `readable`, moving
`L1_Index` toward `L1_Middle`:

| fraction of the distance | found |
|---|---|
| 0.5 | nothing |
| 0.8 | `L1_Index` in `L1_Middle` 1.11 mm, `L1_Middle` in `L1_Index` 0.80 mm |
| 1.0 | 2.91 mm and 2.53 mm |

*Fix:* move by the whole distance.

## 2. On level 1 `budget` and level 2 nothing is found at all

With `L1_Ring` moved into `L1_Middle` (`budget`) and `L2_Thumb` moved into `L2_Main` (level 2), nothing is found
even at 1.0. This one may be a real bug in the check or in the meshes. Things to look at first:

- whether those shells' triangles face inward: inside an inward-facing closed shell the winding number is −1, so
  `winding > 0.5` is never true and the check is blind (compute the winding number at each shell's own centre);
- whether the shells are closed (`budget`'s digits have 5 vertices and 6 triangles each);
- whether the moved vertices actually land inside the target (print them next to the target's vertices).

If a mesh faces inward, fix the mesh (and check that the other tests, the sheets and the editor still agree). If the
check is wrong, fix `shells.js`. Either way, the solver's own results must not change on level 0.

## Done when

The test passes on the three cases with the whole-distance move, a shell moved half way into the gap is still not
reported, and HP01 as built reports nothing deeper than 0.3 mm on every level.

## How to check

```bash
node --expose-gc --test --test-name-pattern="drawn shells" tests/test_hands.mjs
```
