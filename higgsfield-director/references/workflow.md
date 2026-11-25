# Production workflow

## 1. Brief (ask only what blocks; the rest becomes a stated assumption)

Goal and audience · format and destination (aspect ratio) · total duration · subject and what must not change in it ·
references the operator has (and the right to use them) · tone and intent · audio (generated, post or none) ·
budget in credits · preferred model (if any).

## 2. Mode

- **Quick** (one shot, one image, reviewing a prompt): no project.json. Write the prompt following
  `references/prompt.md`, check the limits in the catalog and deliver.
- **Studio** (2+ shots, a character/product that repeats, campaign, budget): build the project from
  `templates/project.json` (or `templates/i2v.json`), validate and compile with `scripts/hfd.py`.

## 3. Structure by format

| Format | Skeleton |
|---|---|
| Product commercial | reference image of the product (the client's, or one generated and approved first) → detail/material with one moment of impact → demonstration or benefit → hero frame (whole product, centered, readable label); text and CTA in post |
| Trailer | premise → escalation → title (in post) |
| Music video | beat map supplied by the operator; shots cut on the beat; music rights are not assumed |
| Documentary | observation → context → verifiable fact; available light, few cuts |
| Narrative scene | establishing → action → reaction; 180° axis respected |
| Loop | last frame = first frame (pose, camera, light, speed) |
| Campaign | same bibles; vary **one** dimension per piece |

## 4. Bibles and continuity

Each character, product, place or brand that repeats gets a bible in `bibles`:

```json
"P01": {"type": "product", "description": "A black glass perfume bottle with a faceted gold cap...",
        "fixed": {"color": "black", "cap": "gold"}, "variable": {"position": "can change"}}
```

- `description` is copied **verbatim** at the start of the prompt of every shot that lists the entity in `entities`:
  the same sentence in all of them is what best holds identity across generations.
- `fixed` are invariants; `validate` flags a state that contradicts the bible.
- Each shot can record `start` and `end` per entity; `validate` compares the end of one with the start of the next.
  A deliberate change goes in `approved_changes: ["P01.position"]`.
- To chain shots, generate shot N, extract the last frame and use it as the `start_image` of N+1.

**Pre-production before the storyboard.** While the idea is still changing, work on the block sketch storyboard and
the script draft (`references/preproduction.md`); the storyboard below comes after the official script.

**Storyboard before video (studio mode).** Before generating any shot as video, generate one image frame per shot,
with the same bibles and references, and show the sheet with each shot's timing, action, camera and sound written
underneath. The image costs a fraction of the video and shows early what gets rejected most often: a swapped product,
a swapped face, framing that cuts off the final state. The approved frame becomes the start image (`start_image`) or
the shot's reference. The sheet approves the **look**; motion, action, emotion and sound are approved only in the
video test. In `follow` mode, the operator sees and approves each frame (`references/modes.md`).

## 5. The project (fields `hfd.py` understands)

| Level | Field | What it is |
|---|---|---|
| project | `title`, `model` (catalog id), `mode` (`t2v`, `i2v`, `edit`, `extend`, `image`), `aspect_ratio`, `resolution` | global choices |
| project | `bibles`, `constraints` (positive sentences), `references`, `preserve` (i2v), `target` (edit), `axis` [[x,y],[x,y]] | continuity |
| shot | `id`, `duration` (s), `entities` or `subject`, `setting`, `action`, `micro_action`, `framing`, `camera`, `optics`, `lighting`, `aesthetic`, `atmosphere`, `secondary`, `final` | the prompt, in this order |
| shot | `sound`, `dialogue` [{`speaker`, `language`, `text`}] | audio block |
| shot | `start`, `end`, `approved_changes`, `camera_xy`, `motivated_crossing`, `timeline` [{`track`,`from`,`to`}] | checks |
| shot | `test_cost`, `final_cost`, `attempts` | budget (price taken from the connector's estimate) |

Current limit: **one model and one mode per project**. Shots in different models or modes (one text-to-video,
another from an image, another in Kling) go in separate project files.

## 6. Commands

```bash
S=<skill-folder>
python3 $S/scripts/hfd.py validate project.json         # errors (exit 1) and warnings
python3 $S/scripts/hfd.py compile project.json --text   # prompts + parameters ready for the connector
python3 $S/scripts/hfd.py budget project.json --reserve 20
python3 $S/scripts/hfd.py export project.json out/      # script.md, shots.csv, subtitles.srt
python3 $S/scripts/hfd.py optics 85 2 1.8               # field of view and focus range
```

The commands read and write only the files given; work in the operator's project folder, never inside the skill
folder.

## 7. Delivery

**Direction** (intent and approach, 2–4 lines) · **Assumptions** · **Model and parameters** (with the date/source of
the limits) · **Prompt(s)** in a copyable block · **Shot plan** (studio) · **Cost** (studio, or whenever generating) ·
**Risks and next test**. Simple request: only the prompt, parameters and one risk.

## 8. After generation

Editing, music, voice and subtitles belong to other tools: an audio skill or tool for voice and music, a local video
editor, or the connector's `video-montage` workflow. Tell the operator where each generated file is.
