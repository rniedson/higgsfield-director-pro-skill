# Quality: before and after generating

## Before spending (checklist)

- [ ] The format is not a ready-made connector workflow (`references/connector.md`).
- [ ] Model confirmed in the live catalog; duration, aspect ratio, resolution and audio within the limits.
- [ ] `hfd.py validate` with no errors; warnings read and accepted or resolved.
- [ ] Each shot has **one** dominant action and **one** main movement (or explicit phases).
- [ ] **Does the scene happen like this in real life?** Someone who knows the subject confirms it. The score measures
      whether the video obeyed the prompt, not whether the scene is plausible: a test scored 80 showed a scene that
      people in the trade have never seen.
- [ ] The final state matches the action (does not undo it).
- [ ] The framing where the camera movement ends contains the final state: a push-in to a close-up does not end with
      the whole product in frame.
- [ ] A product that appears in more than one shot has a reference image: the client's, or one generated and approved
      beforehand.
- [ ] A character sheet has one face; a scene with several people, or a count that matters, has a layout map
      (`references/workflow.md` §4).
- [ ] In an ad, each shot has a moment of impact (an action on the product, with sound tied to it), not just a camera
      movement.
- [ ] The speech fits the duration; the speaker is labeled.
- [ ] No loose negative instruction ("no X") where the positive can be said.
- [ ] Uploaded references belong to the operator or are authorized; a real person only with consent.
- [ ] Cost estimated by the connector and an explicit "ok" from the operator with the total.

## Diagnosis (symptom → hypothesis → change → how to check)

| Symptom | Likely hypothesis | Change (one thing) | Check |
|---|---|---|---|
| Face changes between frames | weak reference, large rotation, a reference sheet with several faces | lock the reference (one face per sheet, the other panels from the neck down; or edit the face panel with the approved face, `references/workflow.md` §4), reduce the orbit, shorten | compare the face at the start and at the end |
| Deformed hands/fingers | simultaneous gestures, hand in the foreground | a single gesture, hand smaller in frame | frame by frame on the hand |
| Sliding feet | walk with no contact described | "each planted foot stays fixed until lifted"; simple path | contact with the ground |
| Erratic camera | two movements, or none defined | one movement, constant speed | path from start to end |
| Deformed product / label melts | occlusion, fast orbit, small text | slower orbit, less occlusion, text in post | label readable in every frame |
| Unreadable text | models render text poorly | text and logo in post; for images, `nano_banana_pro`/`ideogram` | human reading |
| Light flicker | lighting not locked | "constant key light and exposure throughout" | luminance over time |
| Odd physics (liquid, fabric) | force and material not described | direction of the force, material, delay | motion consistent with the weight |
| Poor lip sync | long line, face moving a lot | shorter line, less head movement | mouth on the stressed syllables |
| Loop with a jump | different ends | align pose, camera, light and speed | first × last frame |
| Ignores the request | prompt too long or contradictory, or patched many times | shorten; remove what conflicts; after many patches, rewrite it whole from the approved plan | does each requested element appear? |
| Static camera when the prompt asks for movement | the model rewrites the prompt (Cinema Studio 4.0 has automatic direction) | test the same shot in another model; in one test, Kling 3.0 did the tracking move that Cinema Studio ignored (one sample) | path from start to end |
| Invented symbol or flag | a "film still" model draws from memory | reference with the real symbol; switch models | compare with the original |
| Product changes between shots | text only; detail shot without a feature that identifies the product | product reference image in every shot | compare the product shot by shot |
| Product cropped in the final frame | the movement ends on a tighter framing than the final state needs | make the movement end on a shot that contains the final state | last frame |
| Cuts inside a shot that nobody asked for | the model edited several shots together on its own (Cinema Studio 4.0: 3 of 11 shots of 4 to 5 s in one test, around the 2 s mark); the prompt split the action into beats, timed or as separate paragraphs (Seedance 2.0, one tutorial, despite a "no cuts" line; not reproduced here in 7 attempts, on Seedance 2.5 and on 2.0 with the tutorial's prompt structure) | one continuous shot with a single movement, the action written as one continuous motion; "Single continuous shot" | scene change frame by frame (`ffmpeg -vf "select='gt(scene,0.3)',showinfo"`); the 0.3 threshold missed a cut to a similar shot, and 0.15 missed a hard cut between two similar dark shots in a control, so also divide each frame's difference from the previous one by the median of its neighbours' (an isolated spike is a cut: ×7.8 in that control, at most ×3.4 in seven uncut 15 s and 9 s shots) and look at a sheet of frames every 0.5 s; before trusting a "no cut", check that the measure finds a cut made on purpose |
| An accessory from the bible disappears (hat, glasses) | hypothesis: in a wide shot the accessory is small and the opening frame weighs more than the bible (one sample) | the accessory visible in the approved storyboard frame; a tighter shot when it matters | compare with the bible, frame by frame |
| People or objects swap places, or their count changes | positions given only in the text | a top-view layout map as a reference, with the same colors named in the prompt (`references/workflow.md` §4) | count and positions in each frame |
| Geometry changes between attempts (where something lands, its scale) | words do not fix the geometry | an annotated image as a reference: arrows, marks, positions | compare the attempts frame by frame |
| A reference comes back as a still picture filling the screen | its role is not written, or nothing anchors it | write what it brings and that it is a reference, not the first frame (`references/prompt.md` §1); for a place, a layout map | the first second of each attempt |
| Something no reference shows is invented (a second window, hair under a helmet) | the camera turned to a side, or the shot revealed a part, that no reference covers | a reference for that side or part (`references/workflow.md` §4) | the frames after the turn or the reveal |
| A changed state snaps back (torn clothes mend, wet hair dries) | the change is only in the text | a new approved reference in the new state | the state in every frame after the change |
| Background objects multiply (cars, booths, signs) | clutter in the location image | clean the location image before the video (`references/workflow.md` §4) | count the objects at the start and at the end |
| Faces break in an image with many people | too many people in one generation | one person per generation, assembled in an image editor | each face against its sheet |
| Music comes in although the prompt says "No music" | the text is only a request | `generate_audio` off when no sound is needed; otherwise listen and choose | listen |
| Choppy motion | duplicated frames in the output | count them before editing (below); none of the four models checked on 2026-11-25 (Seedance 2.5, Cinema Studio 4.0 and 3.5, Kling 3.0) has a frame-rate parameter | number of duplicated frames |
| Generation refused by the content filter (status `nsfw`) | every attempt refused (eight of eight in one tutorial): the text, such as a kiss described in a bed or wet clothes clinging to the body; one refusal among passes (one of two identical, neutral requests here): not the text | all refused: rewrite the text, describe less of what a reference already shows, keep the images; one refused: check the refund in the transactions and, with the operator's ok, retry once unchanged | the job's status and the transactions |
| Extras look like clones | the reference shows one person, or one line of text describes the whole group (three boys with one face in a blind round) | a group reference with different people; without a reference, a line per visible person with their own age, hair, build and action (`references/prompt.md` §1) | the extras' faces |
| A generated reference image looks flat | the image model | the same prompt in another image model; compare (one sample) | depth and shadows |
| Correct but lukewarm shot | only camera and setting, nothing happens | one moment of impact per shot, with sound tied to it | blind vote against an alternative version |
| The action ends early and the shot holds still | the action was written for less time than the clip: one continuous motion and a described final frame (a 10 s fight over at about 6.5 s, one blind round) | timed beats up to the clip's end, with the final state in the last beat (`references/prompt.md` §1) | motion in the last third of the shot |
| Clean but artificial, "looks made with AI" | recipes against defects in every prompt as prevention (constant light and exposure, a camera at constant speed), posed people, interface sounds (one blind round, both request types) | keep only the recipes for a defect seen; the atmosphere the place would have; people acting among themselves; the place's own sound (`references/prompt.md` §1 and §3) | blind vote against an alternative version |

Two failures in a row on the same shot: **replan** (another framing, another model, a shorter shot) instead of
piling up constraints. A hypothesis is not a cause: record what changed and what happened. When every attempt fails
the same way, look upstream first: a reference can carry the defect (in one tutorial, the car's reference had the
steering wheel on the wrong side; in another, a frame grabbed from a good take for its framing had lost the
character's headphones, and every new take lost them too until they were painted back), so fix the reference before
rewriting the prompt, and check a grabbed frame against the sheet before it becomes a reference; when the shot is nearly right, more attempts of the same prompt may be enough.

Give each defect one short, concrete note (where it is, and how it should look or move) and regenerate only the shot
it affects. Before paying for another attempt, look for a usable piece: one or two seconds of a failed generation
may be enough for the edit. Notes pile up: after several patches, rewrite the prompt whole from the approved plan, and generate an
image anew instead of editing it again.

A cut written on purpose is allowed after a test, on a model with a multi-shot control (2026-11-25 catalog: Cinema
Studio 3.5, `multi_shot_mode: "custom"` with each shot's prompt and duration in `multi_prompt`). Its `auto` mode, in
which the model plans the cuts, serves to explore angles, with a quote; there the cuts are expected. Only a cut nobody
asked for is a defect.

## Look at the result

Do not score a video you have not seen. To look at a generated video, extract frames from the **start, middle and end
of each shot** (a single frame from the middle hides defects at the entry and at the exit):

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4
ffmpeg -v error -ss 0.2 -i video.mp4 -frames:v 1 frame_start.jpg
ffmpeg -v error -ss <middle> -i video.mp4 -frames:v 1 frame_middle.jpg
ffmpeg -v error -sseof -0.2 -i video.mp4 -frames:v 1 frame_end.jpg
```


Checks that spend no credits:

- **Speech:** transcribe the audio locally and compare it with the requested speech
  (`ffmpeg -i video.mp4 -vn -ac 1 -ar 16000 a.wav` and `whisper a.wav --language pt --model small`). The video model
  generated the speech; Whisper only checks it.
- **Loop:** compare the first and the last frame (`ffmpeg -i frame_start.png -i frame_end.png -lavfi ssim -f null -`).
  In a test with the same image as the first and the last frame, SSIM came out at 0.97 and a jump was still visible
  at the wrap: plan a short dissolve in the edit. For a motion that repeats, take the frames at uneven fractions of
  its period (0, 0.23, 0.41, 0.68, 0.87): frames taken at a step that divides the period land on the same phase and
  look identical, so a working loop looks stuck.
- **Frozen frames:** a generated clip can start or end on a still frame.
  `ffmpeg -i video.mp4 -vf freezedetect=n=0.003:d=0.5 -map 0:v -f null - 2>&1 | grep freeze_` lists each still
  stretch; one that lasts to the end prints only `freeze_start`. On synthetic clips here, a still first second came
  out as 0 to 1.04 s, and a clip that kept moving printed nothing.
- **Duplicated frames:** when the motion looks choppy, count them before editing:
  `ffmpeg -i video.mp4 -vf mpdecimate -loglevel debug -f null - 2>&1 | grep -c ' drop '`. In a synthetic test, a
  clean 96-frame clip gave 0 and a 12 fps clip doubled to 24 fps gave 48.
- **Model that ran:** check the `model` field of `jobs_wait`. In one test, a request for `nano_banana_pro` came back
  as `nano_banana_2`. In the connector these are two models (2026-11-25), even though a command-line catalog calls
  `nano_banana_2` an alias of the Pro.
- **Parameters that ran:** the submission result lists the `params` the server will use, and `adjustments` when it
  changed a value (an unsupported value becomes the nearest allowed one). Compare the aspect ratio, duration,
  resolution, audio and count with the plan before waiting. In two tutorials the prompt text asked for 9:16 or 21:9
  while the panel sent 16:9, and nobody noticed.
Without the ability to see images, ask the operator for a description and say that the evaluation is the operator's.

## Score with evidence

`templates/evaluation.json` → `hfd.py score`. Criteria and weights (`data/weights.json`): identity 20, motion 15,
camera 15, briefing 15, lighting 10, materials 10, continuity 10, audio 5. Each criterion takes a score of 0–10
**and** the evidence (what was seen, at which second); "not applicable" requires the reason. 90+ excellent; 80–89
approved with adjustments; 65–79 revise; below 65 rejected. **A critical failure blocks** any average: altered
identity of a real person, the client's label or brand deformed, improper text or a watermark, content outside the
policy.
