# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

Nothing yet.

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
