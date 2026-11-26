# Lessons from Higgsfield's YouTube channel, batch 3

Collected on 2026-11-25 from the official channel ([youtube.com/@HiggsfieldAI](https://www.youtube.com/@HiggsfieldAI)),
after [batch 1](2026-11-higgsfield-channel.md) and [batch 2](2026-11-higgsfield-channel-2.md). **Part 1** covers
videos 24 to 35, lessons 1 to 13; **part 2** covers videos 36 to 43 and 19 (which failed in batch 2), lessons 14 to
26, in the sections named "Part 2".

The method changed in this batch. Each tip records what the screen **showed** (model, settings, references, the
structure of the prompt, the attempts), not only what was said, as the [reproduction cards](tests/README.md) ask.
Three readers worked in parallel. Before anything went into the skill, every frame cited as evidence was opened
full size here. Five of the readers' details were wrong and are corrected below: two frames attributed to the wrong
video, a word read that is not on screen, a counter misread, and a title misread. This is still the vendor's own
channel: no tip was measured, and "it worked" is the presenter's eye.

Strength: **high** when several videos agree or the catalog confirms it; **medium** when one video explains or shows
it; **low** when it is a single claim, adopted as something to test.

## Sources

| # | Video | Published |
|---|---|---|
| 24 | [How I Get Perfect AI Realism in Every Shot (3 Steps)](https://www.youtube.com/watch?v=1BzzdY-nK9A) | 2026-11-13 |
| 25 | [I Spent 72 Hours Making a Commercial with AI (Full Workflow)](https://www.youtube.com/watch?v=ktGkJfxNN9M) | 2026-10-30 |
| 26 | [You Will Stop Burning Your AI Credits After Watching This (3 Tips)](https://www.youtube.com/watch?v=sCukTWZEt7Q) | 2026-11-07 |
| 27 | [Did AI Change Editing Forever? (GPT-6 Astra + DaVinci Resolve)](https://www.youtube.com/watch?v=kOoC3yhUyDQ) | 2026-10-02 |
| 28 | [I Made a Cinematic Ad Using Claude Fable 5 + Higgsfield AI (Full Workflow)](https://www.youtube.com/watch?v=ODNzk5x2tR4) | 2026-06-15 |
| 29 | [Can AI Beat VFX?](https://www.youtube.com/watch?v=uZkGA1EuIHI) | 2026-10-05 |
| 30 | [I Challenged a Pro VFX Artist to Beat AI](https://www.youtube.com/watch?v=Hn8A8D4-SpQ) | 2026-08-07 |
| 31 | [I Ranked Every AI Model So You Don't Have To](https://www.youtube.com/watch?v=nnGFEUeL-P0) | 2026-01-29 |
| 32 | [Seedance 2.0 Complete Breakdown: Every Format Going Viral Right Now](https://www.youtube.com/watch?v=PsQovs2FwqQ) | 2026-04-03 |
| 33 | [I Mixed AI + Real Footage = Insane VFX!](https://www.youtube.com/watch?v=X7Uw_cWBpzs) | 2026-11-04 |
| 34 | [72 Hours to Make a Luxury Ad: Claude + Higgsfield AI Workflow](https://www.youtube.com/watch?v=oqtXc0yI1S8) | 2026-11-21 |
| 35 | [Kling 3.0 Review: Realism, Camera Moves, and Emotion Tested](https://www.youtube.com/watch?v=jQvHqKrGhy8) | 2026-02-04 |

## Adopted

Each time links to the second of the video. "Shown" means a frame opened here at full size.

| # | Lesson | Sources | Evidence | Strength | Where it went |
|---|---|---|---|---|---|
| 1 | Each reference says what it brings and what stays out: the face and hair only; the room's walls, light and palette only; the sheet's background and clothes, the photo's sunlight stay out of the shot; "not a keyframe". Without a role, an input came back as a still picture filling the screen. | 26 [12:39](https://www.youtube.com/watch?v=sCukTWZEt7Q&t=759s), 33 [03:47](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=227s), 30 [06:10](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=370s); 28 [27:05](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1625s) (the still) | shown in three prompts; the still is said | medium-high | `references/prompt.md` §1 and §4; `references/quality.md`, diagnosis |
| 2 | A small, critical detail (a word on a label, a logo, one color) goes in words even when the reference shows it, because the model can drop it; the rest of the look stays short. | 30 [06:10](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=370s), 33 [03:47](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=227s) | shown: a written rule and a prompt that follows it | medium, to test | `references/prompt.md` §1 |
| 3 | Approved sheets saved as Elements and called by name. | 24, 33 (the dialog, reported by the readers) | live catalog: `elements_create`, `<<<element_id>>>` in the prompt, the supported models | high | `references/workflow.md` §4; `references/connector.md` |
| 4 | A layout map with the distances that matter and the orientation: a street's length and width, the gap between two marks in metres, a compass, the camera's starting point. Without an anchor, a goal moved at every generation. | 28 [28:41](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1721s); 28 [26:43](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1603s)–[27:27](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1647s) | shown; the problem said | medium | `references/workflow.md` §4 |
| 5 | The same defect in every attempt sits upstream: the car's reference had the steering wheel on the wrong side, so the reference was fixed instead of the prompt. | 24 [19:47](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=1187s), 24 [20:18](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=1218s); 30 [08:00](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=480s) | said; the request to rebuild the prompt with the fixed references shown | medium | `references/quality.md`, diagnosis |
| 6 | A video as a reference for motion and identity: the movement filmed by the presenter; a source clip that supplies framing, lens, light and timing; an identity reference made from a video of the head turning. | 25 [09:23](https://www.youtube.com/watch?v=ktGkJfxNN9M&t=563s)–[10:06](https://www.youtube.com/watch?v=ktGkJfxNN9M&t=606s), 33 [03:47](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=227s), 29 [05:28](https://www.youtube.com/watch?v=uZkGA1EuIHI&t=328s) | shown in one prompt; the rest said | medium, to test | `references/prompt.md` §2 |
| 7 | A measure instead of an adjective: speed in km/h, field of view and tilt in degrees, white balance in kelvin, the grade as colors with their shares or as hex values, one constant-radius orbit. | 28 [37:55](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=2275s), 26 [12:39](https://www.youtube.com/watch?v=sCukTWZEt7Q&t=759s), 30 [19:53](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=1193s) | shown in three prompts; never compared with adjectives | low-medium, to test | `references/prompt.md` §1 |
| 8 | Real footage edited in pieces of at least 4 s, a shorter one padded with its frozen last frame; the output takes the input's length. | 30 [05:21](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=321s)–[06:32](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=392s) | said; the catalog confirms that `video_edit` ignores `duration` | medium | `references/prompt.md` §2 |
| 9 | Kling 3.0 has a per-shot multi-shot mode on the website (a prompt and a duration per shot), not exposed by the connector. | 35 [09:51](https://www.youtube.com/watch?v=jQvHqKrGhy8&t=591s) | shown; live catalog | high | `references/models.md` |
| 10 | Timed blocks are how the channel asks for cuts on purpose ("CUT 1 (0–4s)"; "five shots, hard cuts at 2s, 7.4s, 10s and 15s"). Whether the cuts landed on time is not shown. | 28 [37:55](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=2275s), 26 [12:39](https://www.youtube.com/watch?v=sCukTWZEt7Q&t=759s) | shown | low-medium | `references/prompt.md` §1 |
| 11 | To test: a location image can get in the way of a big camera move; described in the text, the move came out. The cast changed in the same attempt. | 34 [15:41](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=941s)–[17:25](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=1045s) | said | low, to test | [tests/to-test.md](tests/to-test.md) |
| 12 | To test: the performance first and the voice after, by swapping the voice over the clip. | 26 [08:48](https://www.youtube.com/watch?v=sCukTWZEt7Q&t=528s) | said; the connector has `voice_change` | low-medium, to test | `references/preproduction.md`, audio |
| 13 | An image edit lists what is locked, with priority, before the one change. | 24 [13:28](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=808s) | shown | medium-low | `references/prompt.md` §2, Edit |

## Decisions

- **Reference scope** (lesson 1) enters as a rule of medium-high strength: shown in three prompts, effect not
  measured.
- **Critical details in words** (lesson 2) enters as an exception to "the text does not describe the reference's
  look again", marked to test.
- **A measure instead of an adjective** (lesson 7) enters as a practice marked to test.

## What batch 3 says about batches 1 and 2

- **Corroborated** (as reported by the readers, at the times in the transcripts):
  - batch 1:
    - lesson 2, the layout map (28 [28:41](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1721s), 34 [09:00](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=540s)), extended by lesson 4;
    - lesson 4, show instead of describe (28 [27:27](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1647s), 33 [06:30](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=390s), 34 [09:00](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=540s));
    - lesson 7, a sheet for the extras (25 [22:54](https://www.youtube.com/watch?v=ktGkJfxNN9M&t=1374s));
    - lesson 8, attempts within a budget (24 [06:49](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=409s), 30 [08:00](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=480s));
    - lesson 9, one note per defect (24 [10:31](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=631s), 25 [19:31](https://www.youtube.com/watch?v=ktGkJfxNN9M&t=1171s), 33 [07:40](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=460s), 34 [23:56](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=1436s));
    - lesson 10, editing one's own footage (30 [05:47](https://www.youtube.com/watch?v=Hn8A8D4-SpQ&t=347s), 33 [01:35](https://www.youtube.com/watch?v=X7Uw_cWBpzs&t=95s));
  - batch 2:
    - lesson 3, start and end frames (Kling 3.0, 35 [08:43](https://www.youtube.com/watch?v=jQvHqKrGhy8&t=523s));
    - lesson 7, a fixed name for each approval (34 [02:48](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=168s));
    - lessons 9 and 10, a location prepared for the action (34 [09:00](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=540s));
    - lessons 11 and 12, one map per shot and one change per edit (34 [09:45](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=585s), 24 [11:49](https://www.youtube.com/watch?v=1BzzdY-nK9A&t=709s));
    - lesson 16, a face fixed on the sheet (28 [15:58](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=958s)).
- **Mixed:**
  - **Batch 1, lesson 1, one face per sheet:** followed in 24, 25 and 28. In 34 the face also shows in the full-body
    panel (34 [02:20](https://www.youtube.com/watch?v=oqtXc0yI1S8&t=140s)); 26 uses two panels.
  - **Batch 2, lesson 6, patches pile up:** in 28 two or three patches worked (28 [17:29](https://www.youtube.com/watch?v=ODNzk5x2tR4&t=1049s)); 24 and 34 fixed the source or
    rewrote instead.
- **Batch 2, lesson 1, timed beats:**
  - lesson 10 above supports its mechanism;
  - in 32 the presenter says a "no cuts, no zooms" line keeps a POV shot locked (32 [07:18](https://www.youtube.com/watch?v=PsQovs2FwqQ&t=438s)), not measured;
  - in video 14 the same kind of line did not prevent the cut ([card](tests/2026-11-25-timed-beats.md)).

## Not adopted

- **Duration, aspect ratio and "15s / 1 shot / 16:9" written in the prompt** (26, 32, 33): the skill keeps them in
  the parameters.
- **Negative phrases and NEGATIVE blocks** (24, 30, 32): batch 1's decision stays. The channel uses them often, never
  in a comparison.
- **Color presets of Soul Cinema on the website** (25 [08:16](https://www.youtube.com/watch?v=ktGkJfxNN9M&t=496s)): the connector's `soul_cinematic` has only `quality` and
  `soul_id`.
- **Model rankings, prices, sponsorship and editing outside generation** (27, 31; parts of 29 and 30).

## Catalog check (2026-11-25, `models_explore get` and the tool descriptions)

- **Elements:** `elements_create` saves an image (or a video) under a name; a prompt uses `<<<element_id>>>`; only
  completed Elements work. Supported video models: `seedance_2_0`, `cinematic_studio_video_v2`,
  `cinematic_studio_3_0`, and `kling3_0` (only with a `start_image`). `seedance_2_5` is not listed.
- **Kling 3.0:** `duration` 3–15, `mode` (`std`, `pro`, `4k`), `sound`, start and end frames; no multi-shot parameter.
- **Seedance 2.0:** `video_references` of 2–15 s, up to 3; `mode` `std` or `fast`, the latter at 480p or 720p only.
- **Seedance 2.5:** in `video_edit`, `duration` and `aspect_ratio` are ignored and the job is billed by the input's
  length.
- **Soul Cinema:** `quality` and `soul_id` only.
- **`voice_change`:** replaces the voice of a clip, keeping its timing, with a preset voice or a voice Element.

## Part 2: sources

Read on 2026-11-25 by five readers with the same method. Every frame cited below was opened here, full size or in a
legible mosaic (28 frames), and three passages were checked in the transcript. Three of the readers' readings were
wrong and are corrected here: "cut the face from the wide-shot character sheet" means remove it from the full-body
panels, which the skill already asks; "never generate locations from the front" was already in the skill; and a
shot regenerated because of scribbled text does not contradict lesson 19.

| # | Video | Published |
|---|---|---|
| 36 | [How to Make Ultra Realistic AI Videos (28 Best Tips)](https://www.youtube.com/watch?v=6aJ2BneDB5M) | 2026-05-16 |
| 37 | [Higgsfield Soul ID — Consistent Characters](https://www.youtube.com/watch?v=1IxI2KLjjwY) | 2025-07-09 |
| 38 | [Higgsfield x Wan 2.5 Camera Control](https://www.youtube.com/watch?v=tq941_PkNQk) | 2025-10-11 |
| 39 | [Higgsfield Draw-To-Edit — Official Launch](https://www.youtube.com/watch?v=VrvZS8p9QrA) | 2025-09-03 |
| 40 | [Higgsfield Ads 2.0 — Official Launch](https://www.youtube.com/watch?v=FKOeo6P7mT0) | 2025-09-09 |
| 41 | [How To Make AI Animation That Doesn't Look Generic (Full Breakdown)](https://www.youtube.com/watch?v=mu_8D93Dkik) | 2026-11-24 |
| 42 | [How To Animate a Short Film with Blender + Higgsfield (Breakdown)](https://www.youtube.com/watch?v=reFzEtCG_m8) | 2026-09-23 |
| 43 | [Claude Fable 5.1 + Higgsfield AI = Insane Motion Graphics!](https://www.youtube.com/watch?v=2OwMjg5As2g) | 2026-09-02 |
| 19 | [This is How I Made an Ultra Realistic AI Short Film Using Seedance 2.0 in 4K (Full Workflow)](https://www.youtube.com/watch?v=0HIRIT7px9Y) | 2026-07-07 |

Videos 37 to 40 are launch trailers with almost no speech: nothing in them was adopted. Video 19 failed to download
in batch 2 and was read here.

## Part 2: adopted

| # | Lesson | Sources | Evidence | Strength | Where it went |
|---|---|---|---|---|---|
| 14 | A reference's line also says what it does not bring: a general rule (identity and construction, not composition, light, pose or audio), a video for motion or only for the camera, an audio for the words or only the rhythm. When the scene must differ from the reference, an override in its line ("IMPORTANT OVERRIDE: … WITHOUT A HELMET"; "the roof stays torn off"). | 41 [20:29](https://www.youtube.com/watch?v=mu_8D93Dkik&t=1229s), [34:58](https://www.youtube.com/watch?v=mu_8D93Dkik&t=2098s); 42 [17:32](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1052s); 36 [11:06](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=666s) | shown in four prompts | medium-high | `references/prompt.md` §1 |
| 15 | After sending, compare the parameters that came back with the plan: twice the prompt text asked for `9:16` or `21:9` and the panel sent `16:9`, unnoticed. | 43 [7:01](https://www.youtube.com/watch?v=2OwMjg5As2g&t=421s); 19 [9:01](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=541s) | shown; the tool's description says an unsupported value becomes the nearest allowed one | medium | `references/quality.md`, checks; `references/connector.md`, step 6 |
| 16 | To test: dialogue generated first, one take chosen per line, and passed to the video as audio references, each named with its shot; the acting and the lips follow the recording. The model sometimes added a pause or sped up a line. | 41 [27:52](https://www.youtube.com/watch?v=mu_8D93Dkik&t=1672s), [32:00](https://www.youtube.com/watch?v=mu_8D93Dkik&t=1920s), [34:58](https://www.youtube.com/watch?v=mu_8D93Dkik&t=2098s), [37:46](https://www.youtube.com/watch?v=mu_8D93Dkik&t=2266s) | shown; live catalog: `elevenlabs_v4`, `audio_references` | medium, to test | `references/prompt.md` §3; `references/preproduction.md`, audio |
| 17 | A blocking render only for a shot whose camera path is specific or easier to animate than to describe; framed wide, because with the camera too close the model could not read the positions; it carries camera and timing, not acting (with a grey figure, faces and hands did not come through; with more detail, the model copied the render's shapes). | 42 [15:31](https://www.youtube.com/watch?v=reFzEtCG_m8&t=931s)–[16:14](https://www.youtube.com/watch?v=reFzEtCG_m8&t=974s), [20:12](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1212s), [22:59](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1379s)–[23:43](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1423s), [26:15](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1575s)–[26:42](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1602s) | shown (the panel); said, checked in the transcript | medium | `references/prompt.md` §2 |
| 18 | What no reference shows, the model invents: a second window on a wall no reference showed, in four of four attempts here; hair under a helmet that came off; a blade that is part of the hand, until it had its own sheet, outside and inside; people inside an empty car. | [faithful card](tests/2026-11-25-timed-beats-faithful.md); 41 [8:30](https://www.youtube.com/watch?v=mu_8D93Dkik&t=510s)–[9:54](https://www.youtube.com/watch?v=mu_8D93Dkik&t=594s); 36 [23:35](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1415s); 42 [21:06](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1266s)–[22:35](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1355s) | measured here once; shown; said | medium | `references/workflow.md` §4; `references/quality.md`, diagnosis |
| 19 | A frame grabbed from a good take, chosen for its framing, carries that take's defects: the character's headphones were missing in it, and in every new take, until they were painted back. | 42 [23:43](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1423s)–[24:46](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1486s) | said, checked in the transcript | medium | `references/quality.md`, diagnosis |
| 20 | The approved head fitted onto a body from another batch in an image edit (scale, neck, perspective, skin tone and light), or an outfit and a sheet as two references. | 41 [6:17](https://www.youtube.com/watch?v=mu_8D93Dkik&t=377s); 19 [14:05](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=845s) | shown | medium | `references/workflow.md` §4 |
| 21 | One sheet per state of the character (clean and bloodied; the same man as a child), with the shots each covers. | 36 [24:23](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1463s); 19 [23:48](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=1428s) | shown; said | medium-low | `references/workflow.md` §4 |
| 22 | To test: an invented name in a spoken line, written as it sounds. | 36 [17:06](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1026s) | shown (a slide) | medium-low, to test | `references/prompt.md` §3 |
| 23 | Before generating, count what one shot asks for (strong actions, camera moves, important characters, complex effects, changes of place); split long pieces at a natural seam, never in the middle of a slow motion or a transformation, and repeat the identity anchor in every part. | 36 [10:51](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=651s); 41 [20:58](https://www.youtube.com/watch?v=mu_8D93Dkik&t=1258s); 43 [1:04](https://www.youtube.com/watch?v=2OwMjg5As2g&t=64s) | shown: the written rules of two other authors; said | medium-low | `references/prompt.md` §1 and §2, Sequence |
| 24 | One or two seconds of a failed generation may be enough for the edit. | 36 [26:53](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1613s) | shown (a slide) | medium-low | `references/quality.md`, diagnosis |
| 25 | To test: a whip pan between two subjects gets a length (0.5 s) and labels (Subject A, Subject B), and ends on the same shot size it started on. | 19 [22:13](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=1333s), [21:59](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=1319s), [22:42](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=1362s) | shown; said, checked in the transcript | medium-low, to test | `references/vocabulary.md` |
| 26 | The character sheet in soft, even, nearly shadowless light: the one picked had no hard shadow on the face and no glare on the hair. | 19 [5:35](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=335s), [5:33](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=333s)–[5:55](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=355s) | shown; said | medium-low | `references/workflow.md` §4 |

## Part 2: decisions

- **How to cite a reference in the prompt.** The Higgsfield website writes `<<<image_1>>>` (41 [20:29](https://www.youtube.com/watch?v=mu_8D93Dkik&t=1229s); 42 [17:32](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1052s)),
  the same form as Elements; the Seedance help center writes `@Image 1`. The connector's catalog says neither. The
  skill records both and marks the connector's form as not confirmed; a test is in
  [tests/to-test.md](tests/to-test.md).
- **Dialogue from recordings** (lesson 16) enters as an option marked to test.
- **When to split a shot** (lesson 23) enters as what to count, without the other authors' thresholds, which were
  not measured.

## Part 2: what it says about earlier lessons

- **Timed beats** ([batch 2, lesson 1](2026-11-higgsfield-channel-2.md#adopted) and both cards): video 36 recommends
  timed beats for a long shot in one generation (36 [15:47](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=947s)); 42 [18:17](https://www.youtube.com/watch?v=reFzEtCG_m8&t=1097s) and 19 [9:01](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=541s) write timed hard cuts on purpose.
  None shows a count of cuts. This agrees with 0 of 7 here.
- **One face per sheet** ([batch 1, lesson 1](2026-11-higgsfield-channel.md#adopted)): confirmed by 36 [23:26](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1406s)
  (otherwise "Seedance grabs it. And your character drifts"); the sheet prompts of 41 [6:17](https://www.youtube.com/watch?v=mu_8D93Dkik&t=377s) and 19 [5:35](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=335s) ask for full
  bodies with faces and a portrait. Mixed, as in part 1.
- **Text and logos in post** (`references/quality.md`): the presenter of 43 says the text "is not melting"
  (43 [2:18](https://www.youtube.com/watch?v=2OwMjg5As2g&t=138s)), and his own frame shows "Recording" with overlapping letters (43 [2:12](https://www.youtube.com/watch?v=2OwMjg5As2g&t=132s)). Confirmed.
- **Elements called by name** (lesson 3): 19 [9:01](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=541s) and [22:13](https://www.youtube.com/watch?v=0HIRIT7px9Y&t=1333s) use `@Santiago`, `@santiago_fit`, `@ball`.
- **A measure instead of an adjective** (lesson 7): 36 [8:59](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=539s) shows a bad prompt ("photorealistic, cinematic, high
  quality"), a good one (light and angle) and a great one (lens, aperture, grain, halation). Still to test.
- **The location in two views:** 36 [21:56](https://www.youtube.com/watch?v=6aJ2BneDB5M&t=1316s) splits a location into one file per view and warns against one labelled
  image; video 14 and the [faithful card](tests/2026-11-25-timed-beats-faithful.md) used both views in one file.
  To test.

## Part 2: not adopted

- **Motion graphics through the connector** (43): Marketing Studio presets, safe zones for vertical text, type
  effects by name. The skill leaves motion graphics out and puts text in post; the video's own frames show why.
- **"100% matches the reference"** as a fixed phrase (42), **"the first 20% of the prompt weighs most"** (42, said,
  no demonstration), **"do not describe what the reference shows"** (42, contradicted by its own prompt on screen).
- **A nine-frame storyboard in one image** (43, said): the skill asks for one frame per shot; no comparison.
- Sound cues as timed bullets (41), watercolor on watercolor (42), a literal word that made a literal object (42):
  single cases. Prices, credits, sponsorship, and the trailers 37 to 40.

## Part 2: catalog check (2026-11-25)

- **Seedance 2.5:** up to 30 image references, 10 video references and 10 audio references; `bitrate_mode`
  `standard` or `high`. The "High" chip on the website's panels may be that, but it also appears on Seedance 2.0 and
  GPT Image 2, which have no such parameter: not cited in the skill.
- **Seedream 5.0 Pro** (`seedream_v5_pro`): instruction-based editing, `is_inpaint`, up to 10 image references, up
  to 2K.
- **Eleven v4** (`elevenlabs_v4`): ordered speech turns with a voice per turn, up to 10 preset or cloned voices, up
  to 4 variations.

## Still open

- Lessons 2, 6, 7, 11, 12 and 13 (part 1), and 16, 22 and 25, the location's views, the override and how the
  connector reads a reference's name (part 2), are things to test. Their original conditions are in
  [tests/to-test.md](tests/to-test.md).
