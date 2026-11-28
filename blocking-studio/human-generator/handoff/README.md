# Hand pose system: work in progress (handoff)

The branch `procedural-hands` adds procedural hands to the human generator. It works end to end but is **not ready
for a pull request into `main`**: some tests fail, documentation is stale, and a few decisions are open. This folder
says where the work stands and how to carry it on. **Delete the whole folder before the pull request into `main`.**

| File | What it is |
|---|---|
| `README.md` | This file: what the branch has, its state, and how to take a task. |
| `issues/` | The tasks, one file each: a header (title, labels, order, area, files, dependencies) and the issue's text. |
| `tasks.py` | Puts the tasks on GitHub: `issues` (milestone, tracking issue, task issues, sub-issues), then `board` (the project). |
| `PROJECT_PROMPT.md` | Two prompts for coding agents: set up the issues and the board once, then take a task. |

Once the issues exist, they are the source of truth: edit the issue, not the file here.

## What the maintainer asked for

A universal hand library that adapts to every body, from the maintainer's reference sheet ("modular hand, ultra
low-poly", not in the repository) and the Hand DNA v1 data (24 poses, `tests/fixtures/hand_poses_24.json`):

- 24 poses; angular, flat-shaded, low triangle counts;
- three modes: articulated finger bones, rigid preset geometry, and simplified meshes for distant levels of detail;
- one wrist interface for every hand;
- left and right hands built independently, mirrored, blended, and adapted to the body's size, age and proportions;
- controls for length, width, thickness, flexion, abduction, adduction and thumb opposition;
- grips that adapt to the object's radius, shape and orientation;
- orthographic technical sheets;
- checks for collisions, continuity, wrist placement, rig compatibility and triangle budget.

The Hand DNA's own notes say its angles are first values, not validated: the rig must recompute dimensions, contacts
and collisions for each hand size.

## What is in the branch

All under `blocking-studio/human-generator/`:

| File | What it does |
|---|---|
| `hands/index.js` | The API: `validateHands`, `buildHands`, `buildHand`, `blendHands`, `posed`, `POSES`, `handDnaPath`, `clearHandCaches`. |
| `hands/rig.js` | Hand dimensions from the body (age and sex factors), the 16-bone skeleton, joint limits, the pose solver (thumb search, collisions by separating axes, contacts, grips). |
| `hands/poses.js` | The 24 poses, written from the maintainer's file. |
| `hands/fit.js` | The library's thumb per pose at six age knots (168, 120, 72, 36, 12 and 0 months), written by `tools/fit_hand_poses.mjs`. Not edited by hand. |
| `hands/mesh0.js` | Level 0: 16 convex pieces and a wrist connector, 332 triangles; mode A (articulated) and mode B (preset). |
| `hands/mesh1.js` | Level 1: variants `budget` (40 triangles) and `readable` (70). |
| `hands/mesh2.js`, `hands/mesh3.js` | Level 2 (20 triangles) and level 3 (12). Level 4 is no hand. |
| `hands/shells.js` | The drawn shells of levels 1 and 2 checked against each other (the solver's exact test runs on level 0's pieces). |
| `generator.js`, `index.html` | The `hands` block of a character, its corrections and diagnostics, and the editor's hand controls. |
| `tools/hand_sheets.mjs` | The orthographic sheets (SVG). |
| `tools/fit_hand_poses.mjs` | Refits `hands/fit.js`; `--check` says whether it is up to date. |
| `tests/test_hands.mjs`, `tests/test_hand_dna.mjs` | The hand tests; `tests/test_generator.mjs` has the integration and performance tests. |

Every hand is built for its own body at every level: the solver runs on level 0's pieces and the lower levels are
drawn from the solved skeleton. The thumb search starts from the library's fit for the hand's age, in 1 degree
steps; when that does not hold, from the fits of the two age knots around the hand; only when neither holds is the
whole range searched. A thumb control (flexion, abduction or opposition other than 0) always searches the whole
range.

Measured before the handoff, on a laptop: a new character with hands about 14 to 16 ms, a cached one about 0.9 ms,
level 4 about 0.5 ms. The continuity numbers are in the continuity task.

## How this branch was made

The work was done in a scratch copy that a reboot erased before it was committed. It was rebuilt by replaying, in
order, every file change recorded in the session's transcripts, from `main` at 077187f, and checked against the
results recorded before the reboot (below). Review the diff as new code.

## State of the tests

From `blocking-studio/human-generator/` (Node 22 or later):

```bash
node --expose-gc --test tests/test_generator.mjs tests/test_hands.mjs tests/test_hand_dna.mjs
node tools/fit_hand_poses.mjs --check
```

Measured at the handoff, on a laptop, Node 24 (each suite runs in its own process):

| Suite | Tests | Pass | Fail | Todo |
|---|---|---|---|---|
| all three together | 96 | 88 | 6 | 2 |

The six failures, each with its task:

| Test | What it says | Task |
|---|---|---|
| `test_generator.mjs`: memory | `8.3 MB kept` (the limit is 8 MB; before the hands were built per body, 0.02 to 1.02 MB) | 11 |
| `test_hands.mjs`: folded fingers | newborn HP04, `fingers.pinky` | 1 |
| `test_hands.mjs`: finger controls | `middle {"spread":1}` moved `Ring_01` by 3.128 mm | 1 |
| `test_hands.mjs`: a plane under every pose | HP15: the grip strength on a plane is not said to be ignored | 1 |
| `test_hands.mjs`: contacts | newborn HP06: a contact error of 1.0 mm, not said | 1 |
| `test_hands.mjs`: drawn shells | level 1 `readable`: `L1_Index` moved into `L1_Middle`, found nothing | 2 |

`node tools/fit_hand_poses.mjs --check` says `hands/fit.js is up to date (largest difference 0)`.

CI runs `test_generator.mjs` on every pull request, so CI fails on the branch until task 11 is done.

## The tasks

In order (the files in `issues/`; once on GitHub, the milestone "Procedural hands"):

1. Four new tests in `test_hands.mjs` expect more than the code promises (fix the tests).
2. The drawn-shell overlap check finds nothing on level 1 `budget` and level 2 (a test problem, and maybe a bug).
3. Run the hand tests and the fit check in CI.
4. A test that neighbouring bodies get neighbouring thumbs (continuity).
5. Update the comments in `test_hands.mjs` that describe the old fitted levels.
6. Regenerate the orthographic sheets and look at every pose in the editor.
7. Rewrite the hand sections of the human generator's README.
8. Four decisions for the maintainer (level 0's triangle count, the default level 1 variant, level 3 without a
   thumb, the fit changing the authored thumbs).
9. Contacts the mesh cannot meet (HP21, HP19, HP23, HP24, HP12).
10. Level 1 defects (the readable thumb's re-entry, the budget wrist gap).
11. The heap test keeps 8.3 MB after 4000 characters (CI fails on it).
12. The pull request from `procedural-hands` into `main`.

Tasks that change the same file go one at a time: 1, 2, 4 and 5 all change `tests/test_hands.mjs`; 2 and 10 change
`hands/mesh1.js`. Each issue lists its files and what it depends on.

## Taking a task

1. On the project board (or the milestone), pick an open issue with no assignee whose "Depends on" issues are closed
   and whose "Files" no issue in progress lists. If there is none, wait or ask.
2. Claim it: `gh issue edit <number> --add-assignee @me`, set its Status to "In Progress" on the board, and comment
   on the issue with your plan in a few lines. An issue with an assignee is taken.
3. Branch from the current `procedural-hands`:
   `git fetch origin && git switch -c hands/<number>-<short-name> origin/procedural-hands`.
4. Do the task as the issue says. Run the checks above, and `python3 tools/check_repo.py` from the repository root.
   Everything in English (`CONTRIBUTING.md`).
5. `git fetch origin`; if `procedural-hands` moved, rebase on it. Push your branch and open the pull request into
   `procedural-hands`, not `main`: `gh pr create --base procedural-hands --body "Part of #<number>. ..."`, with what
   you changed and how you checked it.
6. Stop there: only the maintainer merges. Merging into `procedural-hands` does not close the issue (GitHub closes
   issues only on the default branch), so after the merge close it by hand and set it "Done".
7. Anything new you find goes into a new issue in the milestone, not into your pull request.
