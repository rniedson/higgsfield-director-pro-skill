# Human generator

Builds an ultra low-poly, articulated mannequin of any age, from a newborn to an adult of 100, out of a character's
DNA. Nothing is stored per character: the same DNA gives the same mesh, to the bit, with the same version of the
generator. It is the blocking studio's source of extras and of characters that the two modelled mannequins
([male](../assets/characters/mannequin/README.md), [female](../assets/characters/mannequin-female/README.md)) do not
cover, on the same 23 bones, with the same names, so a pose or a clip made for one fits the other.

- **One topology.** Sex, age, height, build and proportions move vertices. They never add, remove or reorder one, so
  every character of a level of detail shares its triangles, its bone bindings and its rig.
- **Rigid pieces, one mesh.** 23 pieces, each bound with weight 1 to one bone, in one mesh: one draw call a character.
- **Nothing silent.** The generator never edits the DNA. What it could not use as given comes back in `corrections`,
  with the value asked for and the value used.

Status: a first version, to be approved by the maintainer. Only level of detail 1 exists. The hands are a placeholder
(a later phase). The figures in this page were measured on 2026-11-27.

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
- **Checks:** pieces coloured by bone, wireframe, colliders, and the corrections of the character on screen.
- **URL:** `?id=F_H05_C05` or `?id=F_A05_H05_C04`, `&mode=ages`, `&view=front|three_quarter|side|back|top`,
  `&pose=test|neutral`, `&pieces=1`, `&colliders=1`, `&panel=0`, `&cases=PAIR_`.
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
   the top); arms open from the A pose (12 degrees) until they clear the trunk and the thighs; a bust stays on a chest
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

`generate(dna)` returns `{ ok: true, ... }`:

| Field | What it is |
|---|---|
| `positions`, `index`, `boneIndex` | the mesh in the bind pose: metres, Y up, facing +Z, its left side on +X, origin at the centre of the base of the feet |
| `bones` | name, parent, pivot (`head`) and rest rotation (`rest`, a quaternion `[x, y, z, w]`) |
| `pieces` | name, bone, vertex and triangle ranges, and the piece's collider |
| `resolved` | what every `null` became, and the values used where a correction applied |
| `corrections`, `notes` | see above |
| `limits` | proposed limits of flexion, narrowed by the body's volume and scaled by `joint_mobility` |
| `motor_profile` | the motion library and the stance of the stage |
| `neutral_pose` | for an infant: lying on its back, resting on the floor (below); `null` for a character that stands |
| `measures` | the reference height, the height built (standing straight, which must be the DNA's), the posed height, triangles, vertices, the angles of the arms and the legs, and the bust (`bust_m`, how far it stands forward; 0 for every minor) |
| `solved` | `false` when an overlap or a solver limit remains (see the corrections) |

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
the armpit, the top of the thighs) left out of `collisions`.

**Motion.** `motor_profile` names the library a stage needs: `newborn` (lying), `infant` (rolling, sitting, crawling),
`toddler` (first steps), `child`, `adolescent`, `adult`. The libraries themselves are not built yet.

## Triangles

Level of detail 1 has **412 triangles**: 392 for the body and 20 for the two placeholder hands. The proposed budget is
400, and it has not held:

| Piece | Triangles |
|---|---|
| head (four rings of eight and a top) | 62 |
| chest, abdomen, pelvis | 46, 32, 44 |
| neck | 12 |
| each arm: upper arm, forearm, hand | 12, 12, 10 |
| each leg: thigh, shin (with the calf), foot | 12, 24, 14 |
| six ball joints (shoulders, elbows, knees) | 48 |

Reaching 400 means giving up 12: the caps that close the pelvis and the chest where the trunk bends, or a coarser
head. The hands settle it either way: 4 triangles each would fit in 400, and that is one flat quad. A hand worth the
name needs its own budget.

The other levels (0, 2, 3 and 4; proposed budgets 1,200, 200, 80 and 12) are not built.

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
node --test blocking-studio/human-generator/tests/test_generator.mjs
```

Plain Node (22 or newer), no install. Add `--expose-gc` to measure the heap. The fixtures are the maintainer's test
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
| triangle count | 412 at level 1, against the proposed 400 |
| performance | CPU: 0.23 ms a character on the machine that wrote this (about 4,400 a second) |
| memory | 4,000 characters leave the heap where it was |
| fallback on failure | an invalid DNA returns errors and throws nothing |
| the A/B pairs | each pair differs only in the channel it names; what moves and what stays is checked piece by piece |
| age | proportions of the age, no jump at a stage boundary or at 18, the gates for minors measured on the mesh, age without frailty, an infant resting on the floor |
| nothing silent | the seed changes nothing; what is checked is what is built; every overlap and every value not used as given is a correction |

**Not covered:** performance on the GPU (one draw call a character is by construction, not a measurement), export to
GLB or FBX and reimport, compatibility between levels of detail (only one exists), animation and inverse kinematics.

## Not built yet

Levels of detail 0, 2, 3 and 4; the hands; export to GLB and FBX; the motion libraries and their adaptation to each
body (foot IK, pole targets); asymmetry; the technical sheets. The limits in `limits` are proposals for the animation
phase, and `functional.balance`, `motor_control` and `strength` are carried for it: they change no geometry.
