title: Hands: update the comments in test_hands.mjs that describe the old fitted levels
labels: documentation, good first issue
order: 5
area: Docs
files: tests/test_hands.mjs
after: 1, 2, 4
---
Part of TRACKING.

Levels 1 to 3 used to be fitted from a few precomputed corner bodies and blended, so a hand could "step" between
corners. They are now built for each body exactly, like level 0. Some comments and messages in
`blocking-studio/human-generator/tests/test_hands.mjs` still describe the old way:

- the cost comment in the file's header;
- the two places that speak of levels that "step" between bodies (search for `step`);
- the grip test's comment that says "level 1 (fitted, ...)";
- the text of the "no jump" test's tolerance.

## What to do

Make each one say what the code does now: per-body build at every level (`buildHand` on the body the character
gives), and, where a tolerance is quoted, the number the test actually uses. Do not change the tests' logic in this
issue.

## Done when

`grep -n -i "fitted\|corner\|step" tests/test_hands.mjs` shows nothing that describes the old blending, and the
suite's results are unchanged.
