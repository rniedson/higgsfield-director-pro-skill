# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- A guide in each main folder (`higgsfield-director/` and its `references/`, `scripts/`, `templates/`, `data/` and
  `tests/`; `docs/`, `tools/`, `examples/`): what the folder is for, with a diagram and, where it helps, pictures.
  The skill never loads them; `check_repo.py` and the public boundary allow a `README.md` there.
- Illustrated lessons: six side-by-side images from the blind rounds (the version made with the skill beside the one
  made without it, at the same instants) and a card per illustrated lesson in `lessons-learned/2026-11-own-runs.md`;
  the folder's README traces a lesson's life in a diagram.
- A demo in the README: a 10 s kung fu fight between the maintainer's own character and a robot clone of himself,
  made one step at a time (four stills, a draft, the 1080p final), with how it was made, the prompt and the sound in
  `docs/demo/`. `tools/public_boundary.py` allows exactly those three media files, by the maintainer's decision.
  The video plays in the page from a GitHub attachment of the same file; a link to the `.mp4` in the repository
  only opened a download.

- `references/preproduction.md`: the sketch storyboard in two phases, tested once. Phase A draws every shot in one
  sheet with the cheapest image model (same drawing inside the sheet, but count and order are not obeyed); phase B
  crops each panel and uses it as the reference for its own frame in a cheap model that accepts references (same
  figures in every frame, each frame redone alone). Drawing rules: block figures, a face only when the expression
  matters, one identifying trait and the same shape description in every frame, stated scale, only who is in the
  frame, no numbers in the prompt, camera notes on the sheet instead of the prompt. Token-saving rules for the phase.
  The displayed quote can be rounded; the charge was `credits_exact`.
- `hfd.py crop <sheet> <folder> name:x0,y0,x1,y1 ...` writes the ffmpeg commands that crop a sketch sheet into
  frames, from boxes noted while looking at the sheet; it runs nothing and never overwrites. 4 new tests.
- Lessons from a 16-piece generated test, written as general rules: recipes for crowds, hands of two people, the
  final state, emotional gestures, official symbols and branded objects (`references/prompt.md`); a plausibility
  check before spending, two new diagnoses and three free checks after generation: speech by local transcription,
  loops by SSIM, and the model that actually ran (`references/quality.md`); the one-model, one-mode-per-project
  limit (`references/workflow.md`).
- Lessons from a blind with/without comparison (6 generated shots, scored by a blind judge and voted on by a person
  who did not know which was which): one moment of impact per ad shot, with sound tied to it; the end framing of the
  camera move must contain the final state; a product reference image before any multi-shot product work; generated
  audio comes out quiet, so normalize it in post. Four recipes in `references/prompt.md`, three checks and four
  diagnoses in `references/quality.md`, and the product-ad outline in `references/workflow.md`.
- READMEs: a "With and without the skill" section, with what was measured (18 automated sessions and one blind
  generated round). The round was a tie, and the blind human vote went to the version made without the skill.
- `models --import` accepts a single-model `get` response and merges it without removing other models.
- The 20 visual styles of the illustrated manual, with their descriptors, in `references/vocabulary.md`.
- Working modes (`references/modes.md`, `hfd.py preferences`). On first use in a project the skill asks whether the
  operator wants to approve every step (`follow`), see only the total price (`price`), or give a spending ceiling
  for the session in the conversation (`ceiling`). The preference file stores how to work, never how much to spend:
  `hfd.py` rejects any other field, and the cost protocol in `references/connector.md` covers the ceiling.
- Blind calibration with and without the skill (`references/calibration.md`). `scripts/calibrate_claude_code.sh` runs
  both conditions in fresh Claude Code sessions with generation blocked. `hfd.py blind` checks that both ask for the
  same format, draws X and Y and, separately, which one is shown first, and writes the key (mode 600) without showing
  it. `hfd.py result` turns the vote into an allowlisted record.
- `calibration/` with the first three records, `tools/aggregate_calibration.py`, and a calibration scoreboard in both
  READMEs. `tools/check_repo.py` checks every record against the allowlist and fails when the scoreboard is stale.
  CONTRIBUTING explains how to send a record.
- Storyboard before video in studio mode (`references/workflow.md`, `SKILL.md`): one still per shot, approved before
  any video is generated. Not yet measured blind.
- READMEs: the rematch after the fixes (2 rounds, 152 credits). The blind vote and the blind judge both chose the
  version with the skill in both rounds; the voter noted that it was also shown first both times.
- 21 tests.
- A price is never written in the repository. The templates carry no `test_cost` or `final_cost`, and the READMEs no
  table of quotes: prices change at any time, so the agent quotes each step with the connector and `budget` refuses a
  shot without a price.
- `hfd.py` warns when a resolution cannot be sent (the model has no resolution parameter, or is not in the snapshot)
  and when image mode drops `action`, `micro_action`, `secondary` or `final`; it stops on edit or extend with a model
  that has no such mode, on edit without a `target`, on an unknown score criterion, and on a calibration record whose
  date does not exist.
- Usage errors come out as JSON with exit 2, like every other error.
- 53 skill tests (one per mutant that lived through the suite, one per defect a review reproduced) and 10 tests of the
  public boundary, one per hole a review found.

### Changed

- The example references moved from `higgsfield-director/examples/references/` to `examples/references/`, at the
  root, where new users see them first. The skill points to them beside its own folder, or online.
- The skill's work is now the process, not a better prompt. After five blind rounds, where what the skill added to
  the prompts took away the naturalness the models give a plain request, the prompt is the request as asked: every
  fact and every limit, with no camera, lens, light, style or recipe the request did not ask for;
  `references/prompt.md` comes in only on request or to fix a defect a preview showed. Before each expensive step
  the skill shows a cheaper one (the plan in words, one still per shot, one test shot at the lowest resolution, then
  the rest), each quoted and approved, and after each generation it shows what it cost and the running total, in
  every mode. The first-use question asks only the working mode; a blind test runs only when the operator asks. The
  READMEs no longer report the blind rounds: their records and the scoreboard moved to `calibration/README.md`,
  which `tools/aggregate_calibration.py` now builds. A new behavior scenario, and scenario 13 no longer asks for a
  documentary register.
- Calibration: a fifth blind round, on two new requests (a bakery commercial, a fishing teaser), with
  `5.1.0+0f8bcfb`. The person chose the version without the skill in 2 of 2; in round 1 the blind vote was for the
  skill and changed after the key showed a shop sign with a name the request had ruled out. What changed because of
  it: the request's own limits (no text, no brand, nobody real) go into every image and video prompt in plain words,
  naming the surfaces that stay blank, with a behavior scenario. The other differences of the round (studio
  references with tidy clothes, an arrival the model skipped) are lessons only, not rules.
- Calibration: a fourth blind round ran the same two requests again with the fix below (`5.1.0+0717197`), with new
  videos on both sides. The person chose the version with the skill in 2 of 2 ("could pass for real footage"); the
  blind judge's score chose the other in both, so it is now a second opinion only. The READMEs' lead starts there.
- Calibration: a third blind round with the current skill (`5.1.0+7b60cfa`), on two request types not measured
  before (a fight scene, a corporate video). The person chose the version without the skill in 2 of 2; the blind
  judge chose the version with it in both. The READMEs' lead now says so. What changed because of it: a recipe
  against a defect goes in after the defect is seen, not into every prompt; a shot of 8 s or more is written in
  timed beats up to its end; each person in frame gets a line of their own, and a group bible holds only what the
  members share; a piece about real life keeps a documentary register and the place's own sound, without interface
  chimes or a line nobody asked for; the blind judge's score is a second opinion. Two new behavior scenarios.
- The READMEs' results start from where the skill stands: the latest blind rounds (2 of 2 with the skill) first; the
  first round kept as it came out, now with its skill version; and what changed since, which no blind round has
  measured yet. `references/calibration.md` says what is not a round (a video the voter has seen, one side only,
  post-production on one side). `references/models.md`: a Seedance 2.5 final made from a draft repeats the draft's
  motion and, in one run, kept its silence; new `lessons-learned/2026-11-own-runs.md`.
- Lessons from Higgsfield's official skills repository, checked against the connector's live catalog: the list of
  connector workflows (34, with `musical-cards`, `video-redub`, `playable` and `playable-ad`); `draw_to_video` for
  marking a change on a frame of the footage; the first citation form the connector's catalog writes (`@Audio 1`,
  Seed Audio only); the brief asks who appears; frozen frames found with `freezedetect`; uneven frames for a loop.
  The repository check fails on a references file that `SKILL.md` never cites. New `docs/behavior-scenarios.md`.
  The connector's `character-sheet` and `narration` workflows, read in full: how a sheet is built and approved, and
  the narration rules that hold for any recorded line; `get_preset_instructions` loads a workflow when loading it by
  name fails.
- Public/private boundary: production files stay in their own project; the repository check and CI reject personal
  directories, review pages, working media and machine-specific paths. Contributions use an updated topic branch
  and PR; direct pushes to `main` are forbidden, and only the maintainer merges through GitHub.
- `SKILL.md` no longer carries the repository's commit and pull-request rules: it is loaded in every project that
  uses the skill, and those rules serve only who changes this repository. They stay in `AGENTS.md`, `CLAUDE.md`,
  `CONTRIBUTING.md` and the pull-request template.
- **Breaking: everything in the repository is in English.** `SKILL.md`, the references, the docs, `hfd.py`
  (commands, options, JSON fields and values, messages), the templates, the tests, the tools and the calibration
  records now use English names, and the reference files, templates, data files, tools and the calibration folder were
  renamed. The skill still answers each person in their own language. `README.pt-BR.md` stays as the Portuguese
  translation of the README. The Portuguese commands, options and fields keep working for one version with a warning
  that names the new one, and will be removed in 7.0. Every old name and its new one is in `docs/MIGRATION-6.md`.
- `CONTRIBUTING.md` states the rule: files, file names, code, commits and pull requests in English; issues may be in
  English or Portuguese.
- Lessons from the twelve most-viewed tutorials on Higgsfield's YouTube channel, recorded in `lessons-learned/` with
  the video, the minute and where each one went: one face per reference sheet, a top-view layout map for positions,
  a new reference for a change of state, show instead of describe, named gestures, extras without clones, shot and
  reverse shot, the previous clip as a video reference, edits of the operator's own footage (`video_edit`), a 3D
  blocking render as a camera reference, coverage and attempts in the plan, and one short note per defect. A cut
  written on purpose inside a shot is allowed after a test; one camera movement per shot stays.
- A second batch from the channel (ten more tutorials), in `lessons-learned/2026-11-higgsfield-channel-2.md`: a
  continuous action written as one continuous motion, since timed beats made the model cut; Cinema Studio 3.5's
  multi-shot control and its defaults; start and end frames for a change inside a shot; any good frame as the next
  start; rewriting instead of piling up patches; no repeated description of a referenced subject; the camera anchored
  to the set; clean, three-quarter locations built for the action; one change per image edit; a face fixed on the
  sheet; a free check for duplicated frames. Five more are marked as things to test.
- Three example references in `higgsfield-director/examples/references/` (a character sheet, a location in two
  views, a set detail), with the prompts that made them, shown in both READMEs; the boundary check accepts still
  images in that folder.
- The second part of batch 3 of the channel's lessons (videos 36 to 43, and 19): a reference's line also says what
  it does not bring, with an override when the scene differs; the parameters that came back are compared with the
  plan; dialogue from recordings passed as audio references (to test); when to use a blocking render and how to frame
  it; what no reference shows, the model invents; a grabbed frame carries its take's defects; one sheet per state;
  where to split a long piece; a whip pan with a length (to test); the sheet's light. How references are cited on
  the website (`<<<image_1>>>`) and in the help center (`@Image 1`) is recorded, the connector's form not confirmed.
  Six new entries in `lessons-learned/tests/to-test.md`.
- A closer reproduction of the timed-beats lesson (Seedance 2.0, three references, the tutorial's prompt
  structure, 21:9, 15 s): 0 of 4 cut, 0 of 7 with the first test, so timed beats are one suspect among others.
  Cut detection gains a positive control and a spike measure, because scene detection missed a hard cut between
  two similar dark shots even at 0.15. A location reference covers every side the camera faces: a wall that no
  reference showed got an invented window in four of four attempts.
- A third batch of lessons from Higgsfield's channel, part 1 (videos 24 to 35), read for what the screen shows.
  Each reference now says what it brings and what stays out; a small critical detail goes in words even when the
  reference shows it (to test); approved sheets can become Elements (not on Seedance 2.5); layout maps carry
  distances and orientation; a defect that repeats in every attempt is looked for in the references first; filmed
  footage as a motion reference and a measure instead of an adjective (both to test); real footage edited in pieces
  of at least 4 s; locked parts in an image edit; Kling 3.0's per-shot mode exists on the website only. Six new
  entries in `lessons-learned/tests/to-test.md`.
- Reproduction cards in `lessons-learned/tests/`: what each testable lesson's source showed (model, mode, references,
  prompt structure, attempts), how to run the test, the difference from the original, and the result. The first test
  (timed beats, Seedance 2.5) did not reproduce the cut in a simpler form, so timed beats became the first suspect
  for an unwanted cut rather than a rule. A content-filter refusal now tells two cases apart: every attempt refused
  points to the text; one refusal among passes (one of two identical requests here, refunded) is retried once. Every source time in the lessons links to that second of the video. The boundary check accepts
  still frame sheets under `lessons-learned/tests/`.
- The unofficial status is now stated in more places: a notice and a badge at the top of both READMEs, a
  *Disclaimer* / *Aviso* section, a note in the quick start that the connector is Higgsfield's own, a line in
  `SKILL.md` telling the agent not to present itself as Higgsfield or its support, and notes in the illustrated
  manual, `agents/openai.yaml`, `hfd.py`, `CONTRIBUTING.md` and `SECURITY.md`.
- `AGENTS.md` and `CLAUDE.md` state the rule for every coding agent: every change goes through a pull request,
  nobody pushes to `main`, and the maintainer merges. `CONTRIBUTING.md` says the same.
- The flow has a cheap pre-production step before the storyboard: idea, script draft as a table, sketch storyboard,
  refinement, a script locked by the operator, and then the question of where to make the audio (the connector, a
  service the operator already uses, a recorded voice, a free local voice for drafts, or none).
- Work with a sketch storyboard, a storyboard or generated images keeps a local `review.html` that shows each
  frame, its cost and the decision on it, and is opened for the director after every update (step 9 of
  `SKILL.md`, a non-negotiable rule, and *Review page* in `references/preproduction.md`). The page lives in the
  operator's project folder, not in this repository.
- `references/quality.md`: unrequested cuts inside a shot were seen in 3 of 11 shots of 4 to 5 s on Cinema Studio
  4.0, near the 2 s mark, and the scene detector at 0.3 missed one cut, so also look at a contact sheet; new row for an
  accessory from the bible that disappears.
- The skill starts from the connector's live list of workflows (`get_workflow_instructions` with no argument). The
  table in `references/connector.md` is now an offline snapshot, updated with the workflows added since
  (`video-editing`, `katana`, `angles-hf`, `lighting-hf`, `grade-hf`, `narration`, `musical-cards`).
- `references/connector.md` states where the skill works: the connector has no workflow for multi-shot cinematic
  generation and sends it to ordinary generation, which the skill plans, checks and gates.
- In studio mode, the chosen model's live limits (`models_explore get`) go into the project's snapshot and are used
  for validation.
- `references/models.md` no longer stores prices: always quote.
- The tests and the offline workflow snapshot are dated 24/11/2026, Brasília time (they had been written as 25/11).
- The offline workflow table in `references/connector.md` is refreshed (34 workflows by 2026-11-25; adds
  `website-builder-flow`, `short-drama`, `shorts-studio`, `reel-effects`, `manga-engine`, `layer-reveal-hf`,
  `property-studio`, `autobadge`, `color-grade`), and it covers presets, desktop-app commands that install a local
  MCP server (operator approval first) and rented GPUs (billed while running).
- The READMEs now mark the local Codex workflow as tested: the skill tests, the public/private boundary tests, the
  repository check, project validation and 3-shot compilation passed there on 2026-11-25. Authenticated Higgsfield
  quoting and generation from Codex remain untested.
- The READMEs record two more routing rounds (14/14 each, 42/42 in total) and a text-only pilot with and without
  the skill.

### Fixed

- `compile` keeps the project subject when a shot's entity has no description, no longer turns audio on for an
  empty `sound` or dialogue line, and keeps the capitals of a first word such as iPhone or eBay.
- `blind` compares every format and price field the compiler sends (`quality`, `mode`, `sound` too), and refuses a
  round folder that already holds the key under its old name.
- Two camera moves joined by "and" warn as simultaneous, also when a later phase follows.
- The preferences file refuses a `calibrate` or `updated_at` that is not one of the allowed values, not only an
  unknown key.
- `budget` totals add up to the figures it shows (the total is the base plus the rounded reserve); `optics` computes
  the frame width with the same thin lens as the focus range; an import of one model keeps the snapshot's oldest
  date in its header.
- `python3 tests/test_hfd.py` run directly used to skip the 4 crop tests: `unittest.main()` sat in the middle of the
  file.
- The public boundary knows media by its first bytes (a video renamed `.jpg` or saved with no extension), refuses a
  symbolic link, follows git (an ignored `.DS_Store` no longer fails the check; a `node_modules` below the top is no
  longer skipped), reads every file's text and a binary file's metadata for machine paths, catches more forms of
  them, and catches project folders in Portuguese and inside longer names.
- `check_repo.py` checks the links and anchors of every published Markdown file (14 had been left out), reads more
  link forms and refuses a link that leaves the repository or differs in case; the language check reads more text
  files and no longer flags loanwords such as café.
- `scripts/calibrate_claude_code.sh` runs each session with `--permission-mode dontAsk` in its own new folder, lets
  the session with the skill run only the skill's helper, finds a user-wide install in more places, and exits 1 when
  a condition wrote no `params.json`.
- Docs that had drifted from the code: how a bible's description enters an image-to-video prompt, a fixed attribute
  versus `approved_changes`, `export` writing subtitles only when there is dialogue, where an import writes, the
  search for first-and-last-frame models, the v5.1.0 figures, the recipe count, and the old Portuguese file names
  still used as link labels.

## [5.1.0] — 2026-11-24

### Fixed

- `hfd.py` no longer crashes with a traceback and exit code 1 on malformed input. A type check now runs before the
  rules and reports the problem in `errors`, with exit code 1. Anything unexpected exits with code 2 and
  `{"error": ...}`; set `HFD_DEBUG=1` to see the traceback.
- `models --import` no longer writes inside the skill folder. It requires `--out`, accepts several lists at
  once, and removes models that left the catalog, reported as `removed`.
- `budget` rounds subtotals and the base to 2 decimals. It also warns when a shot's own `attempts` overrides
  `--attempts`.
- `export` gives each line of dialogue in a shot its own subtitle, split by word count. They used to share one
  time range.

### Added

- `--snapshot <file>` on `validate`, `compile`, `export` and `models`, to use another model snapshot.
- CI on GitHub Actions: the tests on Python 3.9 to 3.13, plus `tools/check_repo.py`, which checks the skill
  frontmatter as YAML, every JSON file, and the links and anchors of the Markdown files.
- 9 tests (50 in total). Each one fails on the previous code.
- CHANGELOG, CONTRIBUTING, SECURITY, and issue and pull request templates.

### Changed

- `SKILL.md` and `references/workflow.md` no longer name private skills. Other tools are described by what they do.
- The skill `description` is in English, and the skill replies in the operator's language. Prompts are still
  written in English; the body of `SKILL.md` and the references stay in Portuguese for now.
- The `description` names no private projects. It excludes 3D-rendered or code-animated video, editing recorded
  footage, videos built from HTML pages or slides, voice and music, and publishing.
- The manual's 185 images and the emblem are licensed under CC BY-SA 4.0 by the rights holder, the same license as
  the manual's text. The v4.1 package had marked them private.
- `docs/manual/visual/README.md` describes the 185 images. The v4.1 production notes are gone, and `external.json`
  and `protocol.md` were removed.

## [5.0.0] — 2026-11-24

Rewrite of the v4.1 RC3/RC4 package (generated in ChatGPT) for Claude Code and Codex.
Evaluation of the old package: [docs/RC3-EVALUATION.md](docs/RC3-EVALUATION.md).

- A lean skill: `SKILL.md` of 91 lines plus 6 references read on demand, replacing 328 files and 116 "commands".
- One `hfd.py` that uses only the Python standard library, replacing 3 compilers, 2 optics modules and 3 budget
  modules.
- Model limits come from a dated snapshot of 122 models taken from the connector's catalog, which can be refreshed.
- The camera check understands negation and phases, and it warns instead of blocking.
- Generation goes through the official Higgsfield MCP, only after the cost is shown and the operator says "ok".
- The trigger is tied to *AI-generated* video and to Higgsfield, with named exclusions.
- 41 tests with no dependencies; 4 planted defects, 4 caught.
- An illustrated manual: 11 parts, 185 schematic images.

## Earlier editions

Generated in ChatGPT and kept out of this repository.

| Version | Focus |
|---|---|
| v1.0 | cinema skill and prompt vocabulary |
| v2.0 – v2.1 | structured production, catalogs, quality rules, schematic references |
| v3.0 | cinematic intelligence, experiments, offline labs |
| v4.0 | master modules and illustrated manual |
| v4.1 RC1 – RC4 | packaging, hardening, public/private split, AAA illustrated README |

[5.1.0]: https://github.com/rniedson/higgsfield-director-pro-skill/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/rniedson/higgsfield-director-pro-skill/tree/v5.0.0
