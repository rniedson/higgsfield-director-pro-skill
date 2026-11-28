title: Procedural hand pose system: finish the branch and merge it
labels: enhancement
order: 0
area: Release
files: 
after: 
---
The branch [`procedural-hands`](https://github.com/rniedson/hfd/tree/procedural-hands) adds procedural hands to the human generator
(`blocking-studio/human-generator/`). It works end to end, but it is not ready for a pull request into `main`: some
tests fail, documentation is stale, and a few decisions are open. This issue tracks what is left; each task has its
own issue, written so that someone new to the branch can pick it up.

## What the hands are

One universal library that adapts to every body, instead of hands modelled per character:

- 24 poses (the Hand DNA v1 data, `tests/fixtures/hand_poses_24.json`), angular, flat-shaded, low triangle counts;
- three modes: articulated finger bones, rigid preset geometry, and simplified meshes for distant levels of detail
  (level 0: 332 triangles, level 1: 40 or 70, level 2: 20, level 3: 12, level 4: no hand);
- one wrist interface; left and right hands built independently, mirrored and blended;
- the hand adapts to the body's size, age and proportions, with controls for length, width, thickness, flexion,
  abduction, adduction and thumb opposition;
- grips that adapt to the object's radius, shape and orientation;
- orthographic sheets (`tools/hand_sheets.mjs`);
- checks for collisions, continuity, wrist placement, rig compatibility and triangle budget.

Every hand is built for its own body at every level: the pose solver (`hands/rig.js`) runs on level 0's 16 convex
pieces, and the lower levels are drawn from the solved skeleton. The thumb search starts from the library's fit for
the hand's age (`hands/fit.js`, written by `tools/fit_hand_poses.mjs`).

`blocking-studio/human-generator/handoff/README.md` on the branch lists the files and the measured numbers.

## How to work on it

- Branch from `procedural-hands`, and open your pull request **into `procedural-hands`**, not into `main`.
  CI runs on every pull request.
- Run the checks before you push (Node 22 or later, from `blocking-studio/human-generator/`):
  ```bash
  node --expose-gc --test tests/test_generator.mjs tests/test_hands.mjs tests/test_hand_dna.mjs
  node tools/fit_hand_poses.mjs --check
  ```
  and `python3 tools/check_repo.py` from the repository root.
- The rules in `CONTRIBUTING.md` and `AGENTS.md` apply: everything in English, nothing pushed to `main`, and
  numbers either measured or marked as a proposal.
- Take a task as `blocking-studio/human-generator/handoff/README.md` says ("Taking a task"): assign yourself, set it
  In Progress on the project board, and do not start a task whose files another task in progress is changing.
- A pull request into `procedural-hands` does not close its issue when it is merged (GitHub closes issues only on
  the default branch): close the issue by hand after the merge.
- When every task below is done, one pull request takes `procedural-hands` into `main`. Only the maintainer merges.

## Tasks, in order

SUBISSUES
