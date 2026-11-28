// rig.js - the hand rig shared by every level of detail: the dimensions of a hand (from the body, its age and sex, and
// the controls), the 16-bone skeleton, pose reading, the controls on top of a pose, the pose solver (object grips,
// folded fingers, fingers against the palm and their neighbours, the thumb, the exact separating-axis check), mirroring
// and blending. Plain JavaScript, no dependencies beyond the generator's own growth curves; runs in Node and browsers.
//
// Restructured from an articulated prototype written while this system was designed (not in the repository): its frame,
// THUMB_MAP, LIMITS and solver are kept; what is new is the body/age/sex/fat dimensions, the controls, box and plane
// grips, the object's shape and orientation, the grip strength, structured corrections, the library's fit (fit.js),
// and a cache of solved poses.
//
// FRAME (canonical RIGHT hand): metres, origin at the wrist pivot (the Hand_* bone head), +Y wrist -> fingertips, +X
// toward the thumb (radial), +Z out of the palm (the back faces -Z). A left hand is the mirror image in X with the
// winding flipped (positions x -> -x; quaternions (x,y,z,w) -> (x,-y,-z,w), i.e. M R M with M = diag(-1,1,1): proper
// rotations, never a negative scale).
//
// BONES (16 a hand): Hand, Thumb_01..03 (metacarpal: joint CMC; then MCP, IP), Index_01..03, Middle_01..03,
// Ring_01..03, Pinky_01..03 (MCP, PIP, DIP), suffix _L / _R. Every finger bone's local frame: +Y along the bone toward
// the tip, +Z the pad (palmar) side, +X = Y x Z.
//   flexion  rotation about local +X (positive bends toward the pad)              every joint
//   spread   rotation about local +Z at the MCP (positive toward the little finger, the data's sign)
//   twist    rotation about local +Y at the MCP (a small roll of the finger, a control, +-10 degrees)
//   MCP rest = qZ(spread) * qX(flexion) * qY(twist); PIP, DIP rest = qX(flexion).
// The four fingers' bind frames are the hand frame. The thumb's bind frame: local Y along the metacarpal,
// THUMB_MAP.bindAngleDeg radial of +Y in the palm plane; local Z (the pad) turned THUMB_MAP.padTwistDeg from +Z toward
// the index. Thumb_01's rest maps the data's semantic controls to one quaternion (see restFromAngles):
//   inPlane = zeroAngleDeg + kA * abduction - bindAngleDeg
//   Rw = Rz(-inPlane) * R(A, kE * opposition) * R(Yb, -(kP * opposition + twist)),  A = Yb x Z
//   rest = conj(bind) * Rw * bind * qX(cmc_flex)
// `twist` of the thumb is not in the data: an extra pronation the contact solver may use (authored 0, limit +-40).
//
// WHAT IS A PROPOSAL: every proportion, the age, sex and fat factors, THUMB_MAP, LIMITS and the grip objects' sizes are
// this rig's proposals (the maintainer's data says its own angles are experimental too). The only measured numbers
// near the hand are in the human generator (the body's hand length and wrist ring, see README.md).

import { curve } from '../growth.js';
import { POSE_FIT } from './fit.js';

const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------------------ constants
export const REF_LENGTH = 0.184;                              // the design's reference adult hand (a PROPOSAL): wrist pivot to
                                                              // middle fingertip; the generator's adult presets give 189 and 179 mm
export const REF_RING = { w: 0.021, f: 0.030, b: 0.030 };    // the design's reference wrist ring (a PROPOSAL, about the
                                                              // mean of the generator's adult presets: 22.2/31.2 and 19.2/27.2 mm)
export const REFERENCE_BODY = { length: REF_LENGTH, ring: REF_RING, months: 360, fem: 0, fat: 0 };
export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const DIGITS = ['thumb', ...FINGERS];
const CAP = { thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Pinky' };
export const BONE_NAMES = ['Hand', ...DIGITS.flatMap((f) => [1, 2, 3].map((k) => `${CAP[f]}_0${k}`))];
export const BONE_PARENTS = BONE_NAMES.map((n, i) => (i === 0 ? -1 : (i - 1) % 3 === 0 ? 0 : i - 1));
export const DIGIT_BONES = { thumb: [1, 2, 3], index: [4, 5, 6], middle: [7, 8, 9], ring: [10, 11, 12], pinky: [13, 14, 15] };
const FBASE = { index: 4, middle: 7, ring: 10, pinky: 13 };

// Proportions, fractions of the hand length L (proposals chosen while designing this system, not measured).
export const PROPORTIONS = {
  knuckleY: { index: 0.525, middle: 0.54, ring: 0.525, pinky: 0.49 },   // MCP pivots: the knuckle cascade
  fingerLength: { index: 0.39, middle: 0.43, ring: 0.40, pinky: 0.32 }, // relative; scaled so the middle tip lands at L
  split: [0.50, 0.29, 0.21],                                            // proximal, middle, distal share of a finger
  palmWidth: 0.45, palmThickness: 0.15, fingerWidth: 0.09, fingerDepth: 0.085,
  fingerWidthK: { index: 1.0, middle: 1.03, ring: 0.97, pinky: 0.86 },
  segmentK: [[1.0, 0.95], [0.87, 0.83], [0.76, 0.72]],                 // a finger segment's start and body size
  thumb: { metacarpal: 0.25, proximal: 0.17, distal: 0.16, cmc: [0.105, 0.16, 0.04],
    size: [[0.034, 0.032, 0.056, 0.050], [0.050, 0.045, 0.047, 0.042], [0.045, 0.040, 0.040, 0.036]] },   // hw0 ht0 hw1 ht1
};

// Joint limits in degrees, per joint. The pose's authored angles outside them are clamped and reported; controls move
// within them and say so when they reach one.
export const LIMITS = {
  mcp: [-20, 90], pip: [0, 110], dip: [0, 85],
  spread: { index: [-30, 20], middle: [-20, 20], ring: [-20, 25], pinky: [-20, 35] },
  twist: [-10, 10],
  thumb: { cmc: [-15, 50], mcp: [-10, 75], ip: [-15, 85], opposition: [0, 90], abduction: [-10, 70], twist: [-40, 40] },
};

export const THUMB_MAP = { bindAngleDeg: 32, zeroAngleDeg: 14, kA: 0.9, padTwistDeg: 55, kE: 0.6, kP: 0.7 };

// Age (a PROPOSAL: researched numbers were not obtained). The newborn's factor, relative to the hand length, eased to 1
// over the child weight below (1 at birth, 0 from 14 years). A child's hand is not an adult hand scaled down: the palm
// is relatively broader and thicker, the fingers relatively shorter (the hand length is kept: the palm takes the rest)
// and thicker, the thumb relatively shorter. Age is not frailty: an old hand is not curled or thinned by default.
export const AGE_FACTORS = { palmWidth: 1.12, fingerLength: 0.86, fingerThickness: 1.25, palmThickness: 1.15, thumbLength: 0.92 };
export const CHILD_WEIGHT_KNOTS = [[0, 1], [12, 0.86], [36, 0.62], [72, 0.38], [120, 0.14], [168, 0]];   // months -> weight
const childWeight = curve(CHILD_WEIGHT_KNOTS);
// Sex (a PROPOSAL): at the female preset's full weight (fem 1; the generator's fem is 0 for a child).
export const SEX_FACTORS = { palmWidth: 0.96, fingerThickness: 0.94 };
// Fat (a PROPOSAL): at the arms' fat level 1, the palm and the proximal phalanges this much thicker.
export const FAT_FACTORS = { palmThickness: 0.12, proximalThickness: 0.08 };
// A 0..1 size control (0.5 neutral) spans this fraction each way: 0 is x0.85, 1 is x1.15.
export const CONTROL_SPAN = 0.15;
// A contact the solver aims at (a pinch, the thumb on a held object) counts as missed beyond this distance, in metres
// on the reference hand, scaled with the hand (a PROPOSAL: about the gap that shows at close range).
export const CONTACT_TOLERANCE = 0.002;
export const TWIST_DEG = 10;

// Grip objects (PROPOSALS). Where the object's own size is not in the data, it is this for the reference hand and
// scales with the hand's length. The phone of HP19 is a plate standing on its long edge in the palm: the fingers wrap
// its back, the thumb lies on its screen.
export const GRIP_OBJECTS = {
  cylinderTiltDeg: 12,                        // the object's axis in the palm plane, radial end toward the fingers
  phone: { halfLength: 0.075, halfWidth: 0.036, halfThickness: 0.0045 },
  barHalfLength: 0.075,                       // a 'box' asked on a wrapping grip: a square bar of half-size = radius
  thumbTarget: { sphere: [0.5, -0.5, 0.7], cylinder: [0, -0.5, 1], bar: [0, -0.5, 1], plate: [0, -1, 0.35] },
  thumbTargetWeight: 0.5,
  strengthSpan: 0.12,                         // grip_strength 0..1 changes the contact curl by -+12 % (a look)
};

// ---------------------------------------------------------------------------------------------- vectors, quaternions
export const vec = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scl: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  nrm: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const { add, sub, scl, dot, cross, len, nrm } = vec;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const quat = {
  id: () => [0, 0, 0, 1],
  axis(ax, ang) { const n = nrm(ax), s = Math.sin(ang / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)]; },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
  conj: (q) => [-q[0], -q[1], -q[2], q[3]],
  rot(q, v) {
    const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  },
  norm(q) { const l = Math.hypot(...q); return q.map((c) => c / l); },
  fromBasis(X, Y, Z) {   // the rotation whose columns are the unit vectors X, Y, Z
    const m00 = X[0], m01 = Y[0], m02 = Z[0], m10 = X[1], m11 = Y[1], m12 = Z[1], m20 = X[2], m21 = Y[2], m22 = Z[2];
    const tr = m00 + m11 + m22; let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
    return quat.norm(q);
  },
  slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b;
    if (d < 0) { d = -d; bb = b.map((c) => -c); }
    if (d > 0.9995) return quat.norm(a.map((c, i) => c + (bb[i] - c) * t));
    const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return a.map((c, i) => c * wa + bb[i] * wb);
  },
  mirrorX: (q) => [q[0], -q[1], -q[2], q[3]],   // M R M with M = diag(-1, 1, 1)
};
const Q = quat;
const qX = (deg) => Q.axis([1, 0, 0], deg * DEG), qY = (deg) => Q.axis([0, 1, 0], deg * DEG), qZ = (deg) => Q.axis([0, 0, 1], deg * DEG);
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const mm = (x) => (x * 1000).toFixed(1);

// ------------------------------------------------------------------------------------------------------ dimensions
// body: { length (wrist pivot to the middle fingertip, m), ring: { w, f, b } (the forearm's wrist ring, half-sizes in m),
//         months, fem (0..1), fat (the arms' fat level, 0..1) }; missing fields take REFERENCE_BODY's.
// controls (hand level, 0..1, 0.5 neutral, null = neutral): size, palm_width, finger_length, finger_thickness, and
//   fingers.<finger>.length / .thickness. The caller validates them (index.js); this throws on what cannot be built.
// Returns the dimensions every other function reads, plus `notes` (what the factors did) and `key` (for caches).
export function handDimensions(body = {}, controls = {}) {
  const B = { ...REFERENCE_BODY, ...(body ?? {}), ring: { ...REF_RING, ...(body?.ring ?? {}) } };
  for (const [k, v] of [['length', B.length], ['ring.w', B.ring.w], ['ring.f', B.ring.f], ['ring.b', B.ring.b]]) {
    if (!(Number.isFinite(v) && v > 0)) throw new Error(`hand body ${k} must be a positive number (got ${v})`);
  }
  for (const [k, v, lo, hi] of [['months', B.months, 0, Infinity], ['fem', B.fem, 0, 1], ['fat', B.fat, 0, 1]]) {
    if (!(Number.isFinite(v) && v >= lo && v <= hi)) throw new Error(`hand body ${k} must be within ${lo}..${hi} (got ${v})`);
  }
  const c = controls ?? {}, fc = c.fingers ?? {};
  const span = (v) => (v === null || v === undefined ? 1 : 1 + 2 * CONTROL_SPAN * (v - 0.5));
  const notes = [];
  const w = childWeight(B.months);
  const age = Object.fromEntries(Object.entries(AGE_FACTORS).map(([k, v]) => [k, 1 + (v - 1) * w]));
  const sex = { palmWidth: 1 + (SEX_FACTORS.palmWidth - 1) * B.fem, fingerThickness: 1 + (SEX_FACTORS.fingerThickness - 1) * B.fem };
  const fat = { palmThickness: 1 + FAT_FACTORS.palmThickness * B.fat, proximalThickness: 1 + FAT_FACTORS.proximalThickness * B.fat };
  if (w > 0) notes.push(`age ${B.months} months: child factors at weight ${w.toFixed(2)} (proposal): palm width x${age.palmWidth.toFixed(3)}, finger length x${age.fingerLength.toFixed(3)}, finger thickness x${age.fingerThickness.toFixed(3)}, palm thickness x${age.palmThickness.toFixed(3)}, thumb length x${age.thumbLength.toFixed(3)}`);
  if (B.fem > 0) notes.push(`female preset weight ${B.fem.toFixed(2)} (proposal): palm width x${sex.palmWidth.toFixed(3)}, finger thickness x${sex.fingerThickness.toFixed(3)}`);
  if (B.fat > 0) notes.push(`arm fat ${B.fat.toFixed(2)} (proposal): palm thickness x${fat.palmThickness.toFixed(3)}, proximal phalanges x${fat.proximalThickness.toFixed(3)} thick`);

  const P = PROPORTIONS, L = B.length * span(c.size), s = L / REF_LENGTH;
  if (c.size !== null && c.size !== undefined && c.size !== 0.5) notes.push(`size ${c.size}: hand length ${mm(B.length)} -> ${mm(L)} mm (the wrist ring is the forearm's and does not change)`);
  // the palm takes what the fingers do not: the middle fingertip lands at L for neutral finger-length controls
  const fingerShare = 1 - P.knuckleY.middle, palmScale = L / (P.knuckleY.middle + fingerShare * age.fingerLength);
  const W = P.palmWidth * L * age.palmWidth * sex.palmWidth * span(c.palm_width), spacing = W / 4;
  const thick = age.fingerThickness * sex.fingerThickness * span(c.finger_thickness);
  const m = 0.0005 * s;   // clearance inside the joint overlaps and between pieces
  const fingers = {};
  let htMax = 0;
  FINGERS.forEach((f, i) => {
    const total = P.fingerLength[f] / P.fingerLength.middle * fingerShare * palmScale * age.fingerLength * span(c.finger_length) * span(fc[f]?.length);
    const k = thick * span(fc[f]?.thickness) * P.fingerWidthK[f];
    let hw = 0.5 * P.fingerWidth * L * k;
    const ht = 0.5 * P.fingerDepth * L * k;
    const maxHw = 0.5 * spacing / P.segmentK[0][0] - 0.0009 * s;
    if (hw > maxHw) { notes.push(`finger width ${f}: ${mm(2 * hw)} mm would leave no gap at a palm ${mm(W)} mm wide; limited to ${mm(2 * maxHw)} mm (depth kept)`); hw = maxHw; }
    const len = P.split.map((q) => q * total);
    const segs = P.segmentK.map(([k0, k1], j) => {
      const fk = j === 0 ? fat.proximalThickness : 1;
      return { len: len[j], hw0: hw * k0, ht0: ht * k0 * fk, hw1: hw * k1, ht1: ht * k1 * fk };
    });
    fingers[f] = { x: (1.5 - i) * spacing, y: P.knuckleY[f] * palmScale, len, hw, ht, segs };
    htMax = Math.max(htMax, segs[0].ht0);
  });
  const Tk = P.palmThickness * L * age.palmThickness * fat.palmThickness;
  const eZ = 1.15 * htMax + m;            // the palm's half-thickness around the MCP pivots
  const zBack = -0.45 * Tk;
  const zf = zBack + eZ;                   // the finger axis height: dorsal faces nearly flush with the back of the hand
  // the thumb
  const tl = P.thumb, a0 = THUMB_MAP.bindAngleDeg * DEG, psi = THUMB_MAP.padTwistDeg * DEG;
  const Y = [Math.sin(a0), Math.cos(a0), 0], u = [-Math.cos(a0), Math.sin(a0), 0];
  const Z = add(scl([0, 0, 1], Math.cos(psi)), scl(u, Math.sin(psi))), X = cross(Y, Z);
  const tt = thick, tlen = age.thumbLength;
  const cmc = [Math.min(tl.cmc[0] * L, 0.72 * B.ring.f), tl.cmc[1] * palmScale, Math.min(tl.cmc[2] * L, 0.4 * B.ring.w)];
  const tseg = [tl.metacarpal * palmScale * tlen, tl.proximal * palmScale * tlen * span(c.finger_length), tl.distal * palmScale * tlen * span(c.finger_length)]
    .map((l, j) => { const z = tl.size[j]; return { len: l, hw0: z[0] * L * tt, ht0: z[1] * L * tt, hw1: z[2] * L * tt, ht1: z[3] * L * tt }; });
  const thumb = { cmc, Y, Z, X, bindQ: Q.fromBasis(X, Y, Z), elevAxis: cross(Y, [0, 0, 1]), len: tseg.map((g) => g.len), segs: tseg };
  const tip = fingers.middle.y + fingers.middle.len.reduce((a, b) => a + b, 0);
  if (Math.abs(tip - L) > 1e-9) notes.push(`finger length: the wrist to middle fingertip is ${mm(tip)} mm (hand length ${mm(L)} mm at neutral finger length)`);
  const key = JSON.stringify([B.length, B.ring.w, B.ring.f, B.ring.b, B.months, B.fem, B.fat, c.size ?? null, c.palm_width ?? null,
    c.finger_length ?? null, c.finger_thickness ?? null, FINGERS.map((f) => [fc[f]?.length ?? null, fc[f]?.thickness ?? null])]);
  return { key, body: B, L, s, m, W, spacing, fingers, zf, eZ, zBack, Tk, ring: { ...B.ring }, thumb, tipLength: tip,
    factors: { age, sex, fat, childWeight: w }, notes };
}

// The skeleton in the bind pose: [{ name, parent, head (hand space), bind (hand-space quaternion of the bone frame) }].
export function skeleton(d) {
  const t = d.thumb, bones = [{ name: 'Hand', parent: -1, head: [0, 0, 0], bind: Q.id() }];
  let h = t.cmc;
  for (let k = 0; k < 3; k++) { bones.push({ name: `Thumb_0${k + 1}`, parent: k, head: h, bind: t.bindQ }); h = add(h, scl(t.Y, t.len[k])); }
  for (const fn of FINGERS) {
    const f = d.fingers[fn]; let y = f.y;
    for (let k = 0; k < 3; k++) { bones.push({ name: `${CAP[fn]}_0${k + 1}`, parent: k === 0 ? 0 : bones.length - 1, head: [f.x, y, d.zf], bind: Q.id() }); y += f.len[k]; }
  }
  return bones;
}

// ------------------------------------------------------------------------------------------------ poses, controls
// The authored angles of a pose object (poses.js), data names -> the rig's: { index: { mcp, pip, dip, spread, twist },
// ..., thumb: { cmc, mcp, ip, opposition, abduction, twist } }. Throws on a malformed pose.
export function readPose(pose) {
  if (!pose || typeof pose !== 'object') throw new Error(`UNKNOWN_POSE: ${pose}`);
  const num = (v, what) => { if (!Number.isFinite(v)) throw new Error(`INVALID_POSE: ${pose.id} ${what} = ${v}`); return v; };
  const A = { thumb: {} };
  for (const f of FINGERS) {
    const g = pose.fingers?.[f];
    if (!g) throw new Error(`INVALID_POSE: ${pose.id} has no ${f}`);
    A[f] = { mcp: num(g.mcp_flex_deg, `${f}.mcp`), pip: num(g.pip_flex_deg, `${f}.pip`), dip: num(g.dip_flex_deg, `${f}.dip`), spread: num(g.spread_deg, `${f}.spread`), twist: 0 };
  }
  const t = pose.thumb;
  if (!t) throw new Error(`INVALID_POSE: ${pose.id} has no thumb`);
  A.thumb = { cmc: num(t.cmc_flex_deg, 'thumb.cmc'), mcp: num(t.mcp_flex_deg, 'thumb.mcp'), ip: num(t.ip_flex_deg, 'thumb.ip'),
    opposition: num(t.opposition_deg, 'thumb.opposition'), abduction: num(t.abduction_deg, 'thumb.abduction'), twist: 0 };
  const r = pose.contact?.radius_m;
  if (r !== null && r !== undefined && !(Number.isFinite(r) && r >= 0)) throw new Error(`NEGATIVE_RADIUS: ${pose.id} radius_m = ${r}`);
  return A;
}

const cloneA = (A) => JSON.parse(JSON.stringify(A));
const toward = (v, c, open, closed) => v + Math.abs(c) * ((c > 0 ? closed : open) - v);

// The pose-level controls on top of the authored angles (before the solver, which then solves contacts and collisions
// from them): fingers.<f>.curl (-1 open .. 0 the pose's .. 1 closed to the limits), .spread (-1 .. 1 toward the lower /
// upper spread limit), .twist (-1 .. 1, +-10 degrees); thumb.flexion (CMC, MCP and IP together, -1 straight .. 1 the
// limits), .abduction (-1 adducts .. 1 abducts, toward the limits), .opposition (-1 .. 1, toward 0 / 90). Every control
// used is reported; one that reaches a joint limit says so.
export function applyControls(A, controls, diag, corr) {
  const fc = controls?.fingers ?? {}, tc = controls?.thumb ?? {};
  const report = (path, value, changes, atLimit) => {
    diag.push(`control ${path} ${value}: ${changes.join(', ')}${atLimit ? ' (at the joint limit)' : ''}`);
    corr.push({ rule: 'hand-control', path, asked: value, used: value, detail: changes.join(', ') + (atLimit ? '; at the joint limit' : '') });
  };
  for (const f of FINGERS) {
    const c = fc[f] ?? {};
    if (Number.isFinite(c.curl) && c.curl !== 0) {
      const ch = [];
      for (const j of ['mcp', 'pip', 'dip']) { const v = A[f][j]; A[f][j] = toward(v, c.curl, 0, LIMITS[j][1]); ch.push(`${j.toUpperCase()} ${f1(v)}->${f1(A[f][j])}`); }
      report(`fingers.${f}.curl`, c.curl, ch, Math.abs(c.curl) === 1 && c.curl > 0);
    }
    if (Number.isFinite(c.spread) && c.spread !== 0) {
      const [lo, hi] = LIMITS.spread[f], v = A[f].spread;
      A[f].spread = toward(v, c.spread, lo, hi);
      report(`fingers.${f}.spread`, c.spread, [`spread ${f1(v)}->${f1(A[f].spread)}`], Math.abs(c.spread) === 1);
    }
    if (Number.isFinite(c.twist) && c.twist !== 0) {
      A[f].twist = TWIST_DEG * c.twist;
      report(`fingers.${f}.twist`, c.twist, [`roll ${f1(A[f].twist)} deg`], Math.abs(c.twist) === 1);
    }
  }
  if (Number.isFinite(tc.flexion) && tc.flexion !== 0) {
    const ch = [];
    for (const k of ['cmc', 'mcp', 'ip']) { const v = A.thumb[k]; A.thumb[k] = toward(v, tc.flexion, 0, LIMITS.thumb[k][1]); ch.push(`${k.toUpperCase()} ${f1(v)}->${f1(A.thumb[k])}`); }
    report('thumb.flexion', tc.flexion, ch, tc.flexion === 1);
  }
  for (const k of ['abduction', 'opposition']) {
    if (!(Number.isFinite(tc[k]) && tc[k] !== 0)) continue;
    const [lo, hi] = LIMITS.thumb[k], v = A.thumb[k];
    A.thumb[k] = toward(v, tc[k], lo, hi);
    report(`thumb.${k}`, tc[k], [`${k} ${f1(v)}->${f1(A.thumb[k])}`], Math.abs(tc[k]) === 1);
  }
  return A;
}

// ------------------------------------------------------------------------------------------- angles <-> rotations
// One rest rotation per bone (in its own bind frame) from the rig's angles.
export function restFromAngles(d, A) {
  const rest = [Q.id()], t = d.thumb, a = A.thumb, B = t.bindQ;
  const inPlane = THUMB_MAP.zeroAngleDeg + THUMB_MAP.kA * a.abduction - THUMB_MAP.bindAngleDeg;
  const Rw = Q.mul(Q.mul(qZ(-inPlane), Q.axis(t.elevAxis, THUMB_MAP.kE * a.opposition * DEG)), Q.axis(t.Y, -(THUMB_MAP.kP * a.opposition + (a.twist ?? 0)) * DEG));
  rest.push(Q.mul(Q.mul(Q.mul(Q.conj(B), Rw), B), qX(a.cmc)), qX(a.mcp), qX(a.ip));
  for (const fn of FINGERS) { const g = A[fn]; rest.push(Q.mul(Q.mul(qZ(g.spread), qX(g.mcp)), qY(g.twist ?? 0)), qX(g.pip), qX(g.dip)); }
  return rest;
}

// Forward kinematics: every bone's world rotation R[b] (hand space) and head P[b]. `bones`: [{ parent, head, bind }].
export function fk(bones, rest) {
  const R = [], P = [];
  for (let b = 0; b < bones.length; b++) {
    const bn = bones[b], par = Number.isInteger(bn.parentIndex) ? bn.parentIndex : Number.isInteger(bn.parent) ? bn.parent : -1;   // a name in `parent` is read from parentIndex
    if (par < 0) { R[b] = Q.mul(bn.bind, rest[b]); P[b] = bn.head.slice(); continue; }
    const p = bones[par], ip = Q.conj(p.bind);
    R[b] = Q.mul(Q.mul(R[par], Q.mul(ip, bn.bind)), rest[b]);
    P[b] = add(P[par], Q.rot(R[par], Q.rot(ip, sub(bn.head, p.head))));
  }
  return { R, P };
}
export const toWorld = (F, b, v) => add(F.P[b], Q.rot(F.R[b], v));

// ---------------------------------------------------------------------------------------------- convex pieces
// A convex piece: { verts, tris } in its bone's local frame (bone 0, the palm: hand space). The solver reads every
// level-0 piece as given by the caller (index.js passes mesh0's): the collisions are those of the drawn mesh.
export function planesOf(verts, tris) {
  return tris.map(([i, j, k]) => { const n = nrm(cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]))); return { n, d: dot(n, verts[i]) }; });
}
export const sdPlanes = (planes, p) => { let m = -Infinity; for (const pl of planes) m = Math.max(m, dot(pl.n, p) - pl.d); return m; };
export const convexExcess = (verts, tris) => { let m = -Infinity; for (const q of planesOf(verts, tris)) for (const v of verts) m = Math.max(m, dot(q.n, v) - q.d); return m; };

export function convex(verts, tris) {
  const normals = [], edges = [];
  const addDir = (list, v, signed) => { const l = len(v); if (l < 1e-12) return; const u = scl(v, 1 / l); for (const w of list) { const c = dot(u, w); if ((signed ? c : Math.abs(c)) > 0.99999) return; } list.push(u); };
  for (const [i, j, k] of tris) {
    addDir(normals, cross(sub(verts[j], verts[i]), sub(verts[k], verts[i])), true);
    for (const [p, q] of [[i, j], [j, k], [k, i]]) addDir(edges, sub(verts[q], verts[p]), false);
  }
  let c = [0, 0, 0]; for (const v of verts) c = add(c, v); c = scl(c, 1 / verts.length);
  let r = 0; for (const v of verts) r = Math.max(r, len(sub(v, c)));
  return { verts, normals, edges, c, r };
}
// The exact separating-axis test of two convex solids: > 0 is the penetration depth along the best axis, <= 0 means
// separated (and is a lower bound of the gap).
export function satDepth(A, B) {
  if (len(sub(A.c, B.c)) > A.r + B.r) return -(len(sub(A.c, B.c)) - A.r - B.r);
  let best = Infinity;
  const test = (n) => {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of A.verts) { const x = dot(v, n); if (x < a0) a0 = x; if (x > a1) a1 = x; }
    for (const v of B.verts) { const x = dot(v, n); if (x < b0) b0 = x; if (x > b1) b1 = x; }
    const ov = Math.min(a1 - b0, b1 - a0); if (ov < best) best = ov; return ov;
  };
  for (const n of A.normals) if (test(n) <= 0) return best;
  for (const n of B.normals) if (test(n) <= 0) return best;
  for (const ea of A.edges) for (const eb of B.edges) { const c = cross(ea, eb), l = len(c); if (l < 1e-6) continue; if (test(scl(c, 1 / l)) <= 0) return best; }
  return best;
}

// queries on one convex piece in its local frame: the surface height at (0, y) on the pad (+1) or back (-1) side, the
// plane there, the local tip, a capsule that stands for the piece in the fast checks
function pieceInfo(piece) {
  const planes = planesOf(piece.verts, piece.tris);
  const ys = piece.verts.map((v) => v[1]), yMax = Math.max(...ys), yMin = Math.min(...ys);
  const surface = (y, side, x = 0) => {
    let z = side > 0 ? Infinity : -Infinity, best = null;
    for (const pl of planes) {
      if (side > 0 ? pl.n[2] > 0.05 : pl.n[2] < -0.05) {
        const zz = (pl.d - pl.n[0] * x - pl.n[1] * y) / pl.n[2];
        if (side > 0 ? zz < z : zz > z) { z = zz; best = pl; }
      }
    }
    return { z, n: best ? best.n : [0, 0, side] };
  };
  const halfX = (y, z) => { let x = Infinity; for (const pl of planes) if (pl.n[0] > 0.05) x = Math.min(x, (pl.d - pl.n[1] * y - pl.n[2] * z) / pl.n[0]); return x; };
  const top = piece.verts.filter((v) => v[1] >= yMax - 1e-9);
  const tip = scl(top.reduce((a, v) => add(a, v), [0, 0, 0]), 1 / top.length);
  // capsule: along the axis, through the middle of the cross-sections, radius the mean half-size
  const ks = [0.25, 0.5, 0.75].map((k) => yMin + k * (yMax - yMin));
  const secs = ks.map((y) => { const p = surface(y, 1).z, b = surface(y, -1).z; return { zc: (p + b) / 2, ht: (p - b) / 2, hw: halfX(y, (p + b) / 2) }; });
  const r = secs.reduce((a, q) => a + (q.hw + q.ht) / 2, 0) / secs.length, zc = secs.reduce((a, q) => a + q.zc, 0) / secs.length;
  const capsule = { a: [0, Math.max(0, yMin), zc], b: [0, Math.max(yMin, yMax - 0.75 * r), zc], r };
  return { planes, yMax, yMin, surface, halfX, tip, capsule };
}

// The solver's context for one hand: dims, bind skeleton, the 16 convex pieces (one a bone) and their queries.
export function makeRig(d, bones, hulls) {
  if (!Array.isArray(hulls) || hulls.length !== 16) throw new Error('makeRig: 16 convex pieces are needed, one a bone');
  const info = hulls.map((h) => pieceInfo(h));
  const caps = info.map((q, i) => (i === 0 ? null : q.capsule));
  const palmPlanes = info[0].planes;
  const padLocal = (b, k = 0.62) => { const q = info[b], y = q.yMin + k * (q.yMax - q.yMin); return [0, y, q.surface(y, 1).z]; };
  const padNormalLocal = (b, k = 0.62) => { const q = info[b], y = q.yMin + k * (q.yMax - q.yMin); return q.surface(y, 1).n; };
  const tipLocal = (b) => info[b].tip;
  const dorsalLocal = (b) => { const q = info[b], y = 0.45 * q.yMax; return [0, y, q.surface(y, -1).z]; };
  return { d, bones, pieces: hulls, info, caps, palmPlanes, padLocal, padNormalLocal, tipLocal, dorsalLocal };
}

const posedCaps = (ctx, F) => ctx.caps.map((c, b) => (c ? { a: toWorld(F, b, c.a), b: toWorld(F, b, c.b), r: c.r } : null));
function segSeg(p1, q1, p2, q2) {   // the closest distance between two segments
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-14 && e < 1e-14) return len(r);
  if (a < 1e-14) { s = 0; t = clamp(f / e, 0, 1); } else {
    const c = dot(d1, r);
    if (e < 1e-14) { t = 0; s = clamp(-c / a, 0, 1); } else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-14 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  return len(sub(add(p1, scl(d1, s)), add(p2, scl(d2, t))));
}
function segLine(p, q, o, a) {      // the distance from segment pq to the infinite line o + t a (a unit)
  const perp = (x) => { const r = sub(x, o); return sub(r, scl(a, dot(r, a))); };
  const u = perp(p), v = perp(q), w = sub(v, u), ww = dot(w, w);
  const t = ww < 1e-16 ? 0 : clamp(-dot(u, w) / ww, 0, 1);
  return len(add(u, scl(w, t)));
}
function pointSeg(x, p, q) { const dd = sub(q, p), l2 = dot(dd, dd), t = l2 < 1e-16 ? 0 : clamp(dot(sub(x, p), dd) / l2, 0, 1); return len(sub(x, add(p, scl(dd, t)))); }
function capPalm(ctx, c) {   // signed distance capsule -> palm (sampled)
  let m = Infinity;
  for (let k = 0; k <= 4; k++) { const p = add(c.a, scl(sub(c.b, c.a), k / 4)); m = Math.min(m, sdPlanes(ctx.palmPlanes, p) - c.r); }
  return m;
}
const capCap = (c1, c2) => segSeg(c1.a, c1.b, c2.a, c2.b) - c1.r - c2.r;
const isAdjacent = (bones, i, j) => (bones[i].parent ?? bones[i].parentIndex) === j || (bones[j].parent ?? bones[j].parentIndex) === i;
const digitBones = (fn) => DIGIT_BONES[fn];

// ------------------------------------------------------------------------------------------------- grip objects
// Objects: cylinder { p, a (unit axis), R }, sphere { c, R }, box { c, e: [e1, e2, e3] (unit axes), h: [h1, h2, h3] },
// plane { p, n } (the solid lies beyond the plane, on the side n points to).
function boxSd(obj, x) {
  const r = sub(x, obj.c), q = obj.e.map((e, i) => Math.abs(dot(r, e)) - obj.h[i]);
  const out = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0));
  return out + Math.min(Math.max(q[0], q[1], q[2]), 0);
}
export function pointObject(obj, x) {
  if (obj.type === 'cylinder') { const r = sub(x, obj.p); return len(sub(r, scl(obj.a, dot(r, obj.a)))) - obj.R; }
  if (obj.type === 'sphere') return len(sub(x, obj.c)) - obj.R;
  if (obj.type === 'box') return boxSd(obj, x);
  return dot(obj.n, sub(obj.p, x));   // plane
}
function objectDistance(obj, p, q, r) {   // signed distance between a capsule (p, q, r) and the object
  if (obj.type === 'cylinder') return segLine(p, q, obj.p, obj.a) - r - obj.R;
  if (obj.type === 'sphere') return pointSeg(obj.c, p, q) - r - obj.R;
  let m = Infinity;
  const n = obj.type === 'box' ? 8 : 1;
  for (let k = 0; k <= n; k++) m = Math.min(m, pointObject(obj, add(p, scl(sub(q, p), k / n))));
  return m - r;
}
function outwardOf(obj, x) {   // the object's outward surface normal nearest a point
  if (obj.type === 'cylinder') { const r = sub(x, obj.p); return nrm(sub(r, scl(obj.a, dot(r, obj.a)))); }
  if (obj.type === 'sphere') return nrm(sub(x, obj.c));
  if (obj.type === 'plane') return scl(obj.n, -1);
  const r = sub(x, obj.c); let best = -Infinity, n = obj.e[0];
  obj.e.forEach((e, i) => { for (const sg of [1, -1]) { const v = sg * dot(r, e) - obj.h[i]; if (v > best) { best = v; n = scl(e, sg); } } });
  return n;
}
function surfaceToward(obj, dir) {   // the point of the object's surface along dir from its centre
  const u = nrm(dir);
  if (obj.type === 'sphere') return add(obj.c, scl(u, obj.R));
  if (obj.type === 'box') { let t = Infinity; obj.e.forEach((e, i) => { const k = Math.abs(dot(u, e)); if (k > 1e-9) t = Math.min(t, obj.h[i] / k); }); return add(obj.c, scl(u, t)); }
  return null;
}

// the palm surface (front) height at (x, y), from the convex palm's front planes
function palmFrontZ(ctx, x, y) {
  let z = Infinity;
  for (const pl of ctx.palmPlanes) if (pl.n[2] > 0.2) z = Math.min(z, (pl.d - pl.n[0] * x - pl.n[1] * y) / pl.n[2]);
  return z;
}
function palmSlope(ctx) {   // dz/dy of the palm front along the middle line (it thins toward the knuckles)
  const y1 = 0.25 * ctx.d.fingers.middle.y, y2 = 0.85 * ctx.d.fingers.middle.y;
  return (palmFrontZ(ctx, 0, y2) - palmFrontZ(ctx, 0, y1)) / (y2 - y1);
}

// place an object against the palm at parameter t (along +Y); kind: cylinder | sphere | box | plane | hookbar
function placeObject(ctx, g, R, t, A, xs = 0) {
  const d = ctx.d, beta = g.tilt * DEG;
  if (g.object === 'hookbar') {
    const F = fk(ctx.bones, restFromAngles(d, A)), b = FBASE.middle, q = ctx.info[b];
    const y = clamp(t, q.yMin, q.yMax), ht = q.surface(y, 1).z;
    return { type: 'cylinder', p: toWorld(F, b, [0, y, ht + R + 0.0008 * d.s]), a: nrm(Q.rot(F.R[b], [Math.cos(beta), Math.sin(beta), 0])), R };
  }
  const slope = palmSlope(ctx), np = nrm([0, -slope, 1]);
  if (g.object === 'plane') {
    let best = -Infinity, p = null;
    for (const v of ctx.pieces[0].verts) { const k = dot(np, v); if (k > best) { best = k; p = v; } }
    return { type: 'plane', p: add(p, scl(np, 0.0003 * d.s)), n: np };
  }
  const base = [xs, t, palmFrontZ(ctx, xs, t)];
  const axis = nrm([Math.cos(beta), Math.sin(beta), slope * Math.sin(beta)]);
  const make = (h) => {
    const c = add(base, scl(np, h));
    if (g.object === 'cylinder') return { type: 'cylinder', p: c, a: axis, R };
    if (g.object === 'sphere') return { type: 'sphere', c, R };
    // box: e1 the long axis; a plate stands on its long edge (e2 out of the palm, e3 its thickness), a bar is square
    const e2 = nrm(sub(np, scl(axis, dot(np, axis)))), e3 = cross(axis, e2);
    const h3 = g.plate ? g.plate.halfThickness : R;
    return { type: 'box', c, e: [axis, e2, e3], h: [g.halfLength, g.plate ? g.plate.halfWidth : R, h3], plate: !!g.plate };
  };
  const clear = (obj) => {   // signed distance from the object to the palm
    if (obj.type === 'sphere') return sdPlanes(ctx.palmPlanes, obj.c) - R;
    if (obj.type === 'cylinder') { let m = Infinity; for (let k = -6; k <= 6; k++) m = Math.min(m, sdPlanes(ctx.palmPlanes, add(obj.p, scl(obj.a, k * d.W / 10))) - R); return m; }
    let m = Infinity;   // box: its corners and edge midpoints against the palm's planes
    for (const a of [-1, -0.5, 0, 0.5, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
      const p = add(obj.c, add(scl(obj.e[0], a * obj.h[0]), add(scl(obj.e[1], b * obj.h[1]), scl(obj.e[2], c * obj.h[2]))));
      m = Math.min(m, sdPlanes(ctx.palmPlanes, p));
    }
    return m;
  };
  const hiH = (g.object === 'box' ? Math.max(g.plate ? g.plate.halfWidth : R, R) : R) + 0.05 * d.s;
  let lo = 0, hi = hiH;
  for (let i = 0; i < 40; i++) { const h = (lo + hi) / 2; if (clear(make(h)) < 0) lo = h; else hi = h; }
  return make(hi);
}

function fingerObjectSd(ctx, F, fn, obj, skipProximal = false) {
  let m = Infinity;
  for (const b of digitBones(fn).slice(skipProximal ? 1 : 0)) { const c = ctx.caps[b]; m = Math.min(m, objectDistance(obj, toWorld(F, b, c.a), toWorld(F, b, c.b), c.r)); }
  return m;
}
function fingerPalmSd(ctx, F, fn) {   // the middle and distal phalanges against the palm (the proximal one is the palm's child)
  let m = Infinity;
  const bs = fn === 'thumb' ? [2, 3] : [FBASE[fn] + 1, FBASE[fn] + 2];
  for (const b of bs) { const c = ctx.caps[b]; m = Math.min(m, capPalm(ctx, { a: toWorld(F, b, c.a), b: toWorld(F, b, c.b), r: c.r })); }
  return m;
}

function curl(base, c, joints = ['mcp', 'pip', 'dip']) {
  const g = { ...base };
  for (const j of joints) g[j] = clamp(base[j] * c, LIMITS[j][0], LIMITS[j][1]);
  return g;
}

// the first contact as the finger curls (its joints in proportion); it also stops at the palm
function curlToContact(ctx, A, fn, obj, joints = ['mcp', 'pip', 'dip'], margin, cmin = 0) {
  const base = A[fn];
  const test = (c) => {
    const B = cloneA(A); B[fn] = curl(base, c, joints);
    const F = fk(ctx.bones, restFromAngles(ctx.d, B));
    return { obj: obj ? fingerObjectSd(ctx, F, fn, obj, !joints.includes('mcp')) : Infinity, palm: fingerPalmSd(ctx, F, fn) - margin };
  };
  const hit = (r) => r.obj <= 0 || r.palm <= 0;
  const r0 = test(cmin);
  if (hit(r0)) return { c: cmin, by: r0.obj <= 0 ? 'object' : 'palm', start: true };
  let prev = cmin, c = cmin, found = null;
  const cmax = 3;
  while (c < cmax) {
    c = Math.min(cmax, c + 0.02);
    const r = test(c);
    if (hit(r)) { found = r; break; }
    prev = c;
  }
  if (!found) return { c: cmax, by: 'limits' };
  let lo = prev, hi = c;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (hit(test(mid))) hi = mid; else lo = mid; }
  const r = test(hi);
  return { c: lo, by: r.obj <= 0 ? 'object' : 'palm' };
}

// pattern search with box bounds
function patternSearch(f, x0, lo, hi, step, maxEval = 4000) {
  let x = x0.map((v, i) => clamp(v, lo[i], hi[i])), fx = f(x), s = 1, n = 1;
  while (s > 1 / 128 && n < maxEval) {
    let improved = false;
    for (let i = 0; i < x.length && !improved; i++) {
      for (const sg of [1, -1]) {
        const y = x.slice(); y[i] = clamp(x[i] + sg * s * step[i], lo[i], hi[i]);
        if (y[i] === x[i]) continue;
        const fy = f(y); n++;
        if (fy < fx - 1e-12) { x = y; fx = fy; improved = true; break; }
      }
    }
    if (!improved) s /= 2;
  }
  return { x, fx, n };
}

export const THUMB_VARS = ['cmc', 'mcp', 'ip', 'opposition', 'abduction', 'twist'];
const posedPieceVerts = (ctx, F, b) => ctx.pieces[b].verts.map((v) => (b === 0 ? v.slice() : toWorld(F, b, v)));

// The thumb (and, for tip contacts, the fingers it meets) solved by a small optimisation: the contact error (position
// and the pads facing each other), the distance to the authored angles and the penetration of every non-adjacent pair it
// moves. A coarse grid over the whole joint range first, then a pattern search from the best grid points.
function solveThumb(ctx, A, spec, obj, margin, diag, corr, label, seed = null) {
  const d = ctx.d, s = d.s, NV = THUMB_VARS.length;
  const movers = spec.fingers ?? [];
  const touch = new Set((spec.touch ?? []).flatMap(digitBones));
  const x0 = [...THUMB_VARS.map((k) => A.thumb[k] ?? 0), ...movers.map(() => 1)];
  const lo = [...THUMB_VARS.map((k) => LIMITS.thumb[k][0]), ...movers.map(() => 0.3)];
  const hi = [...THUMB_VARS.map((k) => LIMITS.thumb[k][1]), ...movers.map(() => 2.2)];
  const step = [...THUMB_VARS.map(() => 8), ...movers.map(() => 0.08)];
  const bases = Object.fromEntries(movers.map((fn) => [fn, A[fn]]));
  const moving = new Set([1, 2, 3, ...movers.flatMap(digitBones)]);
  const tolC = 0.002 * s;   // digits that are meant to touch may overlap this much (soft pads)
  const apply = (x) => {
    const B = cloneA(A);
    THUMB_VARS.forEach((k, i) => { B.thumb[k] = x[i]; });
    movers.forEach((fn, i) => { B[fn] = curl(bases[fn], x[NV + i]); });
    return B;
  };
  const F0 = fk(ctx.bones, restFromAngles(d, A));
  const staticCv = ctx.pieces.map((pc, b) => (moving.has(b) ? null : convex(posedPieceVerts(ctx, F0, b), pc.tris)));
  const terms = (x) => {
    const B = apply(x), F = fk(ctx.bones, restFromAngles(d, B)), caps = posedCaps(ctx, F);
    const err = spec.error(F), orient = spec.orient ? spec.orient(F) : 0;
    const cv = ctx.pieces.map((pc, b) => staticCv[b] ?? convex(posedPieceVerts(ctx, F, b), pc.tris));
    let pen = 0;
    for (const i of [1, 2, 3]) {
      for (let j = 0; j < cv.length; j++) {
        if (j >= 1 && j <= 3) continue;
        if (j === 0 ? i === 1 : isAdjacent(ctx.bones, i, j)) continue;
        const allow = (j === 0 ? spec.palmTouch : touch.has(j)) ? tolC : -margin;
        if (len(sub(cv[i].c, cv[j].c)) > cv[i].r + cv[j].r + margin) continue;
        const p = satDepth(cv[i], cv[j]) - allow;
        if (p > 0) pen += p * p;
      }
      if (obj) { const c = caps[i]; const p = objectDistance(obj, c.a, c.b, c.r) + (i === 3 ? tolC : -0.3 * margin); if (p < 0) pen += p * p; }
    }
    for (const i of moving) {   // the fingers the solver curls, against the rest (capsules)
      if (i <= 3) continue;
      for (let j = 4; j < caps.length; j++) {
        if (moving.has(j) && j <= i || isAdjacent(ctx.bones, i, j)) continue;
        const p = capCap(caps[i], caps[j]) - (moving.has(j) ? -tolC : margin); if (p < 0) pen += p * p;
      }
      if (ctx.bones[i].parent !== 0) { const p = capPalm(ctx, caps[i]) - margin; if (p < 0) pen += p * p; }
    }
    let reg = 0;
    x.forEach((v, i) => { reg += ((v - x0[i]) / (i < NV ? 30 : 0.4)) ** 2; });
    return { err, orient, pen, reg, B };
  };
  const cost = (x) => {
    const t = terms(x), e = 0.001 * s;
    return (t.err / e) ** 2 + (t.orient / 0.4) ** 2 + 400 * t.pen / (e * e) + 0.4 * t.reg;
  };
  // the whole range: a coarse grid, then a pattern search from the start and from the best grid points
  const search = () => {
    const grid = [[0, 30, 60, 90], [-10, 15, 40, 65], [-15, 15, 45], [0, 30, 60], [0, 40], [-30, 0, 30]];
    const order = [3, 4, 0, 1, 2, 5];   // grid axes -> variable index
    const curls = movers.length ? [1, 1.35, 1.7] : [1];
    const cand = [];
    const rec = (k, x) => {
      if (k === grid.length) {
        for (const c of curls) { const y = x.slice(); movers.forEach((_, i) => { y[NV + i] = c; }); cand.push({ x: y, fx: cost(y) }); }
        return;
      }
      for (const v of grid[k]) { const y = x.slice(); y[order[k]] = v; rec(k + 1, y); }
    };
    rec(0, x0.slice());
    cand.sort((a, b2) => a.fx - b2.fx);
    let b = patternSearch(cost, x0, lo, hi, step);
    for (const c of cand.slice(0, 6)) { const r = patternSearch(cost, c.x, lo, hi, step); if (r.fx < b.fx) b = r; }
    return b;
  };
  // With a seed (the library's fit of this pose for this hand's age, hands/fit.js) the search starts there, in steps
  // an eighth of the whole range's (1 degree), and stays local when that holds on this hand: no overlap, and the
  // contact within the contact tolerance or within 0.5 mm of the fit's own miss. Small steps keep neighbouring bodies
  // on neighbouring answers (with the whole range's 8 degree first steps, two hands a few months apart could land
  // 15 to 30 degrees apart). Where that does not hold, the same search from the fits of the two age knots around this
  // hand (each holds on its own knot's hand), the nearest that holds; only when none does is the whole range
  // searched, and its answer taken where it holds better (said in the diagnostics).
  const judge = (r) => {
    const t = terms(r.x), F = fk(ctx.bones, restFromAngles(d, t.B));
    const miss = spec.clearance ? 0 : (spec.miss ? spec.miss(F) : t.err);
    return { r, clear: t.pen <= (1e-4 * s) ** 2, miss };
  };
  let best, how = '';
  if (seed) {
    const tolMiss = Math.max((seed.miss_m ?? 0) + 0.0005, CONTACT_TOLERANCE) * s;
    // a fit that misses its own contact (the card, the phone: the mesh cannot meet it) is not searched again for a miss
    const holds = (j) => j.clear && (j.miss <= tolMiss || (seed.miss_m ?? 0) > CONTACT_TOLERANCE);
    const rank = (j) => (j.clear ? 2 : 0) + (j.miss <= tolMiss ? 1 : 0);
    // a local search (fine steps, so neighbouring hands land on neighbouring answers) from a start: the thumb's angles
    // (the fit for this age by default) and the fit's curls of the fingers it moves
    const fromStart = (thumb, curls) => {
      const xs = x0.slice();
      if (thumb) THUMB_VARS.forEach((k, i) => { xs[i] = clamp(thumb[k], lo[i], hi[i]); });
      if (curls?.length === movers.length) curls.forEach((c, i) => { xs[NV + i] = clamp(c, lo[NV + i], hi[NV + i]); });
      return judge(patternSearch(cost, xs, lo, hi, step.map((v) => v / 8)));
    };
    const dist = (j) => THUMB_VARS.reduce((a, _, i) => a + (j.r.x[i] - x0[i]) ** 2, 0);
    const local = fromStart(null, seed.movers);
    if (holds(local)) best = local.r;
    else {
      // then from the fits of the two knots around this hand's age (each holds on its own knot's hand), the nearest
      // that holds; only when none does, the whole range
      const knots = (seed.around ?? []).map((k) => fromStart(k.thumb, k.movers)).filter(holds).sort((a, b) => dist(a) - dist(b));
      if (knots.length) { best = knots[0].r; how = ' (from the fit of the nearest age knot)'; }
      else {
        const full = judge(search());
        if (rank(full) > rank(local)) { best = full.r; how = ' (the library fit did not hold on this hand: the whole range searched)'; }
        else { best = local.r; how = ' (from the library fit; the whole range searched found nothing that holds better)'; }
      }
    }
  } else best = search();
  const t = terms(best.x), Ff = fk(ctx.bones, restFromAngles(d, t.B));
  const base = seed ? 'the pose\'s thumb kept' : 'authored angles kept';
  const changes = THUMB_VARS.map((k, i) => (Math.abs(best.x[i] - x0[i]) >= 0.5 ? `${k} ${f1(x0[i])}->${f1(best.x[i])}` : null)).filter(Boolean);
  movers.forEach((fn, i) => { if (Math.abs(best.x[NV + i] - 1) > 0.005) changes.push(`${fn} curl x${best.x[NV + i].toFixed(2)}`); });
  const ang = spec.orientDeg ? `, ${spec.orientDeg(Ff)}` : '';
  const detail = `${changes.length ? changes.join(', ') : base}; contact error ${mm(t.err)} mm${ang}${how}`;
  diag.push(`thumb solved for ${label}: ${detail}`);
  if (changes.length) corr.push({ rule: 'hand-thumb', path: 'thumb', asked: label, used: 'solved', detail, error_m: t.err });
  const miss = spec.clearance ? 0 : (spec.miss ? spec.miss(Ff) : t.err), tol = CONTACT_TOLERANCE * s;
  if (miss > tol) {
    diag.push(`contact missed for ${label}: ${mm(miss)} mm off (tolerance ${mm(tol)} mm)`);
    corr.push({ rule: 'hand-contact-missed', path: 'thumb', asked: label, used: +miss.toPrecision(6), detail: `the contact is ${mm(miss)} mm off; the tolerance is ${mm(tol)} mm (${CONTACT_TOLERANCE * 1000} mm on the reference hand)`, error_m: miss, tolerance_m: tol });
  }
  return { B: t.B, x: best.x.slice(), error_m: t.err, miss_m: miss, movers: best.x.slice(NV) };
}

function contactSpec(ctx, type, R) {
  const pad = (F, b) => toWorld(F, b, ctx.padLocal(b)), tip = (F, b) => toWorld(F, b, ctx.tipLocal(b));
  // tips meet when the two distal phalanges point at each other within 60 degrees (0 is fine, grows beyond)
  const meet = (F, a, b) => Math.max(0, 0.5 + dot(Q.rot(F.R[a], [0, 1, 0]), Q.rot(F.R[b], [0, 1, 0])));
  const meetDeg = (F) => `distal phalanges at ${f1(Math.acos(clamp(dot(Q.rot(F.R[3], [0, 1, 0]), Q.rot(F.R[6], [0, 1, 0])), -1, 1)) / DEG)} deg`;
  const padN = (F, b) => Q.rot(F.R[b], ctx.padNormalLocal(b));
  const T3 = 3, face = (a, b) => 1 + dot(a, b);   // 0 when the two normals are opposite
  const dorsal = (F, b) => toWorld(F, b, ctx.dorsalLocal(b)), dorsalN = (F, b) => Q.rot(F.R[b], [0, 0, -1]);
  switch (type) {
    case 'thumb_index_tips': return { fingers: ['index'], touch: ['index'], error: (F) => len(sub(tip(F, T3), tip(F, 6))), orient: (F) => meet(F, T3, 6), orientDeg: meetDeg };
    case 'tripod': {
      const r = R ?? 0.005 * ctx.d.s;
      return { fingers: ['index', 'middle'], touch: ['index', 'middle'], error: (F) => {
        const a = tip(F, T3), b = tip(F, 6), c = tip(F, 9), mid = scl(add(a, b), 0.5);
        return Math.hypot(len(sub(a, b)) - 2 * r, Math.max(0, len(sub(c, mid)) - 2 * r));
      }, orient: (F) => meet(F, T3, 6), orientDeg: meetDeg };
    }
    case 'thin_plane': {   // a card pinched between the thumb pad and the radial-palmar edge of the index's distal phalanx
      const q = ctx.info[6], y = q.yMin + 0.55 * (q.yMax - q.yMin), zp = q.surface(y, 1).z;
      const edge = [0.8 * q.halfX(y, 0.5 * zp), y, 0.5 * zp], gap = 0.001 * ctx.d.s;
      return { fingers: ['index'], touch: ['index'], error: (F) => Math.abs(len(sub(pad(F, T3), toWorld(F, 6, edge))) - gap), orient: (F) => face(padN(F, T3), nrm(Q.rot(F.R[6], [1, 0, 1]))) };
    }
    case 'thumb_over_fingers': return { touch: ['index', 'middle'], error: (F) => len(sub(pad(F, T3), scl(add(dorsal(F, 5), dorsal(F, 8)), 0.5))), orient: (F) => face(padN(F, T3), nrm(add(dorsalN(F, 5), dorsalN(F, 8)))) };
    case 'thumb_ring': return { touch: ['middle', 'ring'], error: (F) => len(sub(pad(F, T3), dorsal(F, 11))), orient: (F) => face(padN(F, T3), dorsalN(F, 11)) };
    case 'thumb_middle_ring': return { touch: ['middle', 'ring'], error: (F) => len(sub(pad(F, T3), scl(add(dorsal(F, 8), dorsal(F, 11)), 0.5))), orient: (F) => face(padN(F, T3), nrm(add(dorsalN(F, 8), dorsalN(F, 11)))) };
    case 'thumb_pinky': return { touch: ['ring', 'pinky'], error: (F) => len(sub(pad(F, T3), dorsal(F, 14))), orient: (F) => face(padN(F, T3), dorsalN(F, 14)) };
    case 'thumb_palm': {
      const d = ctx.d, x = d.fingers.ring.x, y = 0.8 * d.fingers.ring.y;
      const target = [x, y, palmFrontZ(ctx, x, y)];
      let n = [0, 0, 1]; for (const pl of ctx.palmPlanes) if (Math.abs(dot(pl.n, target) - pl.d) < 1e-6 && pl.n[2] > 0.3) n = pl.n;
      return { palmTouch: true, error: (F) => len(sub(pad(F, T3), target)), orient: (F) => face(padN(F, T3), n) };
    }
    default: return null;
  }
}

// object grips: the thumb pad on the object's surface, on the thumb's side, facing it, pulled toward a target on the
// front-lower quadrant (toward the wrist and out of the palm): what the thumb reaches from its CMC
function objectSpec(ctx, obj) {
  const d = ctx.d, T = GRIP_OBJECTS.thumbTarget;
  let target;
  if (obj.type === 'sphere') target = surfaceToward(obj, T.sphere);
  else if (obj.type === 'box') {
    const along = (d.fingers.index.x + 0.6 * d.spacing - obj.c[0]) / (Math.abs(obj.e[0][0]) > 1e-6 ? obj.e[0][0] : 1);
    const c = add(obj.c, scl(obj.e[0], clamp(along, -obj.h[0], obj.h[0])));
    target = surfaceToward({ ...obj, c }, obj.plate ? T.plate : T.bar);
  } else {
    const along = (d.fingers.index.x + 0.6 * d.spacing - obj.p[0]) / obj.a[0];
    const c = add(obj.p, scl(obj.a, along)), front = nrm(sub(T.cylinder, scl(obj.a, dot(T.cylinder, obj.a))));
    target = add(c, scl(front, obj.R));
  }
  const pad = (F) => toWorld(F, 3, ctx.padLocal(3));
  return { target, error: (F) => Math.hypot(pointObject(obj, pad(F)), GRIP_OBJECTS.thumbTargetWeight * len(sub(pad(F), target))),
    miss: (F) => Math.abs(pointObject(obj, pad(F))),
    orient: (F) => 1 + dot(Q.rot(F.R[3], ctx.padNormalLocal(3)), outwardOf(obj, pad(F))),
    orientDeg: (F) => `pad ${mm(pointObject(obj, pad(F)))} mm from the surface, ${f1(180 - Math.acos(clamp(dot(Q.rot(F.R[3], ctx.padNormalLocal(3)), outwardOf(obj, pad(F))), -1, 1)) / DEG)} deg from facing the object, ${mm(len(sub(pad(F), target)))} mm from the front target` };
}

// The grips: the object each contact type holds, the fingers that wrap it, whether the thumb is solved onto it.
export const GRIP = {
  cylinder: { object: 'cylinder', fingers: FINGERS, thumb: true },
  handle: { object: 'cylinder', fingers: ['middle', 'ring', 'pinky'], thumb: true },
  sphere: { object: 'sphere', fingers: FINGERS, thumb: true },
  cradle: { object: 'sphere', fingers: FINGERS, thumb: false },
  hook: { object: 'hookbar', fingers: FINGERS, thumb: false, joints: ['pip', 'dip'] },
  box: { object: 'box', fingers: FINGERS, thumb: true, plate: true },
  plane: { object: 'plane', fingers: [], thumb: false },
};
export const OBJECT_SHAPES = ['cylinder', 'sphere', 'box', 'plane'];

function clampAuthored(A, diag, corr) {
  const out = [];
  const one = (path, v0, v) => { if (v !== v0) { out.push(`${path} ${f1(v0)}->${f1(v)}`); corr.push({ rule: 'hand-joint-limit', path, asked: v0, used: v, detail: 'authored angle outside the joint limit' }); } };
  for (const fn of FINGERS) {
    for (const j of ['mcp', 'pip', 'dip']) { const v = clamp(A[fn][j], LIMITS[j][0], LIMITS[j][1]); one(`${fn}.${j}`, A[fn][j], v); A[fn][j] = v; }
    const [lo, hi] = LIMITS.spread[fn], v = clamp(A[fn].spread, lo, hi); one(`${fn}.spread`, A[fn].spread, v); A[fn].spread = v;
  }
  for (const k of THUMB_VARS.slice(0, 5)) { const [lo, hi] = LIMITS.thumb[k], v = clamp(A.thumb[k], lo, hi); one(`thumb.${k}`, A.thumb[k], v); A.thumb[k] = v; }
  if (out.length) diag.push(`joint limits: ${out.join(', ')}`);
}

// fingers authored as folded (MCP >= 70 and PIP >= 85: the fist, the thumbs, the folded fingers of the gestures) close
// until the fingertip rests on the palm
function closeFolded(ctx, A, margin, diag, corr, skip) {
  const out = [];
  for (const fn of FINGERS) {
    if (skip.has(fn) || !(A[fn].mcp >= 70 && A[fn].pip >= 85)) continue;
    const r = curlToContact(ctx, A, fn, null, ['mcp', 'pip', 'dip'], margin, 1);
    if (r.c > 1.0005) { A[fn] = curl(A[fn], r.c); out.push(`${fn} x${r.c.toFixed(2)}`); corr.push({ rule: 'hand-folded', path: `fingers.${fn}`, asked: 1, used: +r.c.toFixed(3), detail: 'a folded finger closed until its tip rests on the palm' }); }
  }
  if (out.length) diag.push(`folded fingers closed onto the palm: ${out.join(', ')}`);
}

// fingers against the palm, then neighbouring fingers against each other
function limitFingers(ctx, A, margin, diag, corr, skip = new Set()) {
  for (const fn of FINGERS) {
    if (skip.has(fn)) continue;
    const F = fk(ctx.bones, restFromAngles(ctx.d, A));
    if (fingerPalmSd(ctx, F, fn) - margin >= 0) continue;
    const r = curlToContact(ctx, A, fn, null, ['mcp', 'pip', 'dip'], margin);
    const before = A[fn]; A[fn] = curl(before, Math.min(1, r.c));
    const detail = `curl limited x${Math.min(1, r.c).toFixed(2)} (MCP ${f1(before.mcp)}->${f1(A[fn].mcp)}, PIP ${f1(before.pip)}->${f1(A[fn].pip)}, DIP ${f1(before.dip)}->${f1(A[fn].dip)})`;
    diag.push(`${fn}: would pass through the palm; ${detail}`);
    corr.push({ rule: 'hand-palm-clearance', path: `fingers.${fn}`, asked: 1, used: +Math.min(1, r.c).toFixed(3), detail });
  }
  for (let i = 0; i < 3; i++) {
    const a = FINGERS[i], b = FINGERS[i + 1];
    let moved = 0;
    for (let it = 0; it < 40; it++) {
      const F = fk(ctx.bones, restFromAngles(ctx.d, A)), caps = posedCaps(ctx, F);
      let worst = Infinity;
      for (const x of digitBones(a)) for (const y of digitBones(b)) worst = Math.min(worst, capCap(caps[x], caps[y]) - 0.3 * margin);
      if (worst >= 0) break;
      A[a].spread = clamp(A[a].spread - 0.5, ...LIMITS.spread[a]); A[b].spread = clamp(A[b].spread + 0.5, ...LIMITS.spread[b]); moved += 1;
    }
    if (moved) {
      const detail = `spread opened by ${moved} deg in all (${a} ${f1(A[a].spread)}, ${b} ${f1(A[b].spread)})`;
      diag.push(`${a} and ${b} would pass through each other; ${detail}`);
      corr.push({ rule: 'hand-finger-spread', path: `fingers.${a}+${b}`, asked: 0, used: moved, detail });
    }
  }
}

// every non-adjacent pair of the posed pieces that overlaps by more than tol (exact separating-axis test)
export function penetrations(ctx, F, allowContact = new Set(), tol = 0) {
  const cv = ctx.pieces.map((p, b) => convex(posedPieceVerts(ctx, F, b), p.tris));
  const out = [];
  for (let i = 0; i < cv.length; i++) for (let j = i + 1; j < cv.length; j++) {
    if (isAdjacent(ctx.bones, i, j)) continue;
    const dpt = satDepth(cv[i], cv[j]);
    if (dpt > tol) out.push({ a: BONE_NAMES[i], b: BONE_NAMES[j], i, j, depth: dpt, contact: allowContact.has(`${i}-${j}`) || allowContact.has(`${j}-${i}`) });
  }
  return out;
}

// the grip a pose and the caller's grip block ask for: object kind, radius, tilt, strength (null: no object)
function gripOf(d, pose, grip, diag, corr) {
  const type = pose.contact?.type ?? 'none';
  const ownData = pose.contact?.radius_m ?? null;
  const k = d.L / REF_LENGTH;
  let g = GRIP[type] ? { ...GRIP[type] } : null;
  const shape = grip?.object?.shape ?? null, tiltAsked = grip?.object?.orientation_deg ?? null;
  const strength = grip?.grip_strength ?? 0.5, Rasked = grip?.grip_radius_m ?? null;
  const ignore = (path, why) => { diag.push(`${path} ignored: ${why}`); corr.push({ rule: 'hand-grip-ignored', path, asked: null, used: null, detail: why }); };
  if (!g) {
    if (shape) ignore('object.shape', `contact "${type}" holds no object`);
    if (tiltAsked !== null) ignore('object.orientation_deg', `contact "${type}" holds no object`);
    if (Rasked !== null && type !== 'tripod') ignore('grip_radius_m', `contact "${type}" has no radius`);
    if (grip?.grip_strength !== undefined && grip?.grip_strength !== null && grip.grip_strength !== 0.5) ignore('grip_strength', `contact "${type}" wraps no object`);
    return { type, g: null, tripodR: type === 'tripod' ? (Rasked ?? (ownData === null ? null : ownData * k)) : null };
  }
  // the object's own size: the data's radius for the reference hand, scaled with the hand's length
  let own = ownData === null ? null : ownData * k;
  if (shape && shape !== g.object && !(g.object === 'hookbar' && shape === 'cylinder')) {
    if (g.object === 'hookbar') ignore('object.shape', `the hook holds a bar (a cylinder): "${shape}" is not drawn there`);
    else if (shape === 'plane') { g = { ...g, object: 'plane', plate: false, thumb: false, fingers: [] }; diag.push(`object shape plane instead of the pose's ${GRIP[type].object}: held flat against the palm (no finger or thumb wraps a plane)`); }
    else { g = { ...g, object: shape, plate: false }; diag.push(`object shape ${shape} instead of the pose's ${GRIP[type].object}`); }
  }
  if (g.object === 'plane' && grip?.grip_strength !== undefined && grip?.grip_strength !== null && grip.grip_strength !== 0.5) ignore('grip_strength', 'a plane is held flat, not wrapped: no finger closes on it');
  if (g.object === 'box') {
    if (g.plate) { g.plate = { halfLength: GRIP_OBJECTS.phone.halfLength * k, halfWidth: GRIP_OBJECTS.phone.halfWidth * k, halfThickness: GRIP_OBJECTS.phone.halfThickness * k }; own = own ?? g.plate.halfThickness; }
    g.halfLength = (g.plate ? g.plate.halfLength : GRIP_OBJECTS.barHalfLength * k);
  }
  if (own === null && g.object !== 'plane') own = (g.object === 'sphere' ? 0.035 : 0.015) * k;   // a wrapping grip with no radius in its data
  const R = g.object === 'plane' ? null : (Rasked ?? own);
  if (g.plate && Rasked !== null) g.plate = { ...g.plate, halfThickness: Rasked };
  if (g.object === 'plane' && Rasked !== null) ignore('grip_radius_m', 'a plane has no radius');
  g.tilt = tiltAsked ?? (g.object === 'hookbar' ? 0 : GRIP_OBJECTS.cylinderTiltDeg);
  if (tiltAsked !== null && (g.object === 'sphere' || g.object === 'plane')) ignore('object.orientation_deg', `a ${g.object} has no axis`);
  return { type, g, R, own: g.object === 'plane' ? null : own, strength };
}

function solvePose(ctx, pose, A, grip, diag, corr, fit = null) {
  const d = ctx.d;
  clampAuthored(A, diag, corr);
  const G = gripOf(d, pose, grip, diag, corr);
  const { type, g } = G;
  const allow = new Set();
  const spec0 = contactSpec(ctx, type, G.tripodR ?? null);
  for (const b of (spec0?.touch ?? []).flatMap(digitBones)) for (const t of [1, 2, 3]) allow.add(`${t}-${b}`);
  if (spec0?.palmTouch) for (const t of [2, 3]) allow.add(`${t}-0`);
  if (spec0?.fingers?.length === 2) allow.add('6-9');
  let contact = null, obj = null, thumb = null;
  for (let round = 0; round < 4; round++) {
    const margin = (0.0005 + 0.0012 * round) * d.s;
    const B = cloneA(A), local = [], lcorr = [];
    obj = null; contact = null;
    if (g && g.object === 'plane') {
      obj = placeObject(ctx, g, null, 0, A);
      const out = [];
      for (const fn of FINGERS) {   // fingers that cross the plane are opened until clear
        const F = fk(ctx.bones, restFromAngles(d, B));
        if (fingerObjectSd(ctx, F, fn, obj) >= 0) continue;
        let lo = 0, hi = 1;
        for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2, C = cloneA(B); C[fn] = curl(B[fn], mid); if (fingerObjectSd(ctx, fk(ctx.bones, restFromAngles(d, C)), fn, obj) >= 0) lo = mid; else hi = mid; }
        B[fn] = curl(B[fn], lo); out.push(`${fn} x${lo.toFixed(2)}`);
      }
      local.push(`plane against the palm${out.length ? `: fingers opened to clear it: ${out.join(', ')}` : ': no finger crosses it'}`);
      if (out.length) lcorr.push({ rule: 'hand-grip', path: 'object', asked: 'plane', used: 'plane', detail: `fingers opened to clear the plane: ${out.join(', ')}` });
      contact = { type, shape: 'plane', object: obj, radius: null };
    } else if (g) {
      // the object: placed so that the authored middle finger, at the object's own size, just touches it
      const Rfit = G.own ?? G.R;
      const F0 = fk(ctx.bones, restFromAngles(d, A));
      const fitAt = (t) => fingerObjectSd(ctx, F0, 'middle', placeObject(ctx, g, Rfit, t, A), g.object === 'hookbar');
      const q = ctx.info[FBASE.middle];
      const [t0, t1, dt] = g.object === 'hookbar' ? [q.yMin, q.yMax * 1.3, q.yMax / 40] : [0.15 * d.L, d.fingers.middle.y + 0.3 * Rfit, 0.002 * d.s];
      let t = null, prev = t0;
      if (fitAt(t0) <= 0) t = t0;
      else for (let x = t0 + dt; x <= t1 + 1e-12; x += dt) {
        if (fitAt(x) <= 0) { let lo = prev, hi = x; for (let i = 0; i < 30; i++) { const mm2 = (lo + hi) / 2; if (fitAt(mm2) <= 0) hi = mm2; else lo = mm2; } t = lo; break; }
        prev = x;
      }
      if (t === null) {
        t = g.object === 'hookbar' ? 0.75 * q.yMax : d.fingers.middle.y - 1.2 * Rfit;
        local.push(`the authored middle finger never touches the ${g.object} of size ${mm(Rfit)} mm; object placed by default`);
        lcorr.push({ rule: 'hand-grip', path: 'object', asked: g.object, used: 'default place', detail: 'the authored middle finger never touches the object' });
      }
      obj = placeObject(ctx, g, G.R, t, A);
      const cs = [], k = 1 + 2 * GRIP_OBJECTS.strengthSpan * (G.strength - 0.5);
      for (const fn of g.fingers) {
        const r = curlToContact(ctx, B, fn, obj, g.joints, margin);
        const before = B[fn];
        B[fn] = curl(before, r.c * k, g.joints);
        cs.push(`${fn} x${r.c.toFixed(2)}${r.by !== 'object' ? ` (stopped by ${r.by}${r.start ? ' at the start' : ''})` : ''}`);
        if (r.by !== 'object') lcorr.push({ rule: 'hand-grip', path: `fingers.${fn}`, asked: 'contact', used: r.by, detail: `the finger stopped on the ${r.by} before touching the object` });
      }
      const size = obj.type === 'box' ? `${mm(2 * obj.h[0])} x ${mm(2 * obj.h[1])} x ${mm(2 * obj.h[2])} mm box` : `${obj.type} of radius ${mm(G.R)} mm`;
      local.push(`grip solved on a ${size}${G.R !== G.own ? ` (the pose's own ${G.own === null ? 'none' : mm(G.own) + ' mm'})` : ''}, axis tilt ${f1(g.tilt)} deg: curl ${cs.join(', ')}${k !== 1 ? `; grip strength ${G.strength}: curl x${k.toFixed(3)} (a look, not a force${k > 1 ? ': the fingers press into the object' : ': the fingers stand off the object'})` : ''}`);
      if (k !== 1) lcorr.push({ rule: 'hand-grip', path: 'grip_strength', asked: G.strength, used: G.strength, detail: `contact curl x${k.toFixed(3)}` });
      contact = { type, shape: g.object === 'hookbar' ? 'cylinder' : g.object, object: obj, radius: obj.type === 'box' ? obj.h[2] : G.R, tilt_deg: g.tilt };
    }
    const gripped = new Set(g && g.object !== 'plane' ? g.fingers : []);
    closeFolded(ctx, B, margin, local, lcorr, gripped);
    limitFingers(ctx, B, margin, local, lcorr, gripped);
    let spec = spec0;
    if (g?.thumb && obj) spec = objectSpec(ctx, obj);
    let C = B;
    thumb = null;
    const seed = fit ? { movers: fit.movers, miss_m: fit.miss_m, around: fit.around ?? [] } : null;
    if (spec) { thumb = solveThumb(ctx, B, spec, obj, margin, local, lcorr, type, seed); C = thumb.B; }
    else {   // no target: only keep the thumb out of the fingers, the palm and the object
      const F = fk(ctx.bones, restFromAngles(d, B)), caps = posedCaps(ctx, F);
      let bad = false;
      for (const i of [1, 2, 3]) for (let j = 0; j < caps.length; j++) {
        if (j === i || [1, 2, 3].includes(j) || isAdjacent(ctx.bones, i, j)) continue;
        if (j === 0) { if (i !== 1 && capPalm(ctx, caps[i]) - margin < 0) bad = true; continue; }
        if (capCap(caps[i], caps[j]) - margin < 0) bad = true;
      }
      if (obj) for (const i of [1, 2, 3]) if (objectDistance(obj, caps[i].a, caps[i].b, caps[i].r) < 0) bad = true;
      if (bad) { thumb = solveThumb(ctx, B, { error: () => 0, clearance: true }, obj, margin, local, lcorr, 'clearance (no contact target)', fit ? { movers: null, miss_m: 0 } : null); C = thumb.B; }
    }
    const F = fk(ctx.bones, restFromAngles(d, C));
    // pairs meant to touch may overlap: the thumb's soft pads 2.2 mm on the reference hand, the tripod's index and
    // middle tips (bones 6 and 9) only a touch (0.3 mm)
    const pens = penetrations(ctx, F, allow, 0.0003 * d.s).filter((p) => !(p.contact && p.depth < (p.i === 6 && p.j === 9 ? 0.0003 : 0.0022) * d.s));
    if (!pens.length || round === 3) {
      diag.push(...local); corr.push(...lcorr);
      if (round > 0) { diag.push(`collision margin raised to ${mm(margin)} mm after the exact check`); corr.push({ rule: 'hand-collision-margin', path: 'pose', asked: mm(0.0005 * d.s), used: mm(margin), detail: 'the exact separating-axis check found an overlap; the pose was solved again with a larger clearance' }); }
      for (const p of pens) { diag.push(`could not clear: ${p.a} and ${p.b} overlap by ${mm(p.depth)} mm`); corr.push({ rule: 'hand-collision', path: `${p.a}+${p.b}`, asked: 0, used: p.depth, detail: 'overlap left after the solver' }); }
      return { angles: C, contact, allow: [...allow], thumb };
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------- the public solve
const SOLVED = new Map();
const CACHE_MAX = 2000;
export function clearSolveCache() { SOLVED.clear(); }
export const solveCacheSize = () => SOLVED.size;

// A short hash of a pose object's data (FNV-1a over its JSON): the fit applies to the library's pose exactly.
export function poseHash(pose) {
  const str = JSON.stringify({ fingers: pose.fingers, thumb: pose.thumb, contact: pose.contact ?? null });
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// The library's fit of a pose for a hand (hands/fit.js), or null for a pose object that is not the library's pose as
// fitted. The fit is kept at the knots of the child weight (CHILD_WEIGHT_KNOTS: an adult hand to a newborn's, each
// knot solved from the one before it, so one pose stays one gesture down the ages); a hand takes the two knots around
// its own child weight, interpolated: { thumb, movers, miss_m (scaled to the reference hand's length, as
// CONTACT_TOLERANCE is), changed, detail }.
export function poseFit(pose, d) {
  const f = pose && typeof pose.id === 'string' && Object.hasOwn(POSE_FIT, pose.id) ? POSE_FIT[pose.id] : null;
  if (!f || f.source !== poseHash(pose)) return null;
  const K = f.knots, w = d?.factors?.childWeight ?? 0;
  let k = 0;
  while (k < K.length - 2 && w > K[k + 1].weight) k++;
  const a = K[k], b = K[k + 1] ?? a, t = b === a ? 0 : clamp((w - a.weight) / (b.weight - a.weight), 0, 1);
  const lerp = (x, y) => x + (y - x) * t, near = t < 0.5 ? a : b;
  return { thumb: Object.fromEntries(THUMB_VARS.map((v) => [v, lerp(a.thumb[v], b.thumb[v])])),
    movers: a.movers && b.movers && a.movers.length === b.movers.length ? a.movers.map((m, i) => lerp(m, b.movers[i])) : near.movers,
    miss_m: lerp(a.miss_m, b.miss_m), changed: a.changed || b.changed,
    detail: t === 0 || t === 1 ? near.detail : `between the fits at ${a.months} and ${b.months} months (${near.detail})`, knots: [a.months, b.months], t,
    around: (t === 0 ? [a] : t === 1 ? [b] : [a, b]).map((k) => ({ months: k.months, thumb: { ...k.thumb }, movers: k.movers, miss_m: k.miss_m })) };
}

// Solves one pose for one hand: { angles (the rig's, after controls, limits, contacts and collisions), rest (one
// quaternion a bone), contact (the object held, hand space, canonical right), allow (pairs allowed to touch), thumb
// (the thumb's solution when it was solved: { x, error_m, miss_m, movers }, else null), fit (what the library's fit
// did, or null), diagnostics, corrections }. Cached by its inputs: the same dims, pose, controls and grip return the
// same object. The caller must treat the returned object as read-only.
//
// THE LIBRARY'S FIT. A library pose's thumb is the one fitted once to this mesh with no controls and no grip, on the
// generator's preset hand at each knot of the child weight (hands/fit.js, written by tools/fit_hand_poses.mjs and
// checked by the tests): where the authored thumb overlaps the palm or misses its contact on this mesh, the fit
// moved it, and that is a property of the library on this mesh, said in the diagnostics, not a correction of what a
// DNA asked. Every hand starts from the fit for its age (poseFit), the controls act on it, and the solver only moves
// it further where this hand needs it (a hand-thumb correction then), searching from the fit first, so one pose solves
// the same way on neighbouring bodies. A thumb control (flexion, abduction or opposition other than 0) asks for a
// thumb the fit was not made for: the thumb still starts from the fit and the control acts on it, but the solver then
// searches the whole range, as it does without a fit, so it keeps the nearest thumb that holds rather than the first
// one a local search reaches. { fit: false } solves from the authored angles, { fit: <a fit> } from that fit (the
// tool uses both).
const thumbAsked = (controls) => ['flexion', 'abduction', 'opposition'].some((k) => Number.isFinite(controls?.thumb?.[k]) && controls.thumb[k] !== 0);
export function solveHand(ctx, pose, controls = {}, grip = {}, { fit = true } = {}) {
  const f = fit === true ? poseFit(pose, ctx.d) : fit || null;   // a fit object: that fit (the tool's continuation)
  const key = JSON.stringify([ctx.d.key, ctx.hullKey ?? null, pose, controls?.fingers ?? null, controls?.thumb ?? null, grip ?? null, f ? f.thumb : null]);
  const hit = SOLVED.get(key);
  if (hit) return hit;
  const diag = [], corr = [];
  const P = readPose(pose);
  if (f) {
    P.thumb = { ...f.thumb };
    if (f.changed) diag.push(`thumb of ${pose.id}: the library's fit to this mesh (${f.detail}; hands/fit.js)`);
  }
  const A = applyControls(P, controls, diag, corr);
  const r = solvePose(ctx, pose, A, grip ?? {}, diag, corr, thumbAsked(controls) ? null : f);
  const out = { angles: r.angles, rest: restFromAngles(ctx.d, r.angles), contact: r.contact, allow: r.allow, thumb: r.thumb,
    fit: f ? { changed: f.changed, detail: f.detail } : null, diagnostics: diag, corrections: corr };
  if (SOLVED.size >= CACHE_MAX) SOLVED.delete(SOLVED.keys().next().value);
  SOLVED.set(key, out);
  return out;
}

// The rig's angles in the data's names (degrees), as a build returns them.
export function anglesOut(A) {
  return {
    fingers: Object.fromEntries(FINGERS.map((f) => [f, { mcp_flex_deg: A[f].mcp, pip_flex_deg: A[f].pip, dip_flex_deg: A[f].dip, spread_deg: A[f].spread, twist_deg: A[f].twist ?? 0 }])),
    thumb: { cmc_flex_deg: A.thumb.cmc, mcp_flex_deg: A.thumb.mcp, ip_flex_deg: A.thumb.ip, opposition_deg: A.thumb.opposition, abduction_deg: A.thumb.abduction, twist_deg: A.thumb.twist ?? 0 },
  };
}

// The solved skeleton in hand space (canonical RIGHT hand, posed): what every level of detail is built from.
//   bones[b] = { name, parent, head, rotation (hand-space quaternion of the bone frame), axes: { x, y, z } (unit),
//                length (head to the next joint or the tip), halfWidth, halfThickness (the segment's start, m) }
//   tips = { thumb, index, middle, ring, pinky } (the fingertip points), pads = the distal pads,
//   ring = the six wrist points, contact = the object held (or null).
export function worldSkeleton(ctx, rest, contact) {
  const F = fk(ctx.bones, rest), d = ctx.d;
  const segOf = (b) => { if (b === 0) return null; const dg = DIGITS[Math.floor((b - 1) / 3)], k = (b - 1) % 3; return dg === 'thumb' ? d.thumb.segs[k] : d.fingers[dg].segs[k]; };
  const bones = ctx.bones.map((bn, b) => {
    const R = F.R[b], sg = segOf(b);
    return { name: bn.name, parent: bn.parent, head: F.P[b].slice(), rotation: R.slice(),
      axes: { x: Q.rot(R, [1, 0, 0]), y: Q.rot(R, [0, 1, 0]), z: Q.rot(R, [0, 0, 1]) },
      length: sg ? sg.len : d.fingers.middle.y, halfWidth: sg ? sg.hw0 : d.W / 2, halfThickness: sg ? sg.ht0 : d.Tk / 2 };
  });
  const tips = {}, pads = {};
  for (const dg of DIGITS) { const b = DIGIT_BONES[dg][2]; tips[dg] = toWorld(F, b, ctx.tipLocal(b)); pads[dg] = toWorld(F, b, ctx.padLocal(b)); }
  return { bones, tips, pads, ring: wristRingPoints(d.ring), contact: contact ?? null };
}

// ------------------------------------------------------------------------------------------------ the wrist ring
// The forearm's six-sided wrist ring in the hand frame (canonical right hand), at y = 0, in this order: the radial
// corner, palm side radial, palm side ulnar, the ulnar corner, back side ulnar, back side radial.
export function wristRingPoints({ w, f, b }) {
  return [[f, 0, 0], [f / 2, 0, w], [-b / 2, 0, w], [-b, 0, 0], [-b / 2, 0, -w], [f / 2, 0, -w]];
}

// --------------------------------------------------------------------------------------------- mirror and blend
export const mirrorPoint = (v) => [-v[0], v[1], v[2]];
export function mirrorObject(o) {
  if (!o) return o;
  if (o.type === 'cylinder') return { ...o, p: mirrorPoint(o.p), a: mirrorPoint(o.a) };
  if (o.type === 'sphere') return { ...o, c: mirrorPoint(o.c) };
  if (o.type === 'plane') return { ...o, p: mirrorPoint(o.p), n: mirrorPoint(o.n) };
  return { ...o, c: mirrorPoint(o.c), e: o.e.map(mirrorPoint) };   // box (its axes reflected: a box is symmetric)
}
// flat positions mirrored in X and the winding flipped
export function mirrorMesh(positions, index) {
  const p = positions.slice(); for (let i = 0; i < p.length; i += 3) p[i] = -p[i];
  const ix = index.slice(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  return { positions: p, index: ix };
}
export const slerpRest = (a, b, t) => a.map((q, i) => Q.slerp(q, b[i], t));
