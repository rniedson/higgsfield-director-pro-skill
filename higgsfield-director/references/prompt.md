# Writing the prompt

Read before writing or reviewing any prompt. The vocabulary is in `references/vocabulary.md`.

## 1. The golden rule (order)

Subject and details that do not change → setting → action in chronological order → shot size and angle → camera
movement and speed → lens and focus → lighting and color → atmosphere and secondary motion → final state → (separate
audio block).

- **One dominant action and one camera movement per shot.** More than one only in explicit phases:
  "Static for two seconds, then a slow push-in". (Sora cookbook; Higgsfield, "shot list" per block.) A continuous
  camera path copied from a blocking reference video (§2) counts as one movement; write it phase by phase, with the
  time of each phase.
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
- **Name the gestures.** A generic verb ("she dances", "they fight") comes out soft and vague. Write the one action
  as named gestures, one per beat: head turn, shoulder drop, finger snap. In a fight: who stands where, the blow, the
  fall; medium shots for the movement, close shots for the contact.
- **English** gives the most predictable result. Dialogue stays in the requested language, with the language written
  out. The Higgsfield guide says Seedance and Kling sometimes respond better to Chinese for subtle motion: test, do not
  assume.
- **A short clip obeys better.** The longer the shot, the more the model invents; split it into shots.
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
| Edit | `Change only [target]; preserve everything else exactly as it is. [What the target looks like].` |
| Extension | `Continue seamlessly from the final frame of the previous clip. [What happens next].` |
| Still image | No time, no moving camera, no sound: subject, setting, shot size, angle, lens, lighting, color, style. |
| Sequence | Generate shot by shot; the **last frame** of one becomes the start image of the next (Higgsfield; Veo first/last frame). On a model whose catalog lists `video_references`, the previous shot itself can be the reference (2026-11-25 catalog: Seedance 2.0, up to 3 clips of 2–15 s; Seedance 2.5 and Cinema Studio 4.0, up to 10). Not yet compared with the last frame here: test it one variable at a time. |
| Edit real footage | `mode: video_edit` on a model that has it (2026-11-25 catalog: Seedance 2.5 and Cinema Studio 4.0; billed by the length of the input clip). `Change [what], at [the moment: when he snaps his fingers]. Keep exactly: [face, gestures, rings, camera move, background].` The footage is the operator's; a real person in it only with consent. |
| Motion from a blocking render | A rough 3D blocking render, made in another tool, as a video reference for the camera path and its timing. The text adds what the render does not show (look, materials, acting), phase by phase with times. The render fixes the positions; people's movement is written in the text, or they copy the stiffness of the blocks. |

A clip shown as a screen inside the shot (a TV, a phone) sets the shot's length: the shot lasts as long as the clip,
or the model invents the rest.

## 3. Audio and speech

- Ask for sound **explicitly, in a separate sentence or block** (Veo, Wan, Kling, Sora). `hfd.py compile` already
  puts it all after `Audio:`.
- **Label who speaks** and repeat the same label in every shot: `Ana says in Brazilian Portuguese: "..."` (Kling, Sora).
- **The speech fits the duration**: ~2.5 words per second. 4 s fits 1 or 2 short lines (Sora). `validate` warns.
- For no speech: "No dialogue" (Wan). For no music track: "No music" (Higgsfield practice for Seedance).
- **In an ad, each shot has a sound accent tied to the action** (the splash, the creak of the material, a low boom on
  the final frame) over a low ambience. Ambience alone leaves the shot lukewarm.
- **Generated audio comes out quiet**: between −26 and −28 LUFS integrated in a test with Cinema Studio 4.0. Normalize
  in post for the target platform, or use the connector's `video-sound-design` workflow.
- Seedance (convention copied by Higgsfield from a ByteDance document, secondary source): music inside `( )`, effects
  inside `< >`, speech inside `{ }`. Use it only in Seedance and only after testing.
- **Music as a beat reference:** on a model that accepts `audio_references`, the track can time the motion to the
  beat (Seedance 2.0 also needs an image or video reference). Music rights are the operator's. One tutorial; not
  tested here.
- Real person, someone's voice, a minor: see the hard rules in `SKILL.md`.

## 4. Notes by model (official fact when there is a manufacturer source)

| Model | What changes in the prompt | Source |
|---|---|---|
| Cinema Studio 4.0 (Higgsfield) | Camera, lens, aperture, era, genre, pacing and light exist as **controls** (`camera_model_id`, `camera_lens_id`, `light`...); camera movement goes in the text. Audio on by default. 4–30 s. | connector catalog; Cinema Studio help center (modified 2026-11-19) |
| Seedance 2.5 / 2.0 | References cited in the text as `@Image 1`, `@Video 1`, `@Audio 1`, with the role of each one written out (not inside the image). Order: subject and action; scene; style; camera or cut; audio. | Seedance help center (modified 2026-11-17), Higgsfield blog guide |
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
