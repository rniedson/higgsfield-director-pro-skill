# Examples: `examples/`

What the skill's work looks like, ready to copy. The images here were made the way the skill asks, on generic scenes;
nothing here comes from a client or a real production.

| | | |
|:---:|:---:|:---:|
| <a href="references/README.md#character-sheet"><img src="references/character-sheet.jpg" width="260" alt="Character sheet"></a><br>**Character sheet**<br>one face; the body cropped at the neck | <a href="references/README.md#location-in-two-views"><img src="references/two-view-location.jpg" width="260" alt="Location in two views"></a><br>**Location in two views**<br>the room and the way in, no people | <a href="references/README.md#a-set-detail"><img src="references/photo-wall.jpg" width="260" alt="A set detail"></a><br>**A set detail**<br>the detail the action ends on |

[`references/`](references/README.md) holds the three images and the exact prompt that made each one.

## How a reference enters a video

```mermaid
flowchart LR
    P[the prompt<br/>in references/] --> I[a still image<br/>the cheapest step]
    I --> OK{the operator<br/>approves it?}
    OK -- no --> P
    OK -- yes --> N["named in the video prompt, with its scope:<br/>@image1 is the character, identity only"]
    N --> V([the video shot])
```

A reference does one job, and the prompt says which: the face only, the layout of a place, or one object. A sheet's
grey background, for example, is named as something that stays out of the shot.

## More to look at

| Where | What you see |
|---|---|
| [docs/demo/](../docs/demo/README.md) | a whole shot made one step at a time: four stills, a draft, the 1080p final, with each step's credits |
| [higgsfield-director/templates/](../higgsfield-director/templates/README.md) | projects to copy: a 3-shot commercial, a shot from a photo, a score |
| [lessons-learned/tests/](../lessons-learned/tests/README.md) | the tests behind the lessons, with frame sheets |
| [calibration/](../calibration/README.md) | the blind rounds with and without the skill, and how each was voted |

The license of the three images is still the maintainer's to decide ([references/](references/README.md)).
