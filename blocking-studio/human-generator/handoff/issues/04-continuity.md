title: Hands: a test that neighbouring bodies get neighbouring thumbs
labels: enhancement
order: 4
area: Tests
files: tests/test_hands.mjs, tools/hand_continuity.mjs
after: 1
---
Part of TRACKING.

The thumb of each pose is solved per body. Before the seeded search, two hands a few months apart in age could land
15 to 32 degrees apart in a thumb angle, which shows as a pop when a character ages. The search now starts from the
library's fit for the hand's age, in 1 degree steps, then from the fits of the two age knots around it, and searches
the whole range only when neither holds (`solveThumb` in `hands/rig.js`). Nothing in the tests guards this yet.

## Measured on the branch

Largest change of any thumb angle (`cmc_flex_deg`, `mcp_flex_deg`, `ip_flex_deg`, `opposition_deg`,
`abduction_deg`, `twist_deg`) between neighbouring bodies, the hand built at level 2:

- **ages**, both sexes, `presetDNA({ sex, age_months })` at 0 to 216 months in 3-month steps, then 240, 300 and
  360: at most 9 degrees on 21 of the 24 poses; HP12 17.5, HP21 32, HP23 25;
- **adult neighbours**, `dnaFromId` over `M_H01_C05` to `M_H10_C05`, `M_H05_C01` to `M_H05_C10` and the same for
  `F_`: at most 6 degrees, except HP12 13.4 and HP21 9.3.

HP12, HP21 and HP23 are the poses whose contact the mesh cannot meet on some bodies (see TRACKING), so the search
there switches between answers that each miss.

## What to do

Add a test to `tests/test_hands.mjs` with these as per-pose regression bounds (9 and 6 degrees by default, the
named exceptions above). The full sweep is slow (about 45 seconds for ten poses at 3-month steps); keep the test
under 15 seconds, for example by sampling ages around the knots (168, 120, 72, 36, 12 and 0 months) where jumps
happened, and put the full sweep in a tool (`tools/hand_continuity.mjs`) that prints the table above. Say in the
test's diagnostic what it covers and what it leaves to the tool.

A starting point for the sweep:

```js
const H = await import('../hands/index.js'), gen = await import('../generator.js');
const G0 = { grip_radius_m: null, object: null, grip_strength: null };
const KEYS = ['cmc_flex_deg', 'mcp_flex_deg', 'ip_flex_deg', 'opposition_deg', 'abduction_deg', 'twist_deg'];
const bodyAt = (sex, m) => gen.generate(gen.presetDNA({ sex, age_months: m }),
  { hands: { level: 4, left: { pose: 'HP01' }, right: { pose: 'HP01' } } }).hands.left.body;
// for each pose, sex and pair of neighbouring ages:
//   H.buildHand({ pose, body: bodyAt(sex, m), level: 2, grip: G0 }).angles.thumb
// and the largest |a[k] - b[k]| over KEYS
```

## Done when

The test passes on the branch and fails if the seed is removed (pass `null` instead of the fit in `solvePose`), and
the tool reproduces the numbers above.
