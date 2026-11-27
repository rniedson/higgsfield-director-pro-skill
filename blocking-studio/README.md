# Blocking studio

An engine for animated 3D storyboards in Three.js, to plan a video before generating it on Higgsfield.

Each AI-generated shot costs credits every time it is generated, and a shot that was not thought through is often
generated again. An animated storyboard costs no credits: gray figures move in the right places and are seen from the
right camera, so the timing, the framing and the camera move are settled before the first credit is spent. Its frames
can then go to the [higgsfield-director](../higgsfield-director/SKILL.md) skill in this repository as camera or
position references. The skill takes them but never makes them: they are made here.

It belongs to the first step of the pipeline, pre-production and storyboard
([`preproduction.md`](../higgsfield-director/references/preproduction.md)). There, the skill's sketch storyboard is drawn
by an image model, at a fraction of a credit per frame, and shows still poses. The 3D storyboard shows the motion and
costs no credits.

The studio starts with its first asset, an articulated mannequin. The engine that stages, animates and renders the
storyboard comes next. This folder is not part of the installed skill.

## What is here

| Folder | What it is |
|---|---|
| `assets/characters/mannequin/` | the articulated mannequin, its rig data, the design sheets and the raw source model ([README](assets/characters/mannequin/README.md)) |
| `tools/blender/` | Blender scripts, run headless, that build and check the assets |
| `viewer/` | a single-page Three.js viewer to load a GLB, pose its bones and test it |
| `docs/` | images referenced by the READMEs |

## Look at the mannequin

From the repository root, serve it and open the viewer:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Then go to <http://localhost:8766/blocking-studio/viewer/index.html>.

- **Panel:** a slider per bone and axis, a test pose, fixed views (front, 3/4, side, back) and the skeleton.
- **Other files:** `?glb=<path>` loads another GLB, relative to the viewer.
- **Console:** `boneWorldPositions()` returns every bone's position in the world, to check a pose by numbers.
- **Three.js:** loaded from the jsDelivr CDN (`three@0.170.0`). No build step and no install.

## Rebuild and check the mannequin

The scripts need Blender (tested with 5.3). On macOS the binary is `/Applications/Blender.app/Contents/MacOS/Blender`.
Run them from this folder (`blocking-studio/`).

```bash
blender -b --factory-startup --python-exit-code 1 -P tools/blender/convert_meshy_mannequin.py -- assets/characters/mannequin/source/meshy_four_views.glb assets/characters/mannequin/mannequin.glb
```

```bash
blender -b --factory-startup --python-exit-code 1 -P tools/blender/render_pieces_by_bone.py -- assets/characters/mannequin/mannequin.glb /tmp/mannequin-pieces
```

- **The converter** prints `CUT` (how many openings were capped and how many left open) and `RESULT`: triangles,
  ball joints and bones.
- **The checker** paints each piece with the colour of its bone and renders 4 views at rest and 2 in a test pose.
  `--gray` keeps the file's own materials.

## Conventions

- **Files:** glTF 2.0 binary (`.glb`), Y up, metres, character facing +Z, with its left side on +X.
- **Bone names** come from the mannequin's bone sheet (`Pelvis`, `Spine_01`, `UpperArm_L`, ...), so a pose or clip made
  for one character fits the others.
- **Rigid pieces:** each piece follows one bone, and ball joints fill the gaps.
- **Language:** everything in the folder is in English, file names included, as in the rest of the repository.
