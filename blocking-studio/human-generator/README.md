# Human generator

Builds an ultra low-poly, articulated mannequin of any age, from a newborn to an adult of 100, out of a character's
DNA. Nothing is stored per character: the same DNA gives the same mesh, to the bit, with the same version of the
generator. It is the blocking studio's source of extras and of characters that the two modelled mannequins
([male](../assets/characters/mannequin/README.md), [female](../assets/characters/mannequin-female/README.md)) do not
cover, on the same 23 bones, with the same names, so a pose or a clip made for one fits the other. The hands come from
the hand library in [`hands/`](hands/) (see "Hands" below): 24 poses, four levels of detail, and in the articulated mode
15 finger bones a hand after the 23.

- **One topology.** Sex, age, height, build and proportions move vertices. They never add, remove or reorder one, so
  every character of a level of detail shares its triangles, its bone bindings and its rig.
- **Rigid pieces, one mesh.** 23 pieces for the body and the hands' own pieces (6 a hand at hand level 1), each bound
  with weight 1 to one bone, in one mesh: one draw call a character.
- **Nothing silent.** The generator never edits the DNA. What it could not use as given comes back in `corrections`,
  with the value asked for and the value used.

Status: a first version, to be approved by the maintainer. Only level of detail 1 exists for the body; the hands have
their own levels 0 to 4. The figures in this page were measured on 2026-11-27, those of the hands on 2026-11-28.

## Look at it

From the repository root, serve it and open the editor:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Then go to <http://localhost:8766/blocking-studio/human-generator/index.html>.

- **Panel:** sex, the ten stages of life and an age slider, the ten height levels, the ten builds and the seed; then
  every channel of the DNA. A ticked channel is an explicit value; unticked, it is `null` in the DNA and the slider
  shows what the preset gives.
- **Lineups:** ten ages, growth year by year, aging, ten heights, ten builds, male and female at each stage, fat
  patterns, proportions, the extremes, the 10 x 10 grid, a crowd from seeds, and the cases of the test collection.
- **Poses:** the rest pose, a test pose, and the neutral pose of the age (an infant lies on its back).
- **Hands:** the mode (auto, A, B, C) and the level (auto, 0 to 4) of the hands, the level 1 variant ('budget' or
  'readable'), each hand's pose (HP01 to HP24) and grip radius (unticked: the pose's own), and mirroring. A combination
  the generator refuses is shown with its error and undone. Lineups take the same hands; level 0 builds each new body's
  hands exactly (about a third of a second a body), so a large lineup at level 0 is slow the first time.
- **Checks:** pieces coloured by bone, wireframe, colliders, and the corrections of the character on screen.
- **URL:** `?id=F_H05_C05` or `?id=F_A05_H05_C04`, `&mode=ages`, `&view=front|three_quarter|side|back|top`,
  `&pose=test|neutral`, `&pieces=1`, `&colliders=1`, `&panel=0`, `&cases=PAIR_`, `&hands=<Hand DNA JSON>`,
  `&handVariant=readable`.
- **Three.js:** loaded from the jsDelivr CDN (`three@0.170.0`). No build step and no install.

## The DNA

The DNA is the maintainer's **Human DNA v1.0** contract: [`tests/fixtures/dna.schema.json`](tests/fixtures/dna.schema.json).
Every field is required. `null` means "inherit from the preset"; a number from 0 to 1 is an explicit value of a
normalised channel, not a clinical measure, a fat percentage or an angle.

| Field | What it is |
|---|---|
| `id` | a name: 1 to 80 letters, digits, `_` or `-` |
| `sex` | `male` or `female`: a preset of proportions, not a rule |
| `age_months` | the age, 0 to 1440 (the limit of the tests, not of biology) |
| `development_stage` | `A01` to `A10`: it must be the stage of `age_months` |
| `height_level`, `height_m` | the level `H01` to `H10` and the height in metres (see below) |
| `height_mode` | `recumbent` under 24 months (the height is a length), `standing` from there on |
| `build` | `1` to `10`: a silhouette, not a diagnosis |
| `seed` | 0 to 4294967295: carried and echoed, and it changes nothing in this version (see below) |
| `bone_structure`, `muscle_mass`, `body_fat` | the frame, and the two volumes the build sets when they are `null` |
| `proportions` | 19 channels: head, neck, shoulders, chest, bust, waist, abdomen, hips, glutes, trunk, arms, legs, hands, feet, thighs |
| `fat_distribution` | 7 weights: abdomen, chest, arms, hips, glutes, thighs, calves |
| `aging` | `skeletal_maturity`, `muscle_atrophy`, `skin_laxity` |
| `functional` | `joint_mobility`, `balance`, `motor_control`, `strength` |
| `posture` | `spine_curvature`, `pelvic_tilt`, `shoulder_alignment` (0.5 is neutral) |
| `lod` | the level of detail, 0 to 4; only 1 is built |

**Stages**, by `age_months`: A01 newborn (0), A02 infant (1 to 11), A03 toddler (12 to 47), A04 early childhood (48
to 83), A05 middle childhood (84 to 143), A06 adolescence (144 to 215), A07 young adult (216 to 359), A08 mature adult
(360 to 719), A09 older adult (720 to 959), A10 oldest adult (960 to 1440). They are presets, not clinical classes,
and nothing jumps where one ends: every curve is continuous in the age.

**Height.** For an adult (216 months and up), `H01` to `H10` are 1.40, 1.50, 1.60, 1.70, 1.75, 1.80, 1.90, 2.00, 2.10
and 2.20 m, for either sex, and `height_m` must be the level's. For a minor, `H05` is the reference stature of the age
and `height_m` is free; the contract has no table of levels for minors yet. This generator proposes one, used by the
editor and by the ids: the reference stature of the age, times the ratio the adult level has to 1.75 m.

**Ids.** `dnaFromId('F_H05_C05')` is an adult of 30 (sex, height level, build); `dnaFromId('F_A05_H05_C04')` adds the
stage, at its reference age (0, 6, 24, 60, 108, 180, 288, 480, 840 and 1020 months). 2 sexes x 10 ages x 10 heights x
10 builds: 2,000 presets, and every value between them.

### What is refused

`validate(dna)` returns `{ ok, errors }`, each error with a `stage`, a `code`, a `path` and a `message`. Nothing is
clamped or repaired, and `generate` builds nothing from a DNA that fails.

| Stage | Code | When |
|---|---|---|
| schema | `TYPE`, `RANGE`, `ENUM`, `PATTERN`, `REQUIRED`, `UNKNOWN_KEY` | the shape of the data: a missing or unknown key, a value that is not a finite number, out of range |
| semantic | `STAGE_MISMATCH` | `development_stage` is not the stage of `age_months` |
| semantic | `HEIGHT_MODE_MISMATCH` | `recumbent` at 24 months or more, or `standing` under 24 |
| semantic | `ADULT_HEIGHT_MISMATCH` | an adult's `height_m` is not its level's |
| semantic | `MINOR_ADULT_CHANNEL` | `breast_volume` or `breast_projection` is not `null` under 216 months |
| semantic | `ZERO_FAT_WEIGHTS` | every fat weight is given and they add up to zero |
| generator | `LOD_NOT_AVAILABLE` | a valid DNA asks for a level of detail that is not built |
| generator | `NON_FINITE`, `INTERNAL` | the generator failed; the caller keeps its last valid character |

## How a character is built

In the contract's order: age and sex, height and structure, build, composition and proportions, constraint
correction, rig and pose.

1. **Age and sex.** `skeletal_maturity` says how far the adult presets apply: 0 for a child, 1 for an adult. Its
   default follows the age and the sex preset (it starts at 8 years for the female preset and at 9.5 for the male one,
   and ends at 16 and 18). The DNA may move it, inside the window of the age: it cannot run ahead of age (0 under 8
   years, and 1 not before 15), and everybody is mature from 21 (at 18 the window is 0.85 to 1).
2. **A child is not an adult scaled down.** A child is the sex-neutral adult (the middle of the two presets) at the
   stature of its age, times a ratio of its own for each of 14 regions: the skull's width and depth, the shoulders,
   the chest's width and depth, the waist, the belly, the hips, the neck, the arms, the thighs, the calves, the hands
   and the feet ([`growth.js`](growth.js), `regions`). The ratios apply to the lean body; fat comes on top. The adult
   value of the sex fades in with maturity, so before maturity starts the two presets give one body, in two sizes a
   centimetre or two apart.
3. **Growing is not scaling.** The head, the legs, the arms and the neck each follow their own curve of age as well: a
   newborn's head is a quarter of its length and an adult's an eighth; the crotch sits at a third of a newborn's length
   and at almost half of an adult's height.
4. **Height.** The height below the chin is shared out by landmark fractions; the legs take their share and the trunk
   fills the rest, so the character is as tall as the DNA says. Within the proposed range of heights (0.8 to 1.26
   times the stature the shape is drawn for, the ratios of `H01` and `H10` to 1.75 m) the head grows slower than the
   height and the breadths follow its square root, so a tall character is not a wide one. Beyond that range, which
   only a minor can reach, the body is drawn at the nearest height of the range and scaled as a whole, so it keeps the
   proportions of that height, and a note says so.
5. **Build.** `build` gives `body_fat` and `muscle_mass` unless the DNA sets them. The builds are adult silhouettes:
   before 18 they act around the average of the age, within a part of their range (30% at birth, 60% at six), and a
   note says so.
6. **Fat.** The weights of `fat_distribution` are filled from the body's own pattern where `null` (a child's,
   turning into the sex preset's with maturity), then normalised: they share out the amount `body_fat` sets and never
   add any. Each region has a share of the fat the mesh can hold, measured on the mesh itself by
   [`tools/calibrate_fat.mjs`](tools/calibrate_fat.mjs) (`FAT_SHARE`), which turns its weight into how full it is; so
   bodies with the same `body_fat` and different weights carry about the same volume of fat. A region that cannot hold
   its share is filled to its limit and the rest goes to the regions that have room (`fat-region-full`); only when no
   region with a share has room is fat left out (`fat-unplaced`). A minor's limits are tighter: see "Minors".
7. **Aging.** `muscle_atrophy` thins the muscle of the limbs (most on the thigh) and the glutes, never the frame;
   `skin_laxity` moves volume down (bust, lower abdomen, glutes, jaw). Their defaults are mild from 40 and 50 years
   (0.2 and 0.4 at 75) and can be set to 0: with both at 0, a character of 85 has the body of one of 40.
8. **Constraint solver.** Legs open until the thighs and the knees clear each other (the thighs may press together at
   the top); arms open from the A pose (12 degrees) until they, and the hands' vertices in their pose, clear the trunk
   and the thighs; a bust stays on a chest
   that is narrow for it. Each of these is a correction, and a search that reaches its limit says so
   (`legs-limit`, `arms-limit`). Then the body is checked: any two pieces that still overlap, in the rest pose and in
   the neutral pose, are an `overlap` correction, and `solved` is `false`. Nothing more is moved to hide them.
9. **Rig.** The bind pose has straight limbs and no rotation on any bone; the rest pose (A pose plus posture) is a
   quaternion per bone. Pivots sit at the centres of the joints. The shoulder's ball is bound to the clavicle and
   reaches into the chest, so a raised arm opens no gap at the shoulder. A tilted pelvis can lift or sink the soles by
   a fraction of a millimetre: the body is moved back onto the floor, so the feet stand on it to a hundredth of a
   millimetre.

### Corrections and notes

| Rule | What happened |
|---|---|
| `maturity-window` | `aging.skeletal_maturity` was outside what the age allows |
| `child-build` | `body_fat` or `muscle_mass` was given on a minor: it is read on the scale of the age |
| `child-figure` | a figure channel (waist, hips, glutes, thighs, chest depth) was given on a body that is not adult: it acts within part of its range |
| `child-fat` | a fat weight was given on a body that is not adult: the minor keeps the shape of its own fat pattern |
| `minor-adult-channel` | an adult channel reached the generator on a minor's DNA (the contract refuses it first): it was not used |
| `fat-region-full` | a region could not hold its share of the fat: the rest went to the regions with room |
| `fat-unplaced` | no region with a share had room: this body carries less fat than `body_fat` asks for |
| `legs-apart`, `arms-apart` | the solver opened the legs or the arms |
| `legs-limit`, `arms-limit` | the solver could not clear a collision within its limit (`solved` is `false`) |
| `bust-on-narrow-chest` | the bust was limited to stay on the chest |
| `overlap` | two pieces still overlap, in the rest pose or in the neutral pose (`solved` is `false`) |

`notes` carry what is not a correction: a minor's height beyond the proposed range of its age (the body is scaled as
a whole), and builds acting in part on a minor.

**The seed changes nothing in this version.** A `null` is its preset, exactly, so two records that differ only by
their seed give the same body. Variety comes from `randomDNA(seed)`, which writes explicit values into a DNA, where
they can be seen and edited.

### Minors

- **No bust under 18 years.** The contract refuses `breast_volume` and `breast_projection` under 216 months, and the
  generator ignores them there should they reach it anyway. The bust has a gate by age alone: it is zero for every
  minor, whatever the maturity, the sex preset or the fat (chest fat rounds a minor's chest; it shapes no bust). From
  18 the female preset comes in over three years, so nothing jumps.
- **Maturity cannot run ahead of age** (full maturity not before 15 years), and it is reported when asked for outside
  the window of the age.
- **The figure stays the minor's own.** A minor's default figure is that of its age and maturity. What a DNA asks for
  on top of it acts in part: the figure channels within 35% of their range at the start of maturity and within 50% at
  most until 18; fat weights within the same part of their distance from the body's own pattern, and no region of a
  minor's body holds more than 1.6 times, or less than 1/1.6 of, the share its own pattern gives it. `body_fat` and
  `muscle_mass` are read on the scale of the age. The adult range comes in from 18 to 21 years. Each of these is a
  correction (`child-figure`, `child-fat`, `child-build`), never silent.
- **What that holds, measured.** Over every single-region fat pattern and four mixed ones, at `body_fat` 1, with and
  without the figure channels at their ends and maturity asked at 1: under 8 years the waist-to-hip ratio stays at
  0.75 or more of the heaviest build of the age and the glutes at 1.6 times its or less; from 8 to 18, 0.6 and 1.9
  (the test of the figure of minors). Before the gates, a five-year-old could be given a waist-to-hip ratio of 0.43
  against 0.98 for the heaviest build of the age, and a girl of 10 the bust of the adult preset.
- **The body is neutral.** Before maturity starts, the male and the female preset share one figure.

### Age is not frailty

An older character keeps its stature, its posture, its range of motion and the adult motion library. Curvature
(`posture.spine_curvature`), stiffness (`functional.joint_mobility`), atrophy and laxity are controls of their own. The
reference height is the DNA's; `measures.height_posed` is what posture leaves of it.

## What comes out

`generate(dna, options)` returns `{ ok: true, ... }`. `options` is optional: `{ hands, handVariant }` (see "Hands");
any other key is refused.

| Field | What it is |
|---|---|
| `positions`, `index`, `boneIndex` | the mesh in the bind pose: metres, Y up, facing +Z, its left side on +X, origin at the centre of the base of the feet |
| `bones` | name, parent, pivot (`head`) and rest rotation (`rest`, a quaternion `[x, y, z, w]`): the 23, then in the hands' articulated mode 15 finger bones a hand (53 in all) |
| `pieces` | name, bone, vertex and triangle ranges, and the piece's collider |
| `resolved` | what every `null` became, and the values used where a correction applied |
| `corrections`, `notes` | see above |
| `limits` | proposed limits of flexion, narrowed by the body's volume and scaled by `joint_mobility` |
| `motor_profile` | the motion library and the stance of the stage |
| `neutral_pose` | for an infant: lying on its back, resting on the floor (below); `null` for a character that stands |
| `measures` | the reference height, the height built (standing straight, which must be the DNA's), the posed height, triangles, vertices, the angles of the arms and the legs, the bust (`bust_m`, how far it stands forward; 0 for every minor), and each hand's triangles (`hand_triangles`) |
| `solved` | `false` when an overlap or a solver limit remains (see the corrections), or an overlap inside a hand (`hand-collision`) |
| `hands` | the hands built: mode, level, variant, mirroring, notes, and for each side its pose, angles, contact, counts, corrections, what the body gave it and the wrist interface (see "Hands") |
| `topology.hands` | `{ level, mode, variant }` of the hands: the topology of a character depends on it |

Helpers: `posedPositions`, `boneWorld`, `colliders`, `collisions` and `inspect` take a character and an optional pose
(a quaternion per bone, applied after the rest pose; `$offset` moves the whole character). `volume` gives the volume of
a character's mesh, every piece capped.

**The infant's neutral pose.** Lying on its back, hips and knees bent and the arms open, hands up beside the head. An
infant's head stands out behind its back, so the neck bends forward until the back of the head and the pelvis rest on
the floor together; the arms come down until the elbows touch it; a newborn holds its flexed legs up, and over the
first six months they come down until the feet rest on the floor. The angles are proposals, from the clinical
description of the newborn's posture; the contacts are searched on the mesh.

**Rotations.** Every bone's frame is aligned with the world in the bind pose. X bends, Y twists, Z opens sideways. A
positive turn about X tips what is above the joint forward; a limb hangs below its joint, so it swings forward with a
negative turn and the knee bends with a positive one.

**Colliders** are apart from the mesh: one capsule per piece, with the contacts that belong to the body (neighbours,
the armpit, the top of the thighs) left out of `collisions`. A hand's pieces carry capsules inside them (on the piece's
long axis through its deepest point); a hand's pieces with each other, and a hand with its forearm, are left out (the
hand's own solver checks its pieces exactly).

**Motion.** `motor_profile` names the library a stage needs: `newborn` (lying), `infant` (rolling, sitting, crawling),
`toddler` (first steps), `child`, `adolescent`, `adult`. The libraries themselves are not built yet.

## Triangles

Level of detail 1 has **472 triangles**: 392 for the body and 40 for each hand (hand level 1, 'budget', the default).
The proposed budget is 400: the body alone holds it (392); with the hands it does not.

| Piece | Triangles |
|---|---|
| head (four rings of eight and a top) | 62 |
| chest, abdomen, pelvis | 46, 32, 44 |
| neck | 12 |
| each arm: upper arm, forearm | 12, 12 (the forearm is open at the wrist, where the hand's base closes it) |
| each hand (hand level 1 'budget': a palm and five digits) | 40 |
| each leg: thigh, shin (with the calf), foot | 12, 24, 14 |
| six ball joints (shoulders, elbows, knees) | 48 |

The whole character at each hand level (measured, `CHARACTER_TRIANGLES`):

| Hand level | A hand | The character |
|---|---|---|
| 0 (articulated or preset) | 332 | 1,056 |
| 1 'budget' (the default) | 40 | 472 |
| 1 'readable' | 70 | 532 |
| 2 | 20 | 432 |
| 3 | 12 | 416 |
| 4 (no hand: each forearm closed by 4) | 0 | 400 |

Until the hands, level 1 had 412: 20 triangles for two placeholder hands (a closed tube each). The body's other levels
of detail (0, 2, 3 and 4; proposed budgets 1,200, 200, 80 and 12) are not built.

## Hands

The hands are the hand library in [`hands/`](hands/) (the Procedural Hand Pose System): one parametric hand, sized from
each body, that takes any of 24 poses (`hands/poses.js`: the maintainer's HP01 to HP24, also
[`tests/fixtures/hand_poses_24.json`](tests/fixtures/hand_poses_24.json)) and is meshed at five levels. Nothing is stored
per character: the same DNA and the same hands give the same hands.

### Modes and levels

| Hand level | Mode | Bones a hand | Triangles a hand | Vertices a hand | What it is |
|---|---|---|---|---|---|
| 0 | A `articulated` | 16 | 332 | 200 | the full hand: a faceted palm with its thenar (40), a wrist connector (32), three chamfered segments a finger (20 each, the tips 12), the thumb's metacarpal and two phalanges; the pose is the bones' rest rotations |
| 0 | B `preset` | 1 | 332 | 200 | the same mesh, posed and baked on the hand bone |
| 1 | B `preset`, variant `budget` (default) | 1 | 40 | 32 | a palm and five rigid digits, baked from the same solved skeleton |
| 1 | B `preset`, variant `readable` | 1 | 70 | 47 | the same with bent fingers: tells the 24 poses apart (below) |
| 2 | C `simplified` | 1 | 20 | 14 | the four fingers in one volume, the thumb apart |
| 3 | C `simplified` | 1 | 12 | 8 | a mitten |
| 4 | none | 0 | 0 | 0 | no hand: the forearm's end is closed |

- **One topology a level.** The index is the same for every pose, size, age, side and control; poses move vertices
  (mode A: only bone rotations). The left hand is the right one reflected in x, its winding flipped.
- **One skeleton for every level.** Every level is built from the same solved pose (contacts, joint limits and the
  fingers kept out of each other), so a change of level does not change the pose: levels 1 to 3 stay within a stated
  tolerance of level 0's bounding box and centroid (tested).
- **Mode A** adds 15 bones a hand to `bones`, after the 23, left hand first: `Thumb_01_L` to `Thumb_03_L`, then the
  index, middle, ring and little finger (`Pinky_01_L` to `Pinky_03_L`), each the child of the one before and the first
  of each digit the child of `Hand_L`. Their rest rotations hold the pose. Modes B and C add no bone: the 23 bones stay,
  so the mannequins' poses and clips still fit.
- **The default** is both hands in HP01 at the hand level of the character's level of detail (LOD 1: hand level 1,
  mode B, 'budget'). A `null` level takes that level when the mode is built there, otherwise the mode's own (A: level
  0, C: level 2), and `character.hands.notes` says so.
- **Legibility** (measured by the levels step on silhouettes in three views, two bodies): 'readable' told 24 poses of
  24 apart, 'budget' 10 or 11, level 2 6 or 7, level 3 4. 'budget' is the maintainer's 24 to 40 triangles; 'readable'
  is the second, measured variant the design asked for (the earlier attempt took 82).

### The Hand DNA

`generate(dna, { hands, handVariant })`. `hands` is the **Hand DNA v1** block, apart from the Human DNA (which is not
changed); `handVariant` is a variant of hand level 1 (`'budget'` or `'readable'`) or `null`.

```json
{
  "mode": "articulated | preset | simplified | null",
  "level": "0..4 | null",
  "size": "null | 0..1", "palm_width": "null | 0..1", "finger_length": "null | 0..1", "finger_thickness": "null | 0..1",
  "dominant_hand": "right | left | null",
  "mirror": "none | right_to_left | left_to_right",
  "left": { "pose": "HP01..HP24", "grip_radius_m": "null | 0..0.5 (metres)",
            "object": { "shape": "cylinder | sphere | box | plane | null", "orientation_deg": "-90..90 | null" },
            "grip_strength": "0..1",
            "fingers": { "index": { "curl": "-1..1", "spread": "-1..1", "twist": "-1..1", "length": "0..1", "thickness": "0..1" },
                         "middle": {}, "ring": {}, "pinky": {} },
            "thumb": { "flexion": "-1..1", "abduction": "-1..1", "opposition": "-1..1" } },
  "right": { "pose": "HP01" }
}
```

Only `left.pose` and `right.pose` are required (with a mirror, only the side copied). The maintainer's examples:
`{ "mode": "preset", "left": { "pose": "HP01" }, "right": { "pose": "HP01" } }`, an articulated pair with
`"right": { "pose": "HP06", "grip_radius_m": 0.02 }`, and a preset pair HP05 / HP07. A block that does not validate fails
the character with errors of stage `hands`, each with a code, a path and a message: `UNKNOWN_POSE` (HP25),
`NEGATIVE_RADIUS` (-0.01), `TYPE`, `RANGE`, `ENUM`, `UNKNOWN_KEY`, `REQUIRED`, `MODE_LEVEL_MISMATCH` (articulated asked at
level 2); `handVariant` at a level other than 1, or a variant that does not exist, is refused too. Nothing is clamped or repaired, and the block is read once, like the DNA.

- **`null`** is taken only where the schema lists it (there it is the default: the character's level, the mode's own,
  the body's own size, the pose's own object or shape or tilt); elsewhere (`mirror`, `grip_strength`, `object`,
  `fingers` and each finger and its fields, `thumb` and its fields) leave the key out instead.
- **`grip_radius_m`** is at most 0.5 m (`RANGE` above that; `MAX_GRIP_RADIUS_M` in `hands/index.js`).
- **Read once**: own, enumerable data properties only. An inherited key does not count (an inherited side is
  `REQUIRED`); a symbol or a non-enumerable key is `UNKNOWN_KEY` (`TYPE` when the name is one of the schema's); a getter
  or an object that cannot be read (a Proxy whose trap throws) is `TYPE`, and the getter is never called. Through
  `generate()` the options are copied first and a getter there is read once. `validateHands(block)` returns
  `{ ok, errors, spec, notes }`: `spec` is that checked copy (build from it), and `notes` says what a mirror replaced.
- **A mirror with both sides given** copies the source side over the other and says so in `character.hands.notes`
  (`mirror "right_to_left": the left hand's block given (pose HP05) is replaced by the right hand's (pose HP07),
  mirrored`); the page sends both sides with a mirror.
- **The direct API** (`hands/index.js`) never throws on what it is handed: `buildHand` refuses an unknown argument or
  body key (`UNKNOWN_KEY`), a body outside `HAND_BODY_RANGE` (hand length 0.02..0.45 m, wrist-ring half-sizes
  0.0015..0.08 m: `RANGE` at `body.length`, `body.ring.w`, ...) and a malformed pose object (`INVALID_POSE`);
  `blendHands` refuses two hands of different bodies or hand-level controls (`BLEND_INCOMPATIBLE`, path `body`);
  `buildHands` names DNA paths (`size`, `right.grip_radius_m`; a body's: `opts.bodyRight.length`). `POSES`,
  `HAND_MODES`, `MIRROR_MODES`, `OBJECT_SHAPES` and `HAND_POSE_LIBRARY` are frozen.

### Controls and grips

- `size`, `palm_width`, `finger_length`, `finger_thickness`, and each finger's `length` and `thickness`: 0.5 is the
  body's own, 0 and 1 are 15% less and more (a proposal). `size` changes the hand's length, never its wrist ring.
- Each finger's `curl` and `spread`, and the thumb's `flexion`, `abduction` and `opposition`: -1 to 1, from the pose
  toward the joint's limit at -1 or 1; a finger's `twist` rolls it by up to 10 degrees. What each control did is a
  `hand-control` correction, which says "at the joint limit" at the end of the range.
- `grip_radius_m`: `null` is the pose's own object, scaled with the hand; a number is an absolute radius (the same 20
  mm on a child and on an adult). `object` changes the shape (cylinder, sphere, box, plane) and the tilt of the
  object's axis; `grip_strength` closes or opens the contact curl by up to 12% (a look, not a force). The fingers
  curl to the object and stop on it, a larger object curls them less, and what a pose cannot use (a radius on a pose
  that holds nothing) is a `hand-grip-ignored` correction.

### The wrist interface

- **The hand frame**: metres, origin at the wrist pivot (the `Hand_L` / `Hand_R` bone's head), +Y toward the
  fingertips, +X toward the thumb on a right hand (a left hand is the reflection), +Z out of the palm.
- **The ring**: the hand's base is the forearm's six-point end ring `{ w, f, b }` (in the hand frame, at y = 0:
  `[f,0,0] [f/2,0,w] [-b/2,0,w] [-b,0,0] [-b/2,0,-w] [f/2,0,-w]`). The first six vertices of every level are that ring,
  exactly, and the forearm's open end lies on them, so the two meet without a gap (tested on the 52 cases, under 1e-6 m
  with float32 positions). The pivot is the ring's centre and does not move with the pose or the level.
- **On the body** the hand hangs from its bone with no rest rotation of its own (it turns with the forearm): fingers
  down, palm toward the thigh, thumb forward. `character.hands.left.wrist` gives the bone, the pivot, the hand frame's
  axes in the body (`fingers`, `palm`, `thumb`) and both rings in the bind pose.
- **Wrist flexion and deviation** (about the hand's X, and about the palm's normal toward the little finger): level 0's
  connector keeps the forearm's end inside the hand from -70 to +70 degrees of flexion and -20 to +30 of deviation
  (measured on four bodies, and on a character through the interface above); 'readable' to within 0.006 of the hand's
  length (about 1 mm); 'budget' leaves a gap of up to 0.047 of it (8.6 mm on an adult hand) at the ends of the range.

### What a character carries

`character.hands`: `version`, `mode`, `level`, `variant`, `mirror`, `dominant_hand` (carried for the animation phase),
`given` (whether a block was given), `notes`, `limits` (mode A: the joint limits) and `left` / `right`, each with its
`side`, `pose`, `mode`, `level`, `variant`, `triangles`, `vertices`, `bones`, `pieces` (its piece names: `Hand_L` is the
palm, then `Hand_Index_L` and so on; at level 0 `Hand_Thumb_01_L` to `Hand_Pinky_03_L` and `Hand_Connector_L`; at
level 2 `Hand_L` holds the four fingers too), `angles` (the solved joint angles, degrees),
`contact` (the object held, in the hand frame), `corrections`, `diagnostics`, `body` (what the body gave the hand: its
length, wrist ring, age in months, sex preset and arm fat), `fitted` (below) and `wrist`.

The hands' corrections join `corrections` with rules named `hand-*` and the channel `hands.left.<path>` or
`hands.right.<path>`: `hand-thumb`, `hand-folded`, `hand-palm-clearance`, `hand-finger-spread`, `hand-grip`,
`hand-grip-ignored`, `hand-control`, `hand-joint-limit`, `hand-collision-margin` (the solver moved or stopped something,
and says what), and `hand-collision`: an overlap inside a hand that the hand's solver could not clear, which makes
`solved` false. HP01 always reports `hand-thumb` (its thumb is moved clear of the palm). A joint limit is not a failure.

### How the hands are built on a body

What the body gives a hand: its length (wrist to middle fingertip, from the body's skeleton), the forearm's wrist ring,
the age, the sex preset and the arms' fat. A child's hand is not an adult's scaled down (a broader, thicker palm and
shorter, thicker fingers, eased to the adult's by 14 years), and age is not frailty: an old hand is not curled.

- **Level 0** is built exactly for each body: about a third of a second for a body not seen before, about 1 ms after
  (the library keeps solved poses).
- **Levels 1 to 3** are fitted, to keep `generate()` under a millisecond: each pose is built once on the reference hand
  (0.184 m, the reference wrist ring) at the corners of the body's other inputs (the six knots of the age curve, the sex
  preset at 0 and 1, the arm fat at 0 and 1), and a body blends the corners around it, is scaled to its hand's length
  and fitted to its wrist ring (the base exactly, the fit fading out toward the knuckles). `character.hands.<side>.fitted`
  says which corners and weights were used. Against building the same body exactly (measured on a newborn, a child of
  6, an adult woman and a man of 85, poses HP01 and HP10): the farthest vertex lies 0.086 of the hand's length away at
  most (the newborn's thumb tip in HP10, 5.6 mm), 0.02 to 0.03 on average; level 3 within 0.002.
- Speed, on the machine that wrote this, with the corners built: 0.46 ms a character at hand level 1 'budget', 0.50
  'readable', 0.29 at level 2, 0.28 at level 3; a pose not seen before costs about 0.1 s once.

### What is measured and what is a proposal

| Number | Status |
|---|---|
| triangles, vertices and bones of each level; the characters' triangles | measured (`HAND_LEVELS`, `CHARACTER_TRIANGLES`, the tests) |
| the base on the ring, the pivot, the wrist gaps, the collisions, the jumps between levels, the fitted levels' distance from an exact build, the clearance from the thigh | measured by `tests/test_hands.mjs` |
| legibility of the levels | measured by the levels step (silhouettes, two bodies), not by these tests |
| the 24 poses' angles | the maintainer's data ("experimental" in its own words) |
| the hand's proportions, the age, sex and fat factors, the joint limits, the thumb's mapping, the grip objects' sizes, the controls' 15% | proposals of the hand rig (`hands/rig.js`), not measured |
| the hand's length and wrist ring | the body's own (this generator) |
| the tolerances of the jump test | the levels step's measured worst cases over six bodies, rounded up |

## Where the numbers come from

| Curve | Source | Status |
|---|---|---|
| reference stature by age and sex | WHO Child Growth Standards (length and height for age, birth to 5 years) and WHO Growth Reference 2007 (5 to 19 years): the medians at 31 ages | read from the WHO's printed tables on 2026-11-27 |
| the legs' share by age | sitting height over stature, from the equation of Weinberg et al. 2017 (PMC5385114), and the crown-to-pubis ratios in the MSD Manual | the equation and the ratios were read at the source; the infant values are extrapolated |
| the stance turning to standing at 12 months | WHO Motor Development Study, windows of achievement (walking alone: median 12.0 months) | read at the source |
| head height by age | the artist's canon: a quarter at birth, an eighth for an adult | not measured data |
| the 14 regional ratios by age (skull, shoulders, chest, waist, belly, hips, neck, limbs, hands, feet) | none found | this generator's proposal |
| maturity by age and sex and its window, the builds for minors, baby fat, the limits for minors' figure and fat | none found | this generator's proposal |
| each fat region's share (`FAT_SHARE`) | measured on the mesh by `tools/calibrate_fat.mjs` | measured; rerun it when the mesh changes |
| aging defaults, what atrophy and laxity move | height loss, kyphosis and muscle studies were found but give no geometry | this generator's proposal |
| the infant's neutral pose | the clinical description of the newborn's bent posture | recalled, not measured |

Two things follow from the contract, not from anthropometry. The adult scale is the same for both sexes: 1.75 m is
`H05` for either, while the WHO medians at 18 are 1.76 m for boys and 1.63 m for girls. And a minor's `H05` (the median
of the age) and an adult's `H05` are different things, so a female `H05` goes from 1.63 m at 17 to 1.75 m at 18. The
shape itself does not jump: between 15 and 18 the stature it is drawn for eases from the median to 1.75 m.

None of this is clinical data.

## Tests

```bash
node --test blocking-studio/human-generator/tests/test_generator.mjs blocking-studio/human-generator/tests/test_hands.mjs
```

Plain Node (22 or newer), no install. Add `--expose-gc` to measure the heap. `test_generator.mjs` (41 tests, about
13 s) checks the body; `test_hands.mjs` (29 tests, about 50 s: solving the 24 poses on four bodies is most of it)
checks the hands and their integration, item by item of the hands' design, and lists two shortfalls as TODO (reported,
not failed): level 0 has 332 triangles against the design's 160 to 260, and 'budget' does not close the wrist over the
whole range. The fixtures are the maintainer's test
collection, with file names and notes in English and the DNA records unchanged: 52 priority cases with their manifest,
the adult grid of 200 and 14 invalid DNAs.

| The checklist | Covered by |
|---|---|
| height within tolerance | every case stands within 0.5 mm of its `height_m` |
| topology and indices preserved | the same triangles, bindings and pieces for 290 characters |
| no invalid vertex or flat triangle | every case, at rest and in four test poses |
| bones and pivots in place | ball joints around their pivots, tubes ending on them, left and right mirrored |
| no undue collision in the base pose | every case; infants in their neutral pose too |
| extreme movements | joints to their limits: bones keep their lengths, pieces stay rigid |
| extreme combinations | the 16 extremes and the grid of 200: solved, or reported as corrections |
| feet on the floor | every case within 0.5 mm |
| deterministic regeneration | the same DNA gives the same arrays; a value set and set back leaves no trace |
| triangle count | 472 at level 1 (392 for the body, 40 a hand), against the proposed 400 |
| performance | CPU: 0.91 ms a character with its hands on the machine that wrote this (about 1,100 a second; 0.23 ms before the hands) |
| memory | 4,000 characters leave the heap where it was |
| fallback on failure | an invalid DNA returns errors and throws nothing |
| the A/B pairs | each pair differs only in the channel it names; what moves and what stays is checked piece by piece |
| age | proportions of the age, no jump at a stage boundary or at 18, the gates for minors measured on the mesh, age without frailty, an infant resting on the floor |
| nothing silent | the seed changes nothing; what is checked is what is built; every overlap and every value not used as given is a correction |
| the hands (`test_hands.mjs`) | one topology a level; the wrist ring, the pivot and the connector; collisions by an exact separating-axis check; closed shells and no jump between levels; mirroring, blending, controls, grips; the Hand DNA and its refusals; the triangles, the forearms on the 52 cases, every pose at every level, the thigh, the infant's pose, mode A's bones, the corrections, the defaults, the fitted levels, the budget |

**Not covered:** performance on the GPU (one draw call a character is by construction, not a measurement), export to
GLB or FBX and reimport, compatibility between the body's levels of detail (only one exists), animation and inverse
kinematics, and the editor page (checked by hand with three.js replaced by a stand-in, not by these tests).

## Not built yet

The body's levels of detail 0, 2, 3 and 4 (the hands have theirs); export to GLB and FBX; the motion libraries and
their adaptation to each body (foot IK, pole targets); hand animation (the library blends two hands, but no clip uses
it yet); asymmetry; the body's technical sheets (the hands' are `tools/hand_sheets.mjs`). The limits in `limits` are proposals for the animation
phase, and `functional.balance`, `motor_control` and `strength` are carried for it: they change no geometry.
