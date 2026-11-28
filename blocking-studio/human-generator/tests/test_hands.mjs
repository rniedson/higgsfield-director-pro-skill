// QA of the hands (hands/, Procedural Hand Pose System) and of their integration with the human generator. Run from
// the repository's root with:
//   node --test blocking-studio/human-generator/tests/test_hands.mjs
//
// The items of the design's validation list, in its order: one topology a level; the wrist (ring, pivot, connector);
// collisions (exact separating-axis check); continuity (closed shells, no jump between levels); mirroring, blending,
// controls and grips; the Hand DNA; the integration with generate(); the budget. What is measured against a stated
// tolerance says where the tolerance comes from; shortfalls against the design are TODO tests (reported, not failed).
//
// Cost: the library solves a pose in 0.1 to 0.35 s for each new body; the sweeps below reuse its caches (the same
// bodies, the same grip block as the generator), which keeps the file at about 40 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gen from '../generator.js';
import * as H from '../hands/index.js';
import * as rig from '../hands/rig.js';
import * as mesh0 from '../hands/mesh0.js';
import { HAND_POSE_LIBRARY, getPose } from '../hands/poses.js';
import * as SHELLS from '../hands/shells.js';
import { POSE_FIT } from '../hands/fit.js';
import { fitLibrary, fitDifference, FIT_KNOTS } from '../tools/fit_hand_poses.mjs';

const { generate, presetDNA, dnaFromId, posedPositions, boneWorld, collisions, inspect } = gen;
const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));
const CASES = fixture('dna_cases_52.json');
const POSES = H.POSES;
const MM = 0.001;
const clone = (o) => JSON.parse(JSON.stringify(o));
const both = (pose) => ({ left: { pose }, right: { pose } });
const ok = (r, what) => { assert.ok(r.ok, `${what}: ${JSON.stringify(r.errors)}`); return r; };
// the grip block the generator hands the library: the same block shares the library's solve cache
const G0 = { grip_radius_m: null, object: null, grip_strength: null };
const build = (o) => ok(H.buildHand({ grip: G0, ...o }), JSON.stringify(o));
const make = (dna, options) => ok(generate(dna, options), `${dna.id} ${JSON.stringify(options)}`);

// The maintainer's examples (hands_in/examples.json), as given.
const EXAMPLES = [
  { id: 'REST', hands: { mode: 'preset', left: { pose: 'HP01' }, right: { pose: 'HP01' } } },
  { id: 'TOOL', hands: { mode: 'articulated', left: { pose: 'HP03' }, right: { pose: 'HP06', grip_radius_m: 0.02 } } },
  { id: 'GESTURE', hands: { mode: 'preset', left: { pose: 'HP05' }, right: { pose: 'HP07' } } },
];
const NEGATIVE = [{ block: { pose: 'HP25' }, code: 'UNKNOWN_POSE', path: 'right.pose' },
  { block: { pose: 'HP06', grip_radius_m: -0.01 }, code: 'NEGATIVE_RADIUS', path: 'right.grip_radius_m' }];

// ---------------------------------------------------------------- geometry
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => add(a, scl(sub(b, a), t));
const V3 = (P, i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
const maxDiff = (a, b) => { assert.equal(a.length, b.length); let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
const qaxis = (axis, degrees) => { const a = degrees * Math.PI / 360, s = Math.sin(a), l = len(axis); return [axis[0] / l * s, axis[1] / l * s, axis[2] / l * s, Math.cos(a)]; };
const qmul = rig.quat.mul;
const hashIndex = (ix) => { let h = 2166136261; for (const v of ix) { h ^= v; h = Math.imul(h, 16777619) >>> 0; } return `${ix.length}:${h}`; };
const reversed = (ix) => { const o = Array.from(ix); for (let i = 0; i < o.length; i += 3) [o[i + 1], o[i + 2]] = [o[i + 2], o[i + 1]]; return o; };

// The shells (pieces) of a built hand, posed: [{ name, bone, V, T }].
function shells(h, P = H.posed(h)) {
  return h.pieces.map((pc) => {
    const V = []; for (let i = 0; i < pc.vertices; i++) V.push(V3(P, pc.firstVertex + i));
    const T = []; for (let t = pc.firstTriangle; t < pc.firstTriangle + pc.triangles; t++) T.push([0, 1, 2].map((k) => h.index[3 * t + k] - pc.firstVertex));
    return { name: pc.name, bone: pc.bone, V, T };
  });
}
// The shells of a character's hand on side s ('L', 'R'), at the positions P (bind or posed).
function characterShells(c, s, P = c.positions) {
  return c.pieces.filter((p) => p.name.startsWith('Hand_') && p.name.endsWith('_' + s)).map((p) => {
    const V = []; for (let v = p.v0; v < p.v1; v++) V.push(V3(P, v));
    const T = []; for (let t = p.t0; t < p.t1; t++) T.push([0, 1, 2].map((k) => c.index[3 * t + k] - p.v0));
    return { name: p.name, V, T, piece: p };
  });
}
const signedVolume = (V, T) => T.reduce((s, [a, b, c]) => s + dot(V[a], cross(V[b], V[c])) / 6, 0);
// closed (every directed edge once, its reverse once), finite, no degenerate triangle (area > minArea), outward
function shellIssues(sh, minArea) {
  const out = [];
  for (const { name, V, T } of sh) {
    if (!V.every((v) => v.every(Number.isFinite))) out.push(`${name}: a coordinate is not finite`);
    const E = new Map();
    T.forEach(([a, b, c], t) => {
      if (a === b || b === c || a === c) out.push(`${name}: triangle ${t} repeats a vertex`);
      const area = len(cross(sub(V[b], V[a]), sub(V[c], V[a]))) / 2;
      if (!(area > minArea)) out.push(`${name}: triangle ${t} is degenerate (${(area * 1e6).toExponential(2)} mm2)`);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) E.set(`${u},${v}`, (E.get(`${u},${v}`) ?? 0) + 1);
    });
    for (const [k, n] of E) { const [u, v] = k.split(','); if (n !== 1 || E.get(`${v},${u}`) !== 1) { out.push(`${name}: edge ${k} used ${n} times, its reverse ${E.get(`${v},${u}`) ?? 0}`); break; } }
    if (!(signedVolume(V, T) > 0)) out.push(`${name}: its volume is not positive (inside out)`);
  }
  return out;
}
function solidAngle(a, b, c) {
  const la = len(a), lb = len(b), lc = len(c);
  return 2 * Math.atan2(dot(a, cross(b, c)), la * lb * lc + dot(a, b) * lc + dot(a, c) * lb + dot(b, c) * la);
}
const winding = (p, V, T) => T.reduce((s, [a, b, c]) => s + solidAngle(sub(V[a], p), sub(V[b], p), sub(V[c], p)), 0) / (4 * Math.PI);
function pointTriDist(p, a, b, c) {   // the closest point by its Voronoi regions (Ericson)
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return len(sub(p, add(a, scl(ab, d1 / (d1 - d3)))));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return len(sub(p, add(a, scl(ac, d2 / (d2 - d6)))));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return len(sub(p, add(b, scl(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))))));
  const den = 1 / (va + vb + vc); return len(sub(p, add(a, add(scl(ab, vb * den), scl(ac, vc * den)))));
}
const meshDist = (p, V, T) => T.reduce((m, [a, b, c]) => Math.min(m, pointTriDist(p, V[a], V[b], V[c])), Infinity);
const meshSd = (p, V, T) => (winding(p, V, T) > 0.5 ? meshDist(p, V, T) : -meshDist(p, V, T));   // positive inside
// the distance by which p lies outside every shell (0 or less: inside one of them)
function unionGap(p, sh) {
  let out = Infinity;
  for (const { V, T } of sh) { const d = meshDist(p, V, T); if (winding(p, V, T) > 0.5) return -d; out = Math.min(out, d); }
  return out;
}

// The hand above the wrist plane (the levels' measure of a jump): the bounding box of the vertices with y >= 0 of
// every shell but level 0's connector, and the volume centroid of the triangles above the wrist plane.
function extent(sh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let vol = 0, mom = [0, 0, 0];
  for (const { name, V, T } of sh) {
    if (/Connector/.test(name)) continue;
    for (const v of V) if (v[1] >= -1e-9) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
    for (const [a, b, c] of T) {
      if (V[a][1] < -1e-9 || V[b][1] < -1e-9 || V[c][1] < -1e-9) continue;
      const v = dot(V[a], cross(V[b], V[c])) / 6;
      vol += v; mom = add(mom, scl(add(V[a], add(V[b], V[c])), v / 4));
    }
  }
  return { lo, hi, c: scl(mom, 1 / vol) };
}
function jump(e1, e0) {
  let bbox = 0; for (let k = 0; k < 3; k++) bbox = Math.max(bbox, Math.abs(e1.lo[k] - e0.lo[k]), Math.abs(e1.hi[k] - e0.hi[k]));
  return { bbox, centroid: len(sub(e1.c, e0.c)) };
}

// The wrist joint in the hand frame: the forearm's end ring as the hand sees it at each flexion and deviation of the
// design's range (hands/mesh0.js forearmRingAt), sampled along its six edges; the gap is the largest distance by which
// a point of it lies outside every piece of the hand (0: the joint is closed).
const FLEX = [-70, 70], DEV = [-20, 30];
function wristGap(sh, ring, side, step = 5) {
  let gap = 0, at = null;
  for (let fl = FLEX[0]; fl <= FLEX[1] + 1e-9; fl += step) for (let dv = DEV[0]; dv <= DEV[1] + 1e-9; dv += step) {
    let R = mesh0.forearmRingAt({ ring }, fl, dv);
    if (side === 'left') R = R.map(rig.mirrorPoint);
    for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) {
      const g = unionGap(lerp(R[k], R[(k + 1) % 6], j / 3), sh);
      if (g > gap) { gap = g; at = { flex: fl, dev: dv }; }
    }
  }
  return { gap, at };
}
// The same on a character: its hand bone turned by flexion (about the hand frame's X) and deviation (about the palm's
// normal, toward the little finger) through the wrist interface of character.hands, and the forearm's real end ring.
function characterWristGap(c, step = 10) {
  let gap = 0, at = null;
  for (let fl = FLEX[0]; fl <= FLEX[1] + 1e-9; fl += step) for (let dv = DEV[0]; dv <= DEV[1] + 1e-9; dv += step) {
    const pose = {};
    for (const [s, side] of [['L', 'left'], ['R', 'right']]) {
      const ax = c.hands[side].wrist.axes, x = s === 'L' ? scl(ax.thumb, -1) : ax.thumb;   // the hand frame's +X
      pose['Hand_' + s] = qmul(qaxis(x, fl), qaxis(ax.palm, s === 'L' ? -dv : dv));
    }
    const P = posedPositions(c, pose);
    for (const s of ['L', 'R']) {
      const fore = c.pieces.find((p) => p.name === 'Forearm_' + s), R = [0, 1, 2, 3, 4, 5].map((k) => V3(P, fore.v1 - 6 + k)), sh = characterShells(c, s, P);
      for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) {
        const g = unionGap(lerp(R[k], R[(k + 1) % 6], j / 3), sh);
        if (g > gap) { gap = g; at = { side: s, flex: fl, dev: dv }; }
      }
    }
  }
  return { gap, at };
}

// ---------------------------------------------------------------- the bodies and the sweep
// A body as the generator hands it to the library (character.hands.left.body).
const bodyOf = (dna) => make(dna).hands.left.body;
const REF_CORNER = { length: rig.REF_LENGTH, ring: { ...rig.REF_RING }, months: 168, fem: 0, fat: 0 };   // the reference hand (rig.REFERENCE_BODY)
const LEAN_MAN = presetDNA({ sex: 'male', age_months: 360, build: 1 });   // arm fat 0
const TALL_LEAN_MAN = dnaFromId('M_H10_C01');   // the library's HP01 thumb overlaps his palm: the solver moves it clear
const WOMAN = dnaFromId('F_H05_C04');
let BODIES_ = null;
const BODIES = () => (BODIES_ ??= [
  { name: 'reference adult hand (168 months)', body: REF_CORNER },
  { name: 'newborn', body: bodyOf(presetDNA({ sex: 'male', age_months: 0 })) },
  { name: 'child of 6', body: bodyOf(presetDNA({ sex: 'female', age_months: 72 })) },
  { name: 'adult woman', body: bodyOf(WOMAN) },
]);
const CONFIGS = [
  { key: '0 A', level: 0, mode: 'articulated', variant: null },
  { key: '0 B', level: 0, mode: 'preset', variant: null },
  { key: '1 budget', level: 1, mode: 'preset', variant: 'budget', target: [24, 40], jump: { bbox: 0.13, centroid: 0.07 } },
  { key: '1 readable', level: 1, mode: 'preset', variant: 'readable', target: [41, 82], jump: { bbox: 0.10, centroid: 0.05 } },
  { key: '2', level: 2, mode: 'simplified', variant: null, target: [12, 20], jump: { bbox: 0.19, centroid: 0.11 } },
  { key: '3', level: 3, mode: 'simplified', variant: null, target: [6, 12], jump: { bbox: 0.40, centroid: 0.16 } },
];
// controls at their ends, on a few poses of the reference hand (the levels step's control sets)
const CONTROL_SETS = [{ size: 0, palm_width: 1, finger_length: 0, finger_thickness: 1 },
  { fingers: { index: { curl: 1, spread: 1, twist: -1, length: 1, thickness: 0 }, pinky: { curl: -1, spread: -1, twist: 1 } }, thumb: { flexion: 1, abduction: -1, opposition: 1 } }];
const CONTROL_POSES = ['HP01', 'HP04', 'HP06', 'HP11', 'HP18', 'HP24'];
// every level and side of the 24 poses on each body, and of the control poses with each control set
let SWEEP_ = null;
function sweep() {
  if (SWEEP_) return SWEEP_;
  const items = [];
  const add1 = (bodyName, body, pose, controls, controlSet) => {
    const hands = {};
    for (const C of CONFIGS) for (const side of ['right', 'left']) hands[`${C.key}|${side}`] = build({ pose, side, level: C.level, mode: C.mode, variant: C.variant, body, controls });
    items.push({ bodyName, body, pose, controlSet, hands });
  };
  for (const B of BODIES()) for (const pose of POSES) add1(B.name, B.body, pose, {}, null);
  CONTROL_SETS.forEach((cs, i) => { for (const pose of CONTROL_POSES) add1(BODIES()[0].name, REF_CORNER, pose, cs, i); });
  return (SWEEP_ = items);
}

// ---------------------------------------------------------------- the library's data

test('the 24 poses of hands/poses.js are the fixture tests/fixtures/hand_poses_24.json', () => {
  assert.deepEqual(clone(HAND_POSE_LIBRARY), fixture('hand_poses_24.json'));
  assert.deepEqual(POSES, Array.from({ length: 24 }, (_, i) => `HP${String(i + 1).padStart(2, '0')}`));
});

// ---------------------------------------------------------------- one topology a level

test('one topology a level: the same index for every pose, size, age, side and control; the counts within the targets', (t) => {
  const items = sweep();
  for (const C of CONFIGS) {
    const seen = { right: new Set(), left: new Set() };
    let tris = null, verts = null;
    for (const it of items) for (const side of ['right', 'left']) {
      const h = it.hands[`${C.key}|${side}`];
      seen[side].add(hashIndex(h.index));
      tris ??= h.triangles; verts ??= h.vertices;
      assert.equal(h.triangles, tris, `${C.key} ${it.bodyName} ${it.pose}`); assert.equal(h.vertices, verts);
      assert.equal(h.triangles, h.index.length / 3); assert.equal(h.vertices, h.positions.length / 3);
      assert.equal(h.level, C.level); assert.equal(h.mode, C.mode);
    }
    assert.equal(seen.right.size, 1, `${C.key}: ${seen.right.size} index layouts on the right`);
    assert.equal(seen.left.size, 1, `${C.key}: ${seen.left.size} index layouts on the left`);
    const r = items[0].hands[`${C.key}|right`], l = items[0].hands[`${C.key}|left`];
    assert.deepEqual(Array.from(l.index), reversed(r.index), `${C.key}: the left index is the right one with every triangle reversed`);
    const lv = H.HAND_LEVELS.find((x) => x.level === C.level);
    assert.equal(tris, C.variant ? lv.variants[C.variant].triangles : lv.triangles, `${C.key}: HAND_LEVELS says what is built`);
    if (C.target) assert.ok(tris >= C.target[0] && tris <= C.target[1], `${C.key}: ${tris} triangles, target ${C.target.join('..')}`);
    t.diagnostic(`level ${C.key}: ${tris} triangles, ${verts} vertices, one index (of ${items.length * 2} hands: 4 bodies x 24 poses + 2 control sets x 6 poses, both sides)`);
  }
  // mode A: the poses only turn bones, the bind mesh is the body's own
  for (const B of BODIES()) {
    const hs = items.filter((it) => it.bodyName === B.name && it.controlSet === null).map((it) => it.hands['0 A|right']);
    for (const h of hs) assert.deepEqual(h.positions, hs[0].positions, `${B.name} ${h.pose}: mode A's bind mesh does not depend on the pose`);
  }
});

test('level 0 is within the design\'s target of about 160 to 260 triangles a hand', { todo: 'measured: 332 (palm 40, connector 32, 10 segments of 20, 5 tips of 12); the design asked for about 160 to 260' }, () => {
  const n = H.HAND_LEVELS[0].triangles;
  assert.ok(n >= 160 && n <= 260, `${n} triangles`);
});

// ---------------------------------------------------------------- the wrist

test('the wrist: the first six vertices of every level are the wrist ring exactly, at the pivot, whatever the pose', () => {
  for (const it of sweep()) for (const C of CONFIGS) for (const side of ['right', 'left']) {
    const h = it.hands[`${C.key}|${side}`], ring = H.wristRing(h.dims.ring, side);
    assert.deepEqual(h.wrist.ring, ring); assert.deepEqual(h.wrist.pivot, [0, 0, 0]);
    const P = C.mode === 'articulated' ? H.posed(h) : h.positions;
    for (let k = 0; k < 6; k++) assert.ok(len(sub(V3(P, k), ring[k])) < 1e-12, `${C.key} ${side} ${it.bodyName} ${it.pose}: ring vertex ${k}`);
    assert.equal(len(h.bones[0].head), 0, 'the hand bone sits on the pivot');
    assert.deepEqual(h.dims.ring, it.body.ring, 'the ring is the body\'s, controls do not change it');
  }
});

test('the wrist: level 0\'s connector closes the joint at flexion -70..+70 and deviation -20..+30', (t) => {
  for (const B of BODIES()) for (const pose of ['HP01', 'HP04', 'HP18']) for (const side of ['right', 'left']) {
    const h = build({ pose, side, level: 0, mode: 'articulated', body: B.body }), g = wristGap(shells(h), B.body.ring, side);
    assert.ok(g.gap <= 1e-6 * h.dims.length, `${B.name} ${pose} ${side}: a gap of ${(g.gap / MM).toFixed(3)} mm at ${JSON.stringify(g.at)}`);
  }
  t.diagnostic('level 0: no point of the forearm\'s end ring outside the hand at any flexion and deviation of the range (5 degree steps), 4 bodies, 3 poses, both sides');
});

// the measured gaps of level 1 (the levels step measured 0.047 L for 'budget' and 0.005 L for 'readable')
const L1_GAP = { budget: 0.05, readable: 0.006 };
const level1Gaps = (() => {
  let out = null;
  return () => out ??= Object.fromEntries(['budget', 'readable'].map((variant) => {
    let worst = 0, at = '';
    for (const B of BODIES()) for (const pose of ['HP01', 'HP04', 'HP10']) {
      const h = build({ pose, side: 'right', level: 1, variant, body: B.body }), g = wristGap(shells(h), B.body.ring, 'right');
      if (g.gap / h.dims.length > worst) { worst = g.gap / h.dims.length; at = `${B.name} ${pose} (${(g.gap / MM).toFixed(2)} mm at flexion ${g.at.flex}, deviation ${g.at.dev})`; }
    }
    return [variant, { worst, at }];
  }));
})();
test('the wrist: level 1 \'readable\' closes the joint to within 0.006 of the hand length; \'budget\' leaves a gap, measured and bounded', (t) => {
  const g = level1Gaps();
  for (const v of ['budget', 'readable']) {
    t.diagnostic(`level 1 '${v}': largest wrist gap ${g[v].worst.toFixed(4)} L at ${g[v].at}`);
    assert.ok(g[v].worst <= L1_GAP[v], `level 1 '${v}': ${g[v].worst.toFixed(4)} L, bound ${L1_GAP[v]} L`);
  }
});
test('the wrist: level 1 \'budget\' closes the joint over the whole range', { todo: 'the budget base (40 triangles) leaves a gap of up to about 0.047 of the hand length at the range\'s ends; \'readable\' and level 0 close it' }, () => {
  const g = level1Gaps().budget;
  assert.ok(g.worst <= 0.001, `${g.worst.toFixed(4)} L at ${g.at}`);
});

// ---------------------------------------------------------------- collisions

// The thumb's contacts: the poses whose contact puts the thumb against a finger or the palm. The library's solver
// lets such a pair touch by up to 2.2 mm on the reference hand (0.0022 of the scale, hands/rig.js); every other pair
// of pieces that are not joined (parent and child) may overlap by 0.3 mm on the reference hand at most.
const THUMB_CONTACTS = new Set(['thumb_over_fingers', 'thumb_ring', 'thumb_index_tips', 'tripod', 'thumb_middle_ring', 'thumb_pinky', 'thumb_palm', 'thin_plane']);
test('collisions: no finger through the palm or another finger (exact separating-axis check), 24 poses, four sizes and ages, the controls at their ends', (t) => {
  let pairs = 0, worstFree = 0, worstFreeAt = '', worstContact = 0, worstContactAt = '';
  const reported = [];
  for (const it of sweep()) {
    const h = it.hands['0 A|right'], s = h.dims.length / rig.REF_LENGTH, P = H.posed(h);
    const boneOf = Object.fromEntries(h.bones.map((b, i) => [b.name, i]));
    const cv = shells(h, P).map((sh) => ({ name: sh.name, b: boneOf[sh.bone], hull: rig.convex(sh.V, sh.T) }));
    const joined = (i, j) => i === j || h.bones[i].parentIndex === j || h.bones[j].parentIndex === i;
    const contactPose = THUMB_CONTACTS.has(getPose(it.pose).contact.type);
    const left = new Set(h.corrections.filter((k) => k.rule === 'hand-collision').map((k) => k.path));
    if (left.size) reported.push(`${it.pose} (control set ${it.controlSet}): ${[...left].join(', ')}`);
    assert.ok(!left.size || it.controlSet === 1, `${it.bodyName} ${it.pose}: the solver left ${[...left].join(', ')}`);
    for (let i = 0; i < cv.length; i++) for (let j = i + 1; j < cv.length; j++) {
      if (joined(cv[i].b, cv[j].b)) continue;
      pairs++;
      const depth = rig.satDepth(cv[i].hull, cv[j].hull), where = `${it.bodyName} ${it.pose}${it.controlSet !== null ? ` (control set ${it.controlSet})` : ''} ${cv[i].name}+${cv[j].name}: ${(depth / MM).toFixed(2)} mm`;
      const thumb = /^Thumb_0[23]$/.test(cv[i].name) || /^Thumb_0[23]$/.test(cv[j].name);
      if (left.has(`${cv[i].name}+${cv[j].name}`) || left.has(`${cv[j].name}+${cv[i].name}`)) continue;   // reported, not hidden
      if (contactPose && thumb) {
        if (depth > worstContact) { worstContact = depth / s; worstContactAt = where; }
        assert.ok(depth <= 0.0022 * s, `a contact deeper than the solver allows: ${where}`);
      } else {
        if (depth > worstFree) { worstFree = depth / s; worstFreeAt = where; }
        assert.ok(depth <= 0.0003 * s, `pieces through each other: ${where}`);
      }
    }
  }
  t.diagnostic(`${pairs} pairs of pieces not joined to each other; deepest overlap of a free pair ${(worstFree / MM).toFixed(3)} mm on the reference hand (${worstFreeAt}); deepest thumb contact ${(worstContact / MM).toFixed(2)} mm on the reference hand (${worstContactAt})`);
  // the 24 poses on the four bodies are cleared; the second control set (the little finger straight and pressed
  // against the ring finger, spread -1) cannot be, and the solver says so: those pairs are left out above
  t.diagnostic(`overlaps the solver could not clear, reported as 'hand-collision': ${reported.join('; ') || 'none'}`);
  assert.ok(reported.length > 0 && reported.length <= CONTROL_POSES.length);
});

// ---------------------------------------------------------------- continuity

test('continuity: closed shells, finite coordinates, no degenerate triangle, outward, at every level', () => {
  for (const it of sweep()) for (const C of CONFIGS) for (const side of ['right', 'left']) {
    const h = it.hands[`${C.key}|${side}`], s = h.dims.length / rig.REF_LENGTH;
    assert.deepEqual(shellIssues(shells(h), 1e-10 * s * s), [], `${C.key} ${side} ${it.bodyName} ${it.pose}`);
  }
});

test('no jump: levels 1 to 3 stay within their tolerance of level 0 for every pose (bounding box and centroid, in hand lengths)', (t) => {
  for (const C of CONFIGS.filter((x) => x.jump)) {
    let wb = 0, wbAt = '', wc = 0, wcAt = '';
    for (const it of sweep()) {
      const h0 = it.hands['0 B|right'], h = it.hands[`${C.key}|right`], L = h0.dims.length, j = jump(extent(shells(h)), extent(shells(h0)));
      if (j.bbox / L > wb) { wb = j.bbox / L; wbAt = `${it.bodyName} ${it.pose}`; }
      if (j.centroid / L > wc) { wc = j.centroid / L; wcAt = `${it.bodyName} ${it.pose}`; }
    }
    t.diagnostic(`level ${C.key}: bounding box within ${wb.toFixed(3)} L of level 0 (${wbAt}), centroid within ${wc.toFixed(3)} L (${wcAt}); tolerance ${C.jump.bbox} / ${C.jump.centroid} L (the levels step's measured worst cases over six bodies, rounded up)`);
    assert.ok(wb <= C.jump.bbox, `level ${C.key}: bounding box ${wb.toFixed(3)} L at ${wbAt}`);
    assert.ok(wc <= C.jump.centroid, `level ${C.key}: centroid ${wc.toFixed(3)} L at ${wcAt}`);
  }
});

// ---------------------------------------------------------------- mirroring, blending, controls, grips

test('mirroring: the left hand is the right hand reflected in x, its winding flipped, its bones mirrored', () => {
  for (const it of sweep()) for (const C of CONFIGS) {
    const r = it.hands[`${C.key}|right`], l = it.hands[`${C.key}|left`];
    const m = rig.mirrorMesh(r.positions, r.index);
    assert.equal(maxDiff(l.positions, m.positions), 0, `${C.key} ${it.pose}`);
    assert.deepEqual(Array.from(l.index), Array.from(m.index));
    r.bones.forEach((b, i) => { assert.deepEqual(l.bones[i].head, rig.mirrorPoint(b.head)); assert.deepEqual(l.bones[i].rest, rig.quat.mirrorX(b.rest)); assert.equal(l.bones[i].name, b.name.replace(/_R$/, '_L')); });
    assert.deepEqual(l.angles, r.angles, 'the same pose on both sides');
  }
});

test('blending: hands of one topology blend and meet their ends; other pairs are refused, never switched', () => {
  const body = REF_CORNER;
  for (const C of CONFIGS) {
    const a = build({ pose: 'HP01', side: 'right', level: C.level, mode: C.mode, variant: C.variant, body }), b = build({ pose: 'HP04', side: 'right', level: C.level, mode: C.mode, variant: C.variant, body });
    const at = (t) => ok(H.blendHands(a, b, t), `${C.key} at ${t}`);
    const p0 = H.posed(at(0)), p1 = H.posed(at(1)), ph = H.posed(at(0.5));
    assert.ok(maxDiff(p0, H.posed(a)) < 1e-12 && maxDiff(p1, H.posed(b)) < 1e-12, `${C.key}: t = 0 and t = 1 are the two hands`);
    let between = 0; for (let i = 0; i < ph.length; i++) between = Math.max(between, Math.abs(ph[i] - (p0[i] + p1[i]) / 2));
    assert.ok(ph.every(Number.isFinite) && between < 0.5 * a.dims.length, `${C.key}: the half-way frame lies between them`);
    assert.match(at(0.5).diagnostics.join(' '), /not collision-solved/);
    assert.equal(at(0.5).corrections.length, 0);
  }
  const A = build({ pose: 'HP01', side: 'right', level: 0, mode: 'articulated', body }), B1 = build({ pose: 'HP04', side: 'right', level: 1, body });
  const code = (r) => (r.ok ? 'ok' : `${r.errors[0].code} ${r.errors[0].path}`);
  assert.equal(code(H.blendHands(A, B1, 0.5)), 'BLEND_INCOMPATIBLE level');
  assert.equal(code(H.blendHands(A, build({ pose: 'HP04', side: 'left', level: 0, mode: 'articulated', body }), 0.5)), 'BLEND_INCOMPATIBLE side');
  assert.equal(code(H.blendHands(B1, build({ pose: 'HP04', side: 'right', level: 1, variant: 'readable', body }), 0.5)), 'BLEND_INCOMPATIBLE index');
  assert.equal(code(H.blendHands(A, build({ pose: 'HP04', side: 'right', level: 0, mode: 'preset', body }), 0.5)), 'BLEND_INCOMPATIBLE level');
  assert.equal(code(H.blendHands(A, A, 1.5)), 'RANGE t'); assert.equal(code(H.blendHands(A, A, NaN)), 'TYPE t');
});

test('controls: each one moves what it says, and says so; at its end it is reported at the joint limit', () => {
  const body = REF_CORNER, pose = 'HP01';
  const base = build({ pose, body, level: 0, mode: 'articulated' }), A0 = base.angles;
  const sumFlex = (A, f) => A.fingers[f].mcp_flex_deg + A.fingers[f].pip_flex_deg + A.fingers[f].dip_flex_deg;
  const control = (c) => { const h = build({ pose, body, level: 0, mode: 'articulated', controls: c }); return { h, A: h.angles, k: h.corrections.filter((x) => x.rule === 'hand-control') }; };
  const said = (k, path, value, limit) => {
    const x = k.find((e) => e.path === path);
    assert.ok(x, `${path}: no correction says what the control did`);
    assert.equal(x.asked, value); assert.equal(x.used, value);
    assert.equal(/at the joint limit/.test(x.detail), limit, `${path} ${value}: "${x.detail}"`);
  };
  // the finger controls: their finger only (the solver may still move a neighbour clear, and says so)
  for (const [f, v] of [['index', 1], ['index', 0.5], ['ring', -1]]) {
    const { A, k } = control({ fingers: { [f]: { curl: v } } });
    assert.ok(v > 0 ? sumFlex(A, f) > sumFlex(A0, f) + 20 : sumFlex(A, f) < sumFlex(A0, f) - 20, `curl ${v} moves the ${f} finger`);
    for (const g of ['index', 'middle', 'ring', 'pinky'].filter((x) => x !== f)) assert.equal(sumFlex(A, g), sumFlex(A0, g), `curl of the ${f} finger leaves the ${g} finger`);
    said(k, `fingers.${f}.curl`, v, v === 1);
  }
  { const { A, k } = control({ fingers: { middle: { spread: 1 } } }); assert.ok(A.fingers.middle.spread_deg > A0.fingers.middle.spread_deg + 5); said(k, 'fingers.middle.spread', 1, true); }
  { const { A, k } = control({ fingers: { index: { spread: -0.5 } } }); assert.ok(A.fingers.index.spread_deg < A0.fingers.index.spread_deg - 2); said(k, 'fingers.index.spread', -0.5, false); }
  { const { A, k } = control({ fingers: { ring: { twist: -1 } } }); assert.equal(A.fingers.ring.twist_deg, -rig.TWIST_DEG); said(k, 'fingers.ring.twist', -1, true); }
  { const { A, k } = control({ thumb: { flexion: 1 } }); for (const j of ['cmc_flex_deg', 'mcp_flex_deg', 'ip_flex_deg']) assert.ok(A.thumb[j] > A0.thumb[j] + 10, j); said(k, 'thumb.flexion', 1, true); }
  { const { A, k } = control({ thumb: { abduction: -1 } }); assert.ok(A.thumb.abduction_deg < A0.thumb.abduction_deg - 20); said(k, 'thumb.abduction', -1, true); }
  { const { A, k } = control({ thumb: { opposition: 1 } }); assert.equal(A.thumb.opposition_deg, rig.LIMITS.thumb.opposition[1]); said(k, 'thumb.opposition', 1, true); }
  { const { A, k } = control({ thumb: { opposition: 0.4 } }); assert.ok(A.thumb.opposition_deg > A0.thumb.opposition_deg + 10); said(k, 'thumb.opposition', 0.4, false); }
  // the dimension controls: 0.5 is neutral, 0 and 1 the ends (a span of 15 per cent each way, a proposal)
  const span = 1 + rig.CONTROL_SPAN, head = (h, a) => h.bones.find((x) => x.name === a + '_R').head, headDist = (h, a, b) => len(sub(head(h, a), head(h, b)));
  const across = (h) => head(h, 'Index_01')[0] - head(h, 'Pinky_01')[0];   // the knuckles' span across the palm
  const width = (h, piece) => { const pc = h.pieces.find((p) => p.name === piece), xs = []; for (let v = pc.firstVertex; v < pc.firstVertex + pc.vertices; v++) xs.push(h.positions[3 * v]); return Math.max(...xs) - Math.min(...xs); };
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { size: 1 } }); assert.ok(Math.abs(h.dims.length - rig.REF_LENGTH * span) < 1e-12); assert.deepEqual(h.dims.ring, REF_CORNER.ring); assert.match(h.diagnostics.join(' '), /size 1: hand length/); }
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { size: 0 } }); assert.ok(Math.abs(h.dims.length - rig.REF_LENGTH * (1 - rig.CONTROL_SPAN)) < 1e-12); }
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { palm_width: 1 } }); assert.ok(Math.abs(across(h) / across(base) - span) < 1e-9, `palm width: x${(across(h) / across(base)).toFixed(4)}`); }
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { finger_length: 1 } }); assert.ok(Math.abs(headDist(h, 'Middle_02', 'Middle_03') / headDist(base, 'Middle_02', 'Middle_03') - span) < 1e-9, 'finger length'); }
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { finger_thickness: 0 } }); assert.ok(width(h, 'Middle_02') < width(base, 'Middle_02') * 0.9, 'finger thickness'); }
  { const h = build({ pose, body, level: 0, mode: 'articulated', controls: { fingers: { index: { length: 1, thickness: 1 } } } });
    assert.ok(Math.abs(headDist(h, 'Index_02', 'Index_03') / headDist(base, 'Index_02', 'Index_03') - span) < 1e-9, 'the index alone is longer');
    assert.ok(Math.abs(headDist(h, 'Middle_02', 'Middle_03') - headDist(base, 'Middle_02', 'Middle_03')) < 1e-12, 'the middle finger is not');
    assert.ok(width(h, 'Index_02') > width(base, 'Index_02') * 1.05, 'the index alone is thicker'); }
  // outside the range: refused, never clamped
  for (const c of [{ size: 1.2 }, { fingers: { index: { curl: 1.01 } } }, { thumb: { opposition: -2 } }]) assert.equal(H.buildHand({ pose, body, controls: c }).errors[0].code, 'RANGE');
});

test('grips: the object\'s radius, shape and orientation change the grip, and an absolute radius stays absolute', () => {
  const body = REF_CORNER, curl = (h) => ['middle', 'ring', 'pinky'].reduce((s, f) => s + h.angles.fingers[f].pip_flex_deg + h.angles.fingers[f].dip_flex_deg + h.angles.fingers[f].mcp_flex_deg, 0);
  const at = (grip) => ok(H.buildHand({ pose: 'HP06', body, level: 0, mode: 'articulated', grip }), JSON.stringify(grip));
  const r = [0.012, 0.02, 0.03].map((R) => at({ grip_radius_m: R }));
  r.forEach((h, i) => { assert.equal(h.contact.radius, [0.012, 0.02, 0.03][i]); assert.equal(h.contact.shape, 'cylinder'); });
  assert.ok(curl(r[0]) > curl(r[1]) && curl(r[1]) > curl(r[2]), `a larger object curls the fingers less: ${r.map(curl).map((x) => x.toFixed(0)).join(' > ')}`);
  const sphere = at({ object: { shape: 'sphere', orientation_deg: null } });
  assert.equal(sphere.contact.shape, 'sphere'); assert.match(sphere.diagnostics.join(' '), /object shape sphere/);
  const tilted = at({ object: { shape: null, orientation_deg: 30 } });
  assert.equal(tilted.contact.tilt_deg, 30); assert.notDeepEqual(tilted.angles, at({}).angles);
  // a radius on a pose that holds nothing is ignored and said
  const none = ok(H.buildHand({ pose: 'HP10', body, level: 0, grip: { grip_radius_m: 0.02 } }), 'HP10');
  assert.ok(none.corrections.some((k) => k.rule === 'hand-grip-ignored' && k.path === 'grip_radius_m'));
  // through the generator: the same 20 mm on another body, at level 0 (exact) and level 1 (fitted, built on the
  // reference hand at the radius that scales back to 20 mm)
  for (const level of [0, 1]) {
    const c = make(WOMAN, { hands: { level, left: { pose: 'HP01' }, right: { pose: 'HP06', grip_radius_m: 0.02 } } });
    assert.ok(Math.abs(c.hands.right.contact.radius - 0.02) < 1e-12, `level ${level}: ${c.hands.right.contact.radius}`);
  }
});

// ---------------------------------------------------------------- the rules of a body: age, sex, limits, grips, contacts

test('a child\'s hand is not an adult\'s scaled down, and the female preset\'s is not the male\'s: the factors on the dimensions and on the mesh, and said', () => {
  const L = rig.REF_LENGTH, ring = { ...rig.REF_RING }, A = rig.AGE_FACTORS, S = rig.SEX_FACTORS, P = rig.PROPORTIONS;
  const dimsOf = (months, fem = 0) => rig.handDimensions({ length: L, ring, months, fem, fat: 0 });
  const adult = dimsOf(360), baby = dimsOf(0), woman = dimsOf(360, 1);
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-12, `${what}: ${a} against ${b}`);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  // the newborn (child weight 1): every factor of rig.AGE_FACTORS, the hand's length kept (the palm takes the rest)
  assert.equal(baby.factors.childWeight, 1); assert.equal(dimsOf(168).factors.childWeight, 0);
  const share = 1 - P.knuckleY.middle, palmScale = (fl) => L / (P.knuckleY.middle + share * fl), k = palmScale(A.fingerLength) / palmScale(1);
  near(baby.W / adult.W, A.palmWidth, 'palm width');
  near(baby.Tk / adult.Tk, A.palmThickness, 'palm thickness');
  for (const f of rig.FINGERS) near(baby.fingers[f].ht / adult.fingers[f].ht, A.fingerThickness, `${f} thickness (its depth: a width may be limited by the gaps)`);
  near(sum(baby.fingers.middle.len) / sum(adult.fingers.middle.len), A.fingerLength * k, 'middle finger length');
  near(baby.thumb.len[0] / adult.thumb.len[0], A.thumbLength * k, 'thumb metacarpal');
  near(baby.tipLength, L, 'the newborn\'s middle fingertip at the hand length'); near(adult.tipLength, L, 'the adult\'s');
  // the female preset at full weight: rig.SEX_FACTORS
  near(woman.W / adult.W, S.palmWidth, 'female palm width');
  for (const f of rig.FINGERS) near(woman.fingers[f].ht / adult.fingers[f].ht, S.fingerThickness, `female ${f} thickness`);
  assert.match(baby.notes.join(' '), /age 0 months: child factors at weight 1\.00/);
  assert.match(woman.notes.join(' '), /female preset weight 1\.00/);
  assert.deepEqual(adult.notes, []);
  // on the mesh: the knuckles' span across the palm is the palm width's (index to little finger: three spacings)
  const span = (h) => { const x = (n) => h.bones.find((b) => b.name === n + '_R').head[0]; return x('Index_01') - x('Pinky_01'); };
  const at = (months, fem = 0) => build({ pose: 'HP01', level: 0, mode: 'articulated', body: { length: L, ring, months, fem, fat: 0 } });
  near(span(at(0)) / span(at(360)), A.palmWidth, 'the newborn\'s knuckles');
  near(span(at(360, 1)) / span(at(360)), S.palmWidth, 'the woman\'s knuckles');
  // through the generator: a newborn's hand says so
  assert.match(make(presetDNA({ sex: 'female', age_months: 0 })).hands.right.diagnostics.join(' '), /child factors at weight 1\.00/);
});

// the joints of a built hand against rig.LIMITS, [] when every one is within
function pastLimits(A) {
  const L = rig.LIMITS, out = [];
  const check = (name, v, [lo, hi]) => { if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) out.push(`${name} ${v} outside ${lo}..${hi}`); };
  for (const f of rig.FINGERS) {
    const a = A.fingers[f];
    check(`${f}.mcp`, a.mcp_flex_deg, L.mcp); check(`${f}.pip`, a.pip_flex_deg, L.pip); check(`${f}.dip`, a.dip_flex_deg, L.dip);
    check(`${f}.spread`, a.spread_deg, L.spread[f]); check(`${f}.twist`, a.twist_deg, L.twist);
  }
  const t = A.thumb, T = L.thumb;
  check('thumb.cmc', t.cmc_flex_deg, T.cmc); check('thumb.mcp', t.mcp_flex_deg, T.mcp); check('thumb.ip', t.ip_flex_deg, T.ip);
  check('thumb.opposition', t.opposition_deg, T.opposition); check('thumb.abduction', t.abduction_deg, T.abduction); check('thumb.twist', t.twist_deg, T.twist);
  return out;
}
const GRIP_POSES = POSES.filter((id) => ['cradle', 'cylinder', 'handle', 'hook', 'plane', 'box', 'sphere', 'thin_plane'].includes(getPose(id).contact.type));

test('every solved joint is within its limit: the sweep, and strong grips on small, large, round and flat objects', (t) => {
  let n = 0;
  for (const it of sweep()) { assert.deepEqual(pastLimits(it.hands['0 A|right'].angles), [], `${it.bodyName} ${it.pose} (control set ${it.controlSet})`); n++; }
  // a grip curls the fingers by a factor of the pose's own curl: the factor stops at the joint limits
  const grips = [{ grip_radius_m: 0.006, grip_strength: 1 }, { grip_radius_m: 0.06, grip_strength: 0 }, { object: { shape: 'sphere', orientation_deg: 45 }, grip_strength: 1 }];
  for (const pose of GRIP_POSES) for (const g of grips) {
    const h = build({ pose, body: REF_CORNER, level: 2, grip: { ...G0, ...g } }); n++;
    assert.deepEqual(pastLimits(h.angles), [], `${pose} ${JSON.stringify(g)}`);
  }
  t.diagnostic(`${n} hands: every finger and thumb joint within rig.LIMITS; grip poses ${GRIP_POSES.join(', ')}`);
});

test('folded fingers close until the fingertip rests on the palm, and say so (hand-folded)', (t) => {
  const folded = { HP04: ['index', 'middle', 'ring', 'pinky'], HP14: ['index', 'middle', 'ring', 'pinky'], HP07: ['ring', 'pinky'], HP22: ['middle', 'ring'], HP23: ['pinky'] };
  const rows = BODIES().map((B) => ({ name: B.name, listed: 0, closed: 0, opened: [], off: 0 }));
  let worst = 0, at = '';
  for (const [pose, fingers] of Object.entries(folded)) for (const [i, B] of BODIES().entries()) {
    const h = build({ pose, body: B.body, level: 0, mode: 'articulated' }), s = h.dims.length / rig.REF_LENGTH;
    const said = (rule) => h.corrections.filter((k) => k.rule === rule).map((k) => k.path), closed = said('hand-folded'), opened = said('hand-palm-clearance');
    // the list is the reference body's. On another body a finger of it may pass through the palm at its authored fold
    // (a newborn's little finger): the solver does not close that one, it opens it clear of the palm, and says so
    // (hand-palm-clearance)
    if (B.body === REF_CORNER) assert.deepEqual(closed, fingers.map((f) => `fingers.${f}`), `${B.name} ${pose}`);
    else for (const p of closed) assert.ok(fingers.some((f) => p === `fingers.${f}`), `${B.name} ${pose}: ${p} is said folded, and is not one of the pose's folded fingers`);
    const sh = shells(h), palm = sh.find((x) => x.name === 'Hand');
    for (const f of fingers) {
      const tip = sh.find((x) => x.name === `${f[0].toUpperCase()}${f.slice(1)}_03`);
      const gap = Math.min(...tip.V.map((v) => meshDist(v, palm.V, palm.T))) / s;
      rows[i].listed++;
      if (!closed.includes(`fingers.${f}`)) {
        assert.ok(opened.includes(`fingers.${f}`), `${B.name} ${pose} ${f}: neither closed onto the palm (hand-folded) nor opened clear of it (hand-palm-clearance) is said`);
        rows[i].opened.push(`${pose} ${f}`); rows[i].off = Math.max(rows[i].off, gap);
        continue;
      }
      rows[i].closed++;
      if (gap > worst) { worst = gap; at = `${B.name} ${pose} ${f}`; }
      assert.ok(gap <= 1.5 * MM, `${B.name} ${pose} ${f}: the fingertip ${(gap / MM).toFixed(2)} mm off the palm (reference hand)`);
    }
  }
  // which of the listed fingers are opened instead of closed is pinned, and how far that leaves them: the newborn's
  // little finger only, in its four poses of the list. A shortfall as it is today, not a rule: another finger or
  // another body there, or that finger left further from the palm, fails
  assert.deepEqual(rows.filter((r) => r.opened.length).map((r) => [r.name, r.opened]), [['newborn', ['HP04 pinky', 'HP14 pinky', 'HP07 pinky', 'HP23 pinky']]], 'the listed fingers opened clear of the palm instead of closed onto it: the newborn\'s little finger only');
  const off = Math.max(...rows.map((r) => r.off));
  assert.ok(off <= 16 * MM, `a listed finger opened instead of closed is left ${(off / MM).toFixed(2)} mm off the palm (reference hand); bound 16 mm`);
  t.diagnostic(`hand-folded said for the fingers listed: ${rows.map((r) => `${r.name} ${r.closed} of ${r.listed}${r.opened.length ? ` (opened clear of the palm instead, hand-palm-clearance: ${r.opened.join(', ')}; their tips up to ${(r.off / MM).toFixed(2)} mm off it on the reference hand; bound 16 mm, a regression bound on this shortfall)` : ''}`).join('; ')}`);
  t.diagnostic(`folded fingertips: the farthest ${(worst / MM).toFixed(2)} mm from the palm on the reference hand (${at}); bound 1.5 mm (a regression bound: measured on the sweep's four bodies)`);
});

test('a pose\'s own grip radius scales with the hand; a radius given is absolute', () => {
  for (const B of BODIES()) for (const pose of ['HP06', 'HP09', 'HP20']) {
    const own = getPose(pose).contact.radius_m, h = build({ pose, body: B.body, level: 2 });
    assert.ok(Math.abs(h.contact.radius - own * h.dims.length / rig.REF_LENGTH) < 1e-12, `${B.name} ${pose}: ${h.contact.radius} for ${own} on the reference hand`);
    assert.equal(build({ pose, body: B.body, level: 2, grip: { ...G0, grip_radius_m: 0.02 } }).contact.radius, 0.02);
  }
});

test('the finger controls move their finger only: curl, spread and twist on the bones, the other fingers left where they were', (t) => {
  const body = REF_CORNER, pose = 'HP01', base = build({ pose, body, level: 0, mode: 'articulated' }), P0 = H.posed(base);
  const moved = (h) => { const P = H.posed(h), out = {}; for (const pc of h.pieces) { let m = 0; for (let v = pc.firstVertex; v < pc.firstVertex + pc.vertices; v++) m = Math.max(m, len(sub(V3(P, v), V3(P0, v)))); out[pc.name] = m; } return out; };
  const rows = [];
  // the middle finger is spread toward the ring finger twice: 1 reaches it (the solver parts the two), 0.25 does not
  for (const [f, c] of [['ring', { twist: -1 }], ['pinky', { twist: 1 }], ['middle', { spread: 1 }], ['middle', { spread: 0.25 }], ['index', { spread: -0.5 }], ['index', { curl: 1 }]]) {
    const h = build({ pose, body, level: 0, mode: 'articulated', controls: { fingers: { [f]: c } } }), m = moved(h);
    const own = Object.keys(m).filter((n) => n.toLowerCase().startsWith(f));
    // the solver may move a neighbour clear, and says so (hand-finger-spread, on a path that names both fingers:
    // fingers.middle+ring; hand-collision-margin): only those
    const said = new Set(h.corrections.filter((k) => k.rule !== 'hand-control').flatMap((k) => (k.path.startsWith('fingers.') ? k.path.split('.')[1].split('+') : [k.path.split('.')[0]])));
    for (const o of own) assert.ok(m[o] > 0.2 * MM, `${f} ${JSON.stringify(c)}: ${o} moved ${(m[o] / MM).toFixed(2)} mm`);
    assert.ok(Math.max(...own.map((o) => m[o])) > 1 * MM, `${f} ${JSON.stringify(c)} moves its finger`);
    for (const [n, d] of Object.entries(m)) {
      if (own.includes(n)) continue;
      const digit = n.split('_')[0].toLowerCase();
      if (said.has(digit)) continue;
      assert.ok(d < 1e-9, `${f} ${JSON.stringify(c)} moved ${n} by ${(d / MM).toFixed(3)} mm`);
    }
    // a neighbour the solver moved clear moved as the solver says, and no more: hand-finger-spread names the two
    // neighbouring fingers it parted and opens the spread of each by half of `used` (the degrees in all), the first
    // toward the index finger, the second toward the little finger; no other angle of theirs changes
    for (const k of h.corrections.filter((x) => x.rule === 'hand-finger-spread')) {
      const pair = k.path.split('.')[1].split('+'), i = rig.FINGERS.indexOf(pair[0]);
      assert.ok(pair.length === 2 && i >= 0 && pair[1] === rig.FINGERS[i + 1], `${f} ${JSON.stringify(c)}: hand-finger-spread on ${k.path} does not name two neighbouring fingers`);
      for (const [j, x] of pair.entries()) {
        if (x === f) continue;
        const a1 = h.angles.fingers[x], a0 = base.angles.fingers[x], turn = a1.spread_deg - a0.spread_deg;
        assert.deepEqual({ ...a1, spread_deg: a0.spread_deg }, a0, `${f} ${JSON.stringify(c)}: the solver says it opened the spread of ${x}, and another of its angles changed`);
        assert.ok(Math.abs(turn - (j ? 0.5 : -0.5) * k.used) < 1e-9, `${f} ${JSON.stringify(c)}: the spread of ${x} changed by ${turn} deg, the solver says it opened ${k.used} deg in all (${k.used / 2} a finger)`);
      }
    }
    const also = [...said].filter((x) => x !== f);
    rows.push(`${f} ${JSON.stringify(c)}: its tip ${(Math.max(...own.map((o) => m[o])) / MM).toFixed(1)} mm${also.length ? `, the solver also moved ${also.join(', ')} (said)` : ''}`);
  }
  t.diagnostic(rows.join('; '));
});

test('grip strength: 0 stands the fingers off the object, 1 presses them in, the pose\'s own curl between; each end said', (t) => {
  const curl = (h) => rig.FINGERS.reduce((s, f) => s + h.angles.fingers[f].mcp_flex_deg + h.angles.fingers[f].pip_flex_deg + h.angles.fingers[f].dip_flex_deg, 0);
  const rows = [];
  for (const pose of ['HP06', 'HP20', 'HP09']) {
    const hs = [0, 0.5, 1].map((g) => build({ pose, body: REF_CORNER, level: 2, grip: { ...G0, grip_strength: g } })), c = hs.map(curl);
    assert.ok(c[0] < c[1] && c[1] < c[2], `${pose}: ${c.map((x) => x.toFixed(1)).join(', ')}`);
    assert.deepEqual(hs[1].angles, build({ pose, body: REF_CORNER, level: 2 }).angles, `${pose}: 0.5 is the pose`);
    hs.forEach((h, i) => assert.equal(h.corrections.some((k) => k.rule === 'hand-grip' && k.path === 'grip_strength'), i !== 1, `${pose} at ${[0, 0.5, 1][i]}`));
    rows.push(`${pose} ${c.map((x) => x.toFixed(0)).join(' < ')} deg of curl`);
  }
  t.diagnostic(rows.join('; '));
});

test('a plane under every pose: each builds, finite and clear, and a grip strength on a plane is said to be ignored', () => {
  const kept = [], plane = { ...G0, object: { shape: 'plane', orientation_deg: null } };
  const on = (pose, grip) => build({ pose, body: REF_CORNER, level: 0, mode: 'preset', grip });
  for (const pose of POSES) {
    const h = on(pose, { ...plane, grip_strength: 1 });
    assert.ok(h.positions.every(Number.isFinite), pose);
    assert.ok(!h.corrections.some((k) => k.rule === 'hand-collision'), `${pose}: ${JSON.stringify(h.corrections.filter((k) => k.rule === 'hand-collision'))}`);
    if (!GRIP_POSES.includes(pose)) continue;
    const says = (rule, path) => h.corrections.some((k) => k.rule === rule && k.path === path);
    // a grip that keeps its own object (the hook's bar): the plane is what is said to be ignored, and the grip
    // strength applies to the object kept
    if (h.contact && h.contact.shape !== 'plane') {
      kept.push(pose);
      assert.ok(says('hand-grip-ignored', 'object.shape'), `${pose}: holds a ${h.contact.shape}, and the plane is not said to be ignored`);
      assert.ok(says('hand-grip', 'grip_strength') && !says('hand-grip-ignored', 'grip_strength'), `${pose}: grip strength on its ${h.contact.shape}`);
    } else {
      // said to be ignored, and ignored: it is not said to be applied as well, and the hand is the one the plane gives
      // with no grip strength
      assert.ok(says('hand-grip-ignored', 'grip_strength'), `${pose}: grip strength on a plane`);
      assert.ok(!says('hand-grip', 'grip_strength'), `${pose}: grip strength on a plane said to be ignored, and said to be applied`);
      assert.deepEqual(h.angles, on(pose, plane).angles, `${pose}: the grip strength said to be ignored changes the hand`);
    }
  }
  assert.deepEqual(kept, ['HP15'], 'the hook, and no other grip, keeps its own object');
});

test('every start cap of a digit piece, at the fit\'s own scale, stays inside its parent: 24 poses, four bodies, the controls at their ends', (t) => {
  const a = mesh0.SHAPE.startScale;
  let n = 0, worst = Infinity, at = '';
  for (const it of sweep()) {
    const h = it.hands['0 A|right'], sh = shells(h).filter((x) => x.name !== 'Connector'), byBone = Object.fromEntries(sh.map((x) => [x.bone, x]));
    for (let i = 1; i < h.bones.length; i++) {
      const child = byBone[h.bones[i].name], parent = byBone[h.bones[h.bones[i].parentIndex].name];
      const cap = child.V.slice(0, 4), c = [0, 1, 2].map((k) => cap.reduce((s, v) => s + v[k], 0) / 4);
      for (const v of cap) {
        const w = winding(lerp(c, v, a), parent.V, parent.T); n++;
        if (w < worst) { worst = w; at = `${it.bodyName} ${it.pose} ${child.name} in ${parent.name}`; }
        assert.ok(w > 0.5, `${it.bodyName} ${it.pose}${it.controlSet !== null ? ` (control set ${it.controlSet})` : ''}: ${child.name}'s start cap outside ${parent.name}`);
      }
    }
  }
  t.diagnostic(`${n} corners of start caps (x${a}) inside their parents; the lowest winding number ${worst.toFixed(3)} (${at})`);
});

// the contacts whose error is a distance between a point on the thumb's distal piece and a point on another piece:
// the separation of the two pieces (the separating-axis test's, a lower bound of their distance) is at most the error
const TIP_CONTACTS = { thumb_index_tips: 'Index_03', thumb_ring: 'Ring_02', thumb_pinky: 'Pinky_02' };
// What a contact is missed by, as hands/rig.js solveThumb takes it, and where a hand's diagnostics give it. The eight
// contacts of hands/rig.js contactSpec (the six of the thumb on the hand itself, the tripod, the card): their contact
// error. A grip with the thumb on an object (hands/rig.js objectSpec): the thumb pad's distance to the object's
// surface, "pad X mm from the surface"; there the contact error also counts the distance to a target on that surface,
// and is not what is said to be missed. The other contacts (none, cradle, hook, plane) give the thumb nothing to touch
const MISSED_BY = {
  error: ['thumb_index_tips', 'thumb_ring', 'thumb_middle_ring', 'thumb_pinky', 'thumb_over_fingers', 'thumb_palm', 'tripod', 'thin_plane'],
  pad: ['cylinder', 'handle', 'sphere', 'box'],
};
test('a contact the mesh cannot meet is said: within the tolerance, or a hand-contact-missed correction that names it', (t) => {
  const rows = [], seen = Object.fromEntries(Object.values(MISSED_BY).flat().map((c) => [c, 0])), beyond = { error: 0, pad: 0 };
  let checked = 0;
  for (const it of sweep()) {
    if (it.controlSet !== null) continue;
    const h = it.hands['0 A|right'], s = h.dims.length / rig.REF_LENGTH, tol = rig.CONTACT_TOLERANCE * s, type = getPose(it.pose).contact.type;
    const missed = h.corrections.filter((k) => k.rule === 'hand-contact-missed'), where = `${it.bodyName} ${it.pose}`;
    for (const k of missed) { assert.equal(k.path, 'thumb'); assert.ok(k.used > tol && Math.abs(k.tolerance_m - tol) < 1e-12, JSON.stringify(k)); }
    // the miss as the diagnostics give it (to a tenth of a millimetre): beyond the tolerance it is said, and a miss
    // that is said gives that distance
    const solved = h.diagnostics.find((x) => x.startsWith(`thumb solved for ${type}: `)), kind = Object.keys(MISSED_BY).find((k) => MISSED_BY[k].includes(type));
    if (kind) {
      const given = solved?.match(kind === 'error' ? /contact error ([\d.]+) mm/ : /pad (-?[\d.]+) mm from the surface/);
      assert.ok(given, `${where}: the diagnostics give no ${kind === 'error' ? 'contact error' : 'distance from the thumb pad to the object'}`); seen[type]++;
      const miss = Math.abs(Number(given[1])) * MM, what = kind === 'error' ? `a contact error of ${given[1]} mm` : `the thumb pad ${given[1]} mm from the object`;
      if (miss > tol + 0.05 * MM) { beyond[kind]++; assert.ok(missed.length, `${where}: ${what}, not said`); }
      if (missed.length) assert.ok(Math.abs(missed[0].used - miss) <= 0.051 * MM, `${where}: ${what}, said as ${(missed[0].used / MM).toFixed(2)} mm`);
    } else {
      assert.ok(!solved, `${where}: the thumb is solved for the contact ${type}, and this test does not say what its miss is`);
      assert.equal(missed.length, 0, `${where}: a miss is said, and the contact ${type} gives the thumb nothing to touch`);
    }
    if (TIP_CONTACTS[type]) {
      const sh = shells(h), hull = (n) => { const x = sh.find((p) => p.name === n); return rig.convex(x.V, x.T); };
      const gap = -rig.satDepth(hull('Thumb_03'), hull(TIP_CONTACTS[type])); checked++;
      if (gap > tol) assert.ok(missed.length && missed[0].used >= gap - 1e-9, `${it.bodyName} ${it.pose}: the thumb ${(gap / MM).toFixed(1)} mm from ${TIP_CONTACTS[type]}, ${missed.length ? `said ${(missed[0].used / MM).toFixed(1)} mm` : 'not said'}`);
    }
    if (missed.length) rows.push(`${it.bodyName} ${it.pose} ${(missed[0].used / s / MM).toFixed(1)} mm`);
  }
  for (const [c, n] of Object.entries(seen)) assert.ok(n > 0, `no pose of the sweep has the contact ${c}`);
  const hands = (k) => MISSED_BY[k].reduce((a, c) => a + seen[c], 0), types = (k) => MISSED_BY[k].map((c) => `${c} ${seen[c]}`).join(', ');
  t.diagnostic(`the thumb's miss compared with the tolerance on ${hands('error') + hands('pad')} hands: the contact error on ${hands('error')} (${types('error')}), ${beyond.error} beyond it; the thumb pad's distance to the object held on ${hands('pad')} (${types('pad')}), ${beyond.pad} beyond it; each one beyond it is said, and every miss said gives that distance`);
  t.diagnostic(`${checked} tip contacts checked against their pieces' separation; missed (on the reference hand's scale): ${rows.join(', ') || 'none'}`);
});

test('the drawn shells of levels 1 and 2 are checked against each other: a shell moved into its neighbour is found', () => {
  for (const [level, variant, palm, moving, into] of [[1, 'readable', 'L1_Palm', 'L1_Index', 'L1_Middle'], [1, 'budget', 'L1_Palm', 'L1_Ring', 'L1_Middle'], [2, null, 'L2_Main', 'L2_Thumb', 'L2_Main']]) {
    const h = build({ pose: 'HP01', body: REF_CORNER, level, variant }), s = h.dims.length / rig.REF_LENGTH;
    const deep = (P) => SHELLS.overlaps(P, h.index, h.pieces, { palm }).filter((o) => o.depth > 0.0003 * s);
    assert.deepEqual(deep(h.positions), [], `level ${level} ${variant}: HP01 as built`);
    // every vertex but the base ring moved along the line that takes the shell's far end (its last vertex) onto the
    // neighbour's centre. The whole move leaves the far end at that centre, inside the neighbour: found. Half way to
    // where the far end goes into the neighbour (half way into the gap) nothing is reported. (Not the distance between
    // the two centres: a shell that is a tetrahedron moves only its far end, which then stops outside the neighbour.)
    const centre = (name) => { const pc = h.pieces.find((p) => p.name === name), c = [0, 0, 0]; for (let v = pc.firstVertex; v < pc.firstVertex + pc.vertices; v++) for (let k = 0; k < 3; k++) c[k] += h.positions[3 * v + k] / pc.vertices; return c; };
    const pc = h.pieces.find((p) => p.name === moving), far = V3(h.positions, pc.firstVertex + pc.vertices - 1), whole = sub(centre(into), far);
    const movedBy = (f) => { const P = h.positions.slice(); for (let v = pc.firstVertex + 3; v < pc.firstVertex + pc.vertices; v++) for (let k = 0; k < 3; k++) P[3 * v + k] += f * whole[k]; return P; };
    const N = shells(h, h.positions).find((x) => x.name === into), farIn = (f) => winding(add(far, scl(whole, f)), N.V, N.T) > 0.5;
    assert.ok(meshSd(centre(into), N.V, N.T) > 0.0003 * s, `level ${level} ${variant}: the centre of ${into} is inside it`);
    let enters = 0; while (enters < 100 && !farIn(enters / 100)) enters++;   // the hundredth of the move at which the far end is first inside
    assert.ok(enters > 0, `level ${level} ${variant}: the far end of ${moving} is outside ${into} as built`);
    assert.deepEqual(deep(movedBy(enters / 200)), [], `level ${level} ${variant}: ${moving} moved half way into the gap (${(enters / 200).toFixed(3)} of the way)`);
    const hit = deep(movedBy(1)), pair = (o) => [o.a, o.b].includes(moving) && [o.a, o.b].includes(into);
    assert.ok(hit.some(pair), `level ${level} ${variant}: ${moving} moved into ${into}, found ${JSON.stringify(hit)}`);
    // pushed on through, the far end out again on the other side, no vertex is inside: found by the samples along the
    // edges. On 'budget' alone: the tube of 'readable' is clear of its neighbour again, and level 2's thumb only leaves
    // the volume it is rooted in (against that one only a re-entry counts).
    if (variant === 'budget') {
      let leaves = 100; while (leaves < 300 && farIn(leaves / 100)) leaves++;
      const Q = movedBy(leaves / 100), M = shells(h, Q).find((x) => x.name === moving), through = deep(Q);
      assert.ok(M.V.every((p) => winding(p, N.V, N.T) < 0.5) && N.V.every((p) => winding(p, M.V, M.T) < 0.5), `level ${level} ${variant}: ${moving} pushed through ${into} (${leaves / 100} of the way), a vertex of one is inside the other`);
      assert.ok(through.some(pair), `level ${level} ${variant}: ${moving} pushed through ${into} (${leaves / 100} of the way), found ${JSON.stringify(through)}`);
    }
  }
});

test('finger bones on the character: each one\'s axes are in the body\'s frame, and turning about its flexion axis curls the finger toward the palm', () => {
  const c = make(WOMAN, { hands: { mode: 'articulated', ...both('HP01') } }), P = posedPositions(c);
  for (const [s, side] of [['L', 'left'], ['R', 'right']]) {
    const palm = c.hands[side].wrist.axes.palm;
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (const k of ['01', '02']) {
      const name = `${f}_${k}_${s}`, b = c.bones.find((x) => x.name === name);
      for (const ax of ['flexion', 'twist', 'spread']) assert.ok(Math.abs(len(b.axes[ax]) - 1) < 1e-9, `${name}.axes.${ax}`);
      assert.ok(Math.abs(dot(b.axes.flexion, b.axes.twist)) < 1e-9 && Math.abs(dot(b.axes.twist, b.axes.spread)) < 1e-9, `${name}: orthogonal axes`);
      const turned = posedPositions(c, { [name]: qaxis(b.axes.flexion, 20) });
      const tip = c.pieces.find((p) => p.name === `Hand_${f}_03_${s}`);
      let toward = 0; for (let v = tip.v0; v < tip.v1; v++) toward += dot(sub(V3(turned, v), V3(P, v)), palm) / (tip.v1 - tip.v0);
      assert.ok(toward > 1 * MM, `${name}: +20 deg about its flexion axis moves the fingertip ${(toward / MM).toFixed(2)} mm toward the palm`);
    }
  }
});

test('hand level 4: what is given for a hand that is not built is said, the block\'s own fields once, a side\'s with its side', () => {
  const c = make(WOMAN, { hands: { level: 4, size: 0.7, finger_length: 0.4, left: { pose: 'HP06', grip_radius_m: 0.02 }, right: { pose: 'HP01', thumb: { flexion: 1 } } } });
  assert.deepEqual(c.corrections.filter((k) => k.rule === 'hand-control-ignored').map((k) => k.channel), ['hands.size', 'hands.finger_length', 'hands.left.grip_radius_m', 'hands.right.thumb']);
  assert.ok(c.solved);
  assert.deepEqual(make(WOMAN, { hands: { level: 4, ...both('HP01') } }).corrections.filter((k) => k.rule.startsWith('hand-')), []);
});

test('the library\'s fit: hands/fit.js is what tools/fit_hand_poses.mjs writes for these poses on this mesh', (t) => {
  for (const id of POSES) assert.equal(POSE_FIT[id]?.source, rig.poseHash(getPose(id)), `${id}: the pose changed since the fit (run node tools/fit_hand_poses.mjs)`);
  const start = process.hrtime.bigint(), diff = fitDifference(fitLibrary(), POSE_FIT), sec = Number(process.hrtime.bigint() - start) / 1e9;
  t.diagnostic(`the 24 poses refitted at ${FIT_KNOTS.length} knots in ${sec.toFixed(1)} s: largest difference ${diff} (bound 1e-4)`);
  assert.ok(diff <= 1e-4, `hands/fit.js is out of date (largest difference ${diff}): run node tools/fit_hand_poses.mjs`);
});

// ---------------------------------------------------------------- the Hand DNA

test('the Hand DNA: the maintainer\'s three examples validate, and build through generate()', () => {
  for (const ex of EXAMPLES) {
    const v = H.validateHands(ex.hands);
    assert.deepEqual(v.errors, [], ex.id); assert.deepEqual(v.spec, ex.hands, `${ex.id}: nothing changed`);
    const c = make(WOMAN, { hands: ex.hands });
    assert.equal(c.hands.mode, ex.hands.mode); assert.equal(c.hands.level, ex.hands.mode === 'articulated' ? 0 : 1);
    assert.equal(c.hands.left.pose, ex.hands.left.pose); assert.equal(c.hands.right.pose, ex.hands.right.pose);
    assert.equal(c.bones.length, ex.hands.mode === 'articulated' ? 53 : 23);
    assert.ok(c.solved, `${ex.id}: ${JSON.stringify(c.corrections.filter((k) => !k.rule.startsWith('hand-')))}`);
    assert.equal(c.hands.given, true);
  }
});

test('the Hand DNA: HP25 and a negative radius are refused with their codes', () => {
  for (const n of NEGATIVE) {
    const spec = { left: { pose: 'HP01' }, right: n.block }, v = H.validateHands(spec);
    assert.equal(v.ok, false); assert.equal(v.spec, null);
    assert.deepEqual(v.errors.map((e) => [e.stage, e.code, e.path]), [['hands', n.code, n.path]]);
    const c = generate(WOMAN, { hands: spec });
    assert.equal(c.ok, false); assert.deepEqual(c.errors.map((e) => [e.stage, e.code, e.path]), [['hands', n.code, n.path]]);
    assert.ok(c.errors[0].message.length > 10);
  }
});

test('the Hand DNA: unknown keys, wrong types and out-of-range values are refused, nothing is repaired, the input is not touched', () => {
  const base = { left: { pose: 'HP01' }, right: { pose: 'HP01' } };
  const cases = [
    [{ ...base, colour: 'red' }, 'UNKNOWN_KEY', 'colour'],
    [{ ...base, right: { pose: 'HP01', curl: 1 } }, 'UNKNOWN_KEY', 'right.curl'],
    [{ ...base, right: { pose: 'HP01', fingers: { thumb: { curl: 1 } } } }, 'UNKNOWN_KEY', 'right.fingers.thumb'],
    [{ ...base, right: { pose: 'HP01', object: { shape: 'cylinder', size: 1 } } }, 'UNKNOWN_KEY', 'right.object.size'],
    [{ ...base, size: '0.5' }, 'TYPE', 'size'],
    [{ ...base, size: NaN }, 'TYPE', 'size'],
    [{ ...base, size: Infinity }, 'TYPE', 'size'],
    [{ ...base, level: 1.5 }, 'TYPE', 'level'],
    [{ ...base, right: { pose: 1 } }, 'TYPE', 'right.pose'],
    [{ ...base, right: 'HP01' }, 'TYPE', 'right'],
    [{ ...base, right: { pose: 'HP06', grip_radius_m: '2cm' } }, 'TYPE', 'right.grip_radius_m'],
    [{ ...base, right: { pose: 'HP01', fingers: { index: 1 } } }, 'TYPE', 'right.fingers.index'],
    [{ ...base, size: 1.2 }, 'RANGE', 'size'],
    [{ ...base, palm_width: -0.1 }, 'RANGE', 'palm_width'],
    [{ ...base, level: 5 }, 'RANGE', 'level'],
    [{ ...base, right: { pose: 'HP01', fingers: { index: { curl: 2 } } } }, 'RANGE', 'right.fingers.index.curl'],
    [{ ...base, right: { pose: 'HP01', thumb: { opposition: -1.5 } } }, 'RANGE', 'right.thumb.opposition'],
    [{ ...base, right: { pose: 'HP06', grip_radius_m: 0.6 } }, 'RANGE', 'right.grip_radius_m'],
    [{ ...base, right: { pose: 'HP06', grip_strength: 1.5 } }, 'RANGE', 'right.grip_strength'],
    [{ ...base, right: { pose: 'HP06', object: { orientation_deg: 120 } } }, 'RANGE', 'right.object.orientation_deg'],
    [{ ...base, mode: 'rigid' }, 'ENUM', 'mode'],
    [{ ...base, mirror: 'both' }, 'ENUM', 'mirror'],
    [{ ...base, dominant_hand: 'both' }, 'ENUM', 'dominant_hand'],
    [{ ...base, right: { pose: 'HP06', object: { shape: 'cone' } } }, 'ENUM', 'right.object.shape'],
    [{ right: { pose: 'HP01' } }, 'REQUIRED', 'left'],
    [{ ...base, right: {} }, 'REQUIRED', 'right.pose'],
    [{ ...base, mode: 'articulated', level: 2 }, 'MODE_LEVEL_MISMATCH', 'mode'],
    [{ ...base, mode: 'simplified', level: 1 }, 'MODE_LEVEL_MISMATCH', 'mode'],
    [[], 'TYPE', ''],
  ];
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  for (const [spec, code, path] of cases) {
    const before = JSON.stringify(spec); deepFreeze(spec);
    const v = H.validateHands(spec);
    assert.equal(v.ok, false, before); assert.equal(v.spec, null);
    assert.ok(v.errors.some((e) => e.stage === 'hands' && e.code === code && e.path === path), `${before}: ${JSON.stringify(v.errors)}`);
    const c = generate(WOMAN, { hands: spec });
    assert.equal(c.ok, false, before); assert.ok(c.errors.every((e) => e.stage === 'hands'), JSON.stringify(c.errors));
    assert.equal(JSON.stringify(spec), before, 'the input is not touched');
  }
  // a valid block comes back as given (the mirrored side copied, nothing else changed)
  const full = { mode: 'articulated', level: 0, size: 0.3, palm_width: 0.6, finger_length: 0.7, finger_thickness: 0.2, dominant_hand: 'left', mirror: 'none',
    left: { pose: 'HP06', grip_radius_m: 0.018, object: { shape: 'cylinder', orientation_deg: -10 }, grip_strength: 0.7, fingers: { index: { curl: 0.2, spread: -0.3, twist: 0.1, length: 0.4, thickness: 0.6 } }, thumb: { flexion: 0.1, abduction: -0.2, opposition: 0.3 } },
    right: { pose: 'HP10' } };
  assert.deepEqual(H.validateHands(full).spec, full);
  const mirrored = H.validateHands({ mirror: 'right_to_left', right: { pose: 'HP10', fingers: { index: { curl: 0.4 } } } });
  assert.deepEqual(mirrored.spec.left, { pose: 'HP10', fingers: { index: { curl: 0.4 } } });
});

test('generate() options: every error is explicit, with its stage; what is checked is what is built', () => {
  const codeOf = (r) => r.errors.map((e) => `${e.stage} ${e.code} ${e.path}`);
  assert.deepEqual(codeOf(generate(WOMAN, { hand: both('HP01') })), ['generator UNKNOWN_KEY options.hand']);
  assert.deepEqual(codeOf(generate(WOMAN, 'HP01')), ['generator TYPE options']);
  assert.deepEqual(codeOf(generate(WOMAN, { hands: 'HP01' })), ['hands TYPE ']);
  assert.deepEqual(codeOf(generate(WOMAN, { handVariant: 'nope' })), ['hands ENUM handVariant']);
  assert.deepEqual(codeOf(generate(WOMAN, { hands: { level: 2, ...both('HP01') }, handVariant: 'readable' })), ['hands ENUM handVariant']);
  assert.deepEqual(codeOf(generate(WOMAN, { hands: { level: 0, ...both('HP01') }, handVariant: 'budget' })), ['hands ENUM handVariant']);
  // a block that answers differently each time it is read: it is read once, and that is what is built
  let reads = 0;
  const tricky = { left: { pose: 'HP01' }, right: { get pose() { reads++; return reads === 1 ? 'HP10' : 'HP25'; } } };
  const c = generate(WOMAN, { hands: tricky });
  assert.ok(c.ok); assert.equal(c.hands.right.pose, 'HP10'); assert.equal(reads, 1);
});

// ---------------------------------------------------------------- the integration

const LEVEL_OPTIONS = [
  ['1', {}], ['1:budget', { handVariant: 'budget' }], ['1:readable', { handVariant: 'readable' }],
  ['0', { hands: { mode: 'articulated', level: 0, ...both('HP04') } }], ['0', { hands: { mode: 'preset', level: 0, ...both('HP04') } }],
  ['2', { hands: { level: 2, ...both('HP04') } }], ['3', { hands: { level: 3, ...both('HP04') } }], ['4', { hands: { level: 4, ...both('HP04') } }],
];
const handTriangles = (c, s) => c.pieces.filter((p) => p.name.startsWith('Hand_') && p.name.endsWith('_' + s)).reduce((n, p) => n + p.t1 - p.t0, 0);

test('the character\'s triangles are the body\'s plus the hands\', at every level and variant', (t) => {
  assert.equal(gen.TRIANGLES[1], gen.CHARACTER_TRIANGLES['1']); assert.equal(gen.TRIANGLES[1], 472);
  assert.equal(gen.BODY_TRIANGLES, 392);
  const rows = [];
  for (const [key, options] of LEVEL_OPTIONS) {
    const c = make(WOMAN, options), hand = gen.HAND_TRIANGLES[key];
    assert.equal(c.measures.triangles, gen.CHARACTER_TRIANGLES[key], key);
    assert.equal(c.index.length / 3, c.measures.triangles);
    for (const s of ['L', 'R']) assert.equal(handTriangles(c, s), hand, `${key} ${s}`);
    assert.deepEqual(c.measures.hand_triangles, { left: hand, right: hand });
    // the body is the same 392 triangles, plus the forearms' end caps when there is no hand
    assert.equal(c.measures.triangles - 2 * hand, gen.BODY_TRIANGLES + (hand ? 0 : 8), key);
    rows.push(`${key}: ${c.measures.triangles}`);
  }
  t.diagnostic(`character triangles by hand level: ${rows.join(', ')}`);
});

const ringDeviation = (c) => {
  let m = 0;
  for (const side of ['left', 'right']) { const w = c.hands[side].wrist; for (let k = 0; k < 6; k++) m = Math.max(m, len(sub(w.forearm_ring[k], w.hand_ring[k]))); }
  return m;
};
const ringCentre = (r) => scl(r.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / 6);
test('the hands meet the forearms on the 52 cases, newborn to 100 (level 1), and on a quarter of them at level 0', (t) => {
  let worst = 0, worstCentre = 0;
  const check = (c, what) => {
    worst = Math.max(worst, ringDeviation(c));
    for (const side of ['left', 'right']) {
      const w = c.hands[side].wrist;
      worstCentre = Math.max(worstCentre, len(sub(ringCentre(w.forearm_ring), w.pivot)));
      assert.deepEqual(c.bones.find((b) => b.name === w.bone).rest, [0, 0, 0, 1], `${what}: the hand bone turns with its forearm`);
      assert.deepEqual(c.hands[side].body.ring, { w: c.hands[side].body.ring.w, f: c.hands[side].body.ring.f, b: c.hands[side].body.ring.f }, 'the forearm\'s ring has b = f');
    }
    assert.ok(c.solved, `${what}: ${JSON.stringify(c.corrections.filter((k) => !k.rule.startsWith('hand-')))}`);
  };
  for (const d of CASES) check(make(d), d.id);
  for (const d of CASES.filter((_, i) => i % 4 === 0)) check(make(d, { hands: { mode: 'preset', level: 0, ...both('HP01') } }), `${d.id} level 0`);
  // a posed arm carries both rings together
  const c = make(WOMAN), P = posedPositions(c, { UpperArm_L: qaxis([0, 0, 1], -30), LowerArm_L: qaxis([1, 0, 0], 70), UpperArm_R: qaxis([1, 0, 0], 40) });
  for (const s of ['L', 'R']) {
    const fore = c.pieces.find((p) => p.name === 'Forearm_' + s), palm = c.pieces.find((p) => p.name === 'Hand_' + s);
    for (let k = 0; k < 6; k++) worst = Math.max(worst, len(sub(V3(P, fore.v1 - 6 + k), V3(P, palm.v0 + k))));
  }
  t.diagnostic(`the hand's base against the forearm's end: worst ${worst.toExponential(2)} m (float32 positions); the ring's centre against the pivot: ${worstCentre.toExponential(2)} m`);
  assert.ok(worst < 1e-6, `${worst} m`); assert.ok(worstCentre < 1e-6, `${worstCentre} m`);
});

test('the wrist on the character: the pivot does not move with the pose or the level, and the connector closes the joint through the wrist interface', (t) => {
  const pivots = new Set();
  for (const [, options] of LEVEL_OPTIONS) for (const pose of ['HP01', 'HP10']) {
    const o = options.hands ? { ...options, hands: { ...options.hands, ...both(pose) } } : { ...options, hands: both(pose) };
    const c = make(WOMAN, o);
    pivots.add(JSON.stringify([c.hands.left.wrist.pivot, c.hands.right.wrist.pivot].map((p) => p.map((x) => x.toFixed(9)))));
    const ax = c.hands.left.wrist.axes;   // the left hand (at +x): fingers down, palm toward the thigh (-x), thumb forward (+z)
    assert.ok(len(sub(ax.fingers, [0, -1, 0])) < 1e-9 && len(sub(ax.palm, [-1, 0, 0])) < 1e-9 && len(sub(ax.thumb, [0, 0, 1])) < 1e-9, JSON.stringify(ax));
  }
  assert.equal(pivots.size, 1, [...pivots].join('\n'));
  const gaps = {};
  for (const [name, options] of [['level 0', { hands: { mode: 'preset', level: 0, ...both('HP01') } }], ['level 1 readable', { hands: both('HP01'), handVariant: 'readable' }], ['level 1 budget', { hands: both('HP01') }]]) {
    const c = make(WOMAN, options), g = characterWristGap(c);
    gaps[name] = g.gap / c.hands.left.body.length;
    t.diagnostic(`${name} on the adult woman: largest gap at the wrist ${(g.gap / MM).toFixed(2)} mm (${gaps[name].toFixed(4)} L)${g.at ? ` at ${JSON.stringify(g.at)}` : ''}, flexion -70..70 and deviation -20..30 in 10 degree steps`);
  }
  assert.ok(gaps['level 0'] <= 1e-6, `level 0: ${gaps['level 0']} L`);
  assert.ok(gaps['level 1 readable'] <= L1_GAP.readable, `readable: ${gaps['level 1 readable']} L`);
  assert.ok(gaps['level 1 budget'] <= L1_GAP.budget, `budget: ${gaps['level 1 budget']} L`);
});

test('every pose builds at every level through generate(), finite and solved, with its colliders inside its pieces', (t) => {
  let n = 0, worstInside = Infinity;
  const check = (c, what) => {
    n++;
    assert.ok(c.positions.every(Number.isFinite), what);
    assert.ok(c.solved, `${what}: ${JSON.stringify(c.corrections.filter((k) => k.rule === 'overlap' || k.rule === 'hand-collision' || (k.rule.endsWith('-limit') && !k.rule.startsWith('hand-'))))}`);
    for (const s of ['L', 'R']) for (const sh of characterShells(c, s)) {
      const k = sh.piece.collider;
      assert.ok(k.r > 0, `${what} ${sh.name}`);
      for (let i = 0; i <= 8; i++) {
        const depth = meshSd(lerp(k.a, k.b, i / 8), sh.V, sh.T);
        worstInside = Math.min(worstInside, depth / k.r);
        assert.ok(depth >= k.r * (1 - 1e-6), `${what} ${sh.name}: the collider reaches out of its piece (${depth} < ${k.r})`);
      }
    }
  };
  for (const pose of POSES) {
    for (const variant of ['budget', 'readable']) check(make(LEAN_MAN, { hands: { level: 1, ...both(pose) }, handVariant: variant }), `${pose} level 1 ${variant}`);
    for (const level of [2, 3]) check(make(LEAN_MAN, { hands: { level, ...both(pose) } }), `${pose} level ${level}`);
    for (const mode of ['articulated', 'preset']) check(make(WOMAN, { hands: { mode, level: 0, ...both(pose) } }), `${pose} level 0 ${mode}`);
  }
  // bodies where a bent finger of level 1 'readable' has no point inside all its faces' planes: generate() failed
  // there (INTERNAL) until the colliders of such pieces were measured by their signed distance
  check(make(WOMAN, { hands: both('HP04'), handVariant: 'readable' }), 'adult woman HP04 level 1 readable');
  check(make(presetDNA({ sex: 'male', age_months: 1020 }), { hands: both('HP10'), handVariant: 'readable' }), 'elderly man HP10 level 1 readable');
  for (const pose of ['HP01', 'HP09']) { const c = make(WOMAN, { hands: { level: 4, ...both(pose) } }); n++; assert.equal(c.hands.left.triangles, 0); assert.equal(c.hands.left.pieces.length, 0); }
  t.diagnostic(`${n} characters; the colliders' axes lie at least ${worstInside.toFixed(2)} of their radius inside their pieces`);
});

// The hand's vertices against the thigh at their height: the hand lies outside (laterally) every thigh vertex within
// 2 cm of its height, and no collider of the hand meets the thigh's.
function thighClearance(c) {
  const P = posedPositions(c); let worst = Infinity;
  for (const s of ['L', 'R']) {
    const th = c.pieces.find((p) => p.name === 'Thigh_' + s), TV = [];
    for (let v = th.v0; v < th.v1; v++) TV.push(V3(P, v));
    for (const sh of characterShells(c, s, P)) for (const v of sh.V) {
      let m = -Infinity; for (const q of TV) if (Math.abs(q[1] - v[1]) < 0.02) m = Math.max(m, Math.abs(q[0]));
      if (m > -Infinity) worst = Math.min(worst, Math.abs(v[0]) - m);
    }
  }
  return worst;
}
test('no overlap with the thigh: 52 cases, the narrowest and the widest poses', (t) => {
  let worst = Infinity, at = '';
  for (const d of CASES) for (const [l, r] of [['HP01', 'HP01'], ['HP09', 'HP18']]) {
    const c = make(d, { hands: { left: { pose: l }, right: { pose: r } } });
    const hits = collisions(c).filter((x) => /^(Hand_|Thigh_)/.test(x.a) && /^(Hand_|Thigh_)/.test(x.b));
    assert.deepEqual(hits, [], d.id);
    const g = thighClearance(c);
    if (g < worst) { worst = g; at = `${d.id} ${l}/${r}`; }
    assert.ok(g > 0, `${d.id} ${l}/${r}: a hand reaches ${(-g / MM).toFixed(1)} mm into the thigh's width`);
  }
  t.diagnostic(`the smallest lateral clearance between a hand and its thigh: ${(worst / MM).toFixed(1)} mm (${at}); the arms' solver did not have to open the arms for a hand in these cases`);
});

test('the infant\'s recumbent pose works with the hands, at every level', () => {
  const NEWBORN = presetDNA({ sex: 'male', age_months: 0 });
  const runs = [...LEVEL_OPTIONS.map(([key, o]) => [NEWBORN, o, key]), [NEWBORN, { hands: { mode: 'articulated', level: 0, ...both('HP18') } }, '0 A HP18'],
    [NEWBORN, { hands: { left: { pose: 'HP04' }, right: { pose: 'HP18' } } }, '1 HP04/HP18'], ...CASES.filter((d) => d.age_months < 12).map((d) => [d, {}, d.id])];
  for (const [dna, options, what] of runs) {
    const c = make(dna, options);
    assert.ok(c.neutral_pose, what);
    const at = inspect(c, c.neutral_pose), P = posedPositions(c, c.neutral_pose);
    assert.ok(Math.abs(at.min[1]) < 0.5 * MM, `${what}: lies at ${at.min[1]}`); assert.equal(at.nonFinite, 0);
    assert.deepEqual(collisions(c, c.neutral_pose), [], `${what}: collisions in the neutral pose`);
    for (const s of ['L', 'R']) for (const sh of characterShells(c, s, P)) for (const v of sh.V) assert.ok(v[1] > -0.5 * MM, `${what}: ${sh.name} goes under the floor`);
    assert.ok(c.solved, what);
  }
});

test('mode A: 15 finger bones a hand on the body\'s 23, posed as the library poses them; modes B and C add no bone', () => {
  const c = make(WOMAN, { hands: { mode: 'articulated', left: { pose: 'HP12' }, right: { pose: 'HP06' } } });
  assert.equal(c.bones.length, 53);
  assert.deepEqual(c.bones.slice(0, 23).map((b) => [b.name, b.parent]), gen.BONES.map(([n, p]) => [n, p]));
  const byName = Object.fromEntries(c.bones.map((b) => [b.name, b]));
  for (const s of ['L', 'R']) {
    const own = c.bones.slice(23).filter((b) => b.name.endsWith('_' + s));
    assert.deepEqual(own.map((b) => b.name), H.BONE_NAMES.slice(1).map((n) => `${n}_${s}`));
    for (const b of own) { let p = b; while (p.parent && p.parent !== 'Hand_' + s) p = byName[p.parent]; assert.equal(p.parent, 'Hand_' + s, `${b.name} hangs from Hand_${s}`); }
  }
  // every vertex of a hand piece is bound to the piece's bone
  for (const p of c.pieces.filter((x) => x.name.startsWith('Hand_'))) for (let v = p.v0; v < p.v1; v++) assert.equal(c.bones[c.boneIndex[v]].name, p.bone, p.name);
  // posed in the body exactly as the library poses the hand, turned onto the hand bone
  const world = boneWorld(c), P = posedPositions(c);
  for (const [s, side, pose] of [['L', 'left', 'HP12'], ['R', 'right', 'HP06']]) {
    const lib = H.posed(build({ pose, side, mode: 'articulated', level: 0, body: c.hands[side].body }));
    const ax = c.hands[side].wrist.axes, X = s === 'L' ? scl(ax.thumb, -1) : ax.thumb, W = world['Hand_' + s];
    const rot = (q, v) => { const u = [q[0], q[1], q[2]], t2 = scl(cross(u, v), 2); return add(add(v, scl(t2, q[3])), cross(u, t2)); };
    let m = 0, i = 0;
    for (const p of c.pieces.filter((x) => x.name.startsWith('Hand_') && x.name.endsWith('_' + s))) for (let v = p.v0; v < p.v1; v++, i++) {
      const q = V3(lib, i), body = add(add(scl(X, q[0]), scl(ax.fingers, q[1])), scl(ax.palm, q[2]));
      m = Math.max(m, len(sub(add(W.p, rot(W.q, body)), V3(P, v))));
    }
    assert.ok(m < 1e-6, `${side}: ${m} m from the library's pose`);
    assert.deepEqual(c.hands[side].angles, build({ pose, side, mode: 'articulated', level: 0, body: c.hands[side].body }).angles);
  }
  // a finger bone moves its own segments only
  const moved = posedPositions(c, { Index_02_L: qaxis([1, 0, 0], 30) });
  for (const p of c.pieces) {
    let d = 0; for (let v = p.v0; v < p.v1; v++) d = Math.max(d, len(sub(V3(moved, v), V3(P, v))));
    if (['Hand_Index_02_L', 'Hand_Index_03_L'].includes(p.name)) assert.ok(d > 1 * MM, `${p.name} follows its bone`); else assert.ok(d < 1e-7, `${p.name} moved by ${d} m`);
  }
  for (const [key, options] of LEVEL_OPTIONS.filter(([, o]) => o.hands?.mode !== 'articulated')) {
    const b = make(WOMAN, options);
    assert.deepEqual(b.bones.map((x) => x.name), gen.BONES.map(([n]) => n), `${key}: the 23 bones of the mannequins`);
    assert.equal(b.hands.left.bones, b.hands.left.triangles ? 1 : 0);
  }
});

test('corrections: the hands\' join the body\'s with their side; a joint limit is not a failure, an overlap left is', () => {
  const c = make(TALL_LEAN_MAN);
  const thumb = c.corrections.filter((k) => k.rule === 'hand-thumb');
  assert.deepEqual(thumb.map((k) => k.channel), ['hands.left.thumb', 'hands.right.thumb']);
  for (const k of thumb) { assert.match(k.detail, /^hand (left|right) \(HP01\): /); assert.ok('asked' in k && 'used' in k); }
  assert.ok(c.solved);
  // where the library's fit holds on a body (the woman of the tests), its default hands need nothing
  assert.deepEqual(make(WOMAN).corrections.filter((k) => k.rule === 'hand-thumb'), []);
  assert.equal(gen.isSolved([{ rule: 'hand-joint-limit' }, { rule: 'hand-thumb' }, { rule: 'hand-grip' }, { rule: 'hand-control' }]), true);
  for (const rule of ['hand-collision', 'overlap', 'arms-limit']) assert.equal(gen.isSolved([{ rule }]), false, rule);
  // the corrections of the sweep: every rule is one the library names, each with a path and a detail
  const rules = new Set();
  for (const it of sweep()) for (const k of it.hands['0 A|right'].corrections) { if (it.controlSet === null) rules.add(k.rule); assert.ok(k.rule.startsWith('hand-') && typeof k.path === 'string' && k.detail.length > 0, JSON.stringify(k)); }
  assert.ok(!rules.has('hand-collision'), 'the 24 poses are cleared on every body of the sweep');
  // an overlap the hand's solver cannot clear leaves the character unsolved, and says where
  const tight = make(LEAN_MAN, { hands: { left: { pose: 'HP01' }, right: { pose: 'HP01', fingers: CONTROL_SETS[1].fingers, thumb: CONTROL_SETS[1].thumb } } });
  const left = tight.corrections.filter((k) => k.rule === 'hand-collision');
  assert.ok(left.length > 0 && left.every((k) => k.channel.startsWith('hands.right.')), JSON.stringify(left));
  assert.equal(tight.solved, false);
});

test('the defaults: both hands in HP01 at the level of the character\'s level of detail; a mode not built there takes its own level, with a note', () => {
  const c = make(WOMAN);
  assert.deepEqual(c.topology.hands, { level: 1, mode: 'preset', variant: 'budget' });
  assert.equal(c.hands.given, false); assert.deepEqual(c.hands.notes, []); assert.equal(c.hands.mirror, 'none');
  assert.equal(c.hands.left.pose, 'HP01'); assert.equal(c.hands.right.pose, 'HP01');
  for (const side of ['left', 'right']) for (const k of ['pose', 'angles', 'contact', 'triangles', 'wrist', 'body', 'corrections', 'diagnostics']) assert.ok(k in c.hands[side], `${side}.${k}`);
  assert.equal(c.hands.limits, null);
  const a = make(WOMAN, { hands: { mode: 'articulated', ...both('HP01') } });
  assert.equal(a.hands.level, 0); assert.match(a.hands.notes.join(' '), /level 0, the mode's own/); assert.deepEqual(a.hands.limits, clone(rig.LIMITS));
  const s = make(WOMAN, { hands: { mode: 'simplified', ...both('HP01') } });
  assert.equal(s.hands.level, 2); assert.match(s.hands.notes.join(' '), /level 2, the mode's own/);
  const l3 = make(WOMAN, { hands: { level: 3, ...both('HP01') } });
  assert.equal(l3.hands.mode, 'simplified'); assert.deepEqual(l3.hands.notes, []);
  const l4 = make(WOMAN, { hands: { level: 4, ...both('HP01') } });
  assert.equal(l4.hands.mode, null); assert.equal(l4.measures.triangles, gen.CHARACTER_TRIANGLES['4']);
  // the left and right are independent; mirroring copies one side onto the other, reflected
  const lr = make(WOMAN, { hands: { left: { pose: 'HP04' }, right: { pose: 'HP10' } } });
  assert.equal(lr.hands.left.pose, 'HP04'); assert.equal(lr.hands.right.pose, 'HP10');
  for (const options of [{ hands: { mirror: 'right_to_left', right: { pose: 'HP10' } } }, { hands: { mirror: 'left_to_right', mode: 'articulated', level: 0, left: { pose: 'HP12' } } }]) {
    const m = make(WOMAN, options), P = posedPositions(m);
    assert.equal(m.hands.left.pose, m.hands.right.pose); assert.equal(m.hands.mirror, options.hands.mirror);
    const L = characterShells(m, 'L', P), R = characterShells(m, 'R', P);
    let d = 0; L.forEach((sh, i) => sh.V.forEach((v, k) => { d = Math.max(d, len(sub(v, [-R[i].V[k][0], R[i].V[k][1], R[i].V[k][2]]))); }));
    assert.ok(d < 1e-6, `${options.hands.mirror}: the left hand is the right reflected (${d} m)`);
  }
});

test('levels 1 to 3 on the character are built for its body exactly: the same as building its hand directly', (t) => {
  // the right hand back in the hand frame: the inverse of the bind mapping (x, y, z) -> (z, -y, x) about the pivot
  const handFrame = (c) => { const w = c.hands.right.wrist.pivot, out = []; for (const sh of characterShells(c, 'R')) for (const b of sh.V) out.push(b[2] - w[2], w[1] - b[1], b[0] - w[0]); return out; };
  const bodies = [['newborn', presetDNA({ sex: 'male', age_months: 0 })], ['child of 6', presetDNA({ sex: 'female', age_months: 72 })], ['adult woman', WOMAN], ['elderly man', presetDNA({ sex: 'male', age_months: 1020 })]];
  let worst = 0, at = '';
  for (const [level, variant] of [[1, 'budget'], [1, 'readable'], [2, null], [3, null]]) {
    for (const [name, dna] of bodies) for (const pose of ['HP01', 'HP10']) {
      const c = make(dna, { hands: { level, ...both(pose) }, ...(variant ? { handVariant: variant } : {}) });
      const ex = build({ pose, side: 'right', level, variant, body: c.hands.right.body }), P = handFrame(c);
      assert.equal(P.length, ex.positions.length, `${name} ${pose} level ${level}: the same vertices`);
      let m = 0; for (let v = 0; v < ex.vertices; v++) m = Math.max(m, len(sub(V3(P, v), V3(ex.positions, v))));
      if (m > worst) { worst = m; at = `level ${level}${variant ? ` '${variant}'` : ''}, ${name} ${pose}`; }
      assert.ok(m < 1e-7, `${name} ${pose} level ${level} ${variant}: ${m} m from the direct build (rounding through the body's frame is under 0.1 micrometre)`);
      assert.deepEqual(c.hands.right.angles, ex.angles, `${name} ${pose} level ${level}: the same angles`);
    }
  }
  t.diagnostic(`the farthest vertex from the direct build: ${worst.toExponential(2)} m (${at}); 4 bodies, 2 poses, levels 1 to 3`);
});

test('the budget: triangles, vertices and bones of each level, measured', (t) => {
  const rows = [['level', 'mode', 'variant', 'triangles a hand', 'vertices a hand', 'bones a hand', 'character triangles', 'character bones', 'target a hand']];
  const targets = { 0: '160-260 (design)', 1: '24-40, and a readable one', 2: '12-20', 3: '6-12', 4: '0' };
  for (const [key, options] of LEVEL_OPTIONS) {
    const c = make(WOMAN, options), h = c.hands.left;
    rows.push([h.level, h.mode ?? '-', h.variant ?? '-', h.triangles, h.vertices, h.bones, c.measures.triangles, c.bones.length, targets[h.level]]);
    assert.equal(h.triangles, gen.HAND_TRIANGLES[key]);
  }
  for (const r of rows) t.diagnostic(r.join(' | '));
  t.diagnostic(`level 0 pieces (triangles, vertices): ${Object.entries(mesh0.PIECE_COUNTS).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}; 1 palm, 1 connector, 10 segments, 5 tips`);
  assert.equal(mesh0.TRIANGLES, 40 + 32 + 10 * 20 + 5 * 12);
});
