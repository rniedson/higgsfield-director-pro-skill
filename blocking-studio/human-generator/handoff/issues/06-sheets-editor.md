title: Hands: regenerate the orthographic sheets and look at every pose in the editor
labels: enhancement, help wanted
order: 6
area: Review
files: 
after: 1, 2
---
Part of TRACKING.

The tests check numbers; they do not show whether a pose reads as what it is meant to be. Two things to look at once
the tests pass (TRACKING's first tasks), and again before the final pull request.

## The sheets

```bash
cd blocking-studio/human-generator
node tools/hand_sheets.mjs /some/folder/outside/the/repository
```

writes SVG sheets: the 24 poses per level, the exploded pieces, the wrist, the levels of detail, left and right.
Sheets are output, not source: keep them out of the repository. To turn an SVG into a PNG, headless Chrome works:

```bash
"<path to Chrome>" --headless=new --hide-scrollbars --window-size=1600,1200 --screenshot=out.png <in.svg as a file URL>
```

Look for: a pose that does not read as its name at a level (`readable` level 1 above all, then level 2); a thumb
through the palm or a finger; a gap at the wrist; a left hand that is not the mirror of the right; labels that
overlap.

## The editor

Serve `blocking-studio/human-generator/` (`python3 -m http.server` from that folder) and open `index.html`. Go
through the hand controls: every pose on both sides, each level and level 1's two variants, the modes, the finger
and thumb controls at their ends, a grip with an object, and a baby, a child and two adults of different builds.

## Done when

A comment on this issue with the sheets attached (or linked) and a short list of what looked wrong, each either fixed
in a pull request or opened as its own issue.
