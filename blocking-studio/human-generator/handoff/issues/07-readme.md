title: Hands: rewrite the hand sections of the human generator's README
labels: documentation
order: 7
area: Docs
files: blocking-studio/human-generator/README.md
after: 4
---
Part of TRACKING.

`blocking-studio/human-generator/README.md` has hand sections written while the design was still changing. Parts
of them describe the old fitted levels and give numbers from before the last changes.

## What to do

Rewrite the hand sections so they describe the branch as it is:

- every hand is built for its own body at every level (the solver on level 0's pieces, the lower levels drawn from
  the solved skeleton); remove the text about fitted levels and corner bodies;
- `hands/fit.js`: what it is (the library's thumb per pose at six age knots), that `tools/fit_hand_poses.mjs` writes
  it, that it is not edited by hand, and that `--check` says whether it is up to date;
- the cost: about 14 to 16 ms for a new character with hands, about 0.9 ms when cached, about 0.5 ms at level 4
  (measured on a laptop; say where and how, or measure again);
- the continuity numbers (see the continuity issue in TRACKING);
- the wrist bounds in units of the forearm's end ring;
- the contacts the mesh cannot meet, and that each is said as `hand-contact-missed` (see TRACKING);
- the finger bones' axes on the character (flexion about the bone's own axis curls the finger toward the palm);
- the current test counts.

Every number is either measured (say how) or marked as a proposal, as `CONTRIBUTING.md` asks.

## Done when

Nothing in the README contradicts the code or the tests, and every number in it can be reproduced with a command
the README gives.
