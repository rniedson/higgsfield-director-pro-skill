# Lessons from Higgsfield's YouTube channel, batch 3

Collected on 2026-11-25 from the official channel ([youtube.com/@HiggsfieldAI](https://www.youtube.com/@HiggsfieldAI)),
after [batch 1](2026-11-higgsfield-channel.md) and [batch 2](2026-11-higgsfield-channel-2.md). **Part 1** covers
videos 24 to 35; part 2 (videos 36 to 43, and the one that failed in batch 2) follows.

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

## Still open

- Lessons 2, 6, 7, 11, 12 and 13 are things to test. Their original conditions are in
  [tests/to-test.md](tests/to-test.md).
- Part 2: videos 36 to 43, and the video that failed in batch 2.
