// hands/index.js - the public API of the procedural hand: the Hand DNA v1 (validation), one hand built at a level of
// detail and in a mode, the posed positions of an articulated hand, blending two hands, the level table and the wrist
// interface. Plain JavaScript ES module, no dependencies; runs in Node and in browsers.
//
// The hand frame (canonical RIGHT hand): metres, origin at the wrist pivot (the Hand_L / Hand_R bone head), +Y toward
// the fingertips, +X radial (the thumb), +Z out of the palm. A left hand is the reflection in X with the winding
// flipped (rotations mirrored as (x, y, z, w) -> (x, -y, -z, w): proper rotations, never a negative scale).
//
// The wrist interface: the hand's base is the forearm's six-point wrist ring { w, f, b } at y = 0, exactly (see
// wristRing); the pivot is the origin and never moves; the connector (levels 0 and 1) closes the joint for wrist
// flexion -70..+70 and deviation -20..+30 degrees.
//
// Levels of detail and modes (HAND_LEVELS has the measured counts):
//   level 0  'articulated' (mode A: 16 bones, the bind mesh plus rest rotations) or 'preset' (mode B: the same mesh
//            posed and baked onto the hand bone)                                                    mesh0.js
//   level 1  'preset'      one rigid piece baked from the same solved skeleton                     mesh1.js
//   level 2  'simplified'  the four fingers as one volume, the thumb apart, closed base             mesh2.js
//   level 3  'simplified'  a mitten                                                                mesh3.js
//   level 4  none          no hand (the forearm's end is closed by the body)
// Levels 1 to 3 draw from the same solved skeleton as level 0, solved on the hand's own body.
//
// THE INTERFACE A LOWER LEVEL (mesh1.js, mesh2.js, mesh3.js) IMPLEMENTS
//   export const LEVEL       // 1, 2 or 3
//   export const MODE        // 'preset' (level 1) or 'simplified' (levels 2, 3)
//   export const TRIANGLES   // the one topology's triangle count (for a variant: VARIANTS[name].triangles)
//   export const VERTICES
//   export const VARIANTS    // optional: { name: { triangles, vertices }, ... } (level 1: 'budget' and 'readable')
//   export function build(input) -> { positions, index, diagnostics }
//     input = {
//       dims,       // rig.handDimensions(...): L, W, ring {w,f,b}, fingers {x, y, len, hw, ht, segs}, thumb, zf, eZ, ...
//       skeleton,   // rig.worldSkeleton(...), hand space, canonical RIGHT hand, POSED:
//                   //   bones[16] = { name, parent, head [x,y,z], rotation (quaternion [x,y,z,w] of the bone frame),
//                   //                 axes { x, y, z } (unit vectors), length, halfWidth, halfThickness }
//                   //   tips { thumb, index, middle, ring, pinky } (the fingertip points), pads { ... } (the distal
//                   //   pads), ring (the six wrist points, y = 0), contact (the object held: { type, shape, object,
//                   //   radius, tilt_deg } or null)
//       pose,       // the pose object of poses.js (id, name, contact, gesture_orientation, ...)
//       angles,     // the solved angles in degrees (rig.anglesOut)
//       variant,    // the variant asked (level 1), or null for the module's default
//     }
//     returns positions: flat [x, y, z, ...] in hand space for the canonical RIGHT hand (index.js mirrors a left
//     hand), index: flat [a, b, c, ...] counter-clockwise seen from outside, the SAME for every pose, size, age and
//     control (one topology), every piece closed; diagnostics: an array of strings (may be empty). It must keep the
//     base on the ring (or close it with its own base for levels 2 and 3) and stay within the tolerance of level 0's
//     bounding box and centroid for the same skeleton (no jump between levels).

import { HAND_POSE_LIBRARY, POSE_IDS, CONTACT_TYPES, getPose } from './poses.js';
import * as rig from './rig.js';
import * as mesh0 from './mesh0.js';
import * as shells from './shells.js';
import * as mesh1 from './mesh1.js';
import * as mesh2 from './mesh2.js';
import * as mesh3 from './mesh3.js';

// The lists the validator checks against are frozen copies, and the pose library is frozen in place (nothing in hands/
// writes to it): no module of the process can change what is accepted or what a pose id builds.
const deepFreeze = (o, seen = new WeakSet()) => {
  if (o === null || typeof o !== 'object' || seen.has(o)) return o;
  seen.add(o); Object.freeze(o);
  for (const k of Reflect.ownKeys(o)) deepFreeze(o[k], seen);
  return o;
};
deepFreeze(HAND_POSE_LIBRARY);
export const HAND_DNA_VERSION = '1.0';
export const HAND_MODES = Object.freeze(['articulated', 'preset', 'simplified']);
export const MIRROR_MODES = Object.freeze(['none', 'right_to_left', 'left_to_right']);
export const OBJECT_SHAPES = Object.freeze(['cylinder', 'sphere', 'box', 'plane']);
export const POSES = Object.freeze([...POSE_IDS]);
const CONTACTS = Object.freeze([...CONTACT_TYPES]);   // the contact types a pose object may name
export { HAND_POSE_LIBRARY };
export const BONE_NAMES = rig.BONE_NAMES;

// the modes a level accepts, and each mode's level when none is asked
const LEVEL_MODES = { 0: ['articulated', 'preset'], 1: ['preset'], 2: ['simplified'], 3: ['simplified'], 4: [null] };
const MODE_LEVEL = { articulated: 0, preset: 0, simplified: 2 };
const LEVEL_MODE = { 0: 'articulated', 1: 'preset', 2: 'simplified', 3: 'simplified', 4: null };

// ------------------------------------------------------------------------------------------------ the lower levels
// Imported like every other module: one that fails to load is an error, not a level reported as not built.
const LOWER = { 1: { mod: mesh1 }, 2: { mod: mesh2 }, 3: { mod: mesh3 } };

// The level table, with the measured counts of what is built.
export const HAND_LEVELS = [
  { level: 0, modes: ['articulated', 'preset'], bones: { articulated: 16, preset: 1 }, built: true, module: 'mesh0.js',
    triangles: mesh0.TRIANGLES, vertices: mesh0.VERTICES, pieces: mesh0.PIECE_COUNTS,
    mesh: 'full: faceted palm with thenar, three chamfered segments a finger, thumb metacarpal + 2, wrist connector' },
  ...[1, 2, 3].map((level) => {
    const L = LOWER[level], m = L.mod;
    return { level, modes: LEVEL_MODES[level], bones: { [LEVEL_MODES[level][0]]: 1 }, built: !!m, module: `mesh${level}.js`,
      triangles: m?.TRIANGLES ?? null, vertices: m?.VERTICES ?? null, variants: m?.VARIANTS ?? null, error: m ? null : L.error,
      mesh: level === 1 ? 'one rigid piece baked from the solved skeleton' : level === 2 ? 'the four fingers in one volume, the thumb apart, closed base' : 'a mitten' };
  }),
  { level: 4, modes: [null], bones: {}, built: true, module: null, triangles: 0, vertices: 0, mesh: 'none: the forearm\'s end is closed by the body' },
];

// The wrist ring in the hand frame (canonical right hand), y = 0: the radial corner, palm radial, palm ulnar, the ulnar
// corner, back ulnar, back radial. side 'left' mirrors it.
export function wristRing(ring, side = 'right') {
  const pts = rig.wristRingPoints(ring);
  return side === 'left' ? pts.map(rig.mirrorPoint) : pts;
}

// ------------------------------------------------------------------------------------------------------ validation
// Every error: { stage: 'hands', code, path, message }. Nothing is clamped or repaired; unknown keys are refused.
// A block is first copied with every value read exactly once (snapshot below), and that copy is what is checked and
// what is built, as dna.js does for the human DNA: own data properties only.
const err = (code, path, message) => ({ stage: 'hands', code, path, message });
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const join = (p, k) => (p ? `${p}.${k}` : k);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const own = (o, k) => (hasOwn(o, k) ? o[k] : undefined);   // an own value: an inherited one does not count
const why = (e) => { try { return String(e?.message ?? e).split('\n')[0]; } catch { return 'an error that cannot be read'; } };
// A value as a message shows it, without reading into it: numbers with String() (NaN, Infinity), strings quoted.
function show(v) {
  switch (typeof v) {
    case 'string': return JSON.stringify(v);
    case 'bigint': return `${v}n`;
    case 'function': return 'a function';
    case 'object': if (v === null) return 'null'; try { return Array.isArray(v) ? 'an array' : 'an object'; } catch { return 'an object'; }
    default: return String(v);   // number, boolean, undefined, symbol
  }
}

// The nesting of the Hand DNA: a key whose value is an object read in turn (LEAF: an object whose values are not).
const LEAF = Object.freeze({});
const KEEP = Symbol('keep');   // a value kept as it is, read once (buildHand's pose object)
const FINGERS_NEST = Object.freeze(Object.fromEntries(rig.FINGERS.map((f) => [f, LEAF])));
const SIDE_NEST = Object.freeze({ fingers: FINGERS_NEST, thumb: LEAF, object: LEAF });
const TOP_NEST = Object.freeze({ left: SIDE_NEST, right: SIDE_NEST });

// A copy of v in which every value was read exactly once, to the depth of `nest`. Own keys only (Reflect.ownKeys): an
// inherited key does not count, and symbol and non-enumerable keys are copied as they are, for checkKeys to refuse.
// Data properties only: a getter or setter is refused and never called, and an object that cannot be read (a Proxy
// whose trap throws) is refused; both are TYPE errors pushed to `out`, and the key is left out of the copy. An array, or
// an object deeper than the schema, is copied as an empty one: the checks refuse it by its type, nothing in it is read.
function snapshot(v, nest, path, out) {
  if (v === null || typeof v !== 'object' || nest === KEEP) return v;
  let keys;
  try {
    if (Array.isArray(v)) return [];
    if (!nest) return {};
    keys = Reflect.ownKeys(v);
  } catch (e) { out.push(err('TYPE', path, `could not be read: ${why(e)}`)); return undefined; }
  const copy = {};
  for (const k of keys) {
    const p = join(path, String(k));
    let d;
    try { d = Reflect.getOwnPropertyDescriptor(v, k); } catch (e) { out.push(err('TYPE', p, `could not be read: ${why(e)}`)); continue; }
    if (!d) continue;   // a Proxy that lists a key it does not have
    if (!hasOwn(d, 'value')) { out.push(err('TYPE', p, 'is a getter or setter: only data properties are read')); continue; }
    const inner = typeof k === 'string' && hasOwn(nest, k) ? nest[k] : null;
    Object.defineProperty(copy, k, { value: snapshot(d.value, inner, p, out), enumerable: d.enumerable, writable: true, configurable: true });
  }
  return copy;
}
// The snapshot's errors, then the checks' errors that are not under a path the snapshot already refused.
const merge = (read, out) => [...read, ...out.filter((e) => !read.some((r) => r.path === '' || e.path === r.path || e.path.startsWith(r.path + '.')))];

// Every own key must be an allowed string and enumerable: a symbol, or a string not allowed, is an unknown key.
function checkKeys(obj, allowed, path, out) {
  for (const k of Reflect.ownKeys(obj)) {
    if (typeof k !== 'string' || !allowed.includes(k)) out.push(err('UNKNOWN_KEY', join(path, String(k)), `unknown key ${typeof k === 'string' ? JSON.stringify(k) : String(k)} (allowed: ${allowed.join(', ')})`));
    else if (!Object.prototype.propertyIsEnumerable.call(obj, k)) out.push(err('TYPE', join(path, k), `"${k}" is not enumerable: only enumerable own data properties are read`));
  }
}
// a number within [lo, hi], or null when nullable
function checkNumber(v, path, lo, hi, out, { nullable = true, unit = '' } = {}) {
  if (v === undefined || (v === null && nullable)) return;
  if (!isNum(v)) { out.push(err('TYPE', path, `must be a number${nullable ? ' or null' : ''} (got ${show(v)})`)); return; }
  if (v < lo || v > hi) out.push(err('RANGE', path, `must be within ${lo}..${hi}${unit} (got ${v})`));
}
function checkEnum(v, path, values, out, { nullable = false } = {}) {
  if (v === undefined || (v === null && nullable)) return;
  const list = values.map((x) => JSON.stringify(x)).join(', ');
  if (typeof v !== 'string') { out.push(err('TYPE', path, `must be one of ${list}${nullable ? ' or null' : ''} (got ${show(v)})`)); return; }
  if (!values.includes(v)) out.push(err('ENUM', path, `must be one of ${list} (got ${show(v)})`));
}

const FINGER_KEYS = ['curl', 'spread', 'twist', 'length', 'thickness'];
const THUMB_KEYS = ['flexion', 'abduction', 'opposition'];
const SIDE_KEYS = ['pose', 'grip_radius_m', 'object', 'grip_strength', 'fingers', 'thumb'];
const HAND_KEYS = ['size', 'palm_width', 'finger_length', 'finger_thickness'];
const TOP_KEYS = ['mode', 'level', ...HAND_KEYS, 'dominant_hand', 'mirror', 'left', 'right'];

// The largest grip radius taken (m), in the Hand DNA and in buildHand's grip (README, "The Hand DNA").
export const MAX_GRIP_RADIUS_M = 0.5;

// strict: the Hand DNA, which takes null only where the README's schema lists it (mode, level, the hand-level
// controls, dominant_hand, grip_radius_m, object.shape, object.orientation_deg); elsewhere a key is given or left out.
// buildHand's own arguments (strict false) take null as "the default" everywhere, as the generator hands them.
function checkFingers(v, path, out, strict) {
  if (v === undefined || (v === null && !strict)) return;
  if (!isObj(v)) { out.push(err('TYPE', path, `must be an object { index, middle, ring, pinky }${strict ? '' : ' or null'} (got ${show(v)})`)); return; }
  checkKeys(v, rig.FINGERS, path, out);
  for (const f of rig.FINGERS) {
    const c = own(v, f), p = join(path, f);
    if (c === undefined || (c === null && !strict)) continue;
    if (!isObj(c)) { out.push(err('TYPE', p, `must be an object { ${FINGER_KEYS.join(', ')} } (got ${show(c)})`)); continue; }
    checkKeys(c, FINGER_KEYS, p, out);
    for (const k of ['curl', 'spread', 'twist']) checkNumber(own(c, k), join(p, k), -1, 1, out, { nullable: !strict });
    for (const k of ['length', 'thickness']) checkNumber(own(c, k), join(p, k), 0, 1, out, { nullable: !strict });
  }
}
function checkThumb(v, path, out, strict) {
  if (v === undefined || (v === null && !strict)) return;
  if (!isObj(v)) { out.push(err('TYPE', path, `must be an object { ${THUMB_KEYS.join(', ')} }${strict ? '' : ' or null'} (got ${show(v)})`)); return; }
  checkKeys(v, THUMB_KEYS, path, out);
  for (const k of THUMB_KEYS) checkNumber(own(v, k), join(path, k), -1, 1, out, { nullable: !strict });
}
function checkObject(v, path, out, strict) {
  if (v === undefined || (v === null && !strict)) return;
  if (!isObj(v)) { out.push(err('TYPE', path, `must be an object { shape, orientation_deg }${strict ? '' : ' or null'} (got ${show(v)})`)); return; }
  checkKeys(v, ['shape', 'orientation_deg'], path, out);
  checkEnum(own(v, 'shape'), join(path, 'shape'), OBJECT_SHAPES, out, { nullable: true });
  checkNumber(own(v, 'orientation_deg'), join(path, 'orientation_deg'), -90, 90, out);
}
function checkGrip(v, path, out, strict) {   // grip_radius_m, object, grip_strength of a side block (or buildHand's grip)
  const r = own(v, 'grip_radius_m'), p = join(path, 'grip_radius_m');
  if (r !== undefined && r !== null) {
    if (!isNum(r)) out.push(err('TYPE', p, `must be a number >= 0 or null (got ${show(r)})`));
    else if (r < 0) out.push(err('NEGATIVE_RADIUS', p, `the grip radius cannot be negative (got ${r})`));
    else if (r > MAX_GRIP_RADIUS_M) out.push(err('RANGE', p, `must be within 0..${MAX_GRIP_RADIUS_M} m (got ${r})`));
  }
  checkObject(own(v, 'object'), join(path, 'object'), out, strict);
  checkNumber(own(v, 'grip_strength'), join(path, 'grip_strength'), 0, 1, out, { nullable: !strict });
}

// One side's block, already a snapshot (strict: the Hand DNA's nulls).
function checkSide(b, path, out) {
  if (!isObj(b)) { out.push(err(b === undefined ? 'REQUIRED' : 'TYPE', path, `must be an object with at least { pose }${b === undefined ? '' : ` (got ${show(b)})`}`)); return; }
  checkKeys(b, SIDE_KEYS, path, out);
  const pose = own(b, 'pose'), pp = join(path, 'pose'), range = `${POSES[0]}..${POSES[POSES.length - 1]}`;
  if (pose === undefined || pose === null) out.push(err('REQUIRED', pp, `a pose is required (${range})`));
  else if (typeof pose !== 'string') out.push(err('TYPE', pp, `must be a pose id string (got ${show(pose)})`));
  else if (!POSES.includes(pose)) out.push(err('UNKNOWN_POSE', pp, `unknown pose ${JSON.stringify(pose)} (the library has ${range})`));
  checkGrip(b, path, out, true);
  checkFingers(own(b, 'fingers'), join(path, 'fingers'), out, true);
  checkThumb(own(b, 'thumb'), join(path, 'thumb'), out, true);
}

// One side's block: { pose (required), grip_radius_m, object, grip_strength, fingers, thumb }, read once as
// validateHands reads it. Returns the errors.
export function validateHandSide(block, path = '') {
  const read = [], out = [];
  checkSide(snapshot(block, SIDE_NEST, path, read), path, out);
  return merge(read, out);
}

// the mode and level a spec asks for, with the mismatch reported (null level: the mode's own; null mode: the level's)
function resolveModeLevel(mode, level) {
  if ((mode === null || mode === undefined) && (level === null || level === undefined)) return { mode: 'articulated', level: 0 };
  if (level === null || level === undefined) return { mode, level: MODE_LEVEL[mode] };
  if (mode === null || mode === undefined) return { mode: LEVEL_MODE[level], level };
  if (!LEVEL_MODES[level].includes(mode)) return { mode, level, error: err('MODE_LEVEL_MISMATCH', 'mode', `mode "${mode}" is not built at level ${level} (level ${level} takes ${LEVEL_MODES[level].map((m) => (m === null ? 'no mode (null)' : `"${m}"`)).join(' or ')})`) };
  return { mode, level };
}

const copyPlain = (v) => (isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copyPlain(x)])) : v);

// The Hand DNA v1 block. Returns { ok, errors, spec, notes }. spec is the copy that was checked, every value of the
// block read once (build from it, not from the block handed in), with the mirror applied (the copied side replaced by
// the other; the geometry is mirrored when built) and nothing else changed. notes (strings) says what was replaced: a
// mirror with both sides given keeps the source side and drops the other side's block.
export function validateHands(spec) {
  const read = [], out = [], s = snapshot(spec, TOP_NEST, '', read);
  const fail = (errors) => ({ ok: false, errors, spec: null, notes: [] });
  if (!isObj(s)) return fail(merge(read, [err('TYPE', '', `the hands block must be an object (got ${show(s)})`)]));
  checkKeys(s, TOP_KEYS, '', out);
  const mode = own(s, 'mode'), level = own(s, 'level'), mirrorAsked = own(s, 'mirror');
  checkEnum(mode, 'mode', HAND_MODES, out, { nullable: true });
  if (level !== undefined && level !== null) {
    if (!Number.isInteger(level)) out.push(err('TYPE', 'level', `must be an integer 0..4 or null (got ${show(level)})`));
    else if (level < 0 || level > 4) out.push(err('RANGE', 'level', `must be within 0..4 (got ${level})`));
  }
  for (const k of HAND_KEYS) checkNumber(own(s, k), k, 0, 1, out);
  checkEnum(own(s, 'dominant_hand'), 'dominant_hand', ['right', 'left'], out, { nullable: true });
  checkEnum(mirrorAsked, 'mirror', MIRROR_MODES, out);
  const mirror = MIRROR_MODES.includes(mirrorAsked) ? mirrorAsked : 'none';
  const source = mirror === 'right_to_left' ? 'right' : mirror === 'left_to_right' ? 'left' : null;
  const target = source === 'right' ? 'left' : source === 'left' ? 'right' : null;
  for (const side of ['left', 'right']) {
    if (side === target && own(s, side) === undefined) continue;   // the mirrored side may be left out
    checkSide(own(s, side), side, out);
  }
  if (!out.some((e) => e.path === 'mode' || e.path === 'level')) {
    const r = resolveModeLevel(mode ?? null, level ?? null);
    if (r.error) out.push(r.error);
  }
  const errors = merge(read, out);
  if (errors.length) return fail(errors);
  const notes = [];
  if (target) {
    const given = own(s, target);
    if (given !== undefined) notes.push(`mirror "${mirror}": the ${target} hand's block given (pose ${given.pose}) is replaced by the ${source} hand's (pose ${s[source].pose}), mirrored`);
    s[target] = copyPlain(s[source]);
  }
  return { ok: true, errors: [], spec: s, notes };
}

// ------------------------------------------------------------------------------------------------------- building
const CTX = new Map(), MESH0 = new Map();
function context(d) {
  let c = CTX.get(d.key);
  if (!c) {
    const bones = rig.skeleton(d), P = mesh0.pieces(d, bones);
    c = { bones, P, ctx: rig.makeRig(d, bones, P.bones) };
    if (CTX.size > 200) CTX.delete(CTX.keys().next().value);
    CTX.set(d.key, c);
  }
  return c;
}
function bindMesh0(d, c) {
  let m = MESH0.get(d.key);
  if (!m) { m = mesh0.bindMesh(d, c.bones, c.P); if (MESH0.size > 200) MESH0.delete(MESH0.keys().next().value); MESH0.set(d.key, m); }
  return m;
}
const mirrorQ = rig.quat.mirrorX;
const sideSuffix = (side) => (side === 'left' ? '_L' : '_R');
const mirrorContact = (c) => (c ? { ...c, object: rig.mirrorObject(c.object) } : c);

// The drawn shells of levels 1 and 2 against each other (shells.js), canonical right hand, kept with the solve they
// were built from (the same solve, level and variant draw the same shells). Pairs the solver lets touch (the thumb and
// the fingers or the palm of its contact) may go in as far as level 0's contact allowance (2.2 mm on the reference
// hand); every other pair as far as the exact check's tolerance (0.3 mm). Returns [{ a, b, depth, allowed }] beyond.
const DRAWN = new WeakMap();
const PALM_SHELL = { 1: 'L1_Palm', 2: 'L2_Main' };
const DIGIT_OF_BONE = (b) => (b === 0 ? 'palm' : rig.DIGITS[Math.floor((b - 1) / 3)]);
const SHELL_DIGITS = { L1_Palm: ['palm'], L1_Thumb: ['thumb'], L1_Index: ['index'], L1_Middle: ['middle'], L1_Ring: ['ring'], L1_Pinky: ['pinky'],
  L2_Main: ['palm', 'index', 'middle', 'ring', 'pinky'], L2_Thumb: ['thumb'] };
function drawnOverlaps(solved, level, variant, d, positions, index, pieces) {
  if (!PALM_SHELL[level]) return [];
  let byLevel = DRAWN.get(solved);
  if (!byLevel) { byLevel = new Map(); DRAWN.set(solved, byLevel); }
  const key = `${level}:${variant}`;
  if (byLevel.has(key)) return byLevel.get(key);
  const touch = new Set(solved.allow.map((p) => p.split('-').map((b) => DIGIT_OF_BONE(+b)).sort().join('+')));
  const allows = (a, b) => (SHELL_DIGITS[a] ?? []).some((x) => (SHELL_DIGITS[b] ?? []).some((y) => touch.has([x, y].sort().join('+'))));
  const out = shells.overlaps(positions, index, pieces, { palm: PALM_SHELL[level] })
    .map((o) => ({ ...o, allowed: (allows(o.a, o.b) ? 0.0022 : 0.0003) * d.s })).filter((o) => o.depth > o.allowed);
  byLevel.set(key, out);
  return out;
}

// buildHand's argument object: its keys, and how deep it is read once (the pose object is kept as it is).
const BUILD_KEYS = ['pose', 'side', 'mode', 'level', 'body', 'controls', 'grip', 'variant'];
const BUILD_NEST = Object.freeze({ pose: KEEP, controls: Object.freeze({ fingers: FINGERS_NEST, thumb: LEAF }), grip: Object.freeze({ object: LEAF }), body: Object.freeze({ ring: LEAF }) });
const BODY_KEYS = ['length', 'ring', 'months', 'fem', 'fat'];
// The hand bodies buildHand takes (m): what generate() gives over the human DNA's whole range is 0.025..0.343 m long
// and 0.0023..0.053 m for a half-size of the wrist ring (measured from a 0.25 m newborn to a 2.5 m adolescent and the
// heaviest builds); the bounds leave a margin around that and refuse what cannot be a hand (1e200, 1e-9).
export const HAND_BODY_RANGE = Object.freeze({ length: Object.freeze([0.02, 0.45]), ring: Object.freeze([0.0015, 0.08]) });

function checkBody(body, out) {
  if (body === undefined || body === null) return;   // the reference adult
  if (!isObj(body)) { out.push(err('TYPE', 'body', `must be an object { length, ring: { w, f, b }, months, fem, fat } (got ${show(body)})`)); return; }
  checkKeys(body, BODY_KEYS, 'body', out);
  checkNumber(own(body, 'length'), 'body.length', ...HAND_BODY_RANGE.length, out, { nullable: false, unit: ' m' });
  const ring = own(body, 'ring');
  if (ring !== undefined) {
    if (!isObj(ring)) out.push(err('TYPE', 'body.ring', `must be an object { w, f, b } (half-sizes in m; got ${show(ring)})`));
    else {
      checkKeys(ring, ['w', 'f', 'b'], 'body.ring', out);
      for (const k of ['w', 'f', 'b']) checkNumber(own(ring, k), `body.ring.${k}`, ...HAND_BODY_RANGE.ring, out, { nullable: false, unit: ' m' });
    }
  }
  const months = own(body, 'months');
  if (months !== undefined && !(isNum(months) && months >= 0)) out.push(err(isNum(months) ? 'RANGE' : 'TYPE', 'body.months', `must be a number of months >= 0 (got ${show(months)})`));
  for (const k of ['fem', 'fat']) checkNumber(own(body, k), `body.${k}`, 0, 1, out, { nullable: false });
}

// A pose object (not an id), checked as rig.readPose reads it and as the solver's cache serializes it: what cannot be
// built (a missing finger, an angle that is not finite, a negative radius, an unknown contact) is INVALID_POSE.
function checkPoseObject(pose, out) {
  try {
    if (!isObj(pose) || !isObj(pose.fingers) || !isObj(pose.thumb)) { out.push(err('TYPE', 'pose', 'must be a pose id or a pose object { fingers: { index, middle, ring, pinky }, thumb, contact }')); return null; }
    const contact = pose.contact;
    if (contact !== undefined && contact !== null) {
      if (!isObj(contact)) throw new Error(`the contact must be an object { type, radius_m } (got ${show(contact)})`);
      const type = contact.type;
      if (type !== undefined && type !== null && !CONTACTS.includes(type)) throw new Error(`unknown contact type ${show(type)} (the library has ${CONTACTS.join(', ')})`);
    }
    rig.readPose(pose);
    JSON.stringify(pose);
    return pose;
  } catch (e) { out.push(err('INVALID_POSE', 'pose', why(e))); return null; }
}

// Build one hand.
//   pose      a pose id ('HP01'..'HP24') or a pose object of poses.js
//   side      'right' (canonical) or 'left' (mirrored)
//   mode      'articulated' | 'preset' | 'simplified' | null;  level 0..4 | null (see resolveModeLevel)
//   body      { length, ring: { w, f, b }, months, fem, fat } (the reference adult when left out; length and the ring's
//              half-sizes within HAND_BODY_RANGE, fem and fat 0..1)
//   controls  { size, palm_width, finger_length, finger_thickness, fingers: { index: { curl, spread, twist, length,
//              thickness }, ... }, thumb: { flexion, abduction, opposition } }
//   grip      { grip_radius_m, object: { shape, orientation_deg }, grip_strength }
//   variant   a lower level's variant name (level 1), or null
// The argument object, its controls, grip and body are read once (as validateHands reads a block), and a key that is
// not one of these is refused (UNKNOWN_KEY), as is a malformed pose object (INVALID_POSE).
// Returns { ok: true, side, pose, mode, level, positions, index, boneIndex, bones, pieces, angles, contact, wrist,
// diagnostics, corrections, triangles, vertices } or { ok: false, errors }.
export function buildHand(args = {}) {
  const read = [], errors = [], a = snapshot(args, BUILD_NEST, '', read);
  if (!isObj(a)) return { ok: false, errors: merge(read, [err('TYPE', '', `buildHand takes an object { ${BUILD_KEYS.join(', ')} } (got ${show(a)})`)]) };
  checkKeys(a, BUILD_KEYS, '', errors);
  const arg = (k, dflt) => { const v = own(a, k); return v === undefined ? dflt : v; };
  let pose = arg('pose', 'HP01'), side = arg('side', 'right'), mode = arg('mode', null), level = arg('level', null);
  let body = arg('body', {}), controls = arg('controls', {}), grip = arg('grip', {}), variant = arg('variant', null);
  checkEnum(side, 'side', ['left', 'right'], errors);
  checkEnum(mode, 'mode', HAND_MODES, errors, { nullable: true });
  if (level !== null && level !== undefined && !(Number.isInteger(level) && level >= 0 && level <= 4)) errors.push(err(Number.isInteger(level) ? 'RANGE' : 'TYPE', 'level', `must be an integer 0..4 or null (got ${show(level)})`));
  let poseObj = null;
  if (typeof pose === 'string') { poseObj = POSES.includes(pose) ? getPose(pose) : null; if (!poseObj) errors.push(err('UNKNOWN_POSE', 'pose', `unknown pose ${JSON.stringify(pose)}`)); }
  else if (pose !== null && typeof pose === 'object') poseObj = checkPoseObject(pose, errors);
  else errors.push(err('TYPE', 'pose', `must be a pose id or a pose object (got ${show(pose)})`));
  const c = isObj(controls) ? controls : {};
  if (!isObj(controls) && controls !== null && controls !== undefined) errors.push(err('TYPE', 'controls', `must be an object (got ${show(controls)})`));
  else {
    checkKeys(c, [...HAND_KEYS, 'fingers', 'thumb'], 'controls', errors);
    for (const k of HAND_KEYS) checkNumber(own(c, k), join('controls', k), 0, 1, errors);
    checkFingers(own(c, 'fingers'), 'controls.fingers', errors, false);
    checkThumb(own(c, 'thumb'), 'controls.thumb', errors, false);
  }
  const g = isObj(grip) ? grip : {};
  if (!isObj(grip) && grip !== null && grip !== undefined) errors.push(err('TYPE', 'grip', `must be an object (got ${show(grip)})`));
  else { checkKeys(g, ['grip_radius_m', 'object', 'grip_strength'], 'grip', errors); checkGrip(g, 'grip', errors, false); }
  checkBody(body, errors);
  const all = merge(read, errors);
  if (all.length) return { ok: false, errors: all };
  const ml = resolveModeLevel(mode, level);
  if (ml.error) return { ok: false, errors: [ml.error] };
  if (ml.level >= 1 && ml.level <= 3 && !LOWER[ml.level].mod) {
    return { ok: false, errors: [err('LEVEL_NOT_BUILT', 'level', `level ${ml.level} is not built yet (mesh${ml.level}.js: ${LOWER[ml.level].error})`)] };
  }
  if (variant !== null && variant !== undefined) {   // a variant exists only where the level's module lists it
    const names = Object.keys((ml.level >= 1 && ml.level <= 3 ? LOWER[ml.level].mod.VARIANTS : null) ?? {});
    if (!names.includes(variant)) return { ok: false, errors: [err('ENUM', 'variant', names.length ? `level ${ml.level} has the variants ${names.map((n) => JSON.stringify(n)).join(', ')} (got ${show(variant)})` : `level ${ml.level} has no variants (got ${show(variant)})`)] };
  }
  let d;
  try { d = rig.handDimensions(body ?? {}, c); }
  catch (e) { return { ok: false, errors: [err('BODY', 'body', String(e.message))] }; }
  const C = context(d);
  const solved = rig.solveHand(C.ctx, poseObj, c, g);
  const L = side === 'left', sfx = sideSuffix(side);
  const angles = rig.anglesOut(solved.angles);
  const diagnostics = [...d.notes, ...solved.diagnostics];
  const contact = L ? mirrorContact(solved.contact) : solved.contact;
  const wrist = { ring: wristRing(d.ring, side), pivot: [0, 0, 0], axes: { x: [L ? -1 : 1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } };
  const base = { ok: true, side, pose: poseObj.id, mode: ml.mode, level: ml.level, angles, contact, wrist, diagnostics, corrections: solved.corrections,
    dims: { length: d.L, palm_width: d.W, ring: { ...d.ring }, key: d.key } };

  if (ml.level === 4) return { ...base, positions: [], index: [], boneIndex: [], bones: [], pieces: [], triangles: 0, vertices: 0 };

  base.corrections = solved.corrections;   // the solve's (cached, read-only): copied before anything is added
  let positions, index, boneIndex, bones, pieces;
  if (ml.level === 0) {
    const m = bindMesh0(d, C);
    pieces = m.pieces.map((p) => ({ ...p, bone: p.bone + sfx }));
    if (ml.mode === 'articulated') {
      positions = m.positions.slice(); index = m.index.slice(); boneIndex = m.boneIndex.slice();
      bones = C.bones.map((bn, b) => ({ name: bn.name + sfx, parent: bn.parent < 0 ? null : C.bones[bn.parent].name + sfx, parentIndex: bn.parent,
        head: bn.head.slice(), bind: bn.bind.slice(), rest: solved.rest[b].slice() }));
    } else {
      positions = mesh0.posePositions(m, C.bones, solved.rest); index = m.index.slice(); boneIndex = new Array(positions.length / 3).fill(0);
      bones = [{ name: 'Hand' + sfx, parent: null, parentIndex: -1, head: [0, 0, 0], bind: rig.quat.id(), rest: rig.quat.id() }];
      pieces = pieces.map((p) => ({ ...p, bone: 'Hand' + sfx }));
    }
  } else {
    const mod = LOWER[ml.level].mod;
    const skeleton = rig.worldSkeleton(C.ctx, solved.rest, solved.contact);
    const r = mod.build({ dims: d, skeleton, pose: poseObj, angles, variant });
    positions = Array.from(r.positions); index = Array.from(r.index); boneIndex = new Array(positions.length / 3).fill(0);
    bones = [{ name: 'Hand' + sfx, parent: null, parentIndex: -1, head: [0, 0, 0], bind: rig.quat.id(), rest: rig.quat.id() }];
    pieces = (r.pieces ?? [{ name: `Level${ml.level}`, firstVertex: 0, vertices: positions.length / 3, firstTriangle: 0, triangles: index.length / 3 }]).map((p) => ({ ...p, bone: 'Hand' + sfx }));
    if (r.variant) base.variant = r.variant;
    if (r.diagnostics?.length) diagnostics.push(...r.diagnostics);
    // what is drawn: the lower level's shells against each other (shells.js), per body and pose
    const hits = drawnOverlaps(solved, ml.level, r.variant ?? null, d, positions, index, pieces);
    if (hits.length) base.corrections = [...base.corrections];
    for (const h of hits) {
      const detail = `level ${ml.level}${r.variant ? ` '${r.variant}'` : ''}: the drawn ${h.a.replace(/^L\d_/, '').toLowerCase()} goes ${(h.depth * 1000).toFixed(2)} mm into the ${h.b.replace(/^L\d_/, '').toLowerCase()} (allowed ${(h.allowed * 1000).toFixed(2)} mm; level 0's pieces are what the solver clears)`;
      diagnostics.push(detail);
      base.corrections.push({ rule: 'hand-collision', path: `${h.a}+${h.b}`, asked: 0, used: +h.depth.toPrecision(6), detail });
    }
  }
  if (!positions.every(Number.isFinite)) return { ok: false, errors: [err('BODY', 'body', 'the hand could not be built with finite positions for this body')] };
  if (L) {
    ({ positions, index } = rig.mirrorMesh(positions, index));
    bones = bones.map((bn) => ({ ...bn, head: rig.mirrorPoint(bn.head), bind: mirrorQ(bn.bind), rest: mirrorQ(bn.rest) }));
  }
  return { ...base, positions, index, boneIndex, bones, pieces, triangles: index.length / 3, vertices: positions.length / 3 };
}

// The posed positions of a built hand (hand space, its own side): mode A poses the bind mesh with the bones' rest
// rotations; the other modes are already posed.
export function posed(hand) {
  if (!hand?.ok) throw new Error('posed: not a built hand');
  if (hand.mode !== 'articulated') return hand.positions.slice();
  const F = rig.fk(hand.bones, hand.bones.map((b) => b.rest)), out = new Array(hand.positions.length);
  for (let v = 0, n = hand.boneIndex.length; v < n; v++) {
    const b = hand.boneIndex[v], bn = hand.bones[b];
    const p = [hand.positions[3 * v], hand.positions[3 * v + 1], hand.positions[3 * v + 2]];
    const w = rig.vec.add(F.P[b], rig.quat.rot(F.R[b], rig.quat.rot(rig.quat.conj(bn.bind), rig.vec.sub(p, bn.head))));
    out[3 * v] = w[0]; out[3 * v + 1] = w[1]; out[3 * v + 2] = w[2];
  }
  return out;
}

// Blend two built hands at t (0 = a, 1 = b). Mode A slerps the bones' rest rotations (and lerps the bind data, equal
// for the same body); every other mode lerps vertex positions of the same topology. Different sides, levels or modes
// are refused. A blended frame is not collision-solved (said in its diagnostics).
export function blendHands(a, b, t) {
  const no = (code, path, message) => ({ ok: false, errors: [err(code, path, message)] });
  const built = (h) => h?.ok === true && Array.isArray(h.positions) && Array.isArray(h.index) && Array.isArray(h.bones);
  if (!built(a) || !built(b)) return no('TYPE', '', 'blendHands needs two built hands (what buildHand returns)');
  if (!isNum(t)) return no('TYPE', 't', `must be a number (got ${show(t)})`);
  if (t < 0 || t > 1) return no('RANGE', 't', `must be within 0..1 (got ${t})`);
  if (a.side !== b.side) return no('BLEND_INCOMPATIBLE', 'side', `a ${a.side} hand and a ${b.side} hand cannot be blended`);
  if (a.level !== b.level || a.mode !== b.mode) return no('BLEND_INCOMPATIBLE', 'level', `level ${a.level} ${a.mode} and level ${b.level} ${b.mode} cannot be blended (no silent switch)`);
  if (a.index.length !== b.index.length || a.index.some((v, i) => v !== b.index[i])) return no('BLEND_INCOMPATIBLE', 'index', 'the two hands do not share one topology');
  // the blend keeps a's wrist and dimensions: only hands of one body (and one set of hand-level controls) can share them
  // (a hand with no dims.key, as the generator's fitted levels: its length and wrist ring)
  const bodyOf = (h) => h.dims?.key ?? (h.dims ? `${h.dims.length}|${h.dims.ring?.w}|${h.dims.ring?.f}|${h.dims.ring?.b}` : null);
  if (bodyOf(a) !== bodyOf(b)) return no('BLEND_INCOMPATIBLE', 'body', 'the two hands were built on different bodies or hand-level controls (dims.key differs): a blend would not match its own wrist ring and dimensions');
  const lerp = (x, y) => x + (y - x) * t;
  const positions = a.positions.map((v, i) => lerp(v, b.positions[i]));
  const bones = a.bones.map((bn, i) => ({ ...bn, head: bn.head.map((v, k) => lerp(v, b.bones[i].head[k])), bind: rig.quat.slerp(bn.bind, b.bones[i].bind, t), rest: rig.quat.slerp(bn.rest, b.bones[i].rest, t) }));
  const blendAngles = (x, y) => (isNum(x) ? lerp(x, y) : Object.fromEntries(Object.keys(x).map((k) => [k, blendAngles(x[k], y[k])])));
  return { ...a, pose: `${a.pose}~${b.pose}@${+t.toFixed(4)}`, positions, bones, angles: blendAngles(a.angles, b.angles),
    contact: t < 0.5 ? a.contact : b.contact, corrections: [], blended: { from: a.pose, to: b.pose, t },
    diagnostics: [`blended frame ${a.pose} -> ${b.pose} at t = ${t}: not collision-solved (a pose between two solved poses can touch or cross itself)`] };
}

// A path of buildHand's arguments as a path of the Hand DNA, so an error names a key the block has: controls.size ->
// size (the block's own), controls.fingers.index.curl -> right.fingers.index.curl, grip.grip_radius_m ->
// right.grip_radius_m, pose -> right.pose; mode and level are the block's; a body path names the option the body came
// from (opts.bodyRight.length; 'body' when bodyFrom is not given). Exported for the generator, which builds each hand
// with buildHand from a Hand DNA too.
const under = (p, rest) => (rest ? join(p, rest) : p);
export function handDnaPath(side, path, bodyFrom = null) {
  const [head, ...tail] = String(path).split('.'), rest = tail.join('.');
  if (head === 'controls') return HAND_KEYS.includes(tail[0]) ? rest : under(side, rest);
  if (head === 'grip') return under(side, rest);
  if (head === 'mode' || head === 'level') return path;
  if (head === 'body') return under(bodyFrom ? `opts.${bodyFrom}` : 'body', rest);
  return under(side, path);
}

// Both hands from a Hand DNA block. opts: { body (both sides), bodyLeft, bodyRight, level (the character's level when
// the block's is null) }. Only the copy validateHands checked is built. Returns { ok, version, mode, level,
// dominant_hand, mirror, notes, left, right } or { ok: false, errors }; it never throws.
export function buildHands(spec, opts = {}) {
  try {
    const v = validateHands(spec);
    if (!v.ok) return { ok: false, errors: v.errors };
    const o = opts ?? {};
    if (!isObj(o)) return { ok: false, errors: [err('TYPE', 'opts', `must be an object { body, bodyLeft, bodyRight, level } (got ${show(o)})`)] };
    const optLevel = o.level ?? null;
    if (optLevel !== null && !(Number.isInteger(optLevel) && optLevel >= 0 && optLevel <= 4)) return { ok: false, errors: [err(Number.isInteger(optLevel) ? 'RANGE' : 'TYPE', 'opts.level', `must be an integer 0..4 or null (got ${show(optLevel)})`)] };
    const s = v.spec;
    const ml = resolveModeLevel(s.mode ?? null, s.level ?? optLevel);
    if (ml.error) return { ok: false, errors: [ml.error] };
    const hand = {}, errors = [];
    for (const side of ['left', 'right']) {
      const b = s[side], sideBody = side === 'left' ? 'bodyLeft' : 'bodyRight';
      const bodyFrom = o[sideBody] !== undefined && o[sideBody] !== null ? sideBody : 'body';
      const controls = { ...Object.fromEntries(HAND_KEYS.filter((k) => s[k] !== undefined && s[k] !== null).map((k) => [k, s[k]])), fingers: b.fingers ?? undefined, thumb: b.thumb ?? undefined };
      const grip = { grip_radius_m: b.grip_radius_m ?? null, object: b.object ?? null, grip_strength: b.grip_strength ?? null };
      let h;
      try { h = buildHand({ pose: b.pose, side, mode: ml.mode, level: ml.level, body: o[bodyFrom] ?? {}, controls, grip }); }
      catch (e) { h = { ok: false, errors: [err('INTERNAL', '', `the ${side} hand could not be built: ${why(e)}`)] }; }
      if (!h.ok) errors.push(...h.errors.map((e) => ({ ...e, path: handDnaPath(side, e.path, bodyFrom) })));
      hand[side] = h;
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, version: HAND_DNA_VERSION, mode: ml.mode, level: ml.level, dominant_hand: s.dominant_hand ?? null, mirror: s.mirror ?? 'none',
      notes: v.notes, left: hand.left, right: hand.right };
  } catch (e) { return { ok: false, errors: [err('INTERNAL', '', `the hands could not be built: ${why(e)}`)] }; }
}

// cache control (tests)
export function clearHandCaches() { CTX.clear(); MESH0.clear(); rig.clearSolveCache(); mesh0.clearPieceCache(); mesh1.clearPalmCache(); }
