# Instructions for agents

These rules apply to every coding agent, and to every person, working in this repository.

## Every change goes through a pull request

- **Never push to `main`**, even with credentials that would allow it. Create a branch from an up-to-date `main`,
  commit there, push the branch and open a pull request.
- **Never merge a pull request**, your own included, and never use `gh pr merge` or an admin override. The maintainer
  merges.
- Never force-push `main`, and never skip the hooks with `--no-verify`.
- Before opening the pull request, run the checks in [CONTRIBUTING.md](CONTRIBUTING.md#run-the-checks): the tests
  and `python3 tools/check_repo.py`.

## No data that goes stale

Question every piece of hard-coded data before adding it: a price, a list of models, a connector's workflow, a limit
copied from the catalog. If it can change without this repository noticing, it does not belong in a file here. Write
a routine instead (a command of `hfd.py` the agent runs on each day of use, or on request) that fetches it from the
live source and tells the user what changed since the last run, or that nothing changed. A figure that must stay is
written as a dated record of what was measured, never as a current fact. Hard-coded data is how a skill dies slowly.

## Scripts before the model

What a script can do, a script does. The agent that runs this skill pays in tokens for every step it takes itself; a
step that `hfd.py` takes for it costs nothing. Before adding an instruction that asks the agent to work something out
(count, check, look up, convert, merge files, repeat a request), ask whether a command could do it. If it could, write
the command and make the instruction call it. Leave to the model only what needs judgement: the operator's request,
the plan, the prompt, reading a result.

## Also

- Everything in the repository is in English, file names included
  ([CONTRIBUTING.md](CONTRIBUTING.md#everything-in-the-repository-is-in-english)).
- A production's material (briefs, characters, images, quotes, results) stays in the operator's project folder,
  outside this repository.
