# Reproduction cards

A lesson taken from a video is a claim made under certain conditions. To test it, those conditions have to be known:
a test run under different ones can neither confirm nor refute it. Each card here records what the source **showed**
(not only what it said), how to run the test, and, once run, what happened here and how the run differed from the
original.

A card exists for every lesson that is adopted as something to test, and for every lesson of medium strength that
changes a rule of the skill. Sources are linked at the exact second; frames of a source are never copied here. The
images in each test's folder are frame sheets of this project's own generations, made from generic scenes.

## Cards

| Card | Lesson | Status |
|---|---|---|
| [2026-11-25-timed-beats.md](2026-11-25-timed-beats.md) | timed beats in a prompt make the model cut ([batch 2, lesson 1](../2026-11-higgsfield-channel-2.md#adopted)) | run once: not reproduced under simpler conditions |
| [2026-11-25-timed-beats-faithful.md](2026-11-25-timed-beats-faithful.md) | the same, under the original's conditions as far as they are shown | run: not reproduced (0 of 4) |
| [to-test.md](to-test.md) | the lessons still waiting for a test, with their original conditions | not run |

## How a card is written

1. **Claim**, in one sentence, with a link to the lesson.
2. **Original: shown.** Model and version, mode, references (how many, of what), duration, resolution, aspect ratio,
   sound, the structure of the prompt (paraphrased), the number of attempts and how many failed, and how the result
   was judged. Each item marked *on screen*, *said*, or *not shown*, with a link to the second.
3. **Original: only said.**
4. **What cannot be known** from the source.
5. **Run here.** The scene (generic: no brand, no real person), the one thing that varies, the parameters, the full
   prompts (ours, so they go in whole), the attempts per version, the quote and the actual cost.
6. **Difference from the original.** Every condition that was not matched. This comes before the result: a result
   is only read against it.
7. **Measure.** What is counted or compared, and how (scene detection, a frame sheet every 0.5 s, listening). A
   measure that reports nothing is checked first on a case made on purpose: scene detection missed a hard cut
   between two similar dark shots ([the closer timed-beats card](2026-11-25-timed-beats-faithful.md#measure)).
8. **Result.** Per attempt, with the frame sheet; what was seen; what the skill does with it.
