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
- [ ] In an ad, each shot has a moment of impact (an action on the product, with sound tied to it), not just a camera
      movement.
- [ ] The speech fits the duration; the speaker is labeled.
- [ ] No loose negative instruction ("no X") where the positive can be said.
- [ ] Uploaded references belong to the operator or are authorized; a real person only with consent.
- [ ] Cost estimated by the connector and an explicit "ok" from the operator with the total.

## Diagnosis (symptom → hypothesis → change → how to check)

| Symptom | Likely hypothesis | Change (one thing) | Check |
|---|---|---|---|
| Face changes between frames | weak reference, large rotation | lock the reference, reduce the orbit, shorten | compare the face at the start and at the end |
| Deformed hands/fingers | simultaneous gestures, hand in the foreground | a single gesture, hand smaller in frame | frame by frame on the hand |
| Sliding feet | walk with no contact described | "each planted foot stays fixed until lifted"; simple path | contact with the ground |
| Erratic camera | two movements, or none defined | one movement, constant speed | path from start to end |
| Deformed product / label melts | occlusion, fast orbit, small text | slower orbit, less occlusion, text in post | label readable in every frame |
| Unreadable text | models render text poorly | text and logo in post; for images, `nano_banana_pro`/`ideogram` | human reading |
| Light flicker | lighting not locked | "constant key light and exposure throughout" | luminance over time |
| Odd physics (liquid, fabric) | force and material not described | direction of the force, material, delay | motion consistent with the weight |
| Poor lip sync | long line, face moving a lot | shorter line, less head movement | mouth on the stressed syllables |
| Loop with a jump | different ends | align pose, camera, light and speed | first × last frame |
| Ignores the request | prompt too long or contradictory | shorten; remove what conflicts | does each requested element appear? |
| Static camera when the prompt asks for movement | the model rewrites the prompt (Cinema Studio 4.0 has automatic direction) | test the same shot in another model; in one test, Kling 3.0 did the tracking move that Cinema Studio ignored (one sample) | path from start to end |
| Invented symbol or flag | a "film still" model draws from memory | reference with the real symbol; switch models | compare with the original |
| Product changes between shots | text only; detail shot without a feature that identifies the product | product reference image in every shot | compare the product shot by shot |
| Product cropped in the final frame | the movement ends on a tighter framing than the final state needs | make the movement end on a shot that contains the final state | last frame |
| Cuts inside a shot | the model edited several shots together on its own (Cinema Studio 4.0: 3 of 11 shots of 4 to 5 s in one test, around the 2 s mark) | one continuous shot with a single movement; "Single continuous shot" | scene change frame by frame (`ffmpeg -vf "select='gt(scene,0.3)',showinfo"`); the 0.3 threshold missed a cut to a similar shot, so also look at a sheet of frames every 0.5 s |
| An accessory from the bible disappears (hat, glasses) | hypothesis: in a wide shot the accessory is small and the opening frame weighs more than the bible (one sample) | the accessory visible in the approved storyboard frame; a tighter shot when it matters | compare with the bible, frame by frame |
| Correct but lukewarm shot | only camera and setting, nothing happens | one moment of impact per shot, with sound tied to it | blind vote against an alternative version |

Two failures in a row on the same shot: **replan** (another framing, another model, a shorter shot) instead of
piling up constraints. A hypothesis is not a cause: record what changed and what happened.

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
  at the wrap: plan a short dissolve in the edit.
- **Model that ran:** check the `model` field of `jobs_wait`. In one test, a request for `nano_banana_pro` came back
  as `nano_banana_2`.
Without the ability to see images, ask the operator for a description and say that the evaluation is the operator's.

## Score with evidence

`templates/evaluation.json` → `hfd.py score`. Criteria and weights (`data/weights.json`): identity 20, motion 15,
camera 15, briefing 15, lighting 10, materials 10, continuity 10, audio 5. Each criterion takes a score of 0–10
**and** the evidence (what was seen, at which second); "not applicable" requires the reason. 90+ excellent; 80–89
approved with adjustments; 65–79 revise; below 65 rejected. **A critical failure blocks** any average: altered
identity of a real person, the client's label or brand deformed, improper text or a watermark, content outside the
policy.
