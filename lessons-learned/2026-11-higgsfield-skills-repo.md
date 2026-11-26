# Lessons from Higgsfield's official skills repository

Read on 2026-11-25: [github.com/higgsfield-ai/skills](https://github.com/higgsfield-ai/skills), version 0.14.0
(commit `2700040`, 2026-11-05), MIT license.
- **What it holds:** nine skills (generate, soul-id, product-photoshoot, brandkit, marketplace-cards, websites,
  faceless-video, video-explainer, youtube-thumbnail), their scripts and a set of behavior scenarios.
- **How it was read:**
  - four readers covered the faceless-video, websites, brandkit, thumbnail and soul-id skills;
  - `higgsfield-generate` and the repository's top level were read here;
  - every line cited below was opened here;
  - the catalog claims were checked in the connector's live catalog, at no cost;
  - the connector's own `character-sheet` (2.0) and `narration` (1.1) workflows were read in full, for comparison.
- **Nothing from the repository was run or installed.**

## What it is

- **It drives a different tool.** The skills drive Higgsfield's command-line tool, not the connector this skill
  uses. The connector ships its own versions of the same formats as ready-made workflows, several of them newer than
  the repository:
  - `faceless-video` 2.4;
  - `character-sheet` 2.0;
  - `narration` 1.1;
  - `thumbnail-generation` 1.3.

  For this skill, the live connector is the source.
- **Nothing in it is measured.** Its own `CLAUDE.md` keeps a "Key Decisions (Do Not Revisit Without Data)" section
  that is empty, and calls its defaults conventional rather than empirical. The script tests use synthetic signals.
  The thresholds (words per block, −34 dB, a seam ratio of 1.3) are stated, not shown. It weighs as vendor practice,
  like the channel's tutorials.
- **Its catalog facts do not carry over to the connector.** Three examples, checked 2026-11-25:
  - the repository says the id `nano_banana_2` resolves to Nano Banana Pro; in the connector, `nano_banana_2` is a
    separate model named Nano Banana 2, with a mask role;
  - `nano_banana_flash` does not exist in the connector;
  - the repository says Seedance 2.5 tops out at 1080p; the connector lists `4k`.

  A fact read there is a lead to check, not a fact.

## Adopted

| # | Lesson | Source | Evidence | Strength | Where it went |
|---|---|---|---|---|---|
| 1 | The connector's list of workflows changed: `music-cards` is now `musical-cards`, and `video-redub`, `playable` and `playable-ad` are new (34 in all) | `get_workflow_instructions`, 2026-11-25 | live catalog | high | `references/connector.md` |
| 2 | Marking the change on a frame of the footage exists in the connector as its own model, `draw_to_video`: the source video, exactly one sketched image, an optional style reference; no timestamp parameter, which the command-line workflow has | `higgsfield-generate/references/workflows.md`; `models_explore`, 2026-11-25 | live catalog; not run here | medium-high | `references/prompt.md` §2, Edit real footage |
| 3 | The connector's catalog writes a citation form for the first time: Seed Audio's audio references are `@Audio 1`, `@Audio 2`, `@Audio 3` in the prompt. For Seedance it still says nothing | `models_explore get seed_audio`, 2026-11-25 | live catalog | medium | `references/prompt.md` §4; [tests/to-test.md](tests/to-test.md) |
| 4 | The brief asks who appears: the operator, another person whose consent the operator declares, or a generated character; never chosen silently | `higgsfield-youtube-thumbnail/SKILL.md`, line 46 | stated | medium-high | `references/workflow.md` §1 |
| 5 | A generated clip can start or end on a still frame: `freezedetect` finds it | `higgsfield-faceless-video/scripts/trim_static_head.sh` (trims a still head by frame differences) | measured here on synthetic clips: a still head of 1.04 s found, a moving clip gave nothing | medium | `references/quality.md`, Look at the result |
| 6 | A motion that repeats is sampled at uneven fractions of its period: frames taken at a step that divides the period land on the same phase and look identical | `higgsfield-websites/references/game-procedural-animation.md`, lines 73–77 | stated; sound reasoning | medium | `references/quality.md`, Loop |
| 7 | A references file that `SKILL.md` never cites is never loaded: the repository check now fails on it | the repository's CI (`validate-skills.yml`, orphan check) | — | low-medium | `tools/check_repo.py` |
| 8 | Behavior scenarios: one request, what the skill must do, and pass, partial or fail, run in a fresh session | `evals/scenarios.md` there (no runner there either) | — | medium | [docs/behavior-scenarios.md](../docs/behavior-scenarios.md) |
| 9 | The connector's `character-sheet` workflow: face, outfit flat-lay, then a three-panel sheet, with approval after each; one face per sheet; the same person at another age keeps the base's identity fields | `get_preset_instructions /character-sheet`, 2026-11-25 | the vendor's workflow, stated | medium-high | `references/workflow.md` §4 |
| 10 | The connector's `narration` workflow: 20 to 23 words per 10 s, a take above 2.9 words per second fails; rewrite, never stretch; keep the takes that passed; one voice, from a file; 2048 characters per prompt | `get_preset_instructions /narration`, 2026-11-25 | the vendor's workflow, stated | medium | `references/prompt.md`, audio |
| 11 | When `get_workflow_instructions` fails by name, `get_preset_instructions` with `/<name>` loads the workflow and lists its files | the calls made here, 2026-11-25 | measured here, two workflows | medium | `references/connector.md` |

## Confirmations

These were already in the skill:
- an image edit says only what changes;
- say what should appear, not what should not;
- check the live catalog before trusting a model's limits;
- the `adjustments` that come back with a submission;
- text and logos in post;
- one face per reference sheet;
- each reference says what it brings and what stays out;
- approval is never read from silence;
- a description that says when to use the skill and when not to, within 1024 characters;
- about 2.5 words per second of speech: the connector's `narration` workflow fits 20 to 23 words into 7.8 to 9.5 s
  of speech, 2.1 to 2.9 per second. (The 20 to 23 words count the whole 10 s block, pauses included; read as words
  per second of the block they look like 2.0 to 2.3, which is not a different rate.)

The repository is weaker on one point: its Soul ID skill trains a face model from photos without asking whose face
it is. This skill keeps its rule: a real person's face or voice only with the consent the operator declares.

## Not adopted

- **"Do not pre-estimate cost"** (`higgsfield-generate/SKILL.md`, UX rule 5), and a test image generated at install
  time without a quote. This skill always quotes and waits for an explicit "ok".
- **"Keep prompts under ~200 tokens"** (`prompt-engineering.md`): not measured. This skill copies each entity's
  description verbatim into every prompt, which is what holds identity.
- **The repository's default models**, and Virality Predictor as a score. Virality Predictor is the vendor's
  attention proxy, never validated, and in the connector it is a tool, not a model.
- **Installing the command-line tool** (`curl | sh`): outside this skill, and the operator's decision.

## Still open

- **Soul Location** (`soul_location`) for the first image of a place: text only in the connector, so it takes no
  layout map and no approved reference. To test.
- **Seed Audio as the source of recorded dialogue** (batch 3, lesson 16), against Eleven v4. It has speech rate,
  pitch, preset voices and voice Elements; the connector's `narration` workflow already uses it for one continuous
  read. To test.
