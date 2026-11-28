// Human generator: builds an ultra low-poly, articulated mannequin of any age from a character's DNA.
//
// One topology for every character of a level of detail: sex, age, height, build and proportions move vertices, never
// add, remove or reorder them. Every call starts again from the constants in these files (the immutable base), so
// setting a value and setting it back gives the same geometry, to the bit. The steps run in a fixed order:
//
//   DNA -> validation (dna.js) -> age and sex -> height and structure -> build -> composition and proportions
//       -> skeleton -> modular geometry -> volumes -> constraint solver -> adaptive rig -> mesh
//
// The output is one consolidated mesh (one draw call) made of rigid islands: each piece is bound, with weight 1, to
// one bone of the blocking studio's 23-bone skeleton, the same bone names as the mannequins in ../assets/characters/.
// Nothing here edits the DNA: what had to be corrected or limited is listed in `corrections`, with the value asked for
// and the value used.
//
// Plain JavaScript with no dependencies: the editor (index.html) turns the output into a Three.js SkinnedMesh, and
// Node runs the tests (tests/). Coordinates: metres, Y up, the character faces +Z, its left side is +X, and the origin
// is the centre of the base of the feet.
//
// The hands come from the Procedural Hand Pose System (hands/): one library of 24 poses for every body, built from the
// forearm's own wrist ring and the body's hand length, age, sex and arm fat (see "6b. hands" below and README.md).

import { validate, check, snapshot, blankDNA, stageOf, DNA_CONTRACT, STAGES, HEIGHTS, HEIGHT_LEVELS, GROUPS, ADULT_MONTHS, ADULT_ONLY as ADULT_ONLY_PROPORTIONS } from './dna.js';
import * as G from './growth.js';
import * as HANDS from './hands/index.js';
import { quat as HQ, LIMITS as HAND_LIMITS } from './hands/rig.js';

export { validate, blankDNA, stageOf, DNA_CONTRACT, STAGES, HEIGHTS, HEIGHT_LEVELS, GROUPS, ADULT_MONTHS };
export const GENERATOR_VERSION = '0.3.0';
export const TOPOLOGY_VERSION = { 1: 2 };   // per level of detail; a change of topology needs a new version (2: the hands)
export const LOD_BUDGET = { 0: 1200, 1: 400, 2: 200, 3: 80, 4: 12 };   // proposed triangle budgets, not yet validated
export const BODY_TRIANGLES = 392;          // the body without its hands (head, trunk, neck, arms, legs, ball joints)
// What each level of detail has today, with its default hands (hand level 1, 'budget': 40 triangles a hand, measured
// by hands/mesh1.js). CHARACTER_TRIANGLES has the count for every hand level and variant.
export const TRIANGLES = { 1: BODY_TRIANGLES + 2 * HANDS.HAND_LEVELS.find((l) => l.level === 1).triangles };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const around = (x, amp) => 1 + amp * (x - 0.5) * 2;   // a 0..1 control as a factor around 1 (0.5 = the reference)
const deg = (d) => d * Math.PI / 180;
const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- presets

export const BUILDS = [   // C01..C10: silhouettes, not diagnoses
  { label: 'Extremely thin', body_fat: 0.00, muscle_mass: 0.08 },
  { label: 'Very thin', body_fat: 0.05, muscle_mass: 0.20 },
  { label: 'Slender', body_fat: 0.13, muscle_mass: 0.32 },
  { label: 'Average', body_fat: 0.26, muscle_mass: 0.42 },
  { label: 'Athletic', body_fat: 0.14, muscle_mass: 0.85 },
  { label: 'Robust', body_fat: 0.40, muscle_mass: 0.70 },
  { label: 'Overweight', body_fat: 0.52, muscle_mass: 0.45 },
  { label: 'Obese', body_fat: 0.66, muscle_mass: 0.42 },
  { label: 'Severely obese', body_fat: 0.83, muscle_mass: 0.38 },
  { label: 'Extremely obese', body_fat: 1.00, muscle_mass: 0.35 },
];
const AVERAGE = BUILDS[3];

// Fat. The DNA's weights say where the fat goes; they are filled from the preset where null and normalised, so they
// only share out the amount that body_fat sets. FAT_SHARE is each region's share of the fat the mesh can hold, measured
// on the mesh itself by tools/calibrate_fat.mjs: it turns a region's weight into how full the region is (its level),
// 0.6 everywhere when the fat is spread by volume, more where it concentrates, up to a limit. Measured so, bodies with
// the same body_fat and different weights carry about the same volume of fat.
const FAT_REGIONS = GROUPS.fat_distribution;
export const FAT_SHARE = { abdomen: 0.342, chest: 0.152, arms: 0.127, hips: 0.044, glutes: 0.025, thighs: 0.241, calves: 0.069 };
const FAT_EVEN = 0.6, FAT_FULL = 1.6, MINOR_FAT_SPREAD = 1.6;
const MINOR_FIGURE = 0.5;   // the largest part of their range the figure channels and fat weights have on a minor's body
// A pattern is written as the level it gives each region, and stored as the weights that give those levels.
const weights = (levels) => { const w = FAT_REGIONS.map((k) => levels[k] * FAT_SHARE[k]), sum = w.reduce((x, y) => x + y, 0);
  return Object.fromEntries(FAT_REGIONS.map((k, i) => [k, Math.round(w[i] / sum * 1000) / 1000])); };
const FAT_PRESET = {   // the tendency of each preset: not a rule
  male: weights({ abdomen: 0.85, chest: 0.6, arms: 0.5, hips: 0.4, glutes: 0.35, thighs: 0.4, calves: 0.35 }),
  female: weights({ abdomen: 0.5, chest: 0.55, arms: 0.5, hips: 0.85, glutes: 0.8, thighs: 0.85, calves: 0.5 }),
  child: weights({ abdomen: 0.67, chest: 0.48, arms: 0.67, hips: 0.48, glutes: 0.48, thighs: 0.67, calves: 0.58 }),
};
export const FAT_PATTERNS = {   // ready-made weights for the editor; any mix is allowed, for either sex
  abdominal: weights({ abdomen: 1.1, chest: 0.5, arms: 0.38, hips: 0.3, glutes: 0.25, thighs: 0.3, calves: 0.4 }),
  lower: weights({ abdomen: 0.2, chest: 0.25, arms: 0.3, hips: 1.0, glutes: 1.0, thighs: 1.1, calves: 1.0 }),
  upper: weights({ abdomen: 0.65, chest: 1.0, arms: 1.05, hips: 0.4, glutes: 0.35, thighs: 0.4, calves: 0.4 }),
  uniform: weights({ abdomen: 1, chest: 1, arms: 1, hips: 1, glutes: 1, thighs: 1, calves: 1 }),
};

// The seed is carried and echoed, and changes nothing in this version: a null channel is its preset, exactly, so the
// same body comes out of every record that differs only by its seed. Variety comes from randomDNA(), which writes
// explicit values into the DNA, where they can be seen and edited.

// Proportions that shape the adult figure. On a body that is not mature they act within part of their range.
const FIGURE = ['waist_width', 'hip_width', 'glute_volume', 'glute_projection', 'thigh_volume', 'chest_depth'];

// The morph channels of the first specification, and the DNA value each one reads.
export const MORPH_CHANNELS = [
  ['Height_Morph', 'height_m'], ['Sex_Morph', 'sex'], ['BodyMass_Morph', 'build'], ['Muscle_Morph', 'muscle_mass'],
  ['Fat_Morph', 'body_fat'], ['ShoulderWidth_Morph', 'proportions.shoulder_width'],
  ['ChestVolume_Morph', 'proportions.chest_depth'], ['BreastVolume_Morph', 'proportions.breast_volume'],
  ['WaistWidth_Morph', 'proportions.waist_width'], ['AbdomenVolume_Morph', 'proportions.abdomen_volume'],
  ['HipWidth_Morph', 'proportions.hip_width'], ['GluteVolume_Morph', 'proportions.glute_volume'],
  ['ThighVolume_Morph', 'proportions.thigh_volume'], ['ArmVolume_Morph', 'fat_distribution.arms'],
  ['LegLength_Morph', 'proportions.leg_length'], ['ArmLength_Morph', 'proportions.arm_length'],
  ['HeadSize_Morph', 'proportions.head_size'],
];

export const BONES = [   // name, parent: the mannequins' 23 bones, in their order
  ['Root', null], ['Pelvis', 'Root'], ['Spine_01', 'Pelvis'], ['Spine_02', 'Spine_01'], ['Spine_03', 'Spine_02'],
  ['Clavicle_L', 'Spine_03'], ['UpperArm_L', 'Clavicle_L'], ['LowerArm_L', 'UpperArm_L'], ['Hand_L', 'LowerArm_L'],
  ['Clavicle_R', 'Spine_03'], ['UpperArm_R', 'Clavicle_R'], ['LowerArm_R', 'UpperArm_R'], ['Hand_R', 'LowerArm_R'],
  ['Neck', 'Spine_03'], ['Head', 'Neck'],
  ['Thigh_L', 'Pelvis'], ['Calf_L', 'Thigh_L'], ['Foot_L', 'Calf_L'], ['Toe_L', 'Foot_L'],
  ['Thigh_R', 'Pelvis'], ['Calf_R', 'Thigh_R'], ['Foot_R', 'Calf_R'], ['Toe_R', 'Foot_R'],
];
const BONE_INDEX = Object.fromEntries(BONES.map(([n], i) => [n, i]));

function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- 1. the character the DNA describes

// Resolves a valid DNA into the values the geometry is built from, in the contract's order: age and sex, height and
// structure, build, then composition and proportions. Every null takes its preset here. The DNA is not changed; where
// a value could not be used as given, `corrections` says what was asked for and what was used.
function resolve(D) {
  const notes = [], corrections = [];
  const months = D.age_months, female = D.sex === 'female', adult = months >= ADULT_MONTHS;

  // age and sex: how far the adult presets apply
  const [earliest, latest] = G.maturityWindow(months);   // the least and the most mature a body of this age can be
  let maturity = clamp(G.maturity(D.sex, months), earliest, latest);
  const askedMaturity = D.aging.skeletal_maturity;
  if (askedMaturity !== null) {
    maturity = clamp(askedMaturity, earliest, latest);
    if (maturity !== askedMaturity) {
      corrections.push({ rule: 'maturity-window', channel: 'aging.skeletal_maturity', asked: askedMaturity, used: round3(maturity),
        detail: `skeletal maturity ${askedMaturity} is outside what ${months} months allows (${earliest.toFixed(2)} to ${latest.toFixed(2)}); ${maturity.toFixed(2)} was used` });
    }
  }

  // height and structure
  const reference = G.shapeStature(D.sex, months), H = D.height_m, rel = H / reference;   // the stature the shape is drawn for
  // Inside the range a taller body has a smaller head and narrower breadths for its height (they grow slower than
  // stature). Beyond it nothing more of that is done: the body is drawn at the nearest height of the range and scaled
  // as a whole, so its proportions stay those of that height. An adult's height is always inside (H01 to H10).
  const [lowest, highest] = G.STATURE_RANGE, relShape = rel < lowest - 1e-9 ? lowest : rel > highest + 1e-9 ? highest : rel;
  if (relShape !== rel) {
    const near = reference * relShape;
    notes.push(`height ${H} m is outside the proposed range for ${months} months (${(reference * G.STATURE_RANGE[0]).toFixed(2)} to ${(reference * G.STATURE_RANGE[1]).toFixed(2)} m): the body is drawn as at ${near.toFixed(2)} m and scaled to ${H} m, so it keeps the proportions of that height`);
  }
  const bone_structure = D.bone_structure ?? 0.5;

  // build: the presets are adult silhouettes; before adulthood they act around the age's own average, in part
  const preset = BUILDS[D.build - 1], range = G.buildRange(months);
  const fatIn = D.body_fat ?? preset.body_fat, muscleIn = D.muscle_mass ?? preset.muscle_mass;
  const body_fat = adult ? fatIn : clamp(G.neutralFat(months) + (fatIn - AVERAGE.body_fat) * range, 0, 1);   // an adult's values are used as given
  const muscle_mass = adult ? muscleIn : clamp(AVERAGE.muscle_mass + (muscleIn - AVERAGE.muscle_mass) * range * (0.3 + 0.7 * maturity), 0, 1);
  if (!adult) {
    const scale = `at ${months} months fat and muscle act within ${Math.round(range * 100)}% of their range, around the average of the age`;
    for (const [channel, asked, used] of [['body_fat', D.body_fat, body_fat], ['muscle_mass', D.muscle_mass, muscle_mass]]) {
      if (asked !== null && Math.abs(used - asked) > 1e-9) corrections.push({ rule: 'child-build', channel, asked, used: round3(used), detail: `${channel} ${asked} is read on the scale of the age: ${scale}` });
    }
    if (D.build !== 4 && (D.body_fat === null || D.muscle_mass === null)) notes.push(`the builds are adult silhouettes: ${scale}`);
  }

  // proportions: the preset where null, exactly; explicit values as given
  const P = {};
  for (const k of GROUPS.proportions) P[k] = D.proportions[k] ?? 0.5;
  // The bust is an adult channel, with a gate by age alone: nothing under 18 years whatever the maturity or the sex
  // preset, and from 18 the female preset comes in over three years. An explicit value is only valid from 18: the
  // contract refuses it on a minor, and should a minor's DNA reach this point with one anyway, it is not used.
  for (const k of ADULT_ONLY_PROPORTIONS) {
    if (!adult && D.proportions[k] !== null) {
      corrections.push({ rule: 'minor-adult-channel', channel: `proportions.${k}`, asked: D.proportions[k], used: null,
        detail: `proportions.${k} is an adult channel and was not used under ${ADULT_MONTHS} months` });
      P[k] = 0.5;
    }
  }
  const breastAsked = adult ? D.proportions.breast_volume : null;
  const adultGate = breastAsked !== null ? 1 : G.adultPreset(months);
  P.breast_volume = breastAsked ?? (female ? 0.45 * maturity ** 1.5 * adultGate : 0);
  // The figure channels act within part of their range on a body that is not mature, and on a minor's body within
  // MINOR_FIGURE of it at most, whatever the maturity: the figure a minor has by default is that of its age and
  // maturity, and what a DNA asks for on top of it is held to half. The adult range comes in from 18 to 21 years.
  const figure = Math.min(0.35 + 0.65 * maturity, lerp(MINOR_FIGURE, 1, G.adultPreset(months)));
  if (figure < 1) {
    for (const k of FIGURE) {
      const used = 0.5 + (P[k] - 0.5) * figure, asked = D.proportions[k];
      if (asked !== null && Math.abs(used - asked) > 1e-9) {
        corrections.push({ rule: 'child-figure', channel: `proportions.${k}`, asked, used: round3(used),
          detail: `proportions.${k} acts within ${Math.round(figure * 100)}% of its range at this age and maturity: a body that is not adult keeps its own figure` });
      }
      P[k] = used;
    }
  }

  // fat: fill the nulls from the body's own pattern, normalise, then place each share in its region. The own pattern is
  // the child's, turning into the sex preset's with maturity.
  const ownFat = {}, fatWeights = {}, fatUsed = {}, fatLevel = {};
  let total = 0, ownTotal = 0;
  for (const k of FAT_REGIONS) { ownFat[k] = lerp(FAT_PRESET.child[k], FAT_PRESET[D.sex][k], maturity); ownTotal += ownFat[k]; }
  for (const k of FAT_REGIONS) { ownFat[k] /= ownTotal; fatWeights[k] = D.fat_distribution[k] ?? ownFat[k]; total += fatWeights[k]; }
  for (const k of FAT_REGIONS) fatWeights[k] /= total;
  // A body that is not mature keeps its own pattern as it keeps its own figure: explicit weights act within the same
  // part of their distance from it as the figure channels do. And a minor's body keeps the shape of its own pattern at
  // every maturity: no region takes less than its own share divided by MINOR_FAT_SPREAD (what it lacks is taken from
  // the others, in proportion to what they have above theirs), and none holds more than that factor times its share
  // (below). An adult's region holds up to FAT_FULL and may be left empty; the adult freedom comes in with the adult
  // presets, from 18 to 21 years.
  const adultFat = G.adultPreset(months);
  const asked = { ...fatWeights };
  if (figure < 1) for (const k of FAT_REGIONS) fatWeights[k] = ownFat[k] + (fatWeights[k] - ownFat[k]) * figure;
  const keeps = (k) => lerp(ownFat[k] / MINOR_FAT_SPREAD, 0, adultFat);
  const low = FAT_REGIONS.filter((k) => fatWeights[k] < keeps(k));
  if (low.length) {
    const short = low.reduce((a, k) => a + keeps(k) - fatWeights[k], 0);
    const rest = FAT_REGIONS.filter((k) => !low.includes(k)), spare = rest.reduce((a, k) => a + fatWeights[k] - keeps(k), 0);
    for (const k of low) fatWeights[k] = keeps(k);
    for (const k of rest) fatWeights[k] -= short * (fatWeights[k] - keeps(k)) / spare;
  }
  for (const k of FAT_REGIONS) {
    if (D.fat_distribution[k] !== null && Math.abs(fatWeights[k] - asked[k]) > 1e-9) {
      corrections.push({ rule: 'child-fat', channel: `fat_distribution.${k}`, asked: round3(asked[k]), used: round3(fatWeights[k]),
        detail: `the ${k} would take ${Math.round(asked[k] * 100)}% of the fat and took ${Math.round(fatWeights[k] * 100)}%: a body that is not adult keeps the shape of its own fat pattern` });
    }
    fatUsed[k] = fatWeights[k];
  }
  // A region holds so much: what does not fit goes to the regions that have room, in proportion to their shares. Only
  // when no region with a share has room is fat left out, and that is said.
  const holds = (k) => lerp(MINOR_FAT_SPREAD * ownFat[k], FAT_FULL * FAT_SHARE[k] / FAT_EVEN, adultFat), full = new Set();
  let unplaced = 0;
  for (let pass = 0; pass < FAT_REGIONS.length; pass++) {
    let over = 0;
    for (const k of FAT_REGIONS) if (!full.has(k) && fatUsed[k] > holds(k) + 1e-12) { over += fatUsed[k] - holds(k); fatUsed[k] = holds(k); full.add(k); }
    if (over <= 1e-12) break;
    const open = FAT_REGIONS.filter((k) => !full.has(k) && fatWeights[k] > 0), room = open.reduce((a, k) => a + fatWeights[k], 0);
    if (room <= 0) { unplaced = over; break; }
    for (const k of open) fatUsed[k] += over * fatWeights[k] / room;
  }
  for (const k of FAT_REGIONS) {
    fatLevel[k] = fatUsed[k] * FAT_EVEN / FAT_SHARE[k];
    if (full.has(k) && body_fat > 0) {
      corrections.push({ rule: 'fat-region-full', channel: `fat_distribution.${k}`, asked: round3(fatWeights[k]), used: round3(fatUsed[k]),
        detail: `the ${k} cannot hold ${Math.round(fatWeights[k] * 100)}% of the fat: the region was filled to its limit (${Math.round(fatUsed[k] * 100)}%) and the rest went to the regions with room` });
    }
  }
  if (unplaced > 1e-12 && body_fat > 0) {
    corrections.push({ rule: 'fat-unplaced', channel: 'fat_distribution', asked: 1, used: round3(1 - unplaced),
      detail: `${Math.round(unplaced * 100)}% of the fat has nowhere to go (every region with a share is full): it was left out, so this body carries less fat than body_fat asks for` });
  }

  const aging = { skeletal_maturity: maturity, muscle_atrophy: D.aging.muscle_atrophy ?? G.muscleAtrophy(months),
    skin_laxity: D.aging.skin_laxity ?? G.skinLaxity(months) };
  const functional = { joint_mobility: D.functional.joint_mobility ?? 1, balance: D.functional.balance ?? G.balance(months),
    motor_control: D.functional.motor_control ?? G.motorControl(months), strength: D.functional.strength ?? G.strength(months) };
  const posture = Object.fromEntries(GROUPS.posture.map((k) => [k, D.posture[k] ?? 0.5]));

  return { months, female, adult, maturity, fem: female ? maturity * adultGate : 0, adultFigure: G.adultPreset(months), H, reference, rel, relShape, bone_structure, body_fat, muscle_mass,
    P, fatWeights, fatUsed, fatLevel, aging, functional, posture, notes, corrections };
}

// A value for the male preset and the female preset. A body that is not mature takes the middle of the two (it leans
// to neither), and the preset of its sex fades in with maturity. What makes a child a child is not here: it is the
// age's ratio for each region (growth.js).
const mix = (C) => (m, f) => lerp((m + f) / 2, C.female ? f : m, C.maturity);

// ---------------------------------------------------------------- 2. skeleton

// Heights of the landmarks as a fraction of the height below the chin's reference (male, female). Legs scale with the
// leg share, the torso fills what is left up to the chin, so the total height is always the DNA's height.
const FR = {
  neckBase: [0.838, 0.836], shoulder: [0.808, 0.806], bust: [0.726, 0.716], underbust: [0.682, 0.676],
  waist: [0.618, 0.626], pelvisTop: [0.588, 0.592], hipJoint: [0.522, 0.515], hipWide: [0.508, 0.498],
  crotch: [0.470, 0.466], knee: [0.285, 0.283], calf: [0.215, 0.213], ankle: [0.042, 0.042],
};
const HEAD = 0.2275;   // the reference adult's head height, in metres

function skeleton(C, legAngle = 0) {
  const { H, months, P } = C, L = mix(C);
  const beyond = C.rel / C.relShape;   // 1 inside the proposed range of heights; beyond it the body scales as a whole
  const headH = G.headHeight(months) * C.relShape ** 0.35 * beyond * L(1, 0.97) * around(P.head_size, 0.12);
  const chin = H - headH, U = chin / 0.87;   // U: the body's length unit below the chin, 1.75 for the reference adult
  const share = G.legShare(months) * (1 + 0.12 * (P.leg_length - 0.5) - 0.12 * (P.torso_length - 0.5));
  const raw = (n) => L(...FR[n]) * U;
  const ankle = raw('ankle');
  const leg = (n) => raw(n) * share;
  const hipJ = leg('hipJoint'), hip0 = raw('hipJoint');
  const torso = (n) => hipJ + (raw(n) - hip0) * (chin - hipJ) / (chin - hip0);
  // breadth: with the stature the shape is drawn for, then with the square root of the height (a tall character is not a
  // wide one); the age's ratio of each region comes on top, in sections()
  const wS = C.reference / G.ADULT_STATURE * Math.sqrt(C.relShape) * beyond, E = 0.92 + 0.16 * C.bone_structure, g = G.regions(months);
  const neckK = around(P.neck_length, 0.35) * G.neckShare(months);   // a short neck brings the shoulders up with it
  // (sd.hand below, the wrist pivot to the middle fingertip, is the hand's length that hands/ builds to)
  const neckBase = chin - (chin - torso('neckBase')) * neckK;
  const K = {
    H, U, wS, E, g, headH, chin, hs: headH / HEAD, neckBase, months, legAngle,
    shoulder: chin - (chin - torso('shoulder')) * lerp(1, neckK, 0.6), bust: torso('bust'), underbust: torso('underbust'), waist: torso('waist'),
    pelvisTop: torso('pelvisTop'), hipJoint: hipJ, hipWide: leg('hipWide'), crotch: leg('crotch'),
    knee: leg('knee'), calf: leg('calf'), ankle, footBase: 0,
    armK: around(P.arm_length, 0.08) * G.armShare(months), handK: around(P.hand_size, 0.12) * g.hand, footK: around(P.foot_size, 0.1) * g.foot,
    side: { L: { arm: 1, shoulderDy: 0, handScale: 1 }, R: { arm: 1, shoulderDy: 0, handScale: 1 } },   // symmetric in this version
  };
  K.shX = L(0.19, 0.162) * wS * E * around(P.shoulder_width, 0.1) * g.shoulders;
  K.hipX = L(0.085, 0.09) * wS * E * around(P.hip_width, 0.06) * g.hips;
  K.kneeX = K.hipX * 0.85;
  if (legAngle > 0) {
    // Open legs reach less far down. The bind pose lengthens them below the hip, so that once the rest pose opens them
    // the soles land on the floor again and the height does not change; the foot is built that much lower in the bind.
    const sn = Math.sin(deg(legAngle)), cs = Math.cos(deg(legAngle)), drop = hipJ - ankle;
    const k = (drop + (K.kneeX - K.hipX) * sn) / (drop * cs);
    for (const n of ['knee', 'calf']) K[n] = hipJ - (hipJ - K[n]) * k;
    K.ankle = hipJ - drop * k; K.footBase = K.ankle - ankle;
  }
  K.footLen = L(0.152, 0.145) * U * K.footK;
  for (const s of ['L', 'R']) {
    const sd = K.side[s];
    sd.ua = 0.186 * U * K.armK * sd.arm; sd.fa = 0.146 * U * K.armK * sd.arm;
    sd.hand = L(0.108, 0.102) * U * K.handK * sd.handScale; sd.shY = K.shoulder + sd.shoulderDy;
  }
  return K;
}

function bindPositions(K) {   // the bind pose: arms and legs straight, every bone with no rotation
  const b = { Root: [0, 0, 0], Pelvis: [0, (K.hipJoint + K.pelvisTop) / 2, 0], Spine_01: [0, K.pelvisTop, -0.01 * K.wS],
    Spine_02: [0, K.underbust, -0.012 * K.wS], Spine_03: [0, K.underbust + 0.034 * K.U, -0.012 * K.wS],
    Neck: [0, K.neckBase, -0.015 * K.wS], Head: [0, K.chin + 0.02 * K.hs, -0.018 * K.hs] };
  for (const [s, x] of [['L', 1], ['R', -1]]) {
    const sd = K.side[s];
    b['Clavicle_' + s] = [x * 0.018 * K.wS, K.neckBase - 0.02 * K.U, 0.01 * K.wS];
    const sx = K.shXBody ?? K.shX;
    b['UpperArm_' + s] = [x * sx, sd.shY, 0];
    b['LowerArm_' + s] = [x * sx, sd.shY - sd.ua, 0];
    b['Hand_' + s] = [x * sx, sd.shY - sd.ua - sd.fa, 0];
    b['Thigh_' + s] = [x * K.hipX, K.hipJoint, 0];
    b['Calf_' + s] = [x * K.kneeX, K.knee, 0];
    b['Foot_' + s] = [x * K.kneeX, K.ankle, -0.01 * K.wS];
    b['Toe_' + s] = [x * K.kneeX, K.footBase + 0.022 * K.U / G.ADULT_STATURE, 0.5 * K.footLen];
  }
  return b;
}

// ---------------------------------------------------------------- 3-4. modular geometry and volumes

// Every piece is a stack of rings. A ring: half-width w (sideways), depth f (to the front) and b (to the back), and
// optional pushes (bust, glutes). All sizes in metres at the reference adult, scaled here.
function sections(C, K) {
  const { P, fem } = C, L = mix(C);
  const { wS, E, U, hs, months } = K;
  const lax = C.aging.skin_laxity, atrophy = C.aging.muscle_atrophy;
  const fG = C.body_fat ** 1.35;                          // fat grows faster at the top of the scale
  const m = C.muscle_mass - 0.42;                         // muscle around the average
  const mAdd = m > 0 ? m * (1 - 0.35 * fG) * (1 - 0.6 * atrophy) : m;   // muscle and fat share the volume: not counted twice
  const fat = (region, amount) => fG * C.fatLevel[region] * amount * wS;
  const mus = (amount) => mAdd * amount * wS;
  const W = (x) => x * wS, B = (x) => x * wS * E;           // soft tissue scales with the body, bone with the frame too
  const wasted = (most) => 1 - most * atrophy;              // atrophy thins the muscle of a limb (most on the thigh), never the frame
  const R = {};

  // The age's ratio of each region to the adult's: on the lean part of a ring only, so fat and muscle are not multiplied
  // again. The back is one surface from the pelvis to the shoulders; rings between two regions take the mean of both.
  const g = K.g, back = g.chestDepth;
  const pelvisDepth = (g.belly + g.chestDepth) / 2, pelvisTop = (g.hips + g.waist) / 2;
  const upperWidth = (g.waist + g.chestWidth) / 2, upperFront = (g.belly + g.chestDepth) / 2;

  // torso (eight-sided rings). Fat amounts are what a region gains when it is full (level 1).
  const waistK = around(P.waist_width, 0.18), hipK = around(P.hip_width, 0.12), ribK = around(P.chest_width, 0.1);
  R.pelvis = [
    { y: K.crotch, w: B(L(0.075, 0.08)) * hipK * g.hips + fat('hips', 0.07), f: W(L(0.055, 0.055)) * pelvisDepth + fat('abdomen', 0.04),
      b: W(L(0.06, 0.07)) * back + fat('glutes', 0.05), q: 0.75 },
    { y: K.hipWide, w: B(L(0.15, 0.168)) * hipK * g.hips + fat('hips', 0.11) + fat('abdomen', 0.05), f: W(L(0.09, 0.088)) * pelvisDepth + fat('abdomen', 0.15),
      b: (W(L(0.09, 0.1)) * back + fat('glutes', 0.08)) * around(P.glute_projection, 0.15), q: 0.85 },
    { y: K.pelvisTop + 0.012 * U, w: B(L(0.13, 0.118)) * hipK * pelvisTop + fat('abdomen', 0.11) + fat('hips', 0.07),
      f: W(L(0.085, 0.08)) * g.belly + fat('abdomen', 0.22), b: W(L(0.08, 0.085)) * back + fat('glutes', 0.04), q: 0.8 },
  ];
  const glute = (W(L(0.012, 0.028)) * wasted(0.25) + fat('glutes', 0.10) + (P.glute_volume - 0.5) * 0.05 * wS + Math.min(0, mus(0.02))) * (1 - 0.3 * lax);
  R.pelvis[1].backCorners = -Math.max(0, glute); R.pelvis[0].backCorners = -(0.4 + 0.35 * lax) * Math.max(0, glute);
  const belly = (P.abdomen_volume - 0.5) * wS;
  R.abdomen = [   // the belly is widest in the middle ring
    { y: K.pelvisTop - 0.025 * U, w: W(L(0.125, 0.115)) * around(P.waist_width, 0.06) * g.waist + fat('abdomen', 0.19),
      f: W(L(0.085, 0.075)) * g.belly + fat('abdomen', 0.3) + 0.04 * belly + 0.012 * lax * wS, b: W(L(0.08, 0.075)) * back + fat('abdomen', 0.05), q: 0.8 },
    { y: K.waist, w: W(L(0.12, 0.098)) * waistK * g.waist + fat('abdomen', 0.21) - (m > 0 ? mus(0.012) : 0),
      f: W(L(0.085, 0.07)) * around(P.waist_width, 0.08) * g.belly + fat('abdomen', 0.33) + 0.06 * belly, b: W(L(0.075, 0.068)) * back + fat('abdomen', 0.07), q: 0.8 },
    { y: K.underbust + 0.015 * U, w: W(L(0.13, 0.11)) * around(P.waist_width, 0.06) * upperWidth + fat('abdomen', 0.15) + fat('chest', 0.05),
      f: W(L(0.088, 0.078)) * upperFront + fat('abdomen', 0.22), b: W(L(0.085, 0.075)) * back + fat('chest', 0.06), q: 0.8 },
  ];
  // Chest fat shapes a bust only on an adult body (a part of it on any adult, the rest with the female preset); on a
  // minor's it rounds the chest instead, and the bust term is zero under 18 years whatever the fat or the sex preset.
  const bustFat = 0.3 * C.adultFigure + 0.7 * fem, roundChest = fat('chest', 0.05) * 0.3 * (1 - C.adultFigure) * 0.5;
  const breast = (0.075 * P.breast_volume * around(P.breast_projection, 0.35) * wS + fat('chest', 0.05) * bustFat) * (1 - 0.2 * lax);
  const pec = W(0.006) + (m > 0 ? mus(0.03) : 0);
  const chestDepth = around(P.chest_depth, 0.15);
  K.shXBody = K.shX + fat('arms', 0.06) + fat('chest', 0.05) + fat('abdomen', 0.04) + mus(0.012);   // fat and muscle carry the arm outward
  R.chest = [
    { y: K.underbust - 0.02 * U, w: B(L(0.135, 0.112)) * ribK * g.chestWidth + fat('chest', 0.1) + fat('abdomen', 0.06),
      f: W(L(0.09, 0.08)) * g.chestDepth + fat('chest', 0.08) + fat('abdomen', 0.08), b: W(L(0.09, 0.08)) * back + fat('chest', 0.08), q: 0.8 },
    { y: K.bust - (0.015 * P.breast_volume + 0.012 * lax * fem) * U, w: B(L(0.15, 0.128)) * ribK * g.chestWidth + fat('chest', 0.14) + mus(0.02),
      f: (W(L(0.10, 0.088)) * g.chestDepth + fat('chest', 0.1) + roundChest) * chestDepth, b: (W(L(0.095, 0.085)) * back + fat('chest', 0.1) + mus(0.015)) * chestDepth, q: 0.82 },
    { y: Math.max(K.side.L.shY, K.side.R.shY) + 0.01 * U, w: K.shX - W(L(0.035, 0.03)) + fat('chest', 0.08) + fat('arms', 0.03) + fat('abdomen', 0.03) + mus(0.035),
      f: W(L(0.075, 0.065)) * g.chestDepth + fat('chest', 0.04), b: W(L(0.08, 0.07)) * back + fat('chest', 0.08) + mus(0.02), q: 0.8 },
  ];
  // Seams: the abdomen's ends sit inside the chest and the pelvis, so neither shows an open edge.
  const enclose = (outer, inner) => { for (const k of ['w', 'f', 'b']) outer[k] = Math.max(outer[k], inner[k] + 0.004 * wS); };
  enclose(R.chest[0], R.abdomen[2]); enclose(R.pelvis[2], R.abdomen[0]);
  R.breast = breast; R.pec = pec; R.breastLow = 0.25 + 0.4 * lax;   // sagging moves the volume down
  R.chestApex = [0, K.neckBase, -0.01 * wS];

  // neck and head: an infant's neck is short and thick, its skull broad and long for its height, its cheeks full
  const neckR = (W(L(0.054, 0.045)) * g.neck + fat('chest', 0.06) + mus(0.02) + 0.003 * lax * wS) * around(P.neck_width, 0.2);
  R.neck = [{ y: K.neckBase - 0.035 * U, w: neckR * 1.05, f: neckR, b: neckR }, { y: K.chin + 0.03 * hs, w: neckR, f: neckR * 0.95, b: neckR }];
  const jawFat = fG * 0.03 * wS + 0.004 * lax * hs, jaw = G.jaw(months), cheek = (1 + g.skullWidth) / 2, deep = g.skullDepth;
  R.head = [
    { y: K.chin + 0.02 * K.headH, z: 0.014 * hs, w: L(0.042, 0.035) * hs * jaw + jawFat, f: 0.07 * hs, b: 0.035 * hs + jawFat, q: 0.75 },
    { y: K.chin + 0.36 * K.headH, z: 0.012 * hs, w: L(0.064, 0.057) * hs * cheek + 0.6 * jawFat, f: 0.094 * hs * deep, b: 0.08 * hs * deep, q: L(0.86, 0.78) },
    { y: K.chin + 0.72 * K.headH, z: 0.01 * hs, w: L(0.075, 0.071) * hs * g.skullWidth, f: 0.088 * hs * deep, b: 0.1 * hs * deep, q: 0.8 },
    { y: K.chin + 0.93 * K.headH, z: 0.0, w: L(0.058, 0.056) * hs * g.skullWidth, f: 0.065 * hs * deep, b: 0.08 * hs * deep, q: 0.78 },
  ];
  R.headApex = [0, K.H, -0.01 * hs];

  // limbs (six-sided rings: half-width w sideways, f and b front and back). The knee rings take the mean of thigh and calf.
  const thighV = around(P.thigh_volume, 0.2);
  const arm = g.arm * wasted(0.06), thigh = g.thigh * wasted(0.15), knee = (g.thigh + g.calf) / 2 * wasted(0.1), calf = g.calf * wasted(0.1);
  const ring = (w, f, b) => ({ w, f, b: b ?? f });
  for (const s of ['L', 'R']) {
    R['arm' + s] = {
      upper: [ring(W(L(0.047, 0.039)) * arm + fat('arms', 0.08) + mus(0.028), W(L(0.05, 0.042)) * arm + fat('arms', 0.08) + mus(0.028)),
        ring(B(L(0.035, 0.029)) * arm + fat('arms', 0.05) + mus(0.012), B(L(0.037, 0.031)) * arm + fat('arms', 0.05) + mus(0.012))],
      // fore[1] is the wrist ring: the hand's interface (hands/ builds the hand's base on exactly these six points)
      fore: [ring(W(L(0.039, 0.033)) * arm + fat('arms', 0.045) + mus(0.02), W(L(0.042, 0.036)) * arm + fat('arms', 0.045) + mus(0.02)),
        ring(B(L(0.021, 0.018)) * arm + fat('arms', 0.015) + mus(0.004), B(L(0.03, 0.026)) * arm + fat('arms', 0.015) + mus(0.004))],
    };
  }
  R.leg = {
    thigh: [ring((W(L(0.079, 0.084)) * thigh + fat('thighs', 0.08) + mus(0.03)) * thighV, (W(L(0.082, 0.086)) * thigh + fat('thighs', 0.08) + mus(0.03)) * thighV),
      ring((B(L(0.05, 0.047)) * knee + fat('thighs', 0.085) + mus(0.008)) * thighV, (B(L(0.05, 0.048)) * knee + fat('thighs', 0.085) + mus(0.008)) * thighV)],
    calf: [ring(B(L(0.048, 0.045)) * knee + fat('thighs', 0.05) + fat('calves', 0.03), B(L(0.048, 0.046)) * knee + fat('thighs', 0.05) + fat('calves', 0.03)),
      ring(W(L(0.052, 0.049)) * calf + fat('calves', 0.07) + mus(0.022), W(L(0.045, 0.042)) * calf + fat('calves', 0.06) + mus(0.015), W(L(0.062, 0.058)) * calf + fat('calves', 0.075) + mus(0.022)),
      ring(B(0.029) * calf + fat('calves', 0.02), B(0.03) * calf + fat('calves', 0.016), B(0.032) * calf + fat('calves', 0.02))],
  };
  {
    // The thigh starts at the height of the pelvis's widest ring. The pelvis grows to hold the top of the thighs
    // (wide thighs make wide hips), and the thigh's outer side is then set a millimetre inside it.
    const t0 = (K.hipJoint - K.hipWide) / (K.hipJoint - K.knee), top = R.leg.thigh[0], hip = R.pelvis[1], mm = 0.001 * wS;
    const axis = lerp(K.hipX, K.kneeX, t0) + t0 * (K.hipJoint - K.knee) * Math.sin(deg(K.legAngle));
    const outer = top.w + fat('hips', 0.04);
    hip.w = Math.max(hip.w, axis + outer + mm);
    hip.f = Math.max(hip.f, (top.f + mm) / 0.89); hip.b = Math.max(hip.b, (top.b + mm) / 0.89);
    top.wo = hip.w - mm - axis;
    R.leg.t0 = t0;
  }
  const fw = B(L(0.048, 0.043)) * K.footK, sole = U / G.ADULT_STATURE;
  R.foot = { heel: { z: -0.22 * K.footLen, y: 0.045 * sole, w: B(0.029) * K.footK, top: 0.045 * sole },
    ball: { z: 0.52 * K.footLen, y: 0.022 * sole, w: fw, top: 0.026 * sole }, toe: [0, 0.014 * sole, 0.78 * K.footLen] };

  // Ball joints: an octahedron whose six points are set one by one [outward, inward, up, down, front, back]. Along the
  // limb it reaches as far as the tubes are thick, so a bent joint stays closed; sideways it is flush with the tubes;
  // the knee points forward (the kneecap) and the elbow backward (its tip), where the joint opens when it bends. The
  // shoulder's ball stays with the trunk (it follows the clavicle, not the arm) and reaches into the chest, so a
  // raised arm leaves no gap between its end and the chest.
  R.joints = {};
  for (const s of ['L', 'R']) {
    const a = R['arm' + s], u0 = a.upper[0], u1 = a.upper[1], f0 = a.fore[0], t1 = R.leg.thigh[1], c0 = R.leg.calf[0];
    const reach = Math.max(0, K.shXBody - R.chest[2].w) + 0.012 * wS;   // from the joint to inside the chest's top ring
    R.joints['Shoulder_' + s] = [u0.w, u0.w + reach, 0.75 * u0.w, u0.w, u0.f, u0.b];
    const ew = Math.min(u1.w, f0.w), er = Math.max(u1.w, f0.w, u1.f, f0.f);
    R.joints['Elbow_' + s] = [ew, ew, er, er, 0.9 * Math.min(u1.f, f0.f), 1.2 * Math.max(u1.b, f0.b)];
    const kw = Math.min(t1.w, c0.w), kr = Math.max(t1.w, c0.w, t1.f, c0.f);
    R.joints['Knee_' + s] = [kw, kw, kr, kr, 1.2 * Math.max(t1.f, c0.f), 0.9 * Math.min(t1.b, c0.b)];
  }
  R.fG = fG; R.m = m;
  return R;
}

// ---------------------------------------------------------------- 5. constraint solver

function torsoHalfWidth(R, y) {
  const rings = [...R.pelvis, ...R.abdomen, ...R.chest].sort((a, b) => a.y - b.y);
  if (y <= rings[0].y) return rings[0].w;
  for (let i = 1; i < rings.length; i++) {
    if (y <= rings[i].y) { const t = (y - rings[i - 1].y) / (rings[i].y - rings[i - 1].y); return lerp(rings[i - 1].w, rings[i].w, t); }
  }
  return rings[rings.length - 1].w;
}

const MAX_LEGS = 15, MAX_ARMS = 75, STEP = 0.25;   // degrees: the solver's searches are bounded

// The legs: how far they must open so the thighs and knees do not run into each other.
function solveLegs(K, R) {
  const t0 = R.leg.thigh[0], t1 = R.leg.thigh[1], c0 = R.leg.calf[0], c1 = R.leg.calf[1], len = K.hipJoint - K.knee;
  const shin = K.knee - K.ankle, tc = (K.knee - K.calf) / shin;
  const gap = 0.004 * K.wS;
  const samples = [];   // distance from the hip, half-thickness, how much the two legs may press into each other
  for (const t of [0.15, 0.35, 0.55, 0.75, 1]) {
    const r = lerp(t0.w, t1.w, Math.max(0, (t - R.leg.t0) / (1 - R.leg.t0)));
    samples.push([t * len, r, r * Math.max(0, 0.7 - 0.9 * t), lerp(K.hipX, K.kneeX, t)]);   // thighs press together near the top
  }
  samples.push([len + tc * shin, c1.w, 0, K.kneeX], [len + 0.05 * shin, c0.w, 0, K.kneeX]);
  for (let a = 0; a <= MAX_LEGS; a += STEP) {
    const s = Math.sin(deg(a)), c = Math.cos(deg(a));
    if (samples.every(([d, r, press, x0]) => x0 + d * s - r / c >= gap - press)) return a;
  }
  return MAX_LEGS;
}

const A_POSE = 12;   // degrees between the arm and the vertical in the reference pose

// The arms: how far they must open from the body so they clear the torso, the hips and the thighs. The upper arm and
// the forearm are sampled as tubes (as before the hands existed); the hand is checked on its own vertices, posed, in
// the bind pose of the arm (`handPts`, the left side's convention: x outward), so a fist or an open hand opens the arm
// as far as it needs and no further.
function solveArms(K, R, s, legAngle, handPts = []) {
  const sd = K.side[s], a = R['arm' + s];
  const total = sd.ua + sd.fa + sd.hand;
  const radius = (d) => {   // the arm's half-thickness sideways at a distance d from the shoulder
    if (d <= sd.ua) return lerp(a.upper[0].w, a.upper[1].w, d / sd.ua);
    return lerp(a.fore[0].w, a.fore[1].w, (d - sd.ua) / sd.fa);
  };
  const thighOuter = (y) => {
    if (y > K.hipJoint || y < K.knee) return 0;
    const t = (K.hipJoint - y) / (K.hipJoint - K.knee);
    return lerp(K.hipX, K.kneeX, t) + t * (K.hipJoint - K.knee) * Math.tan(deg(legAngle))
      + lerp(R.leg.thigh[0].wo, R.leg.thigh[1].w, Math.max(0, (t - R.leg.t0) / (1 - R.leg.t0)));
  };
  const gap = 0.012 * K.wS, arm = sd.ua + sd.fa;
  for (let ang = A_POSE; ang <= MAX_ARMS; ang += STEP) {
    const sn = Math.sin(deg(ang)), cs = Math.cos(deg(ang));
    let ok = true;
    for (let i = 4; i <= 24 && ok; i++) {   // from a fifth of the upper arm (the armpit may touch) to the wrist
      const d = total * i / 24, y = sd.shY - d * cs;
      if (d > arm) break;   // the hand: its vertices, below
      if (d < sd.ua && y > K.underbust) continue;
      const x = K.shXBody + d * sn - radius(d) / cs;
      if (x < Math.max(torsoHalfWidth(R, y), thighOuter(y)) + gap) ok = false;
    }
    for (let i = 0; i < handPts.length && ok; i++) {   // the hand's vertices, turned with the arm about the shoulder
      const rx = handPts[i][0] - K.shXBody, ry = handPts[i][1] - sd.shY;
      const x = K.shXBody + rx * cs - ry * sn, y = sd.shY + rx * sn + ry * cs;
      if (x < Math.max(torsoHalfWidth(R, y), thighOuter(y)) + gap) ok = false;
    }
    if (ok) return ang;
  }
  return MAX_ARMS;
}

function solve(C, K, R, hands) {
  const corrections = [];
  const legs = solveLegs(K, R);
  if (legs > 0) corrections.push({ rule: 'legs-apart', channel: 'pose.legs', asked: 0, used: legs,
    detail: `legs opened ${legs.toFixed(2)}° each so the thighs do not run into each other, and lengthened below the hip to keep the height` });
  if (legs >= MAX_LEGS) corrections.push({ rule: 'legs-limit', channel: 'pose.legs', asked: null, used: legs,
    detail: `the thighs could not clear each other within ${MAX_LEGS}°: they overlap` });
  const arms = { L: solveArms(K, R, 'L', legs, handPoints(K, hands, 'L')), R: solveArms(K, R, 'R', legs, handPoints(K, hands, 'R')) };
  for (const s of ['L', 'R']) {
    if (arms[s] > A_POSE) corrections.push({ rule: 'arms-apart', channel: `pose.arm_${s}`, asked: A_POSE, used: arms[s],
      detail: `arm ${s} opened to ${arms[s].toFixed(2)}° (the A pose is ${A_POSE}°) to clear the body` });
    if (arms[s] >= MAX_ARMS) corrections.push({ rule: 'arms-limit', channel: `pose.arm_${s}`, asked: null, used: arms[s],
      detail: `arm ${s} could not clear the body within ${MAX_ARMS}°: it overlaps the body` });
  }
  const maxBreast = 0.85 * R.chest[1].w;
  if (R.breast > maxBreast) {
    corrections.push({ rule: 'bust-on-narrow-chest', channel: 'proportions.breast_volume', asked: round3(R.breast), used: round3(maxBreast),
      detail: `the bust was limited to ${(maxBreast * 100).toFixed(1)} cm forward (asked for ${(R.breast * 100).toFixed(1)} cm) so it stays on a chest this narrow` });
    R.breast = maxBreast;
  }
  return { legs, arms, corrections };
}

// ---------------------------------------------------------------- 6. adaptive rig

const quat = (axis, angle) => { const s = Math.sin(angle / 2); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]; };
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// The rest pose (A pose plus posture), as quaternions [x, y, z, w] in each bone's local frame. Every bone's frame is
// aligned with the world in the bind pose, so one convention holds everywhere: X bends, Y twists, Z opens sideways. A
// positive turn about X tips what is above the joint forward (the spine bends forward); a limb hangs below its joint,
// so it swings forward with a negative turn (hip and shoulder flexion) and the knee bends with a positive one.
const SPINE_FORWARD = 20, SPINE_BACK = 10, PELVIC_TILT = 10, SHOULDER_ROLL = 10;   // degrees at the ends of each posture control
function restPose(C, sol) {
  const Q = {}, P = C.posture;
  const tilt = deg((P.pelvic_tilt - 0.5) * 2 * PELVIC_TILT), bend = (P.spine_curvature - 0.5) * 2;
  const curve = deg(bend * (bend > 0 ? SPINE_FORWARD : SPINE_BACK));   // more thoracic curve than the neutral spine, or less
  const roll = deg((P.shoulder_alignment - 0.5) * 2 * SHOULDER_ROLL);
  if (tilt) { Q.Pelvis = quat(X, tilt); Q.Spine_01 = quat(X, -0.6 * tilt); }
  // the curvature is shared along the spine; the neck and the head turn back so the face stays level
  if (curve) { Q.Spine_02 = quat(X, 0.35 * curve); Q.Spine_03 = quat(X, 0.65 * curve); Q.Neck = quat(X, -0.5 * curve); Q.Head = quat(X, -0.35 * curve); }
  for (const [s, sign] of [['L', 1], ['R', -1]]) {
    Q['UpperArm_' + s] = quat(Z, sign * deg(sol.arms[s]));
    if (roll) Q['Clavicle_' + s] = quat(Y, -sign * roll);
    const legQ = quat(Z, sign * deg(sol.legs));
    Q['Thigh_' + s] = tilt ? qmul(quat(X, -tilt), legQ) : legQ;   // the legs stay vertical when the pelvis tilts
    if (sol.legs) Q['Foot_' + s] = quat(Z, -sign * deg(sol.legs));   // the feet stay flat on the floor
  }
  return Q;
}

// Proposed animation limits, in degrees (from ../assets/characters/mannequin/rig.json): narrowed by the body's volume,
// then scaled by the character's joint mobility, which is its own control and not a function of age.
function limits(C, R, sol) {
  const f = R.fG, FL = C.fatLevel, stiff = 1 - C.functional.joint_mobility;
  const LOSS = { Hip: 0.5, Knee: 0.35, Elbow: 0.3, Spine: 0.5 };   // the share of its range a joint loses at mobility 0
  const out = {
    Hip: { flexion_max: 120 - 55 * f * FL.abdomen - 20 * f * FL.thighs },
    Knee: { flexion_max: 150 - 25 * f * FL.thighs - 15 * f * FL.calves },
    Elbow: { flexion_max: 150 - 35 * f * FL.arms },
    Spine: { flexion_max: 45 - 25 * f * FL.abdomen },
  };
  for (const [name, joint] of Object.entries(out)) joint.flexion_max = Math.round(Math.max(10, joint.flexion_max) * (1 - LOSS[name] * stiff));
  out.Shoulder = { adduction_min: Math.round(Math.max(sol.arms.L, sol.arms.R)) };
  return out;
}

// The neutral pose of a character that does not stand yet: lying on its back, limbs bent, as infants rest. Rotations
// are applied after the rest pose; `$offset` moves the whole character (here: onto the floor, lying along -Z).
// An infant's head stands out behind its back, so the neck bends forward until the back of the head and the back rest
// on the floor together; the arms come down until they touch it; and from six months the knees bend until the feet
// reach it, or as far as they go (a newborn holds its flexed legs up). Each is a bounded search, like the solver's.
const TRUNK = ['Chest', 'Abdomen', 'Pelvis'];
// The first angle from `from` to `to` at which `done` holds: scanned by degrees, then refined to a twentieth of a degree.
// null if it never holds.
function firstAngle(from, to, done) {
  for (let a = from; a <= to + 1e-9; a += 1) {
    if (!done(a)) continue;
    for (let b = Math.max(from, a - 1); b < a; b += 0.05) if (done(b)) return b;
    return a;
  }
  return null;
}
function lowest(character, pose, names) {   // the lowest point of these pieces in this pose: only their vertices are posed
  const world = boneWorld(character, pose), P = character.positions;
  let lo = Infinity;
  for (const p of character.pieces) {
    if (!names.includes(p.name)) continue;
    for (let v = p.v0; v < p.v1; v++) lo = Math.min(lo, place(character, world, p.bone, [P[3 * v], P[3 * v + 1], P[3 * v + 2]])[1]);
  }
  return lo;
}
function recumbentPose(C, sol, character) {
  const young = clamp(1 - C.months / 12, 0, 1);   // 1 at birth, 0 at a year: the bent posture of the newborn relaxes
  // proposed angles, from the clinical description of the newborn's bent posture: not measured values
  const hip = lerp(25, 70, young), spread = 28, knee = lerp(20, 95, young);
  const shoulder = lerp(35, 60, young), elbow = lerp(50, 95, young);
  const pose = { Root: quat(X, deg(-90)) };
  for (const [s, sign] of [['L', 1], ['R', -1]]) {
    pose['Thigh_' + s] = qmul(quat(Z, sign * deg(spread)), quat(X, deg(-hip)));
    pose['Calf_' + s] = quat(X, deg(knee));
    pose['UpperArm_' + s] = quat(Z, sign * deg(Math.max(0, shoulder - sol.arms[s])));
    pose['LowerArm_' + s] = quat(Z, sign * deg(elbow));   // hands up beside the head
  }
  const TOUCH = 0.0005;
  const neck = firstAngle(0, 40, (a) => { pose.Neck = quat(X, deg(a)); return lowest(character, pose, ['Head']) >= lowest(character, pose, TRUNK) - TOUCH; });
  pose.Neck = quat(X, deg(neck ?? 40));
  const floor = Math.min(lowest(character, pose, TRUNK), lowest(character, pose, ['Head']));   // the limbs do not move it
  for (const [s, sign] of [['L', 1], ['R', -1]]) {
    const open = quat(Z, sign * deg(Math.max(0, shoulder - sol.arms[s]))), arm = (a) => { pose['UpperArm_' + s] = qmul(quat(X, deg(a)), open); };
    const limb = [`UpperArm_${s}`, `Forearm_${s}`, `Elbow_${s}`, ...character.pieces.filter((p) => handSide(p.name) === s).map((p) => p.name)];
    const down = firstAngle(0, 60, (a) => { arm(a); return lowest(character, pose, limb) <= floor + TOUCH; });
    arm(down ?? 60);
    const leg = (k) => { pose['Calf_' + s] = quat(X, deg(k)); return lowest(character, pose, [`Foot_${s}`, `Shin_${s}`]) - floor; };
    let rest = firstAngle(knee, 140, (k) => leg(k) <= TOUCH);
    if (rest === null) {   // the feet cannot reach the floor: as low as they go
      let y = Infinity;
      for (let k = knee; k <= 140 + 1e-9; k += 1) { const h = leg(k); if (h < y) { y = h; rest = k; } }
    }
    // a newborn holds its flexed legs up (the angle asked); over the first half year they come down to rest
    pose['Calf_' + s] = quat(X, deg(lerp(knee, rest, clamp(C.months / 6, 0, 1))));
  }
  pose.$offset = [0, -inspect(character, pose).min[1], 0];
  return pose;
}

// ---------------------------------------------------------------- 6b. hands
//
// The hands come from hands/ (the Procedural Hand Pose System). generate()'s option `hands` is the Hand DNA v1 block:
// each hand's pose and controls, the mode and the level of detail. The body gives each hand its length (sd.hand: the
// wrist pivot to the middle fingertip), the forearm's wrist ring (fore[1]: the hand's base is built on exactly its six
// points), the age, the sex preset's weight (C.fem) and the arms' fat. The hand is built in its own frame (canonical
// right hand: +Y to the fingertips, +X the thumb, +Z out of the palm; a left hand is its mirror image) and set on the
// Hand_L / Hand_R bone the way the arm hangs: fingers down, the palm toward the thigh, the thumb forward.
//
// Every level is built for each body exactly: its dimensions, contacts and collisions are solved on this body's hand
// (the maintainer's rule), and levels 1 to 3 are built from the same solved skeleton as level 0, so a change of level
// does not change the pose. The solver starts from the library's fit for the hand's age (hands/fit.js) and stays local
// where that holds, so a body it has not seen costs about 15 ms a pose (README.md, "How the hands are built on a
// body"); a solved body and pose is kept (hands/index.js and rig.js cache by the exact inputs).

const HAND_LEVEL = Object.fromEntries(HANDS.HAND_LEVELS.map((l) => [l.level, l]));
const LOD_HAND_LEVEL = { 1: 1 };   // the character's level of detail -> its hands' level when the Hand DNA leaves it null
const DEFAULT_HANDS = { left: { pose: 'HP01' }, right: { pose: 'HP01' } };
const FOREARM_CAP = 4;             // level 4 has no hand: the forearm's six-sided end is closed by four triangles
// Triangles a hand, for each hand level ('1' is level 1's default variant; '1:<variant>' each variant), and a
// character's with those hands: measured by the modules of hands/ (HAND_LEVELS).
export const HAND_TRIANGLES = Object.fromEntries(HANDS.HAND_LEVELS.flatMap((l) => [[String(l.level), l.triangles],
  ...Object.entries(l.variants ?? {}).map(([name, v]) => [`${l.level}:${name}`, v.triangles])]));
export const CHARACTER_TRIANGLES = Object.fromEntries(Object.entries(HAND_TRIANGLES).map(([k, t]) => [k, BODY_TRIANGLES + 2 * (t || FOREARM_CAP)]));

// The hand frame (own side) to the body's bind pose, around the wrist pivot w; and the same turn as a quaternion.
// Right hand: (x, y, z) -> (z, -y, x); left hand (already mirrored in X): (x, y, z) -> (-z, -y, -x). Both are proper
// rotations: the palm (+Z) faces the body's midline, the thumb (+X right, -X left) points forward (+Z).
const HAND_TO_BODY = {
  L: (p, w) => [w[0] - p[2], w[1] - p[1], w[2] - p[0]],
  R: (p, w) => [w[0] + p[2], w[1] - p[1], w[2] + p[0]],
};
const HAND_TURN = { L: HQ.fromBasis([0, 0, -1], [0, -1, 0], [-1, 0, 0]), R: HQ.fromBasis([0, 0, 1], [0, -1, 0], [1, 0, 0]) };
const handPieceName = (name, s) => { const n = name.replace(/^L\d_/, ''); return ['Hand', 'Palm', 'Main'].includes(n) ? 'Hand_' + s : `Hand_${n}_${s}`; };
const handSide = (name) => (name.startsWith('Hand_') ? name.slice(-1) : null);   // 'L' or 'R' for any piece of a hand
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A copy of the options in which every value was read once (as snapshot() does for the DNA), deep enough for the Hand
// DNA (hands.left.fingers.index.curl). Own keys only (Reflect.ownKeys): an inherited key does not count, and symbol and
// non-enumerable keys are copied as they are (non-enumerable stays non-enumerable), so that the checks refuse them; a
// getter is read once. Nothing is converted: what is checked is what was handed in.
function snapshotDeep(v, depth) {
  if (v === null || typeof v !== 'object' || depth <= 0) return v;
  if (Array.isArray(v)) return Array.from(v, (x) => snapshotDeep(x, depth - 1));
  const out = {};
  for (const k of Reflect.ownKeys(v)) {
    const d = Reflect.getOwnPropertyDescriptor(v, k);
    if (!d) continue;   // a Proxy that lists a key it does not have
    Object.defineProperty(out, k, { value: snapshotDeep('value' in d ? d.value : v[k], depth - 1), enumerable: d.enumerable, writable: true, configurable: true });
  }
  return out;
}

// generate()'s options -> the hands to build: { ok, spec, mode, level, variant, notes } or { ok: false, errors }.
// A null level is the character's (level 1 for LOD 1) when the mode is built there, else the mode's own (articulated:
// 0, simplified: 2), and a note says so; a null mode is the level's.
function resolveHands(options, lod) {
  const no = (stage, code, path, message) => ({ ok: false, errors: [{ stage, code, path, message }] });
  let opts;
  try { opts = options === undefined || options === null ? {} : snapshotDeep(options, 8); }
  catch (e) { return no('generator', 'TYPE', 'options', `the options could not be read: ${e && e.message}`); }
  if (!isPlainObject(opts)) return no('generator', 'TYPE', 'options', 'the options must be an object: { hands, handVariant }');
  for (const k of Reflect.ownKeys(opts)) {   // a symbol, or a string not allowed, is an unknown option
    if (typeof k !== 'string' || !['hands', 'handVariant'].includes(k)) return no('generator', 'UNKNOWN_KEY', `options.${String(k)}`, `unknown option ${typeof k === 'string' ? JSON.stringify(k) : String(k)} (allowed: hands, handVariant)`);
    if (!Object.prototype.propertyIsEnumerable.call(opts, k)) return no('generator', 'TYPE', `options.${k}`, `"${k}" is not enumerable: only enumerable own data properties are read`);
  }
  const ownOption = (k) => (Object.prototype.hasOwnProperty.call(opts, k) ? opts[k] : undefined);
  const given = ownOption('hands') !== undefined && ownOption('hands') !== null;
  const v = HANDS.validateHands(given ? ownOption('hands') : DEFAULT_HANDS);
  if (!v.ok) return { ok: false, errors: v.errors };
  const spec = v.spec, own = LOD_HAND_LEVEL[lod], notes = [...v.notes];   // the Hand DNA's own notes (a mirror's)
  let level = spec.level ?? null, mode = spec.mode ?? null;
  if (level === null) {
    if (mode === null || HAND_LEVEL[own].modes.includes(mode)) level = own;
    else {
      level = mode === 'articulated' ? 0 : 2;
      notes.push(`the mode "${mode}" is not built at hand level ${own} (the character's level of detail ${lod}): level ${level}, the mode's own`);
    }
  }
  if (mode === null) mode = HAND_LEVEL[level].modes[0];
  const variant = ownOption('handVariant') ?? null;
  if (variant !== null) {
    const names = Object.keys(HAND_LEVEL[level].variants ?? {});
    if (typeof variant !== 'string' || !names.includes(variant)) {
      const got = typeof variant === 'string' ? JSON.stringify(variant) : typeof variant === 'bigint' ? `${variant}n`
        : typeof variant === 'object' ? (Array.isArray(variant) ? 'an array' : 'an object') : String(variant);
      return no('hands', 'ENUM', 'handVariant', names.length ? `hand level ${level} has the variants ${names.map((n) => JSON.stringify(n)).join(', ')} (got ${got})`
        : `hand level ${level} has no variants (got ${got})`);
    }
  }
  return { ok: true, spec, mode, level, variant, notes, given };
}

// What the body gives a hand. The fat is the arms' own fat as the body applies it (fat('arms', ...) in sections()),
// as a share of the most it can hold.
function handBody(C, K, R, s) {
  const r = R['arm' + s].fore[1];
  return { length: K.side[s].hand, ring: { w: r.w, f: r.f, b: r.b }, months: C.months, fem: C.fem, fat: Math.min(1, R.fG * C.fatLevel.arms / FAT_FULL) };
}

// Both hands of a body: { L, R } (each a built hand, its posed positions in `posedPositions`) or { errors }.
function characterHands(C, K, R, H) {
  const out = {}, errors = [];
  for (const [s, side] of [['L', 'left'], ['R', 'right']]) {
    const b = H.spec[side], body = handBody(C, K, R, s);
    const controls = { ...Object.fromEntries(['size', 'palm_width', 'finger_length', 'finger_thickness'].filter((k) => H.spec[k] !== undefined && H.spec[k] !== null).map((k) => [k, H.spec[k]])),
      ...(b.fingers ? { fingers: b.fingers } : {}), ...(b.thumb ? { thumb: b.thumb } : {}) };
    const grip = { grip_radius_m: b.grip_radius_m ?? null, object: b.object ?? null, grip_strength: b.grip_strength ?? null };
    let h;
    if (H.level === 4) {
      // no hand: nothing given for it is built, and each field given says so (the block's own fields once, with the
      // left hand; a side's fields with that side)
      const blockGiven = ['size', 'palm_width', 'finger_length', 'finger_thickness'].filter((k) => H.spec[k] !== undefined && H.spec[k] !== null);
      const sideGiven = ['grip_radius_m', 'object', 'grip_strength', 'fingers', 'thumb'].filter((k) => b[k] !== undefined && b[k] !== null);
      const ignored = (path, block) => ({ rule: 'hand-control-ignored', path, ...(block ? { block: true } : {}), asked: null, used: null, detail: 'hand level 4 has no hand: the forearm\'s end is closed and no pose is solved' });
      h = { ok: true, side, pose: b.pose, mode: null, level: 4, variant: null, positions: [], index: [], boneIndex: [], bones: [], pieces: [], angles: null, contact: null,
        corrections: [...(s === 'L' ? blockGiven.map((k) => ignored(k, true)) : []), ...sideGiven.map((k) => ignored(k, false))],
        diagnostics: [`hand level 4: no hand; the forearm's end is closed (no pose is solved)${blockGiven.length + sideGiven.length ? `; ignored: ${[...blockGiven, ...sideGiven].join(', ')}` : ''}`], triangles: 0, vertices: 0 };
    } else {
      h = HANDS.buildHand({ pose: b.pose, side, mode: H.mode, level: H.level, variant: H.level === 1 ? H.variant : null, body, controls, grip });
      if (h.ok) h = { ...h, angles: plain(h.angles), contact: plain(h.contact) ?? null, corrections: plain(h.corrections), diagnostics: [...h.diagnostics] };
    }
    // an error names the Hand DNA's key (HANDS.handDnaPath); what the body gave the hand is the side's own
    if (!h.ok) { errors.push(...h.errors.map((e) => ({ ...e, stage: 'hands', path: !e.path || /^body\b/.test(e.path) ? side : HANDS.handDnaPath(side, e.path) }))); continue; }
    h.body = body;
    h.posedPositions = h.mode === 'articulated' ? HANDS.posed(h) : h.positions;
    out[s] = h;
  }
  return errors.length ? { errors } : out;
}

// The hand's vertices, posed, in the arm's bind pose and the left side's convention (x outward): for solveArms.
function handPoints(K, hands, s) {
  const h = hands?.[s];
  if (!h || !h.vertices) return [];
  const P = h.posedPositions, sd = K.side[s], wx = K.shXBody, wy = sd.shY - sd.ua - sd.fa, out = [];
  for (let i = 0; i < P.length; i += 3) out.push([wx - P[i + 2], wy - P[i + 1]]);   // the same for both sides (see HAND_TO_BODY)
  return out;
}

// Mode A's finger bones on the body: their heads in the bind pose, their rest rotations as the body's bones take them
// (bind frames aligned with the world, as every bone's; a local rotation of the hand library, bind * rest * conj(bind)
// in the hand frame, turned into the body's frame), and `axes`: the bone's own axes in that frame. The hand library's
// bone frame is +Y along the bone, +Z the pad, +X the flexion axis; on the body that frame is not the world's, so a
// turn about the world's X does not bend a finger. A finger bends by a turn about axes.flexion (positive toward the
// pad), rolls about axes.twist and spreads about axes.spread (an MCP's rest is spread * flexion * twist); the thumb's
// metacarpal takes its abduction and opposition as one rotation (hands/rig.js restFromAngles).
function handBones(s, h, wrist) {
  if (h?.mode !== 'articulated') return [];
  const T = HAND_TURN[s], Tc = HQ.conj(T), axis = (q, v) => HQ.rot(T, HQ.rot(q, v)).map((x) => (Math.abs(x) < 1e-15 ? 0 : x));
  return h.bones.slice(1).map((bn) => ({ name: bn.name, parent: bn.parent, head: HAND_TO_BODY[s](bn.head, wrist),
    rest: HQ.norm(qmul(qmul(T, qmul(qmul(bn.bind, bn.rest), HQ.conj(bn.bind))), Tc)),
    axes: { flexion: axis(bn.bind, [1, 0, 0]), twist: axis(bn.bind, [0, 1, 0]), spread: axis(bn.bind, [0, 0, 1]) } }));
}

// A capsule inside a piece of the hand, for the body's solvers and the overlap report: on the piece's long axis
// through its deepest point. A piece with a point inside every face's plane (convex or star-shaped: the pieces of
// level 0 and most others) is measured by those planes, exactly. Any other closed piece (a bent finger of level 1
// 'readable' in some poses) is measured by its signed distance: inside by its winding number, the radius the distance
// to the nearest triangle, sampled along the capsule's axis with the spacing allowed for (the distance to a surface
// changes by at most the distance moved). Both give a capsule inside the piece.
function inscribedCapsule(V, T) {
  const c0 = scale(V.reduce((a, v) => addv(a, v), [0, 0, 0]), 1 / V.length);
  let size = 0; for (const v of V) size = Math.max(size, Math.hypot(...sub(v, c0)));
  // the long axis (the covariance's first direction)
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of V) { const e = sub(v, c0); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += e[a] * e[b]; }
  let u = [0.31, 0.83, 0.47];
  for (let it = 0; it < 40; it++) { const w = [dot(M[0], u), dot(M[1], u), dot(M[2], u)], l = Math.hypot(...w); if (l < 1e-18) break; u = scale(w, 1 / l); }
  const FRACTIONS = [0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];
  const along = (c, d, radiusOf) => {   // the best capsule on the axis through c (d: the depth at c)
    let lo = 0, hi = 0; for (const v of V) { const x = dot(sub(v, c), u); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    let best = { a: c, b: c, r: d, score: d > 0 ? 4 / 3 * d ** 3 : -Infinity };
    for (const f of FRACTIONS) {
      const a = addv(c, scale(u, lo * f)), b = addv(c, scale(u, hi * f)), r = radiusOf(a, b);
      if (!(r > 0)) continue;
      const score = r * r * Math.hypot(...sub(b, a)) + 4 / 3 * r ** 3;
      if (score > best.score) best = { a, b, r, score };
    }
    return best;
  };
  // 1. the planes of the faces: the depth inside all of them is concave, so a segment's least depth is at an end
  const planes = [];
  for (const [i, j, k] of T) { const n = cross(sub(V[j], V[i]), sub(V[k], V[i])), l = Math.hypot(...n); if (l > 1e-14) planes.push([scale(n, 1 / l), V[i]]); }
  const depth = (p) => { let m = Infinity; for (const [n, q] of planes) m = Math.min(m, dot(n, sub(q, p))); return m; };
  let c = c0, d = depth(c0);
  for (let step = 0.1 * size, it = 0; it < 200 && step > 1e-4 * size; it++) {   // toward the deepest point
    let near = planes[0], m = Infinity;
    for (const pl of planes) { const x = dot(pl[0], sub(pl[1], c)); if (x < m) { m = x; near = pl; } }
    const next = sub(c, scale(near[0], step)), dn = depth(next);
    if (dn > d) { c = next; d = dn; } else step *= 0.5;
  }
  let best = along(c, d, (a, b) => Math.min(depth(a), depth(b)));
  if (!(best.r > 0)) {
    // 2. no point inside every face's plane: the signed distance
    const sd = (p) => {
      let w = 0, m = Infinity;
      for (const [i, j, k] of T) {
        const a = sub(V[i], p), b = sub(V[j], p), e = sub(V[k], p), la = Math.hypot(...a), lb = Math.hypot(...b), le = Math.hypot(...e);
        w += 2 * Math.atan2(dot(a, cross(b, e)), la * lb * le + dot(a, b) * le + dot(a, e) * lb + dot(b, e) * la);
        m = Math.min(m, pointTriangleDistance(p, V[i], V[j], V[k]));
      }
      return w > 2 * Math.PI ? m : -m;   // winding number above 1/2: inside
    };
    const K = 16;   // samples along the axis: the radius is the least distance found less half the spacing
    const radiusOf = (a, b) => { let m = Infinity; for (let s = 0; s <= K; s++) m = Math.min(m, sd(addv(a, scale(sub(b, a), s / K)))); return m - Math.hypot(...sub(b, a)) / K / 2; };
    c = c0; d = sd(c0);
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { const p = scale(addv(V[i], V[j]), 0.5), x = sd(p); if (x > d) { c = p; d = x; } }
    const STEPS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let step = 0.1 * size, it = 0; it < 200 && step > 1e-4 * size; it++) {   // toward the deepest point
      let moved = false;
      for (const e of STEPS) { const p = addv(c, scale(e, step)), x = sd(p); if (x > d) { c = p; d = x; moved = true; break; } }
      if (!moved) step *= 0.5;
    }
    best = along(c, d, radiusOf);
  }
  if (!(best.r > 0)) throw new Error('a piece of the hand has no point inside it (it is not a closed solid): it cannot hold a collider');
  return { a: best.a, b: best.b, r: 0.85 * best.r };
}

// The distance from a point to a triangle (the closest point by its Voronoi regions, after Ericson).
function pointTriangleDistance(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return Math.hypot(...sub(p, addv(a, scale(ab, d1 / (d1 - d3)))));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return Math.hypot(...sub(p, addv(a, scale(ac, d2 / (d2 - d6)))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return Math.hypot(...sub(p, addv(b, scale(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))))));
  const den = 1 / (va + vb + vc);
  return Math.hypot(...sub(p, addv(a, addv(scale(ab, vb * den), scale(ac, vc * den)))));
}

// ---------------------------------------------------------------- 7. mesh (level of detail 1)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / Math.hypot(...a));

function frame(w, front) {   // u, v, w with u x v = w; v as close to `front` as it can be
  w = norm(w);
  const v = norm(sub(front, scale(w, dot(w, front))));
  return { u: cross(v, w), v, w };
}

// A unit polygon of n corners. Angle 0 is +u, 90 is +v (the front). q makes the diagonals square (0.707 = round).
function polygon(n, offset, q) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = deg(offset + 360 * k / n);
    pts.push([Math.abs(Math.cos(a)) < 1e-9 ? 0 : Math.cos(a), Math.abs(Math.sin(a)) < 1e-9 ? 0 : Math.sin(a)]);
  }
  const mc = Math.max(...pts.map((p) => Math.abs(p[0]))), ms = Math.max(...pts.map((p) => Math.abs(p[1])));
  const e = q ? Math.log(q) / Math.log(Math.SQRT1_2) : 1;
  return pts.map(([c, s]) => ({ c, s, cu: Math.sign(c) * Math.abs(c / mc) ** e, sv: Math.sign(s) * Math.abs(s / ms) ** e }));
}
const HEX_POINT = polygon(6, 90);   // corners at the front and the back
const BOX = polygon(4, 45);         // a box: the feet
const cornerBump = (c, s) => (2 * Math.abs(c) * Math.abs(s)) ** 2;   // 1 on the diagonals, 0 on the axes

function emit(K, R, sol, hands, boneIndexOf) {
  const pos = [], boneOf = [], index = [], pieces = [];
  let cur = null, mirror = false;
  const begin = (name, bone) => { cur = { name, bone, v0: pos.length / 3, t0: index.length / 3 }; };
  const end = () => { cur.v1 = pos.length / 3; cur.t1 = index.length / 3; pieces.push(cur); };
  const collider = (a, b, r) => {
    const m = (p) => (mirror ? [-p[0], p[1], p[2]] : p), d = sub(b, a), l = Math.hypot(...d);
    if (l > 2 * r) { a = addv(a, scale(d, r / l)); b = sub(b, scale(d, r / l)); } else if (l > 0) { a = b = addv(a, scale(d, 0.5)); }
    cur.collider = { a: m(a), b: m(b), r };
  };
  const vert = (p) => { pos.push(mirror ? -p[0] : p[0], p[1], p[2]); boneOf.push(BONE_INDEX[cur.bone]); return pos.length / 3 - 1; };
  const tri = (a, b, c) => { if (mirror) index.push(a, c, b); else index.push(a, b, c); };
  const ring = (center, F, poly, r) => poly.map(({ c, s, cu, sv }) => {
    const du = (cu > 0 && r.wo !== undefined ? r.wo : r.w) * cu;   // wo: the half-width of the outer side, when it differs
    let dv = (sv >= 0 ? r.f : r.b) * sv;
    if (r.frontCorners && s > 0) dv += r.frontCorners * cornerBump(c, s);
    if (r.frontMiddle && s > 0 && c === 0) dv += r.frontMiddle;
    if (r.backCorners && s < 0) dv += r.backCorners * cornerBump(c, s);
    return vert(addv(center, addv(scale(F.u, du), scale(F.v, dv))));
  });
  // Each side of a loft is a quad cut in two. `bulge` says which ring carries the corner bulges ('b' or 'a'): the cut
  // then starts at that ring's odd points, which keeps the left and right halves of a middle piece mirror images.
  const loft = (a, b, bulge) => {
    const n = a.length;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n, odd = k % 2 === 1;
      if (!bulge || (bulge === 'b') !== odd) { tri(a[k], a[k1], b[k1]); tri(a[k], b[k1], b[k]); }
      else { tri(a[k], a[k1], b[k]); tri(a[k1], b[k1], b[k]); }
    }
  };
  const capStart = (r) => { for (let k = 1; k < r.length - 1; k++) tri(r[0], r[k + 1], r[k]); };
  const capEnd = (r) => { for (let k = 1; k < r.length - 1; k++) tri(r[0], r[k], r[k + 1]); };
  const apexEnd = (r, p) => { const i = vert(p); for (let k = 0; k < r.length; k++) tri(r[k], r[(k + 1) % r.length], i); };
  const UP = frame(Y, Z);

  // torso, neck and head
  const stack = (name, bone, rings, poly, opts = {}) => {
    begin(name, bone);
    const rs = rings.map((r) => ring([0, r.y, r.z ?? 0], UP, poly(r), r));
    for (let i = 0; i + 1 < rs.length; i++) loft(rs[i], rs[i + 1], opts.bulge?.[i]);
    if (opts.capStart) capStart(rs[0]);
    if (opts.capEnd) capEnd(rs[rs.length - 1]);
    if (opts.apex) apexEnd(rs[rs.length - 1], opts.apex);
    const lo = rings[0], hi = rings[rings.length - 1];
    collider([0, lo.y, lo.z ?? 0], [0, hi.y, hi.z ?? 0], 0.85 * Math.min(...rings.map((r) => Math.min(r.w, (r.f + r.b) / 2))));
    end();
  };
  const oct = (r) => polygon(8, 0, r.q);
  stack('Pelvis', 'Pelvis', R.pelvis, oct, { capStart: true, capEnd: true, bulge: ['b', 'a'] });
  stack('Abdomen', 'Spine_01', R.abdomen, oct, { bulge: ['b', 'a'] });
  const chest = R.chest.map((r, i) => ({ ...r, frontCorners: i === 1 ? R.breast + R.pec : i === 0 ? R.breastLow * R.breast : 0.15 * R.pec,
    frontMiddle: i === 1 ? 0.4 * R.breast : 0 }));
  stack('Chest', 'Spine_03', chest, oct, { capStart: true, apex: R.chestApex, bulge: ['b', 'a'] });
  stack('Neck', 'Neck', R.neck.map((r) => ({ ...r, z: -0.015 * K.wS })), () => HEX_POINT);
  stack('Head', 'Head', R.head, oct, { capStart: true, apex: R.headApex, bulge: ['b', 'b', 'a'] });

  // limbs: built for the left side; the right side is the mirror image, with its own sizes when asymmetric
  const tube = (name, bone, a, b, rings, ts, opts = {}) => {
    begin(name, bone);
    const F = frame(sub(b, a), Z);
    const rs = rings.map((r, i) => ring(addv(a, scale(sub(b, a), ts[i])), F, opts.poly ?? HEX_POINT, r));
    for (let i = 0; i + 1 < rs.length; i++) loft(rs[i], rs[i + 1]);
    if (opts.capEnd) capEnd(rs[rs.length - 1]);
    if (opts.apex) apexEnd(rs[rs.length - 1], addv(a, addv(scale(sub(b, a), 1), scale(F.v, opts.apex))));
    collider(addv(a, scale(sub(b, a), ts[0])), opts.apex ? b : addv(a, scale(sub(b, a), ts[ts.length - 1])),
      0.85 * Math.min(...rings.map((r) => Math.min(r.w, (r.f + r.b) / 2))));
    end();
  };
  const ball = (name, bone, c, r) => {
    begin(name, bone);
    const v = [[r[0], 0, 0], [-r[1], 0, 0], [0, r[2], 0], [0, -r[3], 0], [0, 0, r[4]], [0, 0, -r[5]]].map((d) => vert(addv(c, d)));
    for (const sx of [0, 1]) for (const sy of [2, 3]) for (const sz of [4, 5]) {
      const sign = (sx === 0 ? 1 : -1) * (sy === 2 ? 1 : -1) * (sz === 4 ? 1 : -1);
      if (sign > 0) tri(v[sx], v[sy], v[sz]); else tri(v[sx], v[sz], v[sy]);
    }
    collider(c, c, 0.6 * Math.min(...r));
    end();
  };
  // A hand (6b): each piece of the hand library is a piece here, set on its bone from the hand frame. The positions are
  // the body's own, already of their side (no mirroring here), and the winding is the library's (outward).
  const emitHand = (s, h, w) => {
    const P = h.positions, I = h.index, to = HAND_TO_BODY[s];
    for (const pc of h.pieces) {
      begin(handPieceName(pc.name, s), pc.bone);
      const base = pos.length / 3, V = [], T = [], bi = boneIndexOf[pc.bone];
      if (bi === undefined) throw new Error(`hand piece ${pc.name}: no bone ${pc.bone}`);
      for (let v = pc.firstVertex; v < pc.firstVertex + pc.vertices; v++) {
        const q = to([P[3 * v], P[3 * v + 1], P[3 * v + 2]], w);
        pos.push(q[0], q[1], q[2]); boneOf.push(bi); V.push(q);
      }
      for (let t = pc.firstTriangle; t < pc.firstTriangle + pc.triangles; t++) {
        const tr = [I[3 * t] - pc.firstVertex, I[3 * t + 1] - pc.firstVertex, I[3 * t + 2] - pc.firstVertex];
        if (tr.some((x) => !(x >= 0 && x < pc.vertices))) throw new Error(`hand piece ${pc.name}: a triangle reaches outside the piece`);
        index.push(base + tr[0], base + tr[1], base + tr[2]); T.push(tr);
      }
      cur.collider = inscribedCapsule(V, T);
      end();
    }
  };
  const bind = bindPositions(K);
  const left = (p) => [Math.abs(p[0]), p[1], p[2]];
  for (const [s, mir] of [['L', false], ['R', true]]) {
    mirror = mir;
    const A = R['arm' + s], h = hands?.[s];
    const sh = left(bind['UpperArm_' + s]), el = left(bind['LowerArm_' + s]), wr = left(bind['Hand_' + s]);
    tube('UpperArm_' + s, 'UpperArm_' + s, sh, el, A.upper, [0, 1]);
    // the forearm ends open on the wrist ring, where the hand's base is built; with no hand (level 4) it is closed
    tube('Forearm_' + s, 'LowerArm_' + s, el, wr, A.fore, [0, 1], { capEnd: !h?.vertices });
    if (h?.vertices) { mirror = false; emitHand(s, h, bind['Hand_' + s]); mirror = mir; }
    const hp = left(bind['Thigh_' + s]), kn = left(bind['Calf_' + s]), an = left(bind['Foot_' + s]);
    tube('Thigh_' + s, 'Thigh_' + s, addv(hp, scale(sub(kn, hp), R.leg.t0)), kn, R.leg.thigh, [0, 1]);
    tube('Shin_' + s, 'Calf_' + s, kn, an, R.leg.calf, [0, (K.knee - K.calf) / (K.knee - K.ankle), 1]);
    begin('Foot_' + s, 'Foot_' + s);
    const FF = frame(Z, Y);
    const f = R.foot, base = [an[0], K.footBase, an[2]];
    const heel = ring(addv(base, [0, f.heel.y, f.heel.z]), FF, BOX, { w: f.heel.w, f: f.heel.top, b: f.heel.y });
    const ballR = ring(addv(base, [0, f.ball.y, f.ball.z]), FF, BOX, { w: f.ball.w, f: f.ball.top, b: f.ball.y });
    loft(heel, ballR); capStart(heel); apexEnd(ballR, addv(base, f.toe));
    collider(addv(base, [0, f.heel.y, f.heel.z + f.heel.y]), addv(base, [0, f.ball.y, f.ball.z]), 0.85 * f.ball.y);
    end();
  }
  for (const [s, mir] of [['L', false], ['R', true]]) {
    mirror = mir;
    ball('Shoulder_' + s, 'Clavicle_' + s, left(bind['UpperArm_' + s]), R.joints['Shoulder_' + s]);
    ball('Elbow_' + s, 'LowerArm_' + s, left(bind['LowerArm_' + s]), R.joints['Elbow_' + s]);
    ball('Knee_' + s, 'Calf_' + s, left(bind['Calf_' + s]), R.joints['Knee_' + s]);
  }
  mirror = false;
  return { pos, boneOf, index, pieces, bind };
}

// ---------------------------------------------------------------- the generator

// Generates a character from its DNA. Returns { ok: false, errors } for a DNA that does not validate.
// ---------------------------------------------------------------- generate

const fail = (code, path, message) => ({ ok: false, errors: [{ stage: 'generator', code, path, message }] });

// Builds a character from a DNA. Returns { ok: true, ... } or { ok: false, errors }: a DNA that fails the contract, a
// level of detail that does not exist yet, a hands block that fails the Hand DNA (stage 'hands') and a failure inside
// the generator all come back as explicit errors, and the caller keeps its last valid character.
//   options.hands        the Hand DNA v1 block (hands/index.js, README.md "Hands"); left out: both hands in HP01, at
//                        the hand level of the character's level of detail (LOD 1: level 1, 'preset')
//   options.handVariant  a variant of the hand level (level 1: 'budget', the default, or 'readable'), or null
export function generate(input, options = {}) {
  const dna = snapshot(input);   // every value read once: what is checked below is what is built
  const checked = check(dna);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  if (!(dna.lod in TOPOLOGY_VERSION)) {
    return fail('LOD_NOT_AVAILABLE', 'lod', `level of detail ${dna.lod} is not built yet (available: ${Object.keys(TOPOLOGY_VERSION).join(', ')})`);
  }
  const H = resolveHands(options, dna.lod);
  if (!H.ok) return { ok: false, errors: H.errors };
  try { return build(dna, H); }
  catch (e) { return fail('INTERNAL', '', `the generator failed: ${e && e.message}`); }
}

const SIDE_NAME = { L: 'left', R: 'right' };

function build(D, H) {
  const C = resolve(D);
  let K = skeleton(C), R = sections(C, K), hands = characterHands(C, K, R, H);
  if (hands.errors) return { ok: false, errors: hands.errors };
  let sol = solve(C, K, R, hands);
  if (sol.legs > 0) {   // open legs reach less far down: lengthen them so the feet stay on the floor at the same height
    K = skeleton(C, sol.legs);
    R = sections(C, K);
    hands = characterHands(C, K, R, H);   // the same arms and hands (the legs do not change them): from the caches
    if (hands.errors) return { ok: false, errors: hands.errors };
    const again = solve(C, K, R, hands);
    sol = { ...again, legs: sol.legs, corrections: [...sol.corrections.filter((c) => c.rule.startsWith('legs-')), ...again.corrections.filter((c) => !c.rule.startsWith('legs-'))] };
  }
  // the bones: the mannequins' 23, then mode A's 15 finger bones a hand (left, then right)
  const bindAt = bindPositions(K), rest = restPose(C, sol), straight = restPose({ ...C, posture: { spine_curvature: 0.5, pelvic_tilt: 0.5, shoulder_alignment: 0.5 } }, sol);
  const fingers = [...handBones('L', hands.L, bindAt.Hand_L), ...handBones('R', hands.R, bindAt.Hand_R)];
  const boneIndexOf = Object.fromEntries([...BONES.map(([n]) => n), ...fingers.map((b) => b.name)].map((n, i) => [n, i]));
  const mesh = emit(K, R, sol, hands, boneIndexOf);
  if (!mesh.pos.every(Number.isFinite)) return fail('NON_FINITE', '', 'the geometry has a coordinate that is not a finite number');
  const bones = [...BONES.map(([name, parent]) => ({ name, parent, head: mesh.bind[name], rest: rest[name] ?? [0, 0, 0, 1] })), ...fingers];
  // the hands' corrections join the body's, each with its side
  const handCorrections = ['L', 'R'].flatMap((s) => hands[s].corrections.map((k) => ({ rule: k.rule,
    channel: k.block ? `hands.${k.path}` : `hands.${SIDE_NAME[s]}${k.path ? '.' + k.path : ''}`,
    asked: k.asked ?? null, used: k.used ?? null, detail: k.block ? `hands: ${k.detail}` : `hand ${SIDE_NAME[s]} (${hands[s].pose}): ${k.detail}` })));
  const character = {
    ok: true, solved: true, generator: GENERATOR_VERSION, contract: DNA_CONTRACT,
    topology: { lod: D.lod, version: TOPOLOGY_VERSION[D.lod], hands: { level: H.level, mode: H.mode, variant: hands.L.variant ?? null } },
    id: D.id, dna: D, stage: stageOf(C.months),
    // what the DNA's nulls became, and what the generator used where it could not use a value as given
    resolved: { skeletal_maturity: C.maturity, reference_stature: C.reference, bone_structure: C.bone_structure, body_fat: C.body_fat,
      muscle_mass: C.muscle_mass, proportions: C.P, fat_distribution: C.fatWeights, fat_used: C.fatUsed, fat_level: C.fatLevel, aging: C.aging,
      functional: C.functional, posture: C.posture },
    motor_profile: G.motorProfile(C.months), notes: C.notes, corrections: [...C.corrections, ...sol.corrections, ...handCorrections],
    bones, pieces: mesh.pieces, positions: new Float32Array(mesh.pos), boneIndex: new Uint8Array(mesh.boneOf),
    index: new Uint16Array(mesh.index), limits: limits(C, R, sol), neutral_pose: null, hands: null,
    measures: { height_reference: D.height_m, height_mode: D.height_mode, height_built: 0, height_posed: 0, triangles: mesh.index.length / 3,
      vertices: mesh.pos.length / 3, arm_angle: sol.arms, leg_angle: sol.legs, bust_m: R.breast,
      hand_triangles: { left: hands.L.triangles, right: hands.R.triangles } },
  };
  // The height built: the body standing straight, measured. It must be the DNA's; posture is apart (height_posed).
  const fingerRest = new Set(fingers.map((b) => b.name));
  character.measures.height_built = inspect({ ...character, bones: bones.map((b) => ({ ...b, rest: straight[b.name] ?? (fingerRest.has(b.name) ? b.rest : [0, 0, 0, 1]) })) }).height;
  // Feet on the floor: posture (a tilted pelvis) can lift or sink the soles by a fraction of a millimetre. The whole
  // body is moved by that much against its root, which stays at the origin.
  const floor = inspect(character).min[1];
  if (Math.abs(floor) > 1e-6) {
    for (let i = 1; i < character.positions.length; i += 3) character.positions[i] -= floor;
    for (const b of bones) if (b.parent) b.head = [b.head[0], b.head[1] - floor, b.head[2]];
    for (const piece of character.pieces) { piece.collider.a = [piece.collider.a[0], piece.collider.a[1] - floor, piece.collider.a[2]]; piece.collider.b = [piece.collider.b[0], piece.collider.b[1] - floor, piece.collider.b[2]]; }
  }
  character.measures.height_posed = inspect(character).height;
  character.hands = handsRecord(character, H, hands);
  if (character.motor_profile.stance === 'recumbent') character.neutral_pose = recumbentPose(C, sol, character);
  // What the solver could not clear is said, never hidden: any two pieces that still overlap, in the rest pose and in
  // the neutral pose. Nothing more is moved: the body is returned with `solved: false`.
  const report = (pose, where) => {
    for (const hit of collisions(character, pose)) {
      character.corrections.push({ rule: 'overlap', channel: where, asked: 0, used: round3(hit.depth),
        detail: `${hit.a} and ${hit.b} overlap by ${(hit.depth * 1000).toFixed(1)} mm in the ${where === 'pose.rest' ? 'rest' : 'neutral'} pose: this body could not be solved` });
    }
  };
  report({}, 'pose.rest');
  if (character.neutral_pose) report(character.neutral_pose, 'pose.neutral');
  character.solved = isSolved(character.corrections);
  return character;
}

// Solved: nothing overlaps (in the body, or inside a hand: 'hand-collision'), and no body solver ran out of room (a
// rule ending in '-limit'). A hand's joint limit ('hand-joint-limit': a pose or control asked for more than a joint
// bends) is a correction, not a failure.
export const isSolved = (corrections) => !corrections.some((k) => k.rule === 'overlap' || k.rule === 'hand-collision' || (k.rule.endsWith('-limit') && !k.rule.startsWith('hand-')));

// character.hands: what each hand is and where it sits on this body.
function handsRecord(character, H, hands) {
  const piece = Object.fromEntries(character.pieces.map((p) => [p.name, p])), P = character.positions;
  const side = (s) => {
    const h = hands[s], head = character.bones.find((b) => b.name === 'Hand_' + s).head, T = HAND_TURN[s];
    const palm = piece['Hand_' + s], fore = piece['Forearm_' + s];
    const ringAt = (p, first) => (p ? Array.from({ length: 6 }, (_, k) => [P[3 * (first + k)], P[3 * (first + k) + 1], P[3 * (first + k) + 2]]) : null);
    return { side: SIDE_NAME[s], pose: h.pose, mode: h.mode, level: h.level, variant: h.variant ?? null, triangles: h.triangles, vertices: h.vertices,
      bones: h.mode === 'articulated' ? h.bones.length : h.vertices ? 1 : 0, pieces: character.pieces.filter((p) => handSide(p.name) === s).map((p) => p.name),
      angles: plain(h.angles), contact: plain(h.contact) ?? null, corrections: plain(h.corrections), diagnostics: [...h.diagnostics], body: plain(h.body),
      // the universal wrist interface on this body: the pivot (the hand bone's head), the hand frame's axes in the body,
      // and the six points of the ring: the forearm's end and the hand's base, in the bind pose
      wrist: { bone: 'Hand_' + s, pivot: head.slice(), axes: { fingers: rotate(T, [0, 1, 0]), palm: rotate(T, [0, 0, 1]), thumb: rotate(T, [s === 'L' ? -1 : 1, 0, 0]) },
        forearm_ring: ringAt(fore, fore.v1 - 6), hand_ring: palm ? ringAt(palm, palm.v0) : null } };
  };
  return { version: HANDS.HAND_DNA_VERSION, mode: H.mode, level: H.level, variant: hands.L.variant ?? null, mirror: H.spec.mirror ?? 'none',
    dominant_hand: H.spec.dominant_hand ?? null, given: H.given, notes: [...H.notes], limits: H.mode === 'articulated' ? plain(HAND_LIMITS) : null,
    left: side('L'), right: side('R') };
}

const rotate = (q, p) => { const u = [q[0], q[1], q[2]], t = scale(cross(u, p), 2); return addv(addv(p, scale(t, q[3])), cross(u, t)); };

// Forward kinematics: each bone's world rotation and position for the rest pose plus an optional pose (quaternions in
// the bones' local frames, applied after the rest pose).
export function boneWorld(character, pose = {}) {
  const world = {}, byName = Object.fromEntries(character.bones.map((b) => [b.name, b]));
  for (const b of character.bones) {
    const local = pose[b.name] ? qmul(b.rest, pose[b.name]) : b.rest;
    if (!b.parent) { world[b.name] = { q: local, p: addv(b.head, pose.$offset ?? [0, 0, 0]) }; continue; }
    const P = world[b.parent];
    world[b.name] = { q: qmul(P.q, local), p: addv(P.p, rotate(P.q, sub(b.head, byName[b.parent].head))) };
  }
  return world;
}
// A character's bones by name (the 23, and mode A's finger bones): kept with its list of bones, and dropped with it.
const BONES_BY_NAME = new WeakMap();
const boneNamed = (character, name) => {
  let m = BONES_BY_NAME.get(character.bones);
  if (!m) { m = new Map(character.bones.map((b) => [b.name, b])); BONES_BY_NAME.set(character.bones, m); }
  return m.get(name);
};
const place = (character, world, bone, p) => { const W = world[bone]; return addv(W.p, rotate(W.q, sub(p, boneNamed(character, bone).head))); };

// The rest pose (plus an optional pose) applied to the vertices, for tests and exports that need world positions.
export function posedPositions(character, pose = {}) {
  const world = boneWorld(character, pose), out = new Float32Array(character.positions.length);
  const W = character.bones.map((b) => world[b.name]), heads = character.bones.map((b) => b.head);
  for (let i = 0; i < out.length / 3; i++) {
    const b = character.boneIndex[i];
    const p = addv(W[b].p, rotate(W[b].q, sub([character.positions[3 * i], character.positions[3 * i + 1], character.positions[3 * i + 2]], heads[b])));
    out[3 * i] = p[0]; out[3 * i + 1] = p[1]; out[3 * i + 2] = p[2];
  }
  return out;
}

// Simplified colliders, apart from the visible mesh: one capsule per piece (a sphere for a ball joint), posed.
export function colliders(character, pose = {}) {
  const world = boneWorld(character, pose);
  return character.pieces.map((pc) => ({ name: pc.name, a: place(character, world, pc.bone, pc.collider.a),
    b: place(character, world, pc.bone, pc.collider.b), r: pc.collider.r }));
}

// Contacts that belong to the body: a piece with its neighbours, the armpit, the top of the thighs.
const CONNECTED = [['Pelvis', 'Abdomen'], ['Abdomen', 'Chest'], ['Chest', 'Neck'], ['Neck', 'Head'], ['Pelvis', 'Chest']];
for (const s of ['L', 'R']) {
  CONNECTED.push(['Chest', 'Shoulder_' + s], ['Chest', 'UpperArm_' + s], ['Shoulder_' + s, 'UpperArm_' + s],
    ['UpperArm_' + s, 'Elbow_' + s], ['Elbow_' + s, 'Forearm_' + s], ['UpperArm_' + s, 'Forearm_' + s],
    ['Forearm_' + s, 'Hand_' + s], ['Pelvis', 'Thigh_' + s], ['Abdomen', 'Thigh_' + s],
    ['Thigh_' + s, 'Knee_' + s], ['Knee_' + s, 'Shin_' + s], ['Thigh_' + s, 'Shin_' + s], ['Shin_' + s, 'Foot_' + s]);
}
CONNECTED.push(['Thigh_L', 'Thigh_R']);
const CONNECTED_SET = new Set(CONNECTED.flatMap(([a, b]) => [a + '|' + b, b + '|' + a]));
// The pieces of one hand touch each other by design (its own solver checks them, exactly: hands/rig.js), and the
// hand's base sits in its forearm's end.
const connected = (a, b) => {
  if (CONNECTED_SET.has(a + '|' + b)) return true;
  const ha = handSide(a), hb = handSide(b);
  return (ha !== null && ha === hb) || (ha !== null && b === 'Forearm_' + ha) || (hb !== null && a === 'Forearm_' + hb);
};

function segmentDistance(p1, q1, p2, q2) {   // closest distance between two segments
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) return Math.hypot(...r);
  if (a < 1e-12) { s = 0; t = Math.min(Math.max(f / e, 0), 1); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = Math.min(Math.max(-c / a, 0), 1); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.min(Math.max((b * f - c * e) / den, 0), 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(Math.max(-c / a, 0), 1); } else if (t > 1) { t = 1; s = Math.min(Math.max((b - c) / a, 0), 1); }
    }
  }
  return Math.hypot(...sub(addv(p1, scale(d1, s)), addv(p2, scale(d2, t))));
}

// Pairs of pieces that are not connected and whose colliders overlap: interpenetration that should not happen.
export function collisions(character, pose = {}, tolerance = 0.003) {
  const cs = colliders(character, pose), out = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    if (connected(cs[i].name, cs[j].name)) continue;
    const depth = cs[i].r + cs[j].r - segmentDistance(cs[i].a, cs[i].b, cs[j].a, cs[j].b);
    if (depth > tolerance) out.push({ a: cs[i].name, b: cs[j].name, depth });
  }
  return out;
}

// The volume of the mesh in the bind pose, in cubic metres: every piece closed with flat caps and measured on its own,
// so pieces that overlap are counted twice. Good for comparing two bodies (the fat of one build against another), not
// for a body's true volume.
export function volume(character) {
  const p = character.positions, idx = character.index, at = (i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
  const signed = (a, b, c) => (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  let total = 0;
  for (const piece of character.pieces) {
    const next = new Map(), seen = new Set();   // open edges, each with the direction its triangle gives it
    let v = 0;
    for (let t = 3 * piece.t0; t < 3 * piece.t1; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      v += signed(at(tri[0]), at(tri[1]), at(tri[2]));
      for (let e = 0; e < 3; e++) { const a = tri[e], b = tri[(e + 1) % 3]; if (seen.has(b + ':' + a)) { seen.delete(b + ':' + a); next.delete(b); } else { seen.add(a + ':' + b); next.set(a, b); } }
    }
    const open = new Map([...seen].map((e) => e.split(':').map(Number)));
    while (open.size) {   // each loop of open edges gets a cap: a fan from its centre, facing out
      const start = open.keys().next().value, loop = [];
      for (let a = start; open.has(a); ) { loop.push(a); const b = open.get(a); open.delete(a); a = b; }
      const c = [0, 0, 0]; for (const i of loop) { const q = at(i); for (let k = 0; k < 3; k++) c[k] += q[k] / loop.length; }
      for (let i = 0; i < loop.length; i++) v += signed(at(loop[(i + 1) % loop.length]), at(loop[i]), c);
    }
    total += v;
  }
  return total;
}

// What the tests measure on a posed character: its bounds and height, coordinates that are not finite numbers, and
// triangles with no area.
export function inspect(character, pose = {}) {
  const p = posedPositions(character, pose), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let nonFinite = 0, degenerate = 0;
  for (let i = 0; i < p.length; i++) {
    if (!Number.isFinite(p[i])) { nonFinite++; continue; }
    const a = i % 3; if (p[i] < min[a]) min[a] = p[i]; if (p[i] > max[a]) max[a] = p[i];
  }
  const at = (i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]], idx = character.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = at(idx[t]), n = cross(sub(at(idx[t + 1]), a), sub(at(idx[t + 2]), a));
    if (!(Math.hypot(...n) / 2 > 1e-10)) degenerate++;
  }
  return { min, max, height: max[1] - min[1], nonFinite, degenerate };
}

// ---------------------------------------------------------------- ids and presets

const two = (n) => String(n).padStart(2, '0');
export const STAGE_AGE = { A01: 0, A02: 6, A03: 24, A04: 60, A05: 108, A06: 180, A07: 288, A08: 480, A09: 840, A10: 1020 };   // months
export const referenceStature = (sex, months) => G.stature(sex, months);

// A DNA with every channel left to the presets. An adult's height comes from the adult scale (H01..H10); a minor's is
// the reference stature of the age, moved by the same ratio the adult scale has to its own reference (a proposal: the
// contract has no table of heights for minors yet).
export function presetDNA({ sex = 'male', age_months = 360, level = 5, build = 4, seed = 0, id } = {}) {
  const adult = age_months >= ADULT_MONTHS;
  const height_m = adult ? HEIGHTS[level - 1] : Math.round(G.stature(sex, age_months) * HEIGHTS[level - 1] / G.ADULT_STATURE * 100) / 100;
  return blankDNA({ id: id ?? `${sex === 'female' ? 'F' : 'M'}_${stageOf(age_months)}_H${two(level)}_C${two(build)}`, sex, age_months,
    height_level: 'H' + two(level), height_m, build, seed });
}

// SEX_HEIGHT_BUILD (an adult of 30, as in F_H05_C05) or SEX_AGE_HEIGHT_BUILD (as in F_A05_H05_C04).
export function dnaFromId(id) {
  const m = /^([MF])_(?:(A(?:0[1-9]|10))_)?H(0[1-9]|10)_C(0[1-9]|10)$/.exec(id);
  if (!m) return null;
  return presetDNA({ sex: m[1] === 'F' ? 'female' : 'male', age_months: m[2] ? STAGE_AGE[m[2]] : 360, level: +m[3], build: +m[4], id });
}

// A reproducible random adult, for crowds: the same seed gives the same DNA with the same generator version.
export function randomDNA(seed) {
  const r = rng((seed ^ 0x9E3779B9) >>> 0);
  const gauss = () => (r() + r() + r() + r() - 2) / 0.58;   // about a standard normal
  const sex = r() < 0.5 ? 'male' : 'female';
  const age_months = ADULT_MONTHS + Math.floor(r() * (1020 - ADULT_MONTHS));
  const level = clamp(Math.round((sex === 'female' ? 3.2 : 5.3) + gauss() * 1.3), 1, 10);
  const build = clamp(Math.round(4.3 + gauss() * 1.7), 1, 10);
  const dna = presetDNA({ sex, age_months, level, build, seed: seed >>> 0, id: `crowd_${seed >>> 0}` });
  for (const k of ['head_size', 'shoulder_width', 'chest_width', 'waist_width', 'hip_width', 'torso_length', 'leg_length', 'arm_length']) {
    dna.proportions[k] = round3(clamp(0.5 + gauss() * 0.13, 0.1, 0.9));
  }
  return dna;
}
