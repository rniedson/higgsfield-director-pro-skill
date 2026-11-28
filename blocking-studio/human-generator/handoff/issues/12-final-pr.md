title: Hands: the pull request from procedural-hands into main
labels: documentation
order: 12
area: Release
files: CHANGELOG.md, CONTRIBUTING.md, README.md, README.pt-BR.md
after: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
---
Part of TRACKING. Do this last, once the other tasks are closed and the maintainer has answered the decisions issue.

## What to do

1. `CHANGELOG.md`: an entry for the hands.
2. `CONTRIBUTING.md`: the hand test commands in "Run the checks" (if the CI issue did not already).
3. The root `README.md` and its Portuguese translation `README.pt-BR.md`: the hands in the blocking studio's
   description.
4. Delete the folder `blocking-studio/human-generator/handoff/`.
5. Run every check in `CONTRIBUTING.md`, including `python3 tools/check_repo.py`, and read the staged file names and
   the staged diff before committing.
6. `git fetch origin` and bring `origin/main` into the branch.
7. Open the pull request into `main` with the template, and stop there: only the maintainer merges.

## Done when

The pull request is open with CI passing, and nothing in it contradicts the code.
