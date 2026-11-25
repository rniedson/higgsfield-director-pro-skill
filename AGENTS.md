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

## Also

- Everything in the repository is in English, file names included
  ([CONTRIBUTING.md](CONTRIBUTING.md#everything-in-the-repository-is-in-english)).
- A production's material (briefs, characters, images, quotes, results) stays in the operator's project folder,
  outside this repository.
