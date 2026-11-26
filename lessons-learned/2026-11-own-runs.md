# Lessons from the skill's own generations

Generations made while using the skill on real work. Only the generic lesson comes here: no request text, no people,
no frames. A lesson from one run is marked that way, and the catalog is checked before it changes a rule.

| # | Lesson | Run | Evidence | Strength | Where it went |
|---|---|---|---|---|---|
| 1 | A Seedance 2.5 final made from a draft (`draft_job_id`) repeats the draft's motion at the higher resolution, and kept the draft's silence although the final asked for sound | a 10 s action scene from a start image: a 480p draft without sound, then the final at 1080p, 2026-11-25 | measured: 241 frames in both files; the same poses at the same instants in 8 frame pairs from start to end; no audio stream in either file. The catalog (2026-11-25) says the final renders the draft's whole duration; it says nothing about sound | medium (one run) | `references/models.md`, Test composition cheaply |
| 2 | A 10 s action written as one continuous motion with a described final frame ended at about 6.5 s and held still; timed beats up to 10 s filled the clip and won | a blind round, a fight in one shot, Seedance 2.5 at 480p, 2026-11-26 | the person's blind vote; a frame sheet every 0.5 s: no motion after about 6.5 s in the losing take; no cut in the winning take (scene detection at 0.3 and the sheet) | low (one round) | `references/prompt.md` §1; `references/quality.md` |
| 3 | Recipes against defects written into every prompt as prevention flattened the result: no flickering lamp, no haze, a camera that crawled | both rounds of that blind test | the two sides' prompts compared after the vote; the person named movement and atmosphere | low (one round per request type, several differences at once) | `SKILL.md`; `references/prompt.md` §1 |
| 4 | A group written as one line came out as look-alikes; a line per visible person looked natural | a blind round, a 3-shot corporate video, Cinema Studio 4.0 at 480p, 2026-11-26 | the person ("three teenagers with similar faces") and the blind judge both saw it | medium (the person and the judge agree) | `references/prompt.md` §1; `references/workflow.md` §4; `references/quality.md` |
| 5 | Interface chimes, rising beeps and an unrequested line of dialogue made the generated sound read as the stock audio of social media | the same corporate video | the person's reason; not measured otherwise | low (one round) | `references/prompt.md` §3 |
| 6 | The blind judge chose, in both rounds, the version the person rejected | both rounds of that blind test | judge 77.5 × 60.0 and 72.0 × 62.0 against the vote | low (two rounds) | `references/calibration.md`, step 6 |

| 7 | With the fix of rows 2 to 5, the skill won 2 of 2 on the same two requests it had lost 0 of 2 | a blind retest with new videos on both sides, 2026-11-26 | the person's vote, in round 2 against the order of showing; reason: the most natural, could pass for real footage | low (one round per request type) | the READMEs; the rules of rows 2 to 5 stay |
| 8 | A start image can lose the premise (a robot meant to wear the fighter's face came out with a blank chrome head); a blind round generates it without review | the retest's fight scene, a soul_2 start image | the start image, looked at after the vote | low (one image) | nothing new: the review page in `SKILL.md` is where a production catches it |
| 9 | The blind judge's score chose against the person in 4 of 4 rounds, in both directions; asked separately which version looked more natural, it agreed once in two | the third and fourth blind rounds | the four records | medium (four rounds, both directions) | `references/calibration.md`, step 6 |
| 10 | Cinema Studio 4.0 put small white crests on plain uniform shirts in group shots | the corporate video of both blind rounds, the side with the skill | the judge in both; checked at full size in the retest | low (two videos, cause unknown) | not a rule yet: check uniforms at full size |

Rows 2 to 6 come from one blind round per request type: the vote says which video won, not which line made the
difference. They are the differences between the two sides' prompts, read after the vote, and the next blind round
tests them.
