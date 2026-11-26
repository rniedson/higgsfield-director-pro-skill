# Production workflow

## 1. Brief (ask only what blocks; the rest becomes a stated assumption)

Goal and audience · format and destination (aspect ratio) · total duration · subject and what must not change in it ·
who appears (the operator, another person whose consent the operator declares, or a generated character; never
chosen silently) · references the operator has (and the right to use them) · tone and intent · audio (generated, post or none) ·
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
| Dialogue or several people | establishing wide shot first, to fix who stands where; one background anchor per person (the window behind A, the shelf behind B); a reference of the set from both sides for shot and reverse shot; a layout map (§4) when they move |
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
- A bible for a group (a class, a team, a crowd) holds only what the members share: the uniform, the age range, how
  many. Each member seen in a close or medium shot is described on their own, in the shot's action or in a bible of
  their own. One line for the whole group made three boys with one face in a blind round (`references/prompt.md` §1).
- `fixed` are invariants; `validate` flags a state that contradicts the bible.
- Each shot can record `start` and `end` per entity; `validate` compares the end of one with the start of the next.
  A deliberate change goes in `approved_changes: ["P01.position"]`.
- To chain shots, generate shot N, extract the last frame (or any good frame, cutting the clip there) and use it as
  the `start_image` of N+1.
- **Examples** of a character sheet, a location in two views and a set detail, with the prompts that made them,
  are in `examples/references/`; show them when the operator asks what a reference should look like.
- **One face per reference sheet.** A character sheet carries one face close-up; the other panels (full body, front
  and back) are cropped from the neck down, so the model has a single face to read. Neutral mid-grey background, soft
  even light, no strong highlights. With several faces on the sheet, the model picks one and drifts. (Higgsfield YouTube tutorials, 2026.)
  The sheet's light travels into every shot: one tutorial picked the sheet with no hard shadow on the face and no
  glare on the hair.
- **A face that drifts from the approved one is fixed on the sheet:** edit the face panel with the character's
  approved face and keep the body panels from the neck down, instead of rewriting the prompt. A real person's face
  only with the consent the operator declares; swapping faces with another tool is outside this skill. Another way:
  fit the approved head onto a body from another batch in an image edit (`Fit the head from IMAGE 1 onto the body
  from IMAGE 2`, matching scale, neck, perspective, skin tone and light); an outfit goes on the same way, the outfit
  and the sheet as two references (two tutorials, shown on screen).
- **The connector's `character-sheet` workflow** (v2.0, read 2026-11-25) builds a live-action character in three
  pictures and stops for approval after each: a face with no reference, an outfit flat-lay, then a three-panel sheet
  (front, back, and the portrait in the right panel) with the face and the outfit attached, in that order. It fixes
  the models: faces `soul_2` (Realism, 90s, Coming of Age), Realism sheets `gpt_image_2_6` (16:9, 2K), the rest
  `seedream_5_5`. It keeps one face per sheet too: a sheet with a face in another panel is made again once. A look
  whose face changes (an injury, another age) starts from an edit of the approved face. For the same person at
  another age it keeps the base's origin, skin tone, hair colour and texture and eye colour, each written as "as in
  the base look", and leaves out the base's age, clothes and role. Inside a production planned here, the workflow
  makes only the sheet; the bible keeps the description it approved, word for word.
- **A change of state is a new reference.** When a character or product changes on purpose (wet, sweaty, torn
  clothes, a dent, the same person as a child), generate and approve a reference in the new state and use it from
  that shot on, together with `approved_changes`; note which shots each state covers. Written only in the prompt, the change tends to snap back. Images are cheap; video is not. A
  change planned for the middle of a scene (he takes off a moustache) may work better as a removable prop in the
  reference (one tutorial; to test).
- **Positions: a layout map.** When several people or objects must keep their places or their count, generate a
  top-view map first: flat silhouettes with no faces, one muted color per person, the fixed anchors of the set (a
  table, a door, a tree) and the positions in plain words or as percentages of the frame. Pass it as an image
  reference and name the same colors in the prompt. The map fixes where they are; the text says how they move. When
  the positions change from shot to shot, draw one map or rough sketch per shot and pass it as that shot's reference.
  Give the distances that matter and the orientation (a street's width and the gap between two marks in metres, a
  compass, where the camera starts): in one tutorial, without such an anchor, a goal moved at every generation.
- **The location is built for the action.** A three-quarter view of the place (a frontal view leaves the model
  guessing the rest of the room), free space where the action happens and the clutter at the sides, and a crowd that
  belongs in the scene already in the location image. Fix the place and the angle before adding the people. Before
  any video, clean the location image: remove text, background cars and whatever the model tends to multiply.
  Cover every side the camera will face: in a test here, the camera turned toward a wall that no reference showed
  from that side, and the model added a second window there in four of four attempts (2026-11-25). The same holds
  for every part the shot reveals: what no reference shows, the model invents (the hair under a helmet that comes
  off, in one tutorial). A prop whose shape is hard to read (a blade that is part of the hand) gets its own sheet,
  outside and inside, or the model gives it the usual shape; an empty vehicle filled with invented people until the
  characters were in the references.
- **One change per image edit**, everything else kept: the product's name, an object removed. Many people in one
  image break the faces: generate them one at a time and assemble the picture in an image editor.
- **An approved sheet can become an Element.** The connector's `elements_create` saves it under a name; a prompt
  calls it with `<<<element_id>>>` and the server inserts the image. Only completed Elements work, and only on the
  models `elements_search` lists (2026-11-25: Seedance 2.0, Cinema Studio Video 2 and 3.0, Kling 3.0 with a start
  image; **not Seedance 2.5**). The tutorials save every sheet this way and call it by its `@` name on the website.
  Creating one writes to the operator's library: ask first.

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

The cost counts the expected attempts per shot (`attempts`): an ad is often cut from the best part of several takes,
and a quote prices one take.

## 8. After generation

Editing, music, voice and subtitles belong to other tools: an audio skill or tool for voice and music, a local video
editor, or the connector's `video-montage` workflow. Tell the operator where each generated file is.

A shot found missing in the edit is generated later with the same bibles, references and light. Listing the
cutaways and B-roll in the script draft (`references/preproduction.md`) avoids most of these.
