# Writing the prompt

Read before writing or reviewing any prompt. The vocabulary is in `references/vocabulary.md`.

## 1. The golden rule (order)

Subject and details that do not change → setting → action in chronological order → shot size and angle → camera
movement and speed → lens and focus → lighting and color → atmosphere and secondary motion → final state → (separate
audio block).

- **One dominant action and one camera movement per shot.** More than one only in explicit phases:
  "Static for two seconds, then a slow push-in". (Sora cookbook; Higgsfield, "shot list" per block.) A continuous
  camera path copied from a blocking reference video (§2) counts as one movement.
- **A shot that must not cut: write the action as one continuous motion, not as beats.** In one tutorial on
  Seedance 2.0, with three references and a long prompt that already asked for no cuts, the shot cut when the action
  was split into timed phases, and again when the phases became paragraphs without times; one continuous motion
  fixed it, in a rewrite that also slowed the walk. Two tests here did not reproduce the cut (2026-11-25): three
  short timed beats with no references on Seedance 2.5 (0 of 2), and the original's structure on Seedance 2.0,
  with three references, five timed phases in Chinese and the no-cuts block (0 of 4, at 480p without audio). So
  beats are one suspect when an unwanted cut appears, not a rule against them, and in the tutorial a "no cuts"
  line did not prevent the cut. The same form is how cuts are asked for on
  purpose: tutorial prompts write `CUT 1 (0–4s)`, and Wan documents `Shot 1 [0-3s]` for multi-shot (§4).
- **Simple camera work is not a shot where nothing happens.** In an ad, each shot needs a moment of impact on the
  product or on the person using it: a touch that deforms the material, a splash in slow motion, a gesture that shows
  the effect. The camera keeps a single movement; the action carries the emotion, and the sound follows that moment.
  In a blind test, the restrained prompts (a drop running down, a lateral slide) gave better camera and lighting and
  lost to the prompts with action, emotion and sound.
- **Duration, aspect ratio, resolution and audio on/off go in the PARAMETERS**, never in the text. "Make it longer"
  in the prompt does not change the duration. (Sora, Veo, MiniMax.)
- **Describe what you want to see, not what you don't want.** "The label stays flat and readable", not
  "no warped label". Use a negative field only if the model has one (none of the main ones shows one in the
  2026-11-24 catalog). (Veo; Higgsfield: "Say what you want, not what you don't".)
- **Show it instead of describing it.** A detail that is hard to put into words (a creature, an odd shape, the
  button to press, where something lands) goes in as an image reference, marked if needed (an arrow on the button,
  an annotated drawing), and the text names it. (Higgsfield YouTube tutorials, 2026.)
- **With a reference attached, the text does not describe its look again.** Repeating the appearance of a
  referenced person or set made the model add new characters. Give each reference a fixed name, the same in the
  bibles and in every prompt, and write only the action, the camera and what changes. The exception is a small,
  critical detail (a word on a label, a logo, one color): write it even when the reference shows it, because the
  model can drop it (a written rule shown in one tutorial; to test).
- **Each reference says what it brings and what it does not.** Next to its name, write what it supplies (the face
  and hair; the room's walls, materials and light; the clip's framing and timing) and what stays out of the shot (the
  sheet's grey background and clothes, the photo's sunlight); for a place or a still, add that it is a reference, not
  the first frame. Without a role, an input came back as a still picture filling the screen. (Higgsfield YouTube
  tutorials, 2026: written out in three prompts shown on screen.) A video reference says whether it gives the motion
  or only the camera path; an audio reference, whether it gives the words and their delivery or only the rhythm.
  When the scene must differ from a reference (the helmet comes off, the roof has been torn away), write it in that
  reference's line as an override, `IMPORTANT OVERRIDE: she sits in the cabin WITHOUT A HELMET`, or the reference
  wins. (Four more prompts shown on screen in later tutorials.)
- **A measure instead of an adjective** (to test). Tutorial prompts on screen give the speed (8 km/h), the field of
  view and the tilt in degrees, the white balance in kelvin, the grade as colors with their shares (60/30/10) or as
  hex values, and the camera path as one constant-radius orbit rather than an orbit plus a push-in. Not compared with
  adjectives here.
- **Name the gestures.** A generic verb ("she dances", "they fight") comes out soft and vague. Write the one action
  as named gestures, one per beat: head turn, shoulder drop, finger snap. In a fight: who stands where, the blow, the
  fall; medium shots for the movement, close shots for the contact.
- **Anchor the camera to something in the set.** "The camera stands beside the fridge, at the back of the room"
  placed it; "closer" moved the subject toward the camera instead. Say where the camera stands and what it does
  ("the camera moves forward to the desk").
- **English** gives the most predictable result. Dialogue stays in the requested language, with the language written
  out. The Higgsfield guide says Seedance and Kling sometimes respond better to Chinese for subtle motion: test, do not
  assume.
- **A short clip obeys better.** The longer the shot, the more the model invents; split it into shots. When an action
  (a stunt, a chase) and a performance (a look, a line) compete in one prompt, both come out weaker: give each its
  own shot. Before generating, count what one shot asks for: strong actions, camera movements, important characters,
  complex effects, changes of place. Each one beyond the first is a reason to consider a split (tutorials give
  thresholds; none was measured, so none is given here).
- **Change one thing at a time** between attempts. Two failures in a row: replan the shot instead of piling on
  constraints.

Sources: higgsfield.ai/creator-hub/help-center/getting-started/how-do-i-write-a-good-prompt (modified 2026-09-14);
docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide; kling.ai/blog/kling-ai-prompt-guide
(2026-08-07); developers.openai.com/cookbook/examples/sora/sora2_prompting_guide;
help.aliyun.com/en/model-studio/text-to-video-prompt; platform.minimax.io/docs/api-reference/video-generation-t2v.

## 2. Templates by mode

| Mode | Template |
|---|---|
| Text to video | `[Subject and invariants]. [Setting]. [Chronological action]. [Shot size and angle]. [Camera: path and speed]. [Lens and focus]. [Lighting and color]. [Atmosphere and secondary motion]. [Final state].` + `Audio: ...` |
| Image to video | `The reference image is the opening frame; preserve [identity, geometry, wardrobe, background]. [One action]. [Camera]. [Secondary motion]. [Final state].` The image already brings the subject and the scene: the text talks about **motion and camera** (Wan). Text and image must agree: do not ask for "calm, still" over a shaky frame (Higgsfield). |
| Edit | `Change only [target]; preserve everything else exactly as it is. [What the target looks like].` One change per edit. After many edits of the same image the layout drifts: generate a new image with the full description and the same references instead of editing again. For a sheet or a frame whose layout must stay, list the locked parts with their priority, then the one change: `Locked, highest priority: [the framing, the panels, the face]. The only change: [target].` (one tutorial, shown on screen) |
| Extension | `Continue seamlessly from the final frame of the previous clip. [What happens next].` |
| Still image | No time, no moving camera, no sound: subject, setting, shot size, angle, lens, lighting, color, style. |
| Sequence | Generate shot by shot; the **last frame** of one (or any good frame, cutting the clip there) becomes the start image of the next (Higgsfield; Veo first/last frame). On a model whose catalog lists `video_references`, the previous shot itself can be the reference (2026-11-25 catalog: Seedance 2.0, up to 3 clips of 2–15 s; Seedance 2.5 and Cinema Studio 4.0, up to 10). Not yet compared with the last frame here: test it one variable at a time. A piece longer than the model's maximum is split at a natural seam (a hard cut, a whip, a defocus), never in the middle of a slow motion or a transformation, and every part repeats the palette, the main object and the identity anchor (a written rule shown in one tutorial). |
| Start and end frames | For a change of state or place inside one shot: generate and approve the opening and the closing image, and ask for the motion between them, on a model with the `end_image` role (`references/models.md`). |
| Edit real footage | `mode: video_edit` on a model that has it (2026-11-25 catalog: Seedance 2.5 and Cinema Studio 4.0; billed by the length of the input clip). `Change [what], at [the moment: when he snaps his fingers]. Keep exactly: [face, gestures, rings, camera move, background].` Say exactly where the change happens in the frame. Tutorials mark the area on a frame of the clip; the connector does that with a separate model, `draw_to_video` (2026-11-25 catalog: the source video, exactly one sketched image and an optional style reference; `duration`, 480p to 1080p, audio off and a prompt enhancer on by default; no timestamp parameter). Not tested here. Cut the footage into pieces of at least 4 s (one tutorial padded a shorter piece with its frozen last frame); the output takes the input's length (`duration` is ignored in this mode, 2026-11-25 catalog). The footage is the operator's; a real person in it only with consent. |
| Motion from a blocking render | A rough 3D blocking render, made in another tool, as a video reference for the camera path and its timing. The text adds what the render does not show (look, materials, acting) as one continuous motion; the render carries the timing. The render fixes the positions; people's movement is written in the text, or they copy the stiffness of the blocks. Use it for a shot whose camera path is specific or easier to animate than to describe; simple shots go from text. Frame the render wide: with the camera too close, the model could not read the positions, and pulling back fixed it. It carries camera and timing, not acting: with a plain grey figure, faces and hands did not come through, and with more detail the model copied the render's shapes instead of the sheet (one team's tutorial). |
| Motion from filmed footage | Film the movement yourself (a knee lift, a turn of the head) and pass the clip as a video reference, on a model whose catalog lists `video_references` (2026-11-25: Seedance 2.0, up to 3 clips of 2–15 s; Seedance 2.5, up to 10). Write what the clip supplies (timing, path, blocking) and what is replaced (the face, the clothes). One tutorial made an identity reference from a video of the head turning. To test. |

A clip shown as a screen inside the shot (a TV, a phone) sets the shot's length: the shot lasts as long as the clip,
or the model invents the rest.

## 3. Audio and speech

- Ask for sound **explicitly, in a separate sentence or block** (Veo, Wan, Kling, Sora). `hfd.py compile` already
  puts it all after `Audio:`.
- **Label who speaks** and repeat the same label in every shot: `Ana says in Brazilian Portuguese: "..."` (Kling, Sora).
- **The speech fits the duration**: ~2.5 words per second. 4 s fits 1 or 2 short lines (Sora). `validate` warns.
  The connector's `narration` workflow agrees: 20 to 23 words for a 10 s block, 7.8 to 9.5 s of speech, and a take
  above 2.9 words per second fails; each period adds ~0.7 s of silence and each comma ~0.5 s (stated there, 2026-11-25).
- For no speech: "No dialogue" (Wan). For no music track: "No music" (Higgsfield practice for Seedance). It is a
  request, not a guarantee: in one tutorial the music came in anyway. If the shot needs no sound at all, turn audio
  off in the parameters; otherwise listen before approving.
- **In an ad, each shot has a sound accent tied to the action** (the splash, the creak of the material, a low boom on
  the final frame) over a low ambience. Ambience alone leaves the shot lukewarm.
- **Generated audio comes out quiet**: between −26 and −28 LUFS integrated in a test with Cinema Studio 4.0. Normalize
  in post for the target platform, or use the connector's `video-sound-design` workflow.
- Seedance (convention copied by Higgsfield from a ByteDance document, secondary source): music inside `( )`, effects
  inside `< >`, speech inside `{ }`. Use it only in Seedance and only after testing.
- **Music as a beat reference:** on a model that accepts `audio_references`, the track can time the motion to the
  beat (Seedance 2.0 also needs an image or video reference). Music rights are the operator's. One tutorial; not
  tested here.
- **A melody (to test):** a hummed recording of the melody as an audio reference, so the notes come out as intended;
  without it the model made up another tune. One tutorial; not tested here.
- **An accent (to test):** naming the accent was not enough in one tutorial; describing how it sounds (the R, the
  vowels) helped. Keep the same voice description in every shot of that character and listen to the takes side by
  side.
- **Dialogue from recordings (to test):** generate each line first (the connector's `elevenlabs_v4` takes ordered
  turns with a voice per turn and up to four variations), choose a take per line, and pass the takes as
  `audio_references` on a model that has them. Name each one, say which shot uses it and which words it carries, and
  ask that the acting and the lips follow the recording, with no new lines and no rushing. In one tutorial the model
  still added a pause or sped up a line now and then: transcribe and check.
- **Narration from text** goes to the connector's `narration` workflow (v1.1, read 2026-11-25; library voices only,
  never a clone; stated there, not measured here). Its rules hold for any recorded line:
  - a take that does not fit is rewritten, never sped up or stretched; a take that passed is kept, and only the
    failing lines are redone, at most three attempts each;
  - measure the speech, not the file: an inner pause of 0.8 s or more fails the take;
  - one voice for the whole job: write its id and type in a file once and copy them from there into every call; a
    take in another voice fails, however well it fits;
  - a text-to-speech prompt takes at most 2048 characters: split a long script at paragraphs (~1800 characters),
    with the same voice and the same delivery phrase in every part.
- **An invented name, written as it sounds (to test):** `Gan-del-FEE-nah`, not `Gandelfina`, in the spoken line.
- Real person, someone's voice, a minor: see the hard rules in `SKILL.md`.

## 4. Notes by model (official fact when there is a manufacturer source)

| Model | What changes in the prompt | Source |
|---|---|---|
| Cinema Studio 4.0 (Higgsfield) | Camera, lens, aperture, era, genre, pacing and light exist as **controls** (`camera_model_id`, `camera_lens_id`, `light`...); camera movement goes in the text: the connector has no movement or frame-rate parameter (the movement control on the website is not exposed). Audio on by default. 4–30 s. | connector catalog (2026-11-25); Cinema Studio help center (modified 2026-11-19) |
| Cinema Studio 3.5 (Higgsfield) | Several shots in one generation: `multi_shots: true` with `multi_shot_mode: "custom"` and `multi_prompt`, up to 6 items, each with its own `prompt` and `duration`; `auto` lets the model plan the shots. Set `prompt_language: "en"` (the default is `zh`) and `generate_audio: true` when sound is wanted (the default is off). `enhance_prompt` rewrites the prompt (off by default). Up to 15 media in all. | connector catalog (2026-11-25) |
| Seedance 2.5 / 2.0 | References cited in the text as `@Image 1`, `@Video 1`, `@Audio 1`, with the role of each one written out (not inside the image): what it brings and what stays out (§1). The Higgsfield website writes them as `<<<image_1>>>`, `<<<video_1>>>`, the same form as Elements (two tutorials, on screen). Through the connector the references are numbered in the order of `medias`; which form binds there is not confirmed for Seedance: name each reference by number and by what it shows. The connector's catalog writes one form for Seed Audio only, `@Audio 1` to `@Audio 3` (2026-11-25). Order: subject and action; scene; style; camera or cut; audio. | Seedance help center (modified 2026-11-17), Higgsfield blog guide; Higgsfield YouTube tutorials, 2026 |
| Kling 3.x / 4.0 | Subject, action, scene, camera, light, mood. Clear labels for who speaks; speech in Chinese, English, Japanese, Korean or Spanish (Portuguese: test first). | kling.ai/blog/kling-ai-prompt-guide |
| Veo 3.1 | Elements: subject, action, scene, angle, motion, lens, style, time, audio. **Zoom is not dolly.** "Advanced" angles are not officially supported. 4, 6 or 8 s. | Vertex AI video prompt guide; aistudio.google.com/docs/veo |
| Wan 2.6–3.0 | T2V = entity + scene + motion; I2V = motion + camera. Multi-shot in the text: `Shot 1 [0-3s] ...`; single shot: "Generate single shot." | help.aliyun.com/en/model-studio/text-to-video-prompt |
| MiniMax Hailuo | Camera commands in square brackets, up to 3: `[Push in]`, `[Pan left]`, `[Truck right]`, `[Tilt up]`, `[Zoom in]`, `[Tracking shot]`, `[Static shot]`, `[Shake]`... More precise than free text. | platform.minimax.io (t2v API) |

Sora 2 **is not** in the Higgsfield catalog (2026-11-24), and the press reported its discontinuation in 2026-03.

## 5. Intent → visual language (a starting point; the briefing decides)

| Intent | Camera | Lighting | Risk |
|---|---|---|---|
| Intimacy | close-up, slow push-in | soft window light | identity |
| Power | low angle, static | rim light | distortion |
| Loneliness | extreme wide, static | diffuse | unreadable subject |
| Luxury | slow orbit | controlled reflections | geometry and label |
| Anxiety | subtle handheld | low key | shake |
| Discovery | reveal, crane up | motivated | continuity |
| Action | tracking | readable contrast | physical contact |
| Contemplation | locked-off | natural | too much motion |
| UGC | medium close-up, light handheld | window light | lip sync |
| Architecture | stabilized fly-through | daylight | lines and scale |

If identity matters, reduce occlusion and rotation. If text matters, leave room and add the text in post. If the shot
is short, remove actions before speeding up.

## 6. Recipes against classic defects

| Topic | Write it like this | Avoid |
|---|---|---|
| Gaze and subtext | She looks away, pauses, then exhales softly. | She expresses every emotion at once. |
| Weight | She plants her left foot before turning. | She glides while walking. |
| Glass | A clear glass bottle refracts the background; its base remains on the table. | The rigid bottle bends as it rotates. |
| Fabric | Silk follows the arm with a slight delayed sway. | The silk moves like rigid metal. |
| Liquid | Water pours downward into the cup, with a rising fill level. | Water flows upward without a force. |
| Identity | Preserve facial proportions and hairstyle from reference A. | Change the face each time the camera turns. |
| Logo | Keep the label flat and readable; add typography in post if needed. | Make the logo transform during the orbit. |
| Flicker | Maintain constant key light and exposure throughout. | Random exposure changes in a continuous shot. |
| Feet | Each planted foot stays fixed until lifted. | Walk without lifting either foot. |
| Set | Keep straight architectural lines fixed in world space. | The room changes shape during the pan. |
| Lighting | Large soft key at camera left, weaker fill. | Hard and soft shadows from the same tiny source. |
| Color | Neutral white balance; preserve highlight detail. | Apply an unspecified log conversion twice. |
| Sound perspective | Distant traffic under close dry dialogue. | All sounds equally loud and close. |
| Foley | A soft click exactly when the latch closes. | Random loud impacts unrelated to action. |
| Suspense | Hold a wide frame with negative space before the reveal. | Reveal all threats immediately. |
| Documentary | Observe a single everyday action in available light. | Gratuitous cuts during a quiet observation. |
| Product | Reveal material detail, then finish on a centered product frame. | Hide the product and change its label. |
| UGC | Demonstrate one concrete use case in a natural voice. | Unsupported claims about the product. |
| Crowd | A crowd of local fans in plain green T-shirts with no crest, in the small concrete stands of a neighborhood field. | "Fans in green and white football shirts" (pulls in a real club's kit), or a crowd with no clothing stated (the model may take the shirts off). |
| Extras | A group reference with different people (age, build, clothes), each with one small action: one checks a phone, one laughs, one walks off. | One person's sheet for all the extras (they come out as clones), or extras with no action (they freeze). |
| Reverse shot | Say where the camera is and what must be in frame: the camera stands beside the building, looking down at the valley. | "Reverse shot" alone: the model may put a wall behind the character. |
| Transition between generated places | Hide the cut in a gesture or in something passing the lens; the camera keeps the same movement and only the place changes. | A hard cut with a different camera move on each side. |
| Traffic (to test) | One car in a tighter frame, on a straight road with light traffic. | Intersections, traffic lights, dense overtaking: one tutorial reported most of its errors there. |
| Hands of two people | Four hands of two people: a man's hands on the left, a woman's hands on the right. | "Two hands" (you get a single person with both hands). |
| Final state | The banner stays raised above the crowd at the end. | A final state that undoes the action (the cloth goes back to folded after being opened). |
| Emotional gesture | A frontal gesture the model can show: hand on the chest, a slow nod. | "Seen from behind" at a key moment: the model tends to turn the person toward the camera. |
| Official symbol (flag, coat of arms, seal) | Pass the real symbol as a reference image; put mottos and small text in post. | Describing the symbol only in words: the model invents or scrambles it. |
| Branded objects | Unbranded industrial sewing machines. | Leaving the brand unstated: image models sometimes stamp real brands on them. |
| Movement and final state | Slow push-in from a wide shot to a medium shot; the whole product stays in frame at the end. | "Push-in to a close-up" together with "the whole product visible at the end": the model follows the movement and crops the product. |
| Product in a detail shot | Keep one identifying feature in frame: the laces cross the knit in the foreground. | A detail that only shows the material: the model fills in the rest from memory and may invent another product (in one test, a sneaker came out without laces). |
| Same product across several shots | Generate one product image first, get it approved, and pass it as the reference in every shot. | Only the description repeated in each prompt: it holds the style, not the design. |
| Impact in an ad | A fingertip presses into the knit and it springs back; slow-motion droplets burst from each footfall. | Only camera and setting: the shot comes out correct and lukewarm. |

## 7. Short examples (text to video)

- **Perfume:** A black perfume bottle on polished obsidian. Slow 180-degree orbit, macro close-up, controlled specular highlights, black and gold palette. The label stays flat and readable. Single continuous shot.
- **Fashion:** A model walks through a minimalist concrete interior. Smooth reverse tracking, full-body framing, soft cross lighting, natural fabric motion.
- **Car:** A sports car drives along a coastal highway at sunset. Low-angle side tracking, realistic wheel rotation and reflections, golden hour backlight.
- **Portrait:** Extreme close-up, slow push-in, 85mm portrait look, soft window light, natural blinking and subtle breathing.
- **Real estate:** Smooth stabilized fly-through from the entrance to the living room, wide-angle, straight verticals, natural daylight.
- **Suspense:** A detective listens in a dim corridor. Slow push-in, muted green shadows, restrained expression, subtle head turn, one continuous take.
- **Transition:** The camera passes through a dewdrop into an underwater world. Continuous forward motion, realistic refraction.
- **Loop:** A glass sphere completes one slow revolution. Locked-off camera, stable lighting, the closing frame matches the opening frame.
