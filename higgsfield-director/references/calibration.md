# Blind calibration: with and without the skill

The question that matters is "**for me**, does the skill make a difference?". The honest answer comes from a blind
test: the same request, made with and without the skill, and the person chooses without knowing which is which. If
they do not choose the skill, the skill needs to improve, and the result shows where.

Calibration is **optional**: offer it on first use (`references/modes.md`) and when the operator asks. It spends
credits (the shots of both conditions), quoted first and with their "ok".

## Step by step

1. **The request.** A real request, of the kind the operator usually makes (product ad, scene with a character,
   trailer...). Fix the model, duration, resolution and sound in the request itself, so both conditions cost the
   same. Save it in `request.txt`.
2. **The two conditions, without spending.**
   - In Claude Code: `scripts/calibrate_claude_code.sh request.txt <new-folder>`. The script opens two new sessions,
     one with the skill and one without, with the generation tools blocked, and each one saves its own
     `params.json`. It refuses to run if the skill is installed for the whole user, because then the "without"
     session would see it.
   - In another environment: open two new conversations, one where the skill is not installed, paste the same
     request and ask for the parameters in JSON, without generating.
3. **Random draw.** `hfd.py blind --with with/params.json --without without/params.json --out <folder>/blind`. The
   command checks that both conditions ask for the same format (model, duration, aspect ratio, resolution, sound),
   draws who is X and who is Y, saves `blind-requests.json` and the key (`blind-key.json`, which only the file's owner
   can read) **without showing it**. Separately, it draws which of the two appears first (`show_first`).
4. **Generate.** If either condition asked for a reference image, generate it first, with its quote included. Quote
   the total, ask for the "ok" and generate the requests in `blind-requests.json` as they are.
5. **Vote.** Show first the version drawn in `show_first` (on the left, or playing first) and then both together,
   side by side. Whoever sees one first tends to choose the first; the separate draw spreads that effect, and the
   record keeps the order (`--first`) so the scoreboard can measure it. The person chooses X, Y or tie and gives the
   reason in a few words. Record the vote **before** opening the key.
6. **Scores (optional).** A rater who sees only the request and the videos (a subagent, with no access to the key or
   the prompts) fills in one `templates/evaluation.json` for X and another for Y. The scores are a second opinion.
   In the third round the blind judge chose, in both rounds, the version the person rejected: its criteria weigh
   control (identity, camera and continuity are 45% of the score), and none asks whether the video looks natural.
   The person's vote decides; a disagreement is reported, not averaged away.
7. **Record.** `hfd.py result --key <folder>/blind/blind-key.json --vote X --category product-ad
   --model <id> --shots 3 --cost 90 --version <version>+<commit> [--reference] [--reason "..."]
   [--first X] [--evaluation-x x.json --evaluation-y y.json] --out calibration/YYYY-MM-DD-<category>-<suffix>.json`.
   The command translates the vote and the order through the key and rejects any field outside the allowlist.
   `rater` says who gave the scores (`blind-auto`, `person` or `none`); the vote is always the person's.
8. **Show the whole record** to the person. Only with their "go ahead" does it become a contribution.

## What is not a round

- **A video the voter has already seen.** The person would recognize it, so the vote is not blind. A production of
  their own, followed step by step, can be shown as an example; it is never scored.
- **One side only.** A good result made with the skill, with nothing made without it from the same request, shows the
  process, not the difference. It does not enter the scoreboard.
- **Work done outside the skill.** If the sound, the edit or the grade was added with another tool after the
  generation, the round also compares those tools: do the same post-production on both sides, or none.

## Contributing to the repository

The record goes into the repository's `calibration/` folder by pull request (see CONTRIBUTING). CI checks each file
against the same allowlist, and `tools/aggregate_calibration.py` adds everything up into the README table. That way
the scoreboard shows, per request type, where the skill wins and where it loses, and each loss becomes a fix.

| Goes into the record | Never goes in |
|---|---|
| date, skill version, request type, model, number of shots, credits spent, whether a reference image was used | the request text, the prompts, the images and the videos |
| the vote (with, without or tie), which version was seen first and, if the person wants, the reason in up to 160 characters | names, clients, brands, links, emails, file paths |
| the rater's scores per criterion | the draw key and the generation ids |

## Lessons from the first calibrations

- In the first round, the version without the skill won "for the motion, action, emotion, sound". The fix (impact
  per shot, motion that fits the final state, a reference image of the product) became a rule in
  `references/prompt.md`.
- In the rematch, with the fixes, the person and the blind rater chose the version with the skill in both rounds,
  "for the whole: how one scene connects to the next". The person themselves recalled that the version with the
  skill had appeared first in both; hence the separate draw of the order.
- A shot can be rejected by the connector's copyright filter in both conditions at the same time. Do not try again
  without the "ok": compare the shots that are left on both sides.
