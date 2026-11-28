title: Hands: four new tests in test_hands.mjs expect more than the code promises
labels: bug, good first issue
order: 1
area: Tests
files: tests/test_hands.mjs
after: 
---
Part of TRACKING.

Four of the tests near the end of `blocking-studio/human-generator/tests/test_hands.mjs` (just before the
"Hand DNA" section) fail on the branch. In each case the code does the right thing and says so; the test's
expectation is too strict. Fix the tests, not the code.

## The four failures

1. **"folded fingers close until the fingertip rests on the palm, and say so (hand-folded)"**
   fails with `newborn HP04`, `fingers.pinky` expected but not said.
   The list of folded fingers per pose (`HP04`, `HP14`: all four fingers; `HP07`: ring and pinky; `HP22`: middle and
   ring; `HP23`: pinky) holds on the reference body. On a newborn the little finger is short enough that it does not
   reach the palm, so it is not folded and not said.
   *Fix:* assert the exact list only on the reference body. On the other bodies, assert that every finger said with
   `hand-folded` is in the pose's list, and check the fingertip-to-palm gap (bound 1.5 mm on the reference hand's
   scale) only for the fingers that were said.

2. **"the finger controls move their finger only: curl, spread and twist on the bones, the other fingers left where
   they were"** fails with `middle {"spread":1} moved Ring_01 by 3.128 mm`.
   Opening the middle finger pushes the ring finger, and the solver says so:
   `{ rule: "hand-finger-spread", path: "fingers.middle+ring", detail: "spread opened by 8 deg in all (middle 16, ring 8)" }`.
   The test builds its set of fingers the solver was allowed to move from each correction's path, but takes
   `middle+ring` as one name.
   *Fix:* split the second part of a `fingers.` path on `+`.

3. **"a plane under every pose: each builds, finite and clear, and a grip strength on a plane is said to be
   ignored"** fails with `HP15: grip strength on a plane`.
   HP15 is the hook grip: it holds a bar, so a plane is not drawn there, and that is what is ignored:
   `{ rule: "hand-grip-ignored", path: "object.shape", detail: "the hook holds a bar (a cylinder): \"plane\" is not drawn there" }`.
   The grip strength is then applied (`{ rule: "hand-grip", path: "grip_strength" }`).
   *Fix:* for a pose where `object.shape` is ignored, expect `hand-grip-ignored` on `object.shape` and `hand-grip` on
   `grip_strength` instead.

4. **"a contact the mesh cannot meet is said: within the tolerance, or a hand-contact-missed correction that names
   it"** fails with `newborn HP06: a contact error of 1.0 mm, not said`.
   `hand-contact-missed` is about the thumb's contact with the hand itself. HP06 is a tight grip on an object, whose
   contact error is measured to the object's surface.
   *Fix:* check the contact error only for the thumb-to-hand contact types: `thumb_index_tips`, `thumb_ring`,
   `thumb_middle_ring`, `thumb_pinky`, `thumb_over_fingers` and `thumb_palm`.

## Done when

The four tests pass, and each still fails when the behaviour it guards is broken: for example, make the solver stop
saying `hand-folded` or `hand-contact-missed`, and the test must fail. Say in the pull request how you checked this.

## How to check

From `blocking-studio/human-generator/`:

```bash
node --expose-gc --test --test-name-pattern="folded fingers|finger controls move|a plane under|cannot meet" tests/test_hands.mjs
```
