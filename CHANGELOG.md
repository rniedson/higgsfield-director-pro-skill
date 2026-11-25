# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Changed

- **Breaking: everything in the repository is in English.** `SKILL.md`, the references, the docs, `hfd.py`
  (commands, options, JSON fields and values, messages), the templates, the tests, the tools and the calibration
  records now use English names, and the reference files, templates, data files, tools and the calibration folder were
  renamed. The skill still answers each person in their own language. `README.pt-BR.md` stays as the Portuguese
  translation of the README. The Portuguese commands, options and fields keep working for one version with a warning
  that names the new one, and will be removed in 7.0. Every old name and its new one is in `docs/MIGRATION-6.md`.
- `CONTRIBUTING.md` states the rule: files, file names, code, commits and pull requests in English; issues may be in
  English or Portuguese.
- The flow has a cheap pre-production step before the storyboard: idea, script draft as a table, sketch storyboard,
  refinement, a script locked by the operator, and then the question of where to make the audio (the connector, a
  service the operator already uses, a recorded voice, a free local voice for drafts, or none).
- `references/quality.md`: unrequested cuts inside a shot were seen in 3 of 11 shots of 4 to 5 s on Cinema Studio
  4.0, near the 2 s mark, and the scene detector at 0.3 missed one cut, so also look at a contact sheet; new row for an
  accessory from the bible that disappears.
- The skill starts from the connector's live list of workflows (`get_workflow_instructions` with no argument). The
  table in `references/connector.md` is now an offline snapshot, updated with the workflows added since
  (`video-editing`, `katana`, `angles-hf`, `lighting-hf`, `grade-hf`, `narration`, `music-cards`).
- `references/connector.md` states where the skill works: the connector has no workflow for multi-shot cinematic
  generation and sends it to ordinary generation, which the skill plans, checks and gates.
- In studio mode, the chosen model's live limits (`models_explore get`) go into the project's snapshot and are used
  for validation.
- `references/models.md` no longer stores prices: always quote.
- The tests and the offline workflow snapshot are dated 24/11/2026, Brasília time (they had been written as 25/11).
- The offline workflow table in `references/connector.md` is refreshed to 24/11/2026 (31 workflows: adds
  `website-builder-flow`, `short-drama`, `shorts-studio`, `reel-effects`, `manga-engine`, `layer-reveal-hf`,
  `property-studio`, `autobadge`, `color-grade`), and it covers presets, desktop-app commands that install a local
  MCP server (operator approval first) and rented GPUs (billed while running).
- The READMEs say the skill is tested in Claude Code; Codex reads the same format, but it is untested there.
- The READMEs record two more routing rounds (14/14 each, 42/42 in total) and a text-only pilot with and without
  the skill.

### Added

- `references/preproduction.md`: the sketch storyboard in two phases, tested once. Phase A draws every shot in one
  sheet with the cheapest image model (same drawing inside the sheet, but count and order are not obeyed); phase B
  crops each panel and uses it as the reference for its own frame in a cheap model that accepts references (same
  figures in every frame, each frame redone alone). Drawing rules: block figures, a face only when the expression
  matters, one identifying trait and the same shape description in every frame, stated scale, only who is in the
  frame, no numbers in the prompt, camera notes on the sheet instead of the prompt. Token-saving rules for the phase.
  The displayed quote can be rounded; the charge was `credits_exact`.
- `hfd.py crop <sheet> <folder> name:x0,y0,x1,y1 ...` writes the ffmpeg commands that crop a sketch sheet into
  frames, from boxes noted while looking at the sheet; it runs nothing and never overwrites. 4 new tests (75 in total).
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
- `calibracao/` with the first three records, `tools/aggregate_calibration.py`, and a calibration scoreboard in both
  READMEs. `tools/check_repo.py` checks every record against the allowlist and fails when the scoreboard is stale.
  CONTRIBUTING explains how to send a record.
- Storyboard before video in studio mode (`references/workflow.md`, `SKILL.md`): one still per shot, approved before
  any video is generated. Not yet measured blind.
- READMEs: the rematch after the fixes (2 rounds, 152 credits). The blind vote and the blind judge both chose the
  version with the skill in both rounds; the voter noted that it was also shown first both times.
- 21 tests (71 in total).

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
