# Price history

What the Higgsfield connector quoted, week by week, for the same requests: one row per model and tier, in credits.
Each record is the day's price table that `connector.py prices` makes, added here once a week, so the chart below
shows how prices move.

**This is a record, not a price list.** A row says what was quoted on its date. The skill never reads this folder: to
choose or plan it uses the day's table in the project folder, and before generating it quotes the exact request and
waits for the operator's "ok" ([`AGENTS.md`](../AGENTS.md#no-data-that-goes-stale)).

## Add this week's record

Once a week, from a computer where `connector.py login` was done:

```bash
python3 higgsfield-director/scripts/connector.py prices --file /tmp/prices.json   # the quotes cost no credits
python3 tools/aggregate_prices.py --add /tmp/prices.json                           # the record and this page
```

Then open a pull request titled `Price record YYYY-MM-DD` with the new file and this page, as every change here
([`CONTRIBUTING.md`](../CONTRIBUTING.md)). The script refuses a second record in the same week (Monday to Sunday) and
a table it cannot read; `tools/check_repo.py` fails when this page is out of date.

Prices can depend on the account's plan. If every row differs from the last record, say in the pull request which plan
quoted them: a series mixing plans shows a change that did not happen.

## Before the first record

Higgsfield's own blog published prices before this record began. They stay out of the chart: they are the
website's prices for 10-second clips, and the record is the connector's table of 5-second clips. To compare them
without scaling anything, the same requests were quoted through the connector on 2026-11-27.

| Model | Request | Published | Source (date the page gives) | Quoted on 2026-11-27 |
|---|---|---:|---|---:|
| `cinematic_studio_video_4_0` | 10 s, 480p, 16:9, sound on | 30 | [Cinema Studio 4.0 guide](https://higgsfield.ai/blog/cinema-studio-4-0-complete-guide) (pricing checked on 2026-10-24) | 30 |
| `cinematic_studio_video_4_0` | 10 s, 720p, 16:9, sound on | 70 | same | 70 |
| `cinematic_studio_video_4_0` | 10 s, 1080p, 16:9, sound on | 160 | same | 160 |
| `seedance_2_5` | 10 s, 720p, sound on | 70 | [The cost of an AI video](https://higgsfield.ai/blog/how-much-does-ai-video-cost-2026) (checked on 2026-10-30) | 70 |
| `seedance_2_5` | 10 s, 1080p, sound on | 160 | same | 160 |
| `kling4_0` | 10 s, 720p | 27.5 | same | **25** |
| `kling4_0` | 10 s, 1080p | 40 | same | **37.5** |
| `kling3_0` | 10 s, 720p (`std`); the post does not say whether sound was on | 20, "approximate" | [AI video credits explained](https://higgsfield.ai/blog/ai-video-credits-explained) (published 2026-08-03) | 20, sound on |

Only Kling 4.0 differs: 2.5 credits less at both resolutions. The posts give the regular price shown on the
Generate button and say generation discounts are personal, so the difference may be a price change or a discount of
the account that quoted. Prices from other sites were not used: they disagree with each other and name no date.

## The record

<!-- prices:start -->
The chart starts with the second weekly record: one week (2026-11-27) has no line yet.

The index is the mean, over the rows quoted in both, of each row's credits against its credits on 2026-11-27: 100 means no change, 110 means 10% more on average.

| Model | Tier | Duration | Sound | 2026-11-27 | Since 2026-11-27 |
|---|---|---|---|---:|---:|
| `cinematic_studio_video_3_5` | 480p | 5 s | on | 17.5 | = |
| `cinematic_studio_video_3_5` | 720p | 5 s | on | 25 | = |
| `cinematic_studio_video_3_5` | 1080p | 5 s | on | 65 | = |
| `cinematic_studio_video_4_0` | 480p | 5 s | on | 15 | = |
| `cinematic_studio_video_4_0` | 720p | 5 s | on | 35 | = |
| `cinematic_studio_video_4_0` | 1080p | 5 s | on | 80 | = |
| `gemini_omni_flash_1_2` | 360p | 5 s | — | 3.75 | = |
| `gemini_omni_flash_1_2` | 720p | 5 s | — | 11.25 | = |
| `gemini_omni_flash_1_2` | 1080p | 5 s | — | 16.25 | = |
| `gemini_omni_flash_1_2` | 4k | 5 s | — | 33.75 | = |
| `kling3_0` | std | 5 s | on | 10 | = |
| `kling3_0` | pro | 5 s | on | 12.5 | = |
| `kling3_0` | 4k | 5 s | on | 30 | = |
| `kling4_0` | 720p | 5 s | — | 12.5 | = |
| `kling4_0` | 1080p | 5 s | — | 18.75 | = |
| `kling4_0` | 4k | 5 s | — | 45 | = |
| `magi_2` | 1080p | 5 s | on | 12.5 | = |
| `minimax_h3` | 2K | 5 s | — | 10 | = |
| `seedance_2_5` | 480p | 5 s | on | 15 | = |
| `seedance_2_5` | 720p | 5 s | on | 35 | = |
| `seedance_2_5` | 1080p | 5 s | on | 80 | = |
| `seedance_2_5` | 4k | 5 s | on | 140 | = |
| `veo3_1` | basic | 4 s | — | 16 | = |
| `veo3_1` | high | 4 s | — | 16 | = |
| `veo3_1` | ultra | 4 s | — | 36 | = |
| `veo3_1_lite` | — | 4 s | on | 6 | = |
| `wan3_0` | 480p | 5 s | on | 3.75 | = |
| `wan3_0` | 720p | 5 s | on | 7.5 | = |
| `wan3_0` | 1080p | 5 s | on | 15 | = |

Credits per generation, each model from its cheapest tier. Sound: the setting the quote sent; — means the model takes no sound setting in the catalog, not that it has no sound.

Generated by `tools/aggregate_prices.py` from 1 record(s) in `price-history/`, the last 1 shown.
<!-- prices:end -->
