# Lessons from Higgsfield's YouTube channel, batch 1

Collected on 2026-11-25 from the 12 most-viewed tutorials on the official channel
([youtube.com/@HiggsfieldAI](https://www.youtube.com/@HiggsfieldAI)). The audio was transcribed locally, keyframes
were extracted, and each tip was compared with the skill as of 6.0. This is the vendor's own channel: almost every tip
rests on one example, and none was measured here.

Strength: **high** when several videos agree or the screen shows it; **medium** when one video explains it; **low**
when it is a single claim, adopted as something to test.

## Sources

| # | Video | Published |
|---|---|---|
| 01 | [How To Save AI Credits With Higgsfield + Blender (No One Talks About This Workflow)](https://www.youtube.com/watch?v=OiULPvTJ-0E) | 2026-08-28 |
| 02 | [3-Step Workflow To Make Ultra-Realistic AI Ads](https://www.youtube.com/watch?v=3rDs6FhFoUQ) | 2026-06-23 |
| 03 | [Seedance 2.0: Arena Zero Breakdown](https://www.youtube.com/watch?v=036jyFZWppw) | 2026-04-02 |
| 04 | [How To Make an AI Animated Short Film (Full Workflow)](https://www.youtube.com/watch?v=zYPgz6sOy74) | 2026-04-09 |
| 05 | [How I Make Realistic AI Short Films Using Seedance 2.5 - Full Guide](https://www.youtube.com/watch?v=wFbgrPmVXb0) | 2026-10-24 |
| 06 | [I Added Insane AI VFX to Real Footage in 4K(Seedance 2.0)](https://www.youtube.com/watch?v=Yte-UGhYkPQ) | 2026-06-29 |
| 07 | [I Made a Viral AI Short Film From Scratch — Full Workflow (Seedance 4K + Claude Fable 5)](https://www.youtube.com/watch?v=CHHH8tNioSc) | 2026-07-14 |
| 08 | [Claude Opus 5.5 + Higgsfield Make Insane Motion Graphics! (Claude Motion)](https://www.youtube.com/watch?v=5HYYXYYCrL4) | 2026-10-13 |
| 09 | [5-Step Workflow To Make Ultra-Realistic AI Short Films (Seedance 2.0 4K)](https://www.youtube.com/watch?v=HSON-SoFz7s) | 2026-07-02 |
| 10 | [GPT Astra 6 + Blender + Higgsfield Builds The Craziest Cinematic Scenes!](https://www.youtube.com/watch?v=vUYq38wC_xI) | 2026-09-12 |
| 11 | [I Made An AI Commercial For a Delivery Brand From Scratch (Full Tutorial)](https://www.youtube.com/watch?v=kFKpcCHkuPI) | 2026-10-07 |
| 12 | [The Complete AI Short Film Workflow Everyone's Missing](https://www.youtube.com/watch?v=tW40b122Rbs) | 2026-03-13 |

## Adopted

Times are minute:second in the video.

| # | Lesson | Sources | Evidence | Strength | Where it went |
|---|---|---|---|---|---|
| 1 | One face per reference sheet: one face close-up, the other panels cropped from the neck down; neutral mid-grey background, soft light. | 02 [07:57](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=477s), 07 [06:34](https://www.youtube.com/watch?v=CHHH8tNioSc&t=394s), 09 [03:07](https://www.youtube.com/watch?v=HSON-SoFz7s&t=187s), 11 [00:52](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=52s) and [01:53](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=113s) | the sheet is shown on screen in 02 and the prompt in 11 | high | `references/workflow.md` §4; `references/quality.md`, checklist and "Face changes between frames" |
| 2 | A top-view layout map (faceless colored silhouettes, the set's anchors, positions as percentages of the frame) as an image reference, with the colors named in the prompt; with several people, an establishing wide shot first and one background anchor per person. | 02 [27:10](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=1630s), 05 [15:28](https://www.youtube.com/watch?v=wFbgrPmVXb0&t=928s), 10 [09:15](https://www.youtube.com/watch?v=vUYq38wC_xI&t=555s), 11 [09:24](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=564s) and [13:55](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=835s) | the map's prompt is shown on screen in 02 and 11; the presenter of 11 says it fixed a scene that came out with four people instead of three | high | `references/workflow.md` §3 and §4; `references/preproduction.md`, drawing rules; `references/quality.md`, diagnosis |
| 3 | A change of state (wet, torn, sweaty) is a new approved reference, not a sentence in the prompt. | 02 [22:00](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=1320s), 07 [29:04](https://www.youtube.com/watch?v=CHHH8tNioSc&t=1744s) | said | medium | `references/workflow.md` §4; `references/quality.md`, diagnosis |
| 4 | Show instead of describe: an image, marked with an arrow or annotated, for a hard detail, a creature, the button to press, where something lands. | 05 [14:44](https://www.youtube.com/watch?v=wFbgrPmVXb0&t=884s), 06 [06:29](https://www.youtube.com/watch?v=Yte-UGhYkPQ&t=389s), 07 [17:22](https://www.youtube.com/watch?v=CHHH8tNioSc&t=1042s), 09 [24:03](https://www.youtube.com/watch?v=HSON-SoFz7s&t=1443s) | said | medium | `references/prompt.md` §1; `references/quality.md`, diagnosis |
| 5 | Shot and reverse shot: a reference of the set from both sides; in a reverse shot, say where the camera is and what must be in frame. | 07 [32:18](https://www.youtube.com/watch?v=CHHH8tNioSc&t=1938s), 11 [11:48](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=708s) | said | medium | `references/workflow.md` §3; `references/prompt.md` §6 |
| 6 | Named gestures, one per beat, instead of a generic verb; a fight as who stands where, the blow and the fall, with medium shots for the movement and close shots for the contact. | 02 [19:18](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=1158s), 05 [10:13](https://www.youtube.com/watch?v=wFbgrPmVXb0&t=613s) | said; the fight is shown in the final cut of 05 | medium | `references/prompt.md` §1 |
| 7 | Extras from a group reference with different people, each with one small action. | 05 [09:30](https://www.youtube.com/watch?v=wFbgrPmVXb0&t=570s), 09 [28:29](https://www.youtube.com/watch?v=HSON-SoFz7s&t=1709s), 11 [06:55](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=415s) | said | medium | `references/prompt.md` §6; `references/quality.md`, diagnosis |
| 8 | Coverage and attempts: cutaways and B-roll listed in the script draft; a missing shot made later with the same references; the budget counts the attempts; a clip shown as a screen inside a shot sets the shot's length. | 12 [22:29](https://www.youtube.com/watch?v=tW40b122Rbs&t=1349s), 02 [25:39](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=1539s), 09 [22:29](https://www.youtube.com/watch?v=HSON-SoFz7s&t=1349s) | said | medium | `references/preproduction.md`, order; `references/workflow.md` §7 and §8; `references/prompt.md` §2 |
| 9 | One short, concrete note per defect, and regenerate only that shot; a flat reference image can be retried in another image model. | 08 [08:50](https://www.youtube.com/watch?v=5HYYXYYCrL4&t=530s), 09 [06:48](https://www.youtube.com/watch?v=HSON-SoFz7s&t=408s) | the revised result is shown in 08 | medium | `references/quality.md`, diagnosis |
| 10 | A generative edit of the operator's own footage: the clip, the moment of the change and a list of what stays. | 06 [02:10](https://www.youtube.com/watch?v=Yte-UGhYkPQ&t=130s) | said; the result is shown | medium | `references/prompt.md` §2; scope table in `SKILL.md` |
| 11 | The previous clip as a video reference for continuity, on a model that accepts video references. | 04 [04:46](https://www.youtube.com/watch?v=zYPgz6sOy74&t=286s) | said | low, to test | `references/prompt.md` §2, Sequence |
| 12 | A transition hidden in a gesture or in something passing the lens. | 11 [08:20](https://www.youtube.com/watch?v=kFKpcCHkuPI&t=500s) | said | low | `references/prompt.md` §6 |
| 13 | A music track as an audio reference to time the motion to the beat. | 02 [30:22](https://www.youtube.com/watch?v=3rDs6FhFoUQ&t=1822s) | said | low, to test | `references/prompt.md` §3 |

## Decisions

- **A 3D blocking render as a reference** (01 [03:50](https://www.youtube.com/watch?v=OiULPvTJ-0E&t=230s), 10 [01:26](https://www.youtube.com/watch?v=vUYq38wC_xI&t=86s) and [11:07](https://www.youtube.com/watch?v=vUYq38wC_xI&t=667s)). Adopted as a reference only: a render made
  in another tool can drive the camera path and timing, with the motion of people written in the text. Building the
  render stays outside this skill (`SKILL.md` scope table; `references/prompt.md` §2).
- **A cut on purpose inside a shot** (07 [27:08](https://www.youtube.com/watch?v=CHHH8tNioSc&t=1628s)). Allowed when it is written with its timing, on a model whose catalog
  lists multi-shot, after a test; a cut nobody asked for stays a defect (`references/quality.md`).
- **One camera movement per shot** (01 [02:58](https://www.youtube.com/watch?v=OiULPvTJ-0E&t=178s), 10 [08:07](https://www.youtube.com/watch?v=vUYq38wC_xI&t=487s)). Kept. A continuous path copied from a blocking reference
  counts as one movement (`references/prompt.md` §1).

## Not adopted

- Prices and credit counts said in the videos, such as a number of images per credit or the credits of a whole ad:
  the skill always quotes.
- "Best model" opinions, and any capability not confirmed in the catalog.
- Negative phrases seen in the channel's prompts ("no 3D render", "never plastic skin"): the skill keeps describing
  what should appear.
- "Do not plan every shot, give camera rules" (05 [12:21](https://www.youtube.com/watch?v=wFbgrPmVXb0&t=741s)): the shot table is the core of the skill.
- One voice track per character (12 [22:53](https://www.youtube.com/watch?v=tW40b122Rbs&t=1373s)): it belongs to an audio skill.
- Questions before the script (07 [04:49](https://www.youtube.com/watch?v=CHHH8tNioSc&t=289s)): the skill already asks only what blocks.

## Catalog check (2026-11-25, `models_explore get`)

- Seedance 2.5 and Cinema Studio 4.0: modes `t2v`, `omni_reference`, `video_edit` (billed by the length of the input
  video) and `video_extension`; up to 10 video references and 10 audio references.
- Seedance 2.0: up to 3 video references and 3 audio references, each 2 to 15 s; audio references need an image or
  video reference too; no video-edit mode.
- None of the three is tagged multi-shot.
- Seedance 2.5 has a 480p `draft` that can be finalized within seven days (`draft_job_id`); `references/models.md`
  already points to it.

## Still open

- The `SKILL.md` description, which decides when the skill is called, still sends "editing recorded footage"
  elsewhere. Lesson 10 is reached once the skill is running; changing the description needs a routing test first.
- Lessons 11 and 13 are adopted as things to test; their original conditions and a reproduction are in
  [tests/to-test.md](tests/to-test.md). Record the result here when they are tested.
- [Batch 2](2026-11-higgsfield-channel-2.md#what-batch-2-says-about-batch-1) corroborates lessons 1 to 5, 7, 8 and
  10, refines lesson 9 and weakens lesson 6.
