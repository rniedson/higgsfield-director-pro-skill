# Cheap pre-production: from idea to official script

Before the final storyboard and any video, the idea matures where mistakes cost little. Here the spending is almost
all **tokens**, because the agent is the one who writes the idea and the script (the connector has no text model),
plus a fraction of a credit for the sketch.

## Order

1. **Idea:** one sentence (who, what, the twist), plus format, duration and destination.
2. **Script draft:** a short table with shot, duration, what is seen and what is heard. No prose. List the coverage
   too: the cutaways and B-roll the edit will need, so a missing shot is not improvised later.
3. **Sketch storyboard:** Phase A and then Phase B (below). Pose, action, camera and who is who.
4. **Refinement:** idea, script and sketch change together. Rewrite only the part that changed; redo only the frame
   that changed.
5. **Official script:** the operator locks the version. From here on, changing costs credits.
6. **Audio:** ask where to generate it (below) before any spending on voice.
7. **Final storyboard** with bibles and references (`references/workflow.md` §4), then the video test and the final.


## Review page

In any work with a sketch storyboard, a storyboard or generated images, keep a local `review.html` in the
production folder, outside this shared skill's repository. Briefs, images and results stay with the operator's
project. The page is part of the delivery, even when the work stops before generation. As soon as you
create or update it, open the file through the system (on macOS, `open /absolute/path/review.html`, without `-a`) so
the director chooses how to open it. Also give the clickable absolute link. Check on the opened page that the images
load; if you cannot open a graphical interface, say so and give the link. Use relative paths inside the HTML so the
folder can be moved as a whole.

- Show the sheet and the frames produced side by side, per shot and per version. When there is a Phase A and a
  Phase B, show the crop used as the reference next to the result. Caption the model, the settings and the exact
  cost of each generation when known.
- Record the shot's intent, what was actually seen, the decision (approve, adjust or redo) and the change for the
  next version. Keep earlier versions available to compare, without silently replacing images.
- Keep confirmed data apart from plans: do not attribute credits, a model, an approval or a quality to a generation
  that did not happen. If only the local helper was tested, show the test files and say that they are synthetic.
- Update the page before handing each round to the operator and give the link to the file. Use the visual
  comparison format of earlier versions: images side by side, cost and notes per frame; adapt the layout to the
  work.

## Spending few tokens

- Ask only what blocks; the rest becomes a stated assumption.
- One file is the source (the project). The conversation does not repeat the whole script on every turn: show what
  changed.
- Tables instead of prose.
- Looking at images costs tokens: look at each sheet once and, in that look, already link each panel to a shot and
  note each one's crop box.
- A sketch is a draft. Do not discuss drawing detail at this stage.

## Sketch storyboard

### Drawing rules

- **Blocks.** People with an oval head, a rectangular torso and stick limbs; objects as boxes and circles. A
  detailed drawing makes the model invent, and each panel comes out with a different object.
- **A face only when the expression matters** for the shot (a scream, a fright). In the others, a blank head.
- **One trait that identifies** each character (a hat, the size) and the **same shape description** in every panel.
- **State the scale:** "three times taller than him". Without it, the big object shrinks.
- **Who is where carries over.** In a scene with several people, the sketch's positions become the layout map used
  as a reference for the video (`references/workflow.md` §4).
- **Only who appears.** Each panel describes only who is in it, in a normal sentence. The "NAME = description" format
  made the model draw everyone in every panel and swap one for another.
- **Shapes, not labels.** "Robot" became a figure with a face; "a box on a conveyor belt with a round lens on the
  front, no face" came out the same in every panel.
- **No numbers in the prompt** (aspect ratio, time): the model writes the number into the image. Ask for "a very
  wide frame".
- **The camera goes on the sheet.** Tilt, low camera and movement were ignored in the sketch. Note the camera under
  the panel, on the approval sheet, instead of spending credits trying.
- Color may leak into the main object; accept it as an accent color.

### Phase A: single sheet (explore)

A fast, cheap image model, with no reference, draws all the shots on one sheet. Within the sheet, the drawing
repeats itself; it is the lowest cost in the catalog and serves well someone who does not yet know what they want.

Limits: the model obeys neither count nor order (4 panels asked for, 6 came) and sometimes puts the action on the
wrong character. Link each panel to a shot; whatever is left over stays out.

```text
A storyboard sheet on off-white paper with four panels in a two by two grid, each panel a very rough abstract
pencil thumbnail: block figures and block objects, few quick lines, no shading, no background, no text, no numbers.
The same characters appear drawn exactly the same in every panel: <the shapes of each one, with the scale>.
Top left: <action>. Top right: <action>. Bottom left: <action>. Bottom right: <action>.
```

### Phase B: separate frames (work)

1. **Crop** the sheet with the boxes noted during the look (fractions from 0 to 1):
   `python3 scripts/hfd.py crop sheet.png panels/ T01:0.04,0.07,0.33,0.48 T02:0.35,0.07,0.65,0.48`.
   The command only writes the ffmpeg commands; run them. Automatic detection of the borders was tested and
   discarded: the drawn border is crooked and broken.
2. **Upload** each crop to the connector (`media_upload`, PUT, `media_confirm`). Uploading costs no credits; a 5xx
   error on the PUT passed on the second attempt.
3. **Generate one frame per shot** in a cheap image model that accepts a reference, at low quality, with that shot's
   own crop as the reference and only what changes in the text.

In the test, the four frames came out with the same line work, the same object and the same character, the four
right actions, and they fixed what the sheet had got wrong. Each frame is redone on its own, without redoing the
sheet.

```text
Redraw the reference panel as one full storyboard frame in exactly the same style: <the same shapes of each one>.
Very rough abstract thumbnail, few lines, no background, no text, no frame border.
Changes: <what changes in this shot>; blank head, no face <when the expression does not matter>.
```

Both templates were tested on 2026-11-25 with `z_image` (Phase A) and `gpt_image_2` with `quality: low` (Phase B);
confirm the models in the live catalog. The short negations worked in this scribble style; for video, the rule of
describing what should appear still applies.

### Cost

Always quote; the price changes. In the test quote, the whole Phase A sheet cost less than one Phase B frame, and one
Phase B frame cost a fraction of a final storyboard frame. The number shown may be rounded: the dashboard showed a
whole number and charged the `credits_exact`. Show the exact one to the operator and check the balance afterwards.

## Audio: ask where

With the official script locked, and before any spending on voice, ask where to generate the audio:

- through the connector (voice and music models from the catalog; quote);
- through a service the operator already uses (the account and the cost are theirs);
- their own recorded voice;
- a free local synthetic voice, for drafts only (the operating system's voice, for example);
- none: the sound goes in during post.

At the idea stage, the free draft is enough. Narration or voice-over comes before the video, because the timing of
the voice decides the timing of the shots. Dialogue in the scene comes from the video model with sound or from a
lip-sync step: ask which is the case before generating. A character's voice with no lips in view can also be chosen
after the performance, with `voice_change` over the clip (one tutorial; to test). Note the choice in the project's assumptions.
