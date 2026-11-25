# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Changed

- The unofficial status is now stated in more places: a notice and a badge at the top of both READMEs, a
  *Disclaimer* / *Aviso* section, a note in the quick start that the connector is Higgsfield's own, a line in
  `SKILL.md` telling the agent not to present itself as Higgsfield or its support, and notes in the illustrated
  manual, `agents/openai.yaml`, `hfd.py`, `CONTRIBUTING.md` and `SECURITY.md`.
- The skill starts from the connector's live list of workflows (`get_workflow_instructions` with no argument). The
  table in `references/conector.md` is now an offline snapshot, updated with the workflows added since
  (`video-editing`, `katana`, `angles-hf`, `lighting-hf`, `grade-hf`, `narration`, `music-cards`).
- `references/conector.md` states where the skill works: the connector has no workflow for multi-shot cinematic
  generation and sends it to ordinary generation, which the skill plans, checks and gates.
- In studio mode, the chosen model's live limits (`models_explore get`) go into the project's snapshot and are used
  for validation.
- `references/modelos.md` no longer stores prices: always quote.
- The tests and the offline workflow snapshot are dated 24/11/2026, Brasília time (they had been written as 25/11).
- The offline workflow table in `references/conector.md` is refreshed to 24/11/2026 (31 workflows: adds
  `website-builder-flow`, `short-drama`, `shorts-studio`, `reel-effects`, `manga-engine`, `layer-reveal-hf`,
  `property-studio`, `autobadge`, `color-grade`), and it covers presets, desktop-app commands that install a local
  MCP server (operator approval first) and rented GPUs (billed while running).
- The READMEs say the skill is tested in Claude Code; Codex reads the same format, but it is untested there.
- The READMEs record two more routing rounds (14/14 each, 42/42 in total) and a text-only pilot with and without
  the skill.

### Added

- Lessons from a 16-piece generated test, written as general rules: recipes for crowds, hands of two people, the
  final state, emotional gestures, official symbols and branded objects (`references/prompt.md`); a plausibility
  check before spending, two new diagnoses and three free checks after generation: speech by local transcription,
  loops by SSIM, and the model that actually ran (`references/qualidade.md`); the one-model, one-mode-per-project
  limit (`references/fluxo.md`).
- Lessons from a blind with/without comparison (6 generated shots, scored by a blind judge and voted on by a person
  who did not know which was which): one moment of impact per ad shot, with sound tied to it; the end framing of the
  camera move must contain the final state; a product reference image before any multi-shot product work; generated
  audio comes out quiet, so normalize it in post. Four recipes in `references/prompt.md`, three checks and four
  diagnoses in `references/qualidade.md`, and the product-ad outline in `references/fluxo.md`.
- READMEs: a "With and without the skill" section, with what was measured (18 automated sessions and one blind
  generated round). The round was a tie, and the blind human vote went to the version made without the skill.
- `modelos --importar` accepts a single-model `get` response and merges it without removing other models.
- The 20 visual styles of the illustrated manual, with their descriptors, in `references/vocabulario.md`.
- Working modes (`references/modos.md`, `hfd.py preferencias`). On first use in a project the skill asks whether the
  operator wants to approve every step (`acompanhar`), see only the total price (`preco`), or give a spending ceiling
  for the session in the conversation (`teto`). The preference file stores how to work, never how much to spend:
  `hfd.py` rejects any other field, and the cost protocol in `references/conector.md` covers the ceiling.
- Blind calibration with and without the skill (`references/calibracao.md`). `scripts/calibrar_claude_code.sh` runs
  both conditions in fresh Claude Code sessions with generation blocked. `hfd.py cego` checks that both ask for the
  same format, draws X and Y and, separately, which one is shown first, and writes the key (mode 600) without showing
  it. `hfd.py resultado` turns the vote into an allowlisted record.
- `calibracao/` with the first three records, `tools/agregar_calibracao.py`, and a calibration scoreboard in both
  READMEs. `tools/checar_repo.py` checks every record against the allowlist and fails when the scoreboard is stale.
  CONTRIBUTING explains how to send a record.
- Storyboard before video in studio mode (`references/fluxo.md`, `SKILL.md`): one still per shot, approved before
  any video is generated. Not yet measured blind.
- READMEs: the rematch after the fixes (2 rounds, 152 credits). The blind vote and the blind judge both chose the
  version with the skill in both rounds; the voter noted that it was also shown first both times.
- 21 tests (71 in total).

## [5.1.0] — 2026-11-24

### Fixed

- `hfd.py` no longer crashes with a traceback and exit code 1 on malformed input. A type check now runs before the
  rules and reports the problem in `erros`, with exit code 1. Anything unexpected exits with code 2 and
  `{"erro": ...}`; set `HFD_DEBUG=1` to see the traceback.
- `modelos --importar` no longer writes inside the skill folder. It requires `--saida`, accepts several lists at
  once, and removes models that left the catalog, reported as `removidos`.
- `orcamento` rounds subtotals and the base to 2 decimals. It also warns when a shot's own `tentativas` overrides
  `--tentativas`.
- `exportar` gives each line of dialogue in a shot its own subtitle, split by word count. They used to share one
  time range.

### Added

- `--retrato <file>` on `validar`, `compilar`, `exportar` and `modelos`, to use another model snapshot.
- CI on GitHub Actions: the tests on Python 3.9 to 3.13, plus `tools/checar_repo.py`, which checks the skill
  frontmatter as YAML, every JSON file, and the links and anchors of the Markdown files.
- 9 tests (50 in total). Each one fails on the previous code.
- CHANGELOG, CONTRIBUTING, SECURITY, and issue and pull request templates.

### Changed

- `SKILL.md` and `references/fluxo.md` no longer name private skills. Other tools are described by what they do.
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
Evaluation of the old package: [docs/AVALIACAO-RC3.md](docs/AVALIACAO-RC3.md).

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
