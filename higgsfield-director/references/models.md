# Choosing the model

**The source of truth is the live catalog** of the connector (`models_explore`: `recommend` to suggest, `get` for
one model's limits). `data/models.json` is a **dated snapshot** of the same catalog, for working without the connector
and for `hfd.py validate` to check duration, aspect ratio, resolution and audio. When citing a limit, say where it
came from and its date. If the import updates only part of the catalog, each model keeps its own update date; the
file's overall date records when the snapshot was saved. The old-snapshot warning uses the date of the chosen model.

```bash
python3 <skill>/scripts/hfd.py models --type video            # summary of all
python3 <skill>/scripts/hfd.py models --search "first-last"   # search the snapshot
python3 <skill>/scripts/hfd.py models --id seedance_2_5       # full entry
```

## By need (snapshot of 2026-11-24: 66 video models, 56 image models)

| I need… | Start with | Why |
|---|---|---|
| Shot up to 30 s long | `cinematic_studio_video_4_0`, `seedance_2_5`, `kling4_0`, `magi_2`, `wan3_0` | maximum duration 30 s in the catalog |
| Cinema control (lens, camera, era, light) | `cinematic_studio_video_4_0` | has `camera_model_id`, `camera_lens_id`, `camera_aperture_id`, `era_id`, `genre_id`, `pacing_id`, `light`, `color_palette` |
| Many references (product, identity, style) | `cinematic_studio_video_4_0`, `seedance_2_5` | up to 30 images, 10 videos, 10 audio files (`omni_reference` mode) |
| First **and** last frame | `kling3_0`, `seedance_2_5`, `cinematic_studio_video_4_0` (`omni_reference` mode), `cinematic_studio_video_3_5`, `wan3_0`, `minimax_h3`, `veo3_1_lite`, `gemini_omni_flash_1_2` | `end_image` role in the catalog |
| Several shots in one generation, each with its own prompt and duration | `cinematic_studio_video_3_5` | `multi_shots` and `multi_prompt` (up to 6 shots) in the 2026-11-25 catalog; `kling3_0` is tagged multi-shot but has no control in the connector |
| Native audio and speech | `cinematic_studio_video_4_0`, `seedance_2_5`, `kling3_0` (`sound`), `veo3_1`, `wan3_0` | audio parameter or "audio" tag |
| Edit or extend a video | `cinematic_studio_video_4_0`, `seedance_2_5` (`video_edit`, `video_extension`), `kling4_0` | modes in the catalog |
| Test composition cheaply | on the same model, at the lowest resolution it accepts (quote the test and the final); `seedance_2_5` has `draft` | a test on another model does not predict the final result |
| Realistic image of a person/fashion/UGC | `soul_2` | "Realistic UGC, fashion editorial and character" |
| Cinema still / concept art | `soul_cinematic`, `cinematic_studio_image` | "Cinema-grade stills and concept art" |
| Readable text in the image, diagram | `nano_banana_pro`, `ideogram_4_6` | "text and diagrams"; masked editing |
| General image use, GIF/SVG | `gpt_image_2_6` | the connector's default for images |
| Transparent background, PNG | `seedream_5_5` | "optional transparent background" |
| Vector, logo, icon | `recraft_v4_1` | `model_type` for vector |

Price is not stored: it changes with model, duration, resolution, mode, sound and plan, and it changes over time.
**Always quote** with `estimate_video_cost` / `estimate_image_cost` (costs nothing, returns `quote_ref`) and never
use a remembered number.

## Video generation models in the snapshot (2026-11-24)

| id | name | duration (s) | audio | 1st/last frame | refs | modes |
|---|---|---|---|---|---|---|
| `cinematic_studio_video_4_0` | Cinema Studio 4.0 | 4–30 | yes | 1st+last | audio, image, video | t2v, omni_reference, video_edit, video_extension |
| `cinematic_studio_video_3_5` | Cinematic Studio 3.5 | 4 or more (default 15) | yes (off by default) | 1st+last | audio, image, video | multi-shot (`multi_prompt`), checked live 2026-11-25 |
| `seedance_2_5` | Seedance 2.5 | 4–30 | yes | 1st+last | audio, image, video | t2v, omni_reference, video_edit, video_extension |
| `seedance_2_5_flash` | Seedance 2.5 Flash | 4–30 | yes | 1st+last | audio, image, video | same |
| `seedance_2_0` | Seedance 2.0 | 4–15 | yes | 1st+last | audio, image, video | std, fast |
| `kling4_0` | Kling 4.0 | 3–30 | ? | 1st+last | image, video | text/image/reference-to-video, video-edit |
| `kling_4_0_flash` | Kling 4.0 Flash | 3–20 | ? | 1st | image, video | same |
| `kling3_0` | Kling 3.0 | 3–15 | yes (`sound`) | 1st+last | — | std, pro, 4k (quality) |
| `kling_o3_image_reference` | Kling 3.0 Omni | 3–15 | yes (`sound`) | — | image | std, pro, 4k; multi-shot |
| `veo3_1` | Google Veo 3.1 | 4/6/8 | yes | 1st | — | preview/fast variant |
| `veo3_1_lite` | Google Veo 3.1 Lite | 4/6/8 | yes | 1st+last | — | — |
| `gemini_omni_flash_1_2` | Gemini Omni Flash 1.2 | 3–15 | yes | 1st+last | image, video | t2v, i2v, ref, edit, extend |
| `wan3_0` | Wan 3.0 | up to 30 | yes | 1st+last | audio, image, video | — |
| `wan2_7` | Wan 2.7 | 2–15 | yes | 1st+last | audio | — |
| `minimax_h3` | MiniMax H3 | 4–15 | ? | 1st+last | audio, image, video | — |
| `minimax_hailuo` | MiniMax Hailuo | 6/10 | ? | 1st+last | — | — |
| `magi_2` | MAGI-2 | 4–30 | yes | 1st+last | audio, image, video | — (has `seed`) |
| `flux_3_video` | FLUX 3 Video | 5–20 | yes | 1st+last | image, video | — |
| `grok_video_v15` | Grok Video 1.5 | 2–15 | yes | 1st | audio, image | — |

"?" = the catalog does not show it; check with `models_explore get`. Left out of this table are the tool models
(upscale, background removal, dubbing, lipsync, reframe, Genjutsu, Editing Room…): see `references/connector.md`.

## Warnings as of 2026-11-24

- **Sora 2:** it is not in the Higgsfield catalog; the press (CBS, Axios, 2026-03-24) reported it was discontinued.
- **Veo 3.1 "preview":** Google's documentation says Veo 3.1 Preview was shut down on 2026-10-22; the connector
  still offers the `veo-3-1-preview` variant. Prefer `veo-3-1-fast` or check live.
- **Cinema Studio 3.5:** `prompt_language` defaults to `zh` and `generate_audio` to off (live catalog, 2026-11-25).
- **MiniMax:** there is a third-party report that Hailuo 2.3 became legacy and H3 is the current one (not confirmed).

## Validate against the live limits (studio mode, with connector)

Save the `models_explore get` response for the chosen model in a project file and import only that one:
`python3 <skill>/scripts/hfd.py models --import <project>/get.json --out <project>/models.json`. The `get` adds or
updates that model without removing any other. Then use `--snapshot <project>/models.json` in `validate`, `compile`
and `export`: validation then uses today's limits, not those of the snapshot that ships with the skill.

## Update the whole snapshot (when it is more than 30 days old or a cited model is not in it)

1. Call `models_explore` with `action: list`, `type: video`, `limit: 100`; save the JSON response in a file.
   Repeat with `type: image`. (In Claude Code, a large response already comes saved in a file; use that path.)
2. Build the new snapshot **outside the skill folder**, with all lists in the same command:
   `python3 <skill>/scripts/hfd.py models --import video.json image.json --out <project>/models.json`.
   For each imported type, whatever did not come in the list leaves the snapshot; check `removed` in the response
   (a list cut off at 100 items removes models that still exist: import all pages together).
3. Use that snapshot with `--snapshot <project>/models.json` in `validate`, `compile`, `export` and `models`.
4. Updating the snapshot that ships with the skill is work for whoever maintains the repository:
   `--out <clone>/higgsfield-director/data/models.json`, run `python3 -m unittest discover -s <skill>/tests`, review
   the table above if something big changed and commit.
