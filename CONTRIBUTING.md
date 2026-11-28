# Contributing

Thanks for helping. Issues are welcome in English or Portuguese.

## Everything in the repository is in English

Every file, file name, folder name, `hfd.py` command, option, JSON field and value, message, test, comment, commit
message and pull request goes in English. The skill still answers each person in their own language; only its
content is in English. The one exception is `README.pt-BR.md`, the Portuguese translation of `README.md`.
`tools/check_repo.py` rejects Portuguese text and file names elsewhere, and CI runs it on every pull request. The
Portuguese names used before 6.0 are listed in [`docs/MIGRATION-6.md`](docs/MIGRATION-6.md).

## Public code and private productions

This repository is a **public, shared skill**. Commit reusable instructions, offline tools, tests, documentation,
and anonymized calibration records only. Keep a person's or client's brief, brand, characters, scripts, shot lists,
sketches, review pages, generated media, quotes, preferences and working files in a separate project folder or
personal skill outside this repository. Do not turn a local production into a shared example by accident.

Before every commit, inspect both the staged file names (`git diff --cached --name-only`) and the staged diff
(`git diff --cached`), then run `python3 tools/check_repo.py`. Move private files out and unstage them before
committing. `.gitignore` is a convenience, not a privacy boundary: `git add -f` can bypass it. The repository
check rejects project directories, review pages, production media outside the documented manual assets, and
machine-specific file paths. It cannot recognize every client detail inside otherwise valid prose, so the staged
diff still needs a human review. The allowlisted calibration records remain the only production-derived data
accepted here, after the review described below.

## Concurrent work and pull requests

Never push directly to `main`. Start a topic branch from an updated `origin/main`, and submit changes through a
pull request. A passing CI run and a review of the PR diff are required before merging. **Only the maintainer
merges, through the GitHub pull request page. Agents stop with the PR ready for review; they never merge their own
or another PR, use an admin override, or skip hooks with `--no-verify`.**

Before pushing the branch, fetch again: `git fetch origin`. If `origin/main` moved, integrate it into your branch
and resolve conflicts, then rerun the checks. Rebase a branch that only you own (`git rebase origin/main`); on a
branch another agent is also editing, coordinate or merge `origin/main` instead of rewriting their commits. A
commit before this fetch is optional; rebasing needs a clean worktree, which can be achieved by committing or
stashing. `git pull --rebase` combines fetch and rebase, but the explicit fetch makes the new base visible. If the
push is rejected because the branch moved, fetch and integrate again; never force-push `main`. Use
`--force-with-lease` only for an owned PR branch after checking its remote head.

Agents using an API connector instead of a Git checkout follow the same rule: read the current base SHA, create a
commit on a topic branch, and update the branch only with an expected-head check. If the base advances, rebuild on
the new base, resolve conflicts and rerun CI before merging the PR.

## Run the checks

There is nothing to install. The skill uses only the Python standard library (3.9 or later).

```bash
cd higgsfield-director && python3 -m unittest discover -s tests -v   # hfd.py and skill format
cd .. && python3 -m unittest discover -s tools/tests -v           # public/private boundary
python3 tools/check_repo.py                                        # repository and privacy checks
cd blocking-studio/human-generator                                 # the human generator (Node 22 or later)
node --expose-gc --test tests/test_generator.mjs                   # the body
node --expose-gc --test tests/test_hand_dna.mjs                    # the Hand DNA's contract
node --expose-gc --test tests/test_hands.mjs                       # the hands
node tools/fit_hand_poses.mjs --check                              # hands/fit.js is what the fit tool writes
```

CI runs them on every pull request and on every push to `main`, with PyYAML installed so that the frontmatter is read
as real YAML (`check_repo.py --require-yaml`). Without PyYAML, the local check reads it by pattern and says so. The
last five lines need Node and only matter for a change under `blocking-studio/human-generator/`. `--expose-gc` is not
optional there: without it the memory test of `test_generator.mjs` passes without measuring the heap.

## Rules for changes

- **Every change goes through a pull request.** Nobody pushes to `main`, maintainers and coding agents included;
  the maintainer merges. The rules for agents are in [AGENTS.md](AGENTS.md).
- **Credits are spent only after the cost is shown and the operator says "ok".** A change that weakens this
  rule, in `SKILL.md`, in the references or in the code, will not be merged.
- **`hfd.py` stays offline and stdlib-only.** It reads and writes only the paths it is given, never inside the skill
  folder unless the path is passed explicitly. The one default path is `preferences`, which uses
  `.higgsfield-director/preferences.json` in the current folder.
- **The preference file never authorizes spending.** It stores how the operator wants to work, nothing else; a change
  that lets it carry a ceiling or a budget will not be merged.
- **No hard-coded data that goes stale.** A price, a list of models, a connector's workflow or a limit copied from
  the catalog changes without this repository noticing. Instead of writing it in a file, add a routine to `hfd.py`
  that refreshes it from the live source on each day of use or on request and reports what changed, or that nothing
  did (as `hfd.py prices` and `models --import` do). A figure that must stay is a dated record of what was measured.
  A change that writes current data by hand will be asked to become a routine
  ([AGENTS.md](AGENTS.md#no-data-that-goes-stale)).
- **Scripts before the model.** Every step the agent takes by itself costs tokens; a step a script takes costs
  none. If a change asks the agent to compute, check, look up, convert or repeat something, make it a command of
  `hfd.py` and have the instruction call it ([AGENTS.md](AGENTS.md#scripts-before-the-model)).
- **Keep the project clearly unofficial.** Do not add Higgsfield's logo or wording that suggests the skill is
  official, endorsed or supported by Higgsfield. Use the name only to say which service the skill works with. Keep
  the notice at the top of both READMEs, the *Disclaimer* / *Aviso* sections and the line at the top of `SKILL.md`.
- **Every bug fix comes with a test that fails before the fix.** Add one for each defect you correct.
- **Model capabilities come from the catalog.** Use the live `models_explore` or the dated snapshot, never memory.
  To refresh the bundled snapshot, follow the snapshot section in `references/models.md`.
- **Keep `SKILL.md` lean.** At most 200 lines; detail goes into `references/`, which the agent reads on demand. The
  `description` has at most 1024 characters and is a quoted YAML string.
- **The two READMEs move together.** A change to `README.md` needs the same change in `README.pt-BR.md`.
- **Never commit** generated media, API keys, tokens, signed URLs, or prompts and images that belong to a client.
  The one exception is the blocking studio's shared assets in `blocking-studio/assets/`: a character enters there only
  by the maintainer's decision, and `tools/public_boundary.py` allows still images only in each character's `sheets/`
  and in `blocking-studio/docs/`.
- Add a line to `CHANGELOG.md` under *Unreleased*.

## Run the behavior scenarios

[docs/behavior-scenarios.md](docs/behavior-scenarios.md) lists requests with what the skill must do: the cost rule,
routing to a connector workflow, consent, the live catalog. Run them in a fresh session after changing `SKILL.md` or
a reference, and never give the "ok" a scenario stops at.

## Contribute a calibration result

A blind round, with and without the skill, on a request of your own, is kept as a record in
[`calibration/`](calibration/README.md). The steps are in
[`references/calibration.md`](higgsfield-director/references/calibration.md).

1. Build the record with `hfd.py result`. It writes only allowlisted fields: date, skill version, request type,
   model, shots, credits, whether a reference image was used, the vote, which version was seen first, an optional
   reason of up to 160 characters, and the blind reviewer's scores.
2. **Read the whole record before you share it.** Never add the request text, prompts, images, videos, names,
   clients, brands, links, e-mail addresses or file paths. CI rejects any field outside the allowlist.
3. Put it in `calibration/` as `YYYY-MM-DD-<category>-<suffix>.json`, run `python3 tools/aggregate_calibration.py
   --write` to refresh the scoreboard in `calibration/README.md`, and run the checks above.
4. Open a pull request with the record and the scoreboard change. A round where the skill lost is just as welcome.

## Add the week's price record

Once a week, someone whose computer is signed in to the connector (`connector.py login`) adds that day's price table
to [`price-history/`](price-history/README.md), so its chart shows how prices move:

1. `python3 higgsfield-director/scripts/connector.py prices --file /tmp/prices.json`. The quotes cost no credits and
   no model tokens.
2. `python3 tools/aggregate_prices.py --add /tmp/prices.json`. It refuses a second record in the same week (Monday to
   Sunday) and redraws `price-history/README.md`.
3. Open a pull request titled `Price record YYYY-MM-DD` with the record and the page. If every row changed, say which
   plan quoted them: prices can depend on the plan.

The record is history. The skill never reads it; it plans from the day's table in the project and quotes before
spending ([`AGENTS.md`](AGENTS.md#no-data-that-goes-stale)).

## License

Contributions are accepted under the license of the files they change (see *Licensing* in the README).
