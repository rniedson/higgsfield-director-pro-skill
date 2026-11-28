// QA of the human generator. Run from the repository's root with:
//   node --test blocking-studio/human-generator/tests/test_generator.mjs
//
// The fixtures are the maintainer's Human DNA v1.0 collection (tests/fixtures/): 52 priority cases, the adult grid of
// 200 and 14 invalid DNAs. What these tests do not cover is listed in ../README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gen from '../generator.js';
import * as growth from '../growth.js';
import { TOP_KEYS, GROUPS, ADULT_ONLY, MAX_AGE_MONTHS } from '../dna.js';

import { measure as measureFat } from '../tools/calibrate_fat.mjs';

const { generate, validate, collisions, colliders, inspect, posedPositions, boneWorld, dnaFromId, presetDNA, randomDNA, volume } = gen;
const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));
const CASES = fixture('dna_cases_52.json'), GRID = fixture('dna_adult_grid_200.json'), INVALID = fixture('dna_invalid_14.json');
const MANIFEST = fixture('dna_cases_52_manifest.json'), SCHEMA = fixture('dna.schema.json');
const VALID = [...CASES, ...GRID];
const byId = Object.fromEntries(CASES.map((d) => [d.id, d]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const make = (d) => { const c = generate(d); assert.ok(c.ok, `${d.id}: ${JSON.stringify(c.errors)}`); return c; };
const MM = 0.001;
const AGES = [0, 1, 3, 6, 9, 12, 18, 24, 36, 48, 60, 84, 108, 132, 144, 156, 180, 204, 216, 288, 480, 720, 840, 960, 1020, 1200, 1440];
const SWEEP = AGES.flatMap((m) => ['male', 'female'].map((sex) => presetDNA({ sex, age_months: m })));
const quat = (axis, degrees) => { const a = degrees * Math.PI / 360, s = Math.sin(a); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a)]; };
const X = [1, 0, 0], Z = [0, 0, 1];
const neutralPosture = (d) => Object.values(d.posture).every((v) => v === null || v === 0.5);

// ---------------------------------------------------------------- the contract

test('the validator accepts every valid case of the collection', () => {
  assert.equal(VALID.length, 252);
  for (const d of VALID) assert.deepEqual(validate(d), { ok: true, errors: [] }, d.id);
});

test('the validator refuses every invalid case at the expected stage, for the expected reason, on the expected field', () => {
  assert.equal(INVALID.length, 14);
  for (const c of INVALID) {
    const r = validate(c.dna);
    assert.equal(r.ok, false, c.id);
    assert.deepEqual([...new Set(r.errors.map((e) => e.stage))], [c.expected_stage], c.id);
    if (c.expected_stage === 'semantic') assert.ok(r.errors.some((e) => e.code === c.expected_error), `${c.id}: ${JSON.stringify(r.errors)}`);
    assert.ok(r.errors.some((e) => e.path === c.field || e.path.startsWith(c.field + '.')), `${c.id}: no error on ${c.field}`);
    assert.equal(generate(c.dna).ok, false, `${c.id} must not generate`);
  }
});

test("the validator's keys are the schema's", () => {
  const same = (a, b, what) => assert.deepEqual([...a].sort(), [...b].sort(), what);
  same(TOP_KEYS, Object.keys(SCHEMA.properties), 'top-level keys');
  same(TOP_KEYS, SCHEMA.required, 'required top-level keys');
  for (const [name, keys] of Object.entries(GROUPS)) {
    same(keys, Object.keys(SCHEMA.properties[name].properties), name);
    same(keys, SCHEMA.properties[name].required, `${name}: required`);
  }
  assert.equal(SCHEMA.properties.age_months.maximum, MAX_AGE_MONTHS);
});

test('untrusted values are refused, never repaired, and nothing throws', () => {
  for (const v of [null, undefined, 3, 'x', [], true, () => 1]) {
    assert.equal(validate(v).ok, false); assert.equal(generate(v).ok, false);
  }
  const base = () => dnaFromId('M_H05_C04');
  for (const v of [NaN, Infinity, -Infinity, '0.5', true, [], {}, -0.01, 1.01]) {
    for (const set of [(d) => { d.muscle_mass = v; }, (d) => { d.proportions.head_size = v; }, (d) => { d.fat_distribution.abdomen = v; }, (d) => { d.posture.spine_curvature = v; }]) {
      const d = base(); set(d);
      assert.equal(validate(d).ok, false, `accepted ${String(v)}`); assert.equal(generate(d).ok, false);
    }
  }
  for (const [k, v] of [['height_m', 1e9], ['age_months', 12.5], ['build', 4.5], ['seed', 2 ** 32], ['lod', 1.5], ['id', 'a b'], ['id', ''], ['sex', 'Male']]) {
    const d = base(); d[k] = v; assert.equal(validate(d).ok, false, `${k} = ${v}`);
  }
  const extra = base(); extra.proportions.wings = 0.5; assert.equal(validate(extra).ok, false);
  const missing = base(); delete missing.aging.skin_laxity; assert.equal(validate(missing).ok, false);
  const proto = JSON.parse('{"__proto__": {"polluted": true}}'); assert.equal(validate(proto).ok, false); assert.equal({}.polluted, undefined);
  const undef = base(); undef.build = undefined; assert.ok(validate(undef).errors.some((e) => e.code === 'REQUIRED' && e.path === 'build'));
  const symbol = base(); symbol[Symbol('x')] = 1; assert.equal(validate(symbol).ok, false);
  const inherited = Object.create(base()); assert.equal(validate(inherited).ok, false, 'keys must be the DNA\'s own');
  // a hostile DNA does not cost a message per key
  const huge = base(); for (let i = 0; i < 5000; i++) huge['k' + i] = i;
  const r = validate(huge); assert.equal(r.ok, false); assert.ok(r.errors.length <= 51); assert.equal(r.errors.at(-1).code, 'TOO_MANY_ERRORS');
});

test('what is checked is what is built: a DNA that answers differently each time it is read gains nothing', () => {
  // a minor whose bust channel says null while it is checked and 0.9 afterwards
  const child = presetDNA({ sex: 'female', age_months: 108 });
  let reads = 0;
  Object.defineProperty(child.proportions, 'breast_volume', { enumerable: true, get() { reads++; return reads <= 2 ? null : 0.9; } });
  const c = generate(child), plain = make(presetDNA({ sex: 'female', age_months: 108 }));
  assert.ok(c.ok); assert.equal(reads, 1, 'the channel was read more than once');
  assert.equal(c.resolved.proportions.breast_volume, 0); assert.deepEqual(c.positions, plain.positions);
  // the same for a value that is valid when checked and out of range when used
  const adult = dnaFromId('M_H05_C04'); let n = 0;
  Object.defineProperty(adult, 'body_fat', { enumerable: true, get() { n++; return n === 1 ? 0.2 : 55; } });
  const a = generate(adult); assert.ok(a.ok); assert.equal(a.resolved.body_fat, 0.2); assert.equal(a.dna.body_fat, 0.2);
});

test('a level of detail that is not built yet is an explicit error', () => {
  for (const lod of [0, 2, 3, 4]) {
    const r = generate({ ...dnaFromId('M_H05_C04'), lod });
    assert.equal(r.ok, false); assert.deepEqual(r.errors.map((e) => [e.stage, e.code]), [['generator', 'LOD_NOT_AVAILABLE']]);
  }
});

test('every case of the manifest is in the collection, and every id builds its DNA', () => {
  assert.deepEqual(MANIFEST.map((m) => m.id), CASES.map((d) => d.id));
  for (const d of GRID) {   // the grid's records are the ids' own DNAs, but for their seeds
    const mine = dnaFromId(d.id); mine.seed = d.seed;
    assert.deepEqual(mine, d, d.id);
  }
  assert.equal(dnaFromId('X_H05_C05'), null); assert.equal(dnaFromId('M_H11_C05'), null);
  for (const d of SWEEP) assert.ok(validate(d).ok, d.id);
});

// ---------------------------------------------------------------- the checklist

test('every valid case generates: height, feet on the floor, finite vertices, no flat triangle, no undue collision', () => {
  for (const d of [...VALID, ...SWEEP]) {
    const c = make(d), at = inspect(c);
    assert.equal(c.measures.height_reference, d.height_m, d.id);
    if (neutralPosture(d)) assert.ok(Math.abs(at.height - d.height_m) < 0.5 * MM, `${d.id}: stands ${at.height} m tall, asked for ${d.height_m}`);
    assert.ok(Math.abs(at.min[1]) < 0.5 * MM, `${d.id}: lowest point at ${at.min[1]}`);
    assert.equal(at.nonFinite, 0, d.id); assert.equal(at.degenerate, 0, d.id);
    assert.deepEqual(collisions(c), [], `${d.id}: collisions in the rest pose`);
    assert.ok(Math.abs(c.measures.height_posed - at.height) < 1e-9);
    assert.ok(Math.abs(c.measures.height_built - d.height_m) < 0.5 * MM, `${d.id}: built ${c.measures.height_built} m tall`);
    assert.equal(c.solved, true, d.id);
  }
});

test('one topology: the same triangles, bone bindings and pieces for every character', () => {
  const ref = make(dnaFromId('M_H05_C04'));
  assert.equal(ref.measures.triangles, gen.TRIANGLES[1]);
  assert.equal(ref.topology.version, gen.TOPOLOGY_VERSION[1]);
  const pieces = (c) => c.pieces.map((p) => [p.name, p.bone, p.v0, p.v1, p.t0, p.t1]);
  for (const d of [...VALID, ...SWEEP, ...Array.from({ length: 40 }, (_, i) => randomDNA(i))]) {
    const c = make(d);
    assert.deepEqual(c.index, ref.index, d.id); assert.deepEqual(c.boneIndex, ref.boneIndex, d.id);
    assert.equal(c.positions.length, ref.positions.length, d.id); assert.deepEqual(pieces(c), pieces(ref), d.id);
    assert.deepEqual(c.bones.map((b) => [b.name, b.parent]), gen.BONES, d.id);
  }
  // every vertex belongs to exactly one piece, and to the bone of that piece
  const owner = new Array(ref.positions.length / 3).fill(null);
  for (const p of ref.pieces) for (let i = p.v0; i < p.v1; i++) { assert.equal(owner[i], null); owner[i] = p.name; assert.equal(gen.BONES[ref.boneIndex[i]][0], p.bone); }
  assert.ok(owner.every(Boolean));
  for (const p of ref.pieces) for (let t = 3 * p.t0; t < 3 * p.t1; t++) assert.ok(ref.index[t] >= p.v0 && ref.index[t] < p.v1, `${p.name}: a triangle reaches outside the piece`);
});

test('the triangle count is what the generator declares, and the gap to the proposed budget is known', () => {
  assert.equal(gen.TRIANGLES[1], 412);
  assert.equal(gen.LOD_BUDGET[1], 400);   // the proposal; README.md says why level 1 has 412 and what 400 would cost
  const c = make(dnaFromId('M_H05_C04')), hands = c.pieces.filter((p) => p.name.startsWith('Hand_')).reduce((a, p) => a + p.t1 - p.t0, 0);
  assert.equal(c.measures.triangles - hands, 392);
});

test('the faces look outward', () => {
  for (const d of [dnaFromId('M_H05_C04'), dnaFromId('F_H05_C10'), presetDNA({ age_months: 0 }), presetDNA({ sex: 'female', age_months: 108 })]) {
    const c = make(d), p = c.positions, at = (i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
    let inward = 0, total = 0;
    for (const piece of c.pieces) {
      const { a, b } = piece.collider, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      for (let t = 3 * piece.t0; t < 3 * piece.t1; t += 3) {
        const [u, v, w] = [at(c.index[t]), at(c.index[t + 1]), at(c.index[t + 2])];
        const e1 = [v[0] - u[0], v[1] - u[1], v[2] - u[2]], e2 = [w[0] - u[0], w[1] - u[1], w[2] - u[2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const g = [(u[0] + v[0] + w[0]) / 3, (u[1] + v[1] + w[1]) / 3, (u[2] + v[2] + w[2]) / 3];
        const k = len2 > 0 ? Math.min(1, Math.max(0, ((g[0] - a[0]) * ab[0] + (g[1] - a[1]) * ab[1] + (g[2] - a[2]) * ab[2]) / len2)) : 0;
        const out = [g[0] - a[0] - k * ab[0], g[1] - a[1] - k * ab[1], g[2] - a[2] - k * ab[2]];
        total++; if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] <= 0) inward++;
      }
    }
    assert.equal(inward, 0, `${d.id}: ${inward} of ${total} faces look inward`);
  }
});

test('the body is symmetric: every left piece has its mirror image on the right', () => {
  for (const d of [dnaFromId('M_H05_C04'), byId.EXT_F_H01_C10, presetDNA({ age_months: 6 })]) {
    const c = make(d), p = c.positions, piece = Object.fromEntries(c.pieces.map((x) => [x.name, x]));
    for (const left of c.pieces.filter((x) => x.name.endsWith('_L'))) {
      const right = piece[left.name.slice(0, -1) + 'R'];
      for (let i = 0; i < left.v1 - left.v0; i++) {
        const a = 3 * (left.v0 + i), b = 3 * (right.v0 + i);
        assert.ok(Math.abs(p[a] + p[b]) < 1e-6 && Math.abs(p[a + 1] - p[b + 1]) < 1e-6 && Math.abs(p[a + 2] - p[b + 2]) < 1e-6, `${d.id}: ${left.name}`);
      }
    }
    for (const b of c.bones.filter((x) => x.name.endsWith('_L'))) {
      const r = c.bones.find((x) => x.name === b.name.slice(0, -1) + 'R');
      assert.deepEqual(r.head.map((v, i) => +(i === 0 ? -v : v).toFixed(9)), b.head.map((v) => +v.toFixed(9)), `${d.id}: ${b.name}`);
    }
  }
});

test('pivots sit at the centres of the joints', () => {
  for (const d of [...CASES, ...SWEEP]) {
    const c = make(d), head = Object.fromEntries(c.bones.map((b) => [b.name, b.head])), piece = Object.fromEntries(c.pieces.map((p) => [p.name, p]));
    const centre = (name) => { const p = piece[name]; const s = [0, 0, 0]; for (let i = p.v0; i < p.v1; i++) for (let k = 0; k < 3; k++) s[k] += c.positions[3 * i + k] / (p.v1 - p.v0); return s; };
    const span = (name, k) => { const p = piece[name]; let lo = Infinity, hi = -Infinity; for (let i = p.v0; i < p.v1; i++) { lo = Math.min(lo, c.positions[3 * i + k]); hi = Math.max(hi, c.positions[3 * i + k]); } return [lo, hi]; };
    for (const s of ['L', 'R']) {
      // each ball joint is built around its bone's pivot
      for (const [ball, bone] of [['Shoulder_', 'UpperArm_'], ['Elbow_', 'LowerArm_'], ['Knee_', 'Calf_']]) {
        const [lo, hi] = [0, 1, 2].map((k) => span(ball + s, k)).reduce((a, x) => [[...a[0], x[0]], [...a[1], x[1]]], [[], []]);
        for (let k = 0; k < 3; k++) assert.ok(head[bone + s][k] > lo[k] - 1e-9 && head[bone + s][k] < hi[k] + 1e-9, `${d.id}: ${bone}${s} is outside its ball`);
      }
      // the limbs hang from their pivots: elbow below shoulder, wrist below elbow, knee below hip, ankle below knee
      for (const [upper, lower] of [['UpperArm_', 'LowerArm_'], ['LowerArm_', 'Hand_'], ['Thigh_', 'Calf_'], ['Calf_', 'Foot_']]) assert.ok(head[upper + s][1] > head[lower + s][1], `${d.id}: ${lower}${s}`);
      // the tubes start and end on their pivots
      const near = 0.004 * d.height_m;   // the end ring of a slanted tube is tilted: its rim is not exactly at the pivot's height
      assert.ok(Math.abs(span('UpperArm_' + s, 1)[1] - head['UpperArm_' + s][1]) < near && Math.abs(span('Forearm_' + s, 1)[1] - head['LowerArm_' + s][1]) < near, `${d.id}: arm ${s}`);
      assert.ok(Math.abs(span('Shin_' + s, 1)[1] - head['Calf_' + s][1]) < near && Math.abs(span('Thigh_' + s, 1)[0] - head['Calf_' + s][1]) < near, `${d.id}: leg ${s}`);
      assert.ok(Math.abs(centre('Hand_' + s)[0] - head['Hand_' + s][0]) < 5 * MM, `${d.id}: hand ${s}`);
    }
    for (const [low, high] of [['Pelvis', 'Spine_01'], ['Spine_01', 'Spine_02'], ['Spine_02', 'Spine_03'], ['Spine_03', 'Neck'], ['Neck', 'Head']]) assert.ok(head[high][1] > head[low][1], `${d.id}: ${high} is not above ${low}`);
    assert.ok(head.Head[1] < d.height_m && head.Thigh_L[1] > head.Calf_L[1]);
    assert.deepEqual(head.Root, [0, 0, 0]);
  }
});

test('movement: bones keep their lengths, nothing breaks, and the pieces follow their bones', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const d of [byId.EXT_M_H01_C01, byId.EXT_M_H10_C10, byId.EXT_F_H01_C10, byId.AGE_A01_F, byId.AGE_A03_M, byId.AGE_A10_M, dnaFromId('M_H05_C05')]) {
    const c = make(d), L = c.limits;
    const poses = {
      'hips and knees to their limits': { Thigh_L: quat(X, -L.Hip.flexion_max), Thigh_R: quat(X, -L.Hip.flexion_max), Calf_L: quat(X, L.Knee.flexion_max), Calf_R: quat(X, L.Knee.flexion_max) },
      'elbows to their limits, arms raised': { UpperArm_L: quat(Z, 150), UpperArm_R: quat(Z, -150), LowerArm_L: quat(X, -L.Elbow.flexion_max), LowerArm_R: quat(X, -L.Elbow.flexion_max) },
      'spine to its limit, head turned': { Spine_01: quat(X, L.Spine.flexion_max / 2), Spine_03: quat(X, L.Spine.flexion_max / 2), Neck: quat([0, 1, 0], 60), Head: quat(X, -25) },
      'a stride': { Thigh_L: quat(X, -45), Calf_L: quat(X, 60), Thigh_R: quat(X, 25), UpperArm_L: quat(X, 30), UpperArm_R: quat(X, -40), LowerArm_R: quat(X, -70) },
    };
    const rest = boneWorld(c);
    for (const [name, pose] of Object.entries(poses)) {
      const at = inspect(c, pose), world = boneWorld(c, pose);
      assert.equal(at.nonFinite, 0, `${d.id}: ${name}`); assert.equal(at.degenerate, 0, `${d.id}: ${name}`);
      for (const b of c.bones) if (b.parent) assert.ok(Math.abs(dist(world[b.name].p, world[b.parent].p) - dist(rest[b.name].p, rest[b.parent].p)) < 1e-9, `${d.id}: ${name}: ${b.name} changed length`);
      const span = Math.max(at.max[0] - at.min[0], at.max[1] - at.min[1], at.max[2] - at.min[2]);
      assert.ok(span < 2.2 * d.height_m, `${d.id}: ${name}: the body flew apart (${span.toFixed(2)} m)`);
    }
    // rigid pieces: within a piece, every distance between two vertices survives a pose
    const pose = poses['a stride'], a = posedPositions(c), b = posedPositions(c, pose), v = (p, i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
    for (const piece of c.pieces) for (let i = piece.v0 + 1; i < piece.v1; i++) assert.ok(Math.abs(dist(v(a, piece.v0), v(a, i)) - dist(v(b, piece.v0), v(b, i))) < 1e-5, `${d.id}: ${piece.name} deformed`);
    assert.ok(L.Hip.flexion_max >= 10 && L.Knee.flexion_max >= 10 && L.Elbow.flexion_max >= 10 && L.Spine.flexion_max >= 5, d.id);
  }
});

test('the extremes are solved or reported: every correction says what was asked and what was used, and the DNA is not touched', () => {
  const rules = new Set();
  for (const d of [...VALID, ...SWEEP]) {
    const before = clone(d), c = make(d);
    assert.deepEqual(d, before, `${d.id}: the DNA was modified`); assert.deepEqual(c.dna, before, d.id);
    for (const k of c.corrections) {
      rules.add(k.rule);
      assert.ok(typeof k.rule === 'string' && typeof k.channel === 'string' && typeof k.detail === 'string' && k.detail.length > 20 && 'asked' in k && 'used' in k, `${d.id}: ${JSON.stringify(k)}`);
    }
    assert.ok(!c.corrections.some((k) => k.rule.endsWith('-limit')), `${d.id}: a constraint could not be met`);
  }
  for (const id of ['EXT_M_H01_C10', 'EXT_M_H10_C10', 'EXT_M_H05_C10']) assert.ok(make(byId[id]).corrections.some((k) => k.rule === 'arms-apart'), id);
  for (const id of ['EXT_F_H01_C10', 'EXT_F_H10_C10', 'EXT_F_H05_C10']) assert.ok(make(byId[id]).corrections.some((k) => k.rule === 'legs-apart'), id);
  for (const id of ['EXT_M_H05_C01', 'EXT_F_H05_C01', 'PAIR_SEX_A', 'PAIR_SEX_B']) assert.deepEqual(make(byId[id]).corrections, [], id);
  assert.ok(rules.has('arms-apart') && rules.has('legs-apart'));
});

test('the same DNA gives the same character, to the bit, and a value set and set back leaves no trace', () => {
  for (const d of [byId.EXT_F_H01_C10, byId.AGE_A02_M, byId.PAIR_FAT_DIST_A, dnaFromId('M_H05_C04')]) {
    const a = make(d);
    // other characters in between: nothing is kept from one generation to the next
    for (const other of [byId.EXT_M_H10_C10, byId.AGE_A01_F, byId.PAIR_POSTURE_B]) make(other);
    const changed = clone(d); changed.proportions.shoulder_width = 0.9; changed.body_fat = 0.8; changed.build = 7; make(changed);
    const b = make(clone(d));
    for (const k of ['positions', 'index', 'boneIndex']) assert.deepEqual(b[k], a[k], `${d.id}: ${k}`);
    assert.deepEqual(clone(b.bones), clone(a.bones), d.id); assert.deepEqual(b.corrections, a.corrections, d.id);
    assert.deepEqual(b.measures, a.measures, d.id);
  }
});

test('a null is its preset, exactly: the seed changes nothing, and an explicit 0.5 is the same as null', () => {
  const plain = make(dnaFromId('F_H05_C04'));
  for (const k of GROUPS.proportions) assert.equal(plain.resolved.proportions[k], k === 'breast_volume' ? 0.45 : 0.5, k);
  for (const seed of [1, 7, 4294967295]) {
    const c = make({ ...dnaFromId('F_H05_C04'), seed });
    assert.deepEqual(c.positions, plain.positions, `seed ${seed}`); assert.deepEqual(c.resolved, plain.resolved, `seed ${seed}`);
  }
  // the collection overlaps on purpose: these three records are one DNA, but for the id and the seed
  const same = [byId.EXT_M_H05_C01, byId.PAIR_BUILD_A, GRID.find((d) => d.id === 'M_H05_C01')].map(make);
  assert.deepEqual(same[1].positions, same[0].positions); assert.deepEqual(same[2].positions, same[0].positions);
  // along the grid, what should grow with the height level grows
  const hip = (d) => { const c = make(d); return c.bones.find((b) => b.name === 'Thigh_L').head[1] / d.height_m; };
  const row = GRID.filter((d) => d.sex === 'male' && d.build === 4).map(hip);
  for (let i = 1; i < row.length; i++) assert.ok(row[i] > row[i - 1], `hip height over stature is not monotonic at H${i + 1}`);
  // explicit neutral values are the presets
  const explicit = dnaFromId('M_H05_C04');
  for (const k of GROUPS.posture) explicit.posture[k] = 0.5;
  for (const k of GROUPS.proportions) if (!k.startsWith('breast')) explicit.proportions[k] = 0.5;
  explicit.bone_structure = 0.5;
  assert.deepEqual(make(explicit).positions, make(dnaFromId('M_H05_C04')).positions);
  // variety comes from randomDNA: explicit values, reproducible from the seed
  assert.deepEqual(randomDNA(42), randomDNA(42)); assert.notDeepEqual(randomDNA(42), randomDNA(43));
  assert.notDeepEqual(make(randomDNA(42)).positions, make(randomDNA(43)).positions);
  for (let i = 0; i < 60; i++) assert.ok(validate(randomDNA(i)).ok, `randomDNA(${i})`);
});

// ---------------------------------------------------------------- the controlled pairs

const pair = (name) => [byId[`PAIR_${name}_A`], byId[`PAIR_${name}_B`]];
const differingKeys = (a, b) => {
  const out = [];
  for (const k of Object.keys(a)) {
    if (k === 'id') continue;
    if (a[k] && typeof a[k] === 'object') { for (const j of Object.keys(a[k])) if (a[k][j] !== b[k][j]) out.push(`${k}.${j}`); } else if (a[k] !== b[k]) out.push(k);
  }
  return out;
};
const pieceBox = (c, name, axis) => { const p = c.pieces.find((x) => x.name === name); let lo = Infinity, hi = -Infinity;
  for (let i = p.v0; i < p.v1; i++) { lo = Math.min(lo, c.positions[3 * i + axis]); hi = Math.max(hi, c.positions[3 * i + axis]); } return hi - lo; };
const samePiece = (a, b, name) => { const p = a.pieces.find((x) => x.name === name);
  for (let i = 3 * p.v0; i < 3 * p.v1; i++) if (a.positions[i] !== b.positions[i]) return false; return true; };

test('pairs: each pair differs only in the channel it names, and shares its seed', () => {
  const expected = { HEIGHT: ['height_level', 'height_m'], BUILD: ['build'], MUSCLE: ['muscle_mass'], SEX: ['sex'], POSTURE: ['posture.spine_curvature'],
    PROPORTION: ['proportions.torso_length', 'proportions.leg_length'], CHEST: ['proportions.breast_volume'],
    FAT_DIST: ['fat_distribution.abdomen', 'fat_distribution.chest', 'fat_distribution.hips', 'fat_distribution.glutes', 'fat_distribution.thighs'] };
  for (const [name, keys] of Object.entries(expected)) { const [a, b] = pair(name); assert.deepEqual(differingKeys(a, b).sort(), [...keys].sort(), name); assert.equal(a.seed, b.seed); }
});

test('pair, height: the segments and the pivots follow the height; the body preset stays', () => {
  const [a, b] = pair('HEIGHT').map(make);
  assert.ok(Math.abs(inspect(a).height - 1.4) < 0.5 * MM && Math.abs(inspect(b).height - 2.2) < 0.5 * MM);
  const y = (c, bone) => c.bones.find((x) => x.name === bone).head[1];
  for (const bone of ['Pelvis', 'Spine_03', 'Neck', 'Head', 'Calf_L', 'Foot_L', 'LowerArm_L']) {
    const ratio = y(b, bone) / y(a, bone);
    assert.ok(ratio > 1.5 && ratio < 1.7, `${bone}: ${ratio.toFixed(3)} (the height ratio is ${(2.2 / 1.4).toFixed(3)})`);
  }
  for (const k of ['body_fat', 'muscle_mass', 'bone_structure', 'skeletal_maturity']) assert.equal(a.resolved[k], b.resolved[k], k);
  assert.deepEqual(a.resolved.proportions, b.resolved.proportions); assert.deepEqual(a.resolved.fat_distribution, b.resolved.fat_distribution);
  assert.ok(pieceBox(b, 'Head', 1) / pieceBox(a, 'Head', 1) < 1.25, 'the head grows less than the body');
});

test('pair, build: the height stays, the volume changes, and the collisions are solved', () => {
  const [a, b] = pair('BUILD').map(make);
  assert.ok(Math.abs(inspect(a).height - inspect(b).height) < 0.5 * MM);
  for (const piece of ['Abdomen', 'Chest', 'Pelvis', 'Thigh_L', 'UpperArm_L']) assert.ok(pieceBox(b, piece, 2) > 1.25 * pieceBox(a, piece, 2), piece);
  assert.deepEqual(collisions(a), []); assert.deepEqual(collisions(b), []);
  assert.deepEqual(a.corrections, []); assert.ok(b.corrections.length > 0, 'the extreme build must report what it had to open');
});

test('pair, muscle: muscle alone, the fat fixed', () => {
  const [a, b] = pair('MUSCLE').map(make);
  assert.equal(a.resolved.body_fat, 0.35); assert.equal(b.resolved.body_fat, 0.35);
  assert.equal(a.resolved.muscle_mass, 0.1); assert.equal(b.resolved.muscle_mass, 0.9);
  for (const piece of ['UpperArm_L', 'Thigh_L', 'Shin_L', 'Forearm_L']) assert.ok(pieceBox(b, piece, 0) > 1.08 * pieceBox(a, piece, 0), piece);
  assert.ok(samePiece(a, b, 'Head'), 'muscle does not move the head'); assert.ok(Math.abs(inspect(a).height - inspect(b).height) < 0.5 * MM);
});

test('pair, fat distribution: the weights are normalised and the amount of fat stays', () => {
  const [a, b] = pair('FAT_DIST').map(make);
  for (const c of [a, b]) {
    assert.equal(c.resolved.body_fat, 0.7);
    assert.ok(Math.abs(Object.values(c.resolved.fat_distribution).reduce((x, y) => x + y, 0) - 1) < 1e-12);
  }
  assert.ok(pieceBox(a, 'Abdomen', 2) > 1.2 * pieceBox(b, 'Abdomen', 2), 'A carries its fat on the abdomen');
  assert.ok(pieceBox(b, 'Thigh_L', 0) > 1.2 * pieceBox(a, 'Thigh_L', 0), 'B carries its fat on the thighs');
  assert.ok(samePiece(a, b, 'Head'));
  // null weights come from the preset, and any explicit vector is used in proportion
  const d = clone(pair('FAT_DIST')[0]); for (const k of GROUPS.fat_distribution) d.fat_distribution[k] = k === 'abdomen' ? 0.95 : null;
  const partial = make(d), plain = make({ ...clone(d), fat_distribution: Object.fromEntries(GROUPS.fat_distribution.map((k) => [k, null])) });
  assert.ok(partial.resolved.fat_distribution.abdomen > plain.resolved.fat_distribution.abdomen);
  const scaled = clone(pair('FAT_DIST')[0]); for (const k of GROUPS.fat_distribution) scaled.fat_distribution[k] /= 2;
  assert.deepEqual(make(scaled).positions, a.positions, 'weights twice as small share the fat the same way');
  // the amount of fat stays: the two bodies carry about the same volume of it
  const fat = (d) => volume(make(d)) - volume(make({ ...clone(d), body_fat: 0 }));
  const [va, vb] = pair('FAT_DIST').map(fat);
  assert.ok(Math.abs(va - vb) / Math.max(va, vb) < 0.1, `A carries ${(va * 1000).toFixed(1)} L of fat and B ${(vb * 1000).toFixed(1)} L`);
  // B asks more of the hips and the glutes than they hold: the rest goes to the regions with room, and it is said
  assert.deepEqual(a.corrections.filter((k) => k.rule.startsWith('fat')), []);
  assert.deepEqual(b.corrections.filter((k) => k.rule.startsWith('fat')).map((k) => [k.rule, k.channel]), [['fat-region-full', 'fat_distribution.hips'], ['fat-region-full', 'fat_distribution.glutes']]);
  assert.ok(Math.abs(Object.values(b.resolved.fat_used).reduce((x, y) => x + y, 0) - 1) < 1e-12, 'no fat was dropped');
  assert.ok(b.resolved.fat_used.thighs > b.resolved.fat_distribution.thighs);
});

test('fat: the shares are the ones measured on the mesh, and fat with nowhere to go is reported', () => {
  const { share } = measureFat();
  for (const k of GROUPS.fat_distribution) assert.ok(Math.abs(share[k] - gen.FAT_SHARE[k]) < 0.05 * gen.FAT_SHARE[k] + 0.002, `${k}: measured ${share[k].toFixed(3)}, FAT_SHARE says ${gen.FAT_SHARE[k]}: run tools/calibrate_fat.mjs`);
  assert.ok(Math.abs(Object.values(gen.FAT_SHARE).reduce((x, y) => x + y, 0) - 1) < 1e-9);
  // the same body_fat, whatever the pattern: about the same volume of fat
  const base = () => ({ ...dnaFromId('M_H05_C04'), body_fat: 0.7 }), lean = volume(make({ ...base(), body_fat: 0 }));
  const litres = Object.values(gen.FAT_PATTERNS).map((w) => { const d = base(); d.fat_distribution = { ...w }; return volume(make(d)) - lean; });
  assert.ok(Math.max(...litres) / Math.min(...litres) < 1.2, `the patterns carry ${litres.map((v) => (v * 1000).toFixed(0)).join(', ')} L`);
  // all the fat on the calves: they fill, nothing else has a share, and the body says it carries less than asked
  const calves = base(); for (const k of GROUPS.fat_distribution) calves.fat_distribution[k] = k === 'calves' ? 1 : 0;
  const c = make(calves), rules = c.corrections.filter((k) => k.rule.startsWith('fat'));
  assert.deepEqual(rules.map((k) => k.rule), ['fat-region-full', 'fat-unplaced']);
  assert.ok(rules[1].used < 0.3 && rules[1].asked === 1);
  // no fat, no report: there is nothing to place
  const none = { ...calves, body_fat: 0 }; assert.deepEqual(make(none).corrections.filter((k) => k.rule.startsWith('fat')), []);
});

test('pair, sex: the preset changes; the height, the build, the seed and the rig do not', () => {
  const [a, b] = pair('SEX').map(make);
  assert.deepEqual(a.bones.map((x) => [x.name, x.parent]), b.bones.map((x) => [x.name, x.parent]));
  assert.deepEqual(a.index, b.index); assert.deepEqual(a.boneIndex, b.boneIndex);
  assert.ok(Math.abs(inspect(a).height - inspect(b).height) < 0.5 * MM);
  for (const k of ['body_fat', 'muscle_mass', 'bone_structure']) assert.equal(a.resolved[k], b.resolved[k], k);
  assert.notDeepEqual(a.positions, b.positions);
  assert.ok(pieceBox(a, 'Chest', 0) > pieceBox(b, 'Chest', 0), 'the male preset has the broader chest');
});

test('pair, posture: the reference height is apart from the posed height', () => {
  const [a, b] = pair('POSTURE').map(make);
  for (const c of [a, b]) { assert.equal(c.measures.height_reference, 1.75); assert.ok(c.measures.height_posed < 1.75 - MM, `posed ${c.measures.height_posed}`); }
  assert.deepEqual(a.positions, b.positions, 'posture is a pose: the bind geometry is the same');
  const straight = clone(pair('POSTURE')[0]); straight.posture.spine_curvature = 0.5;
  assert.ok(Math.abs(make(straight).measures.height_posed - 1.75) < 0.5 * MM);
  assert.ok(Math.abs(inspect(a).min[1]) < 0.5 * MM && Math.abs(inspect(b).min[1]) < 0.5 * MM, 'the feet stay on the floor');
});

test('pair, proportion: long torso against long legs at the same height, with the rig recomputed', () => {
  const [a, b] = pair('PROPORTION').map(make);
  assert.ok(Math.abs(inspect(a).height - 1.75) < 0.5 * MM && Math.abs(inspect(b).height - 1.75) < 0.5 * MM);
  const y = (c, bone) => c.bones.find((x) => x.name === bone).head[1];
  assert.ok(y(b, 'Thigh_L') > y(a, 'Thigh_L') + 0.04, 'B has the higher hips'); assert.ok(y(b, 'Calf_L') > y(a, 'Calf_L') + 0.02);
  assert.ok(pieceBox(a, 'Abdomen', 1) > pieceBox(b, 'Abdomen', 1), 'A has the longer trunk');
  assert.ok(Math.abs(y(a, 'Head') - y(b, 'Head')) < 2 * MM);
});

test('pair, chest: the adult bust channel on its own', () => {
  const [a, b] = pair('CHEST').map(make);
  assert.ok(pieceBox(b, 'Chest', 2) > pieceBox(a, 'Chest', 2) + 0.02);
  for (const p of a.pieces) if (p.name !== 'Chest') assert.ok(samePiece(a, b, p.name), `${p.name} moved`);
  assert.deepEqual(a.bones, b.bones); assert.ok(Math.abs(inspect(a).height - inspect(b).height) < 0.5 * MM);
});

// ---------------------------------------------------------------- age

test('age: proportions of the age, not an adult scaled down', () => {
  const ratio = (months, sex = 'male') => { const c = make(presetDNA({ sex, age_months: months })), y = (b) => c.bones.find((x) => x.name === b).head[1], H = c.dna.height_m;
    return { head: pieceBox(c, 'Head', 1) / H, hip: y('Thigh_L') / H, shoulders: 2 * c.bones.find((x) => x.name === 'UpperArm_L').head[0] / H, c }; };
  const newborn = ratio(0), toddler = ratio(24), child = ratio(108), adult = ratio(360);
  assert.ok(newborn.head > 0.23 && newborn.head < 0.27, `a newborn's head is about a quarter of its length: ${newborn.head.toFixed(3)}`);
  assert.ok(adult.head > 0.12 && adult.head < 0.14, `an adult's head is about an eighth: ${adult.head.toFixed(3)}`);
  assert.ok(newborn.head > toddler.head && toddler.head > child.head && child.head > adult.head, 'the head shrinks against the body as it grows');
  assert.ok(newborn.hip < toddler.hip && toddler.hip < child.hip && child.hip <= adult.hip + 0.03, 'the legs lengthen against the trunk');
  assert.ok(newborn.hip < 0.4 && adult.hip > 0.5);
  // a scaled-down adult would keep the adult's ratios
  assert.ok(Math.abs(newborn.head - adult.head) > 0.1 && Math.abs(newborn.hip - adult.hip) > 0.1);
});

test('age: nothing jumps where a stage ends', () => {
  // the curves are continuous, and stature never falls while growing
  for (const sex of ['male', 'female']) {
    let last = 0;
    for (let m = 0; m <= 240; m++) { const s = growth.stature(sex, m); assert.ok(s >= last - 1e-12, `${sex}: stature falls at ${m} months`); last = s; }
    for (const [m, v] of growth.STATURE_KNOTS[sex]) assert.equal(growth.stature(sex, m), v, `${sex}: the median at ${m} months`);
    for (let m = 0; m < 300; m++) assert.ok(Math.abs(growth.shapeStature(sex, m + 1) - growth.shapeStature(sex, m)) < 0.05, `${sex}: the shape's stature jumps at ${m} months`);   // a newborn grows 4.8 cm in its first month
    assert.equal(growth.shapeStature(sex, 216), growth.ADULT_STATURE); assert.equal(growth.shapeStature(sex, 120), growth.stature(sex, 120));
  }
  for (const [name, f] of Object.entries(growth)) {
    if (typeof f !== 'function' || ['curve', 'stature', 'shapeStature', 'maturity', 'maturityWindow', 'motorProfile', 'regions'].includes(name)) continue;
    for (let m = 0; m < MAX_AGE_MONTHS; m++) assert.ok(Math.abs(f(m + 1) - f(m)) < 0.05, `${name} jumps at ${m} months`);
  }
  for (const k of growth.REGIONS) for (let m = 0; m < 300; m++) assert.ok(Math.abs(growth.regions(m + 1)[k] - growth.regions(m)[k]) < 0.08, `${k} jumps at ${m} months`);
  for (const k of growth.REGIONS) for (const m of [216, 300, 1440]) assert.equal(growth.regions(m)[k], 1, `${k} at ${m} months`);
  // the body itself: from one month to the next, across every stage boundary, no vertex moves much more than its neighbours in time
  // an id's height is rounded to the centimetre, so follow the median itself; around 18 years the median gives way to
  // the adult scale, so hold one height (H04, 1.70 m) on both sides
  const at = (sex, m) => { const d = presetDNA({ sex, age_months: m, level: m > 200 ? 4 : 5 }); d.height_m = m > 200 ? 1.7 : growth.stature(sex, m); return make(d).positions; };
  const step = (sex, m) => { const a = at(sex, m - 1), b = at(sex, m); let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
  for (const sex of ['male', 'female']) {
    for (const boundary of [1, 12, 24, 48, 84, 144, 216, 360, 720, 960]) {
      const here = step(sex, boundary), around = Math.max(step(sex, boundary + 1), boundary > 1 ? step(sex, boundary - 1) : 0);
      assert.ok(here <= 2 * around + 0.5 * MM, `${sex}: a jump of ${(here * 1000).toFixed(1)} mm at ${boundary} months (${(around * 1000).toFixed(1)} mm beside it)`);
    }
    for (const m of [300, 500, 700, 900, 1100]) assert.ok(step(sex, m) < 0.05 * MM, `${sex}: an adult body changes in a month at ${m} months`);
  }
});

test('age: children have a neutral, shared figure, and the adult channels cannot reach them', () => {
  // before maturity starts, the male and the female preset share one body: each at its own reference stature, they
  // differ in size alone (the two references are a centimetre or two apart)
  for (const months of [0, 6, 24, 60, 90]) {
    const a = make(presetDNA({ sex: 'male', age_months: months })), b = make(presetDNA({ sex: 'female', age_months: months }));
    assert.equal(a.resolved.skeletal_maturity, 0); assert.equal(b.resolved.skeletal_maturity, 0);
    for (const k of ['proportions', 'fat_distribution', 'body_fat', 'muscle_mass', 'aging']) assert.deepEqual(a.resolved[k], b.resolved[k], `${months} months: ${k}`);
    assert.equal(b.resolved.proportions.breast_volume, 0);
    let apart = 0;
    for (let i = 0; i < a.positions.length; i++) apart = Math.max(apart, Math.abs(a.positions[i] / a.dna.height_m - b.positions[i] / b.dna.height_m));
    assert.ok(apart < 0.01, `${months} months: the two presets differ by ${(apart * 100).toFixed(2)}% of the height`);
  }
  for (const d of [...CASES, ...SWEEP].filter((x) => x.age_months < gen.ADULT_MONTHS)) {
    const c = make(d);
    assert.equal(c.resolved.proportions.breast_volume, 0, `${d.id}: the bust is an adult channel`);
    for (const k of ADULT_ONLY) { const bad = clone(d); bad.proportions[k] = 0.5; assert.ok(validate(bad).errors.some((e) => e.code === 'MINOR_ADULT_CHANNEL'), `${d.id}: ${k}`); assert.equal(generate(bad).ok, false); }
  }
  // maturity cannot run ahead of age: asked for, it is limited and reported
  const early = presetDNA({ sex: 'female', age_months: 72 }); early.aging.skeletal_maturity = 1;
  const c = make(early), plain = make(presetDNA({ sex: 'female', age_months: 72 }));
  assert.equal(c.resolved.skeletal_maturity, 0); assert.deepEqual(c.positions, plain.positions);
  assert.deepEqual(c.corrections.map((k) => [k.rule, k.asked, k.used]), [['maturity-window', 1, 0]]);
  // no bust under 18 years, whatever the maturity asked for: the chest of a female minor is the chest the male preset
  // would have with the same frame
  const front = (c) => { const p = c.pieces.find((x) => x.name === 'Chest'); let z = -Infinity; for (let i = p.v0; i < p.v1; i++) z = Math.max(z, c.positions[3 * i + 2]); return z; };
  for (const months of [100, 156, 180, 215]) {
    const girl = presetDNA({ sex: 'female', age_months: months }); girl.aging.skeletal_maturity = 1;
    const g = make(girl), flat = make({ ...clone(girl), proportions: { ...girl.proportions } });
    assert.equal(g.resolved.proportions.breast_volume, 0, `${months} months`);
    const adultBust = make({ ...dnaFromId('F_H05_C04'), height_m: 1.6, height_level: 'H03' });
    const boy = make({ ...clone(girl), sex: 'male' });
    assert.ok(front(g) - front(boy) < 0.012 * girl.height_m, `${months} months: the chest stands ${((front(g) - front(boy)) * 100).toFixed(1)} cm ahead of the male preset's`);
    assert.ok(front(adultBust) - front(g) > 0.01, 'the adult preset has a bust the minor does not have');
    assert.deepEqual(flat.positions, g.positions);
  }
  // and nothing jumps at 18: the adult preset comes in over three years
  const at18 = (m) => make({ ...presetDNA({ sex: 'female', age_months: m, level: 4 }), height_m: 1.7 });
  assert.equal(at18(216).resolved.proportions.breast_volume, 0);
  let before = 0;
  for (let m = 216; m <= 252; m += 3) { const v = at18(m).resolved.proportions.breast_volume; assert.ok(v >= before && v - before < 0.08, `${m} months: ${v}`); before = v; }
  assert.equal(at18(252).resolved.proportions.breast_volume, 0.45); assert.equal(at18(400).resolved.proportions.breast_volume, 0.45);
  // from 18, an explicit value is the DNA's own choice and is used as given
  const chosen = at18(216).dna; chosen.proportions.breast_volume = 0.8;
  assert.equal(make(chosen).resolved.proportions.breast_volume, 0.8);
  // an adult is mature, whatever the DNA asks
  const late = dnaFromId('F_H05_C04'); late.aging.skeletal_maturity = 0;
  assert.equal(make(late).resolved.skeletal_maturity, 1); assert.ok(make(late).corrections.some((k) => k.rule === 'maturity-window'));
  // the figure channels act within part of their range on a body that is not mature, and say so
  const shaped = presetDNA({ sex: 'female', age_months: 72 }); Object.assign(shaped.proportions, { waist_width: 0, hip_width: 1, glute_projection: 1 });
  const s = make(shaped);
  assert.deepEqual(s.corrections.map((k) => k.rule), ['child-figure', 'child-figure', 'child-figure']);
  for (const k of s.corrections) assert.ok(Math.abs(k.used - 0.5) < Math.abs(k.asked - 0.5));
  const adult = dnaFromId('F_H05_C04'); Object.assign(adult.proportions, { waist_width: 0, hip_width: 1, glute_projection: 1 });
  assert.deepEqual(make(adult).corrections, []);
  // the builds are adult silhouettes: on a child they act in part, and a note says so
  const heavy = make(presetDNA({ age_months: 60, build: 10 })), heavyAdult = make(dnaFromId('M_H05_C10'));
  assert.ok(heavy.resolved.body_fat < heavyAdult.resolved.body_fat); assert.ok(heavy.notes.some((n) => n.includes('adult silhouettes')));
  assert.equal(make(presetDNA({ age_months: 60 })).notes.length, 0);
  // an explicit value on a minor is read on the scale of the age, and that is a correction with what was asked and used
  const fat = presetDNA({ age_months: 108 }); fat.body_fat = 0.8; fat.muscle_mass = 0.9;
  const f = make(fat);
  assert.deepEqual(f.corrections.filter((k) => k.rule === 'child-build').map((k) => [k.rule, k.channel, k.asked]), [['child-build', 'body_fat', 0.8], ['child-build', 'muscle_mass', 0.9]]);
  assert.ok(f.resolved.body_fat < 0.8 && f.resolved.muscle_mass < 0.9);
  const grown = dnaFromId('M_H05_C04'); grown.body_fat = 0.8; grown.muscle_mass = 0.9;
  assert.deepEqual(make(grown).corrections.filter((k) => k.rule === 'child-build'), []); assert.equal(make(grown).resolved.body_fat, 0.8);
});

// The figure measured on the mesh, in the bind pose: the waist-to-hip ratio (the widths of the abdomen's waist ring and of
// the pelvis's widest ring) and how far the glutes stand out of the hip ring, as a share of the height.
const ringOf = (c, name, r, n = 8) => { const p = c.pieces.find((x) => x.name === name); return Array.from({ length: n }, (_, k) => [0, 1, 2].map((j) => c.positions[3 * (p.v0 + n * r + k) + j])); };
const shape = (c) => { const waist = ringOf(c, 'Abdomen', 1), hip = ringOf(c, 'Pelvis', 1);
  return { whr: waist[0][0] / hip[0][0], glute: (-hip[5][2] - 0.85 * -hip[6][2]) / c.dna.height_m }; };

test('age: fat and figure channels cannot give a minor an adult figure', () => {
  const R = GROUPS.fat_distribution, only = (w) => Object.fromEntries(R.map((k) => [k, w[k] ?? 0]));
  const PATTERNS = [...R.map((k) => only({ [k]: 1 })), only({ hips: 0.32, glutes: 0.266, thighs: 0.414 }),
    only({ chest: 0.32, hips: 0.32, glutes: 0.266, thighs: 0.094 }), only({ hips: 0.5, glutes: 0.5 }), only({ chest: 0.6, glutes: 0.4 })];
  const FIG = { waist_width: 0, hip_width: 1, glute_volume: 1, glute_projection: 1 };
  const build = (sex, months, fat, fig, mature) => { const d = presetDNA({ sex, age_months: months }); d.body_fat = 1; d.fat_distribution = { ...fat };
    if (fig) Object.assign(d.proportions, FIG); if (mature) d.aging.skeletal_maturity = 1; return make(d); };
  for (const sex of ['female', 'male']) for (const months of [0, 6, 24, 60, 95, 120, 143, 156, 180, 200, 215]) {
    const heavy = shape(make(presetDNA({ sex, age_months: months, build: 10 })));
    // a child's limits are tighter than an adolescent's: these are the ones this generator holds, measured
    const [whrLeast, gluteMost] = months < 96 ? [0.75, 1.6] : [0.6, 1.9];
    for (const fat of PATTERNS) for (const fig of [false, true]) for (const mature of [false, true]) {
      const c = build(sex, months, fat, fig, mature), s = shape(c), label = `${sex} ${months} months ${JSON.stringify(fat)} figure ${fig} mature ${mature}`;
      assert.equal(c.measures.bust_m, 0, `${label}: no bust under 18 years`);
      assert.ok(s.whr >= whrLeast * heavy.whr, `${label}: waist-to-hip ${s.whr.toFixed(3)} against ${heavy.whr.toFixed(3)} for the heaviest build of the age`);
      assert.ok(s.glute <= gluteMost * heavy.glute, `${label}: glutes ${(100 * s.glute).toFixed(2)}% of the height against ${(100 * heavy.glute).toFixed(2)}%`);
      // what the weights could not do is said: asked and used for each explicit weight that changed
      for (const k of c.corrections.filter((x) => x.rule === 'child-fat')) assert.ok(R.includes(k.channel.split('.')[1]) && k.asked !== k.used);
      // no region of a minor holds more than 1.6 times, or less than 1/1.6 of, the share its own pattern gives it
      const plain = presetDNA({ sex, age_months: months }); plain.aging.skeletal_maturity = c.resolved.skeletal_maturity;
      const own = make(plain).resolved.fat_distribution;
      for (const k of R) assert.ok(c.resolved.fat_used[k] <= 1.6 * own[k] + 1e-9 && c.resolved.fat_used[k] >= own[k] / 1.6 - 1e-9, `${label}: ${k} holds ${c.resolved.fat_used[k].toFixed(3)} of the fat, its own pattern ${own[k].toFixed(3)}`);
    }
  }
  // before maturity starts, an explicit weight acts within 35% of its distance from the child's own pattern
  const child = presetDNA({ sex: 'female', age_months: 60 }), childOwn = make(child).resolved.fat_distribution;
  child.fat_distribution = only({ glutes: 1 });
  const glutes = make(child).resolved.fat_distribution.glutes;
  assert.ok(Math.abs(glutes - (childOwn.glutes + (1 - childOwn.glutes) * 0.35)) < 1e-9, `glutes ${glutes}`);
  // the same DNA on an adult goes further: the limits are the minor's, not the channels'
  const lower = only({ hips: 0.32, glutes: 0.266, thighs: 0.414 });
  const minor = shape(build('female', 200, lower, true, true)), adult = shape(build('female', 360, lower, true, true));
  assert.ok(adult.whr < minor.whr - 0.1 && adult.glute > minor.glute);
  // the defaults are not touched: a minor with nothing set has no correction about its figure or its fat
  for (const d of SWEEP.filter((x) => x.age_months < gen.ADULT_MONTHS)) assert.deepEqual(make(d).corrections.filter((k) => k.rule.startsWith('child-')), [], d.id);
  // and nothing jumps at 18: from 215 to 216 months the same DNA moves no vertex by more than 3 mm
  for (const sex of ['female', 'male']) {
    const at = (m) => { const d = presetDNA({ sex, age_months: m, level: 5 }); d.height_m = 1.75; d.body_fat = 1; d.fat_distribution = { ...lower }; Object.assign(d.proportions, FIG); return make(d); };
    const a = at(215).positions, b = at(216).positions;
    let most = 0; for (let i = 0; i < a.length; i++) most = Math.max(most, Math.abs(a[i] - b[i]));
    assert.ok(most < 3 * MM, `${sex}: ${(most * 1000).toFixed(2)} mm between 215 and 216 months`);
  }
});

test('age: adolescence is a gradual transition, and maturity is its own control', () => {
  let last = { male: -1, female: -1 };
  for (let m = 84; m <= 228; m += 6) for (const sex of ['male', 'female']) {
    const mat = make(presetDNA({ sex, age_months: m })).resolved.skeletal_maturity;
    assert.ok(mat >= last[sex] - 1e-12 && mat - Math.max(0, last[sex]) < 0.2, `${sex}: maturity ${mat.toFixed(2)} at ${m} months`); last[sex] = mat;
  }
  const [lo, hi] = growth.maturityWindow(156), teen = (v) => { const d = presetDNA({ sex: 'female', age_months: 156 }); d.aging.skeletal_maturity = v; return make(d); };
  assert.ok(lo < 0.2 && hi > 0.8 && hi < 1);
  // full maturity is not reached before 15 years, and the default of either sex is always inside the window
  assert.ok(growth.maturityWindow(179)[1] < 1); assert.equal(growth.maturityWindow(180)[1], 1);
  for (let m = 0; m <= 300; m++) for (const sex of ['male', 'female']) { const [a, b] = growth.maturityWindow(m), v = growth.maturity(sex, m); assert.ok(v >= a - 1e-12 && v <= b + 1e-12, `${sex} ${m}`); }
  assert.deepEqual(teen(1).corrections.map((k) => k.rule), ['maturity-window']); assert.ok(teen(1).resolved.skeletal_maturity < 1);
  assert.deepEqual(teen(0.3).corrections, []); assert.equal(teen(0.3).resolved.skeletal_maturity, 0.3);
  assert.notDeepEqual(teen(0.3).positions, teen(0.9).positions);
});

test('age is not frailty: an old character keeps its stature, and aging is a set of controls', () => {
  for (const sex of ['male', 'female']) {
    const adult = make(presetDNA({ sex, age_months: 480 })), old = make(presetDNA({ sex, age_months: 1020 }));
    assert.ok(Math.abs(old.measures.height_posed - 1.75) < 0.5 * MM, 'no height lost to age');
    assert.deepEqual(old.bones.map((b) => b.rest), adult.bones.map((b) => b.rest), 'no posture imposed by age');
    assert.deepEqual(old.limits, adult.limits, 'no mobility lost to age alone');
    assert.deepEqual(old.resolved.functional, adult.resolved.functional);
    assert.equal(old.motor_profile.library, 'adult');
    const fit = presetDNA({ sex, age_months: 1020 }); fit.aging.muscle_atrophy = 0; fit.aging.skin_laxity = 0;
    assert.deepEqual(make(fit).positions, adult.positions, 'with the aging controls at zero, 85 looks like 40');
    assert.notDeepEqual(old.positions, adult.positions, 'the mild defaults do show');
    const frail = presetDNA({ sex, age_months: 1020 }); frail.aging.muscle_atrophy = 1; frail.functional.joint_mobility = 0.2;
    const f = make(frail);
    assert.ok(pieceBox(f, 'Thigh_L', 2) < pieceBox(adult, 'Thigh_L', 2)); assert.ok(f.limits.Knee.flexion_max < adult.limits.Knee.flexion_max);
  }
});

test('infants: a recumbent neutral pose on the floor, and a motor profile for each stage', () => {
  const libraries = {};
  for (const d of CASES.filter((x) => x.id.startsWith('AGE_'))) {
    const c = make(d); libraries[c.stage] = c.motor_profile.library;
    assert.equal(c.measures.height_mode, d.age_months < 24 ? 'recumbent' : 'standing');
    if (d.age_months < 12) {
      assert.equal(c.motor_profile.stance, 'recumbent'); assert.ok(c.neutral_pose);
      const at = inspect(c, c.neutral_pose);
      assert.ok(Math.abs(at.min[1]) < 0.5 * MM, `${d.id}: lies at ${at.min[1]}`);
      assert.ok(at.max[1] < 0.6 * d.height_m, `${d.id}: is not lying down`);
      assert.ok(at.max[2] - at.min[2] > 0.6 * d.height_m, `${d.id}: does not lie along the floor`);
      assert.deepEqual(collisions(c, c.neutral_pose), [], `${d.id}: collisions in the neutral pose`);
      // it rests: the back of the head, the pelvis and the elbows touch the floor, and the feet too from six months
      const at2 = posedPositions(c, c.neutral_pose), low = (name) => { const p = c.pieces.find((x) => x.name === name); let y = Infinity; for (let v = p.v0; v < p.v1; v++) y = Math.min(y, at2[3 * v + 1]); return y; };
      for (const name of ['Head', 'Pelvis', 'Elbow_L', 'Elbow_R']) assert.ok(low(name) < 1 * MM, `${d.id}: ${name} is ${(low(name) * 100).toFixed(2)} cm above the floor`);
      assert.ok(low('Chest') < 1 * c.dna.height_m / 100, `${d.id}: the chest hovers`);
      if (d.age_months >= 6) for (const name of ['Foot_L', 'Foot_R']) assert.ok(low(name) < 1 * MM, `${d.id}: ${name} is ${(low(name) * 100).toFixed(2)} cm above the floor`);
      assert.equal(at.nonFinite, 0);
    } else { assert.equal(c.motor_profile.stance, 'standing'); assert.equal(c.neutral_pose, null); }
  }
  assert.deepEqual(libraries, { A01: 'newborn', A02: 'infant', A03: 'toddler', A04: 'child', A05: 'child', A06: 'adolescent', A07: 'adult', A08: 'adult', A09: 'adult', A10: 'adult' });
});

test('a height far from the age keeps the proportions of the nearest height of the range, and is noted', () => {
  const headShare = (c) => pieceBox(c, 'Head', 1) / c.dna.height_m;
  for (const [months, height] of [[24, 1.6], [200, 0.25], [0, 2.5], [60, 0.4]]) {
    const far = presetDNA({ age_months: months }); far.height_m = height;
    const c = make(far), reference = growth.shapeStature('male', months);
    const edge = reference * (height > reference ? growth.STATURE_RANGE[1] : growth.STATURE_RANGE[0]);
    const near = presetDNA({ age_months: months }); near.height_m = +edge.toFixed(6);
    assert.ok(c.notes.some((n) => n.includes('outside the proposed range') && n.includes('keeps the proportions')), `${months} months at ${height} m`);
    assert.ok(Math.abs(inspect(c).height - height) < 0.5 * MM); assert.deepEqual(collisions(c), []); assert.equal(c.solved, true);
    // the body is the one at the edge of the range, scaled as a whole: the head keeps its share of the height
    assert.ok(Math.abs(headShare(c) - headShare(make(near))) < 1e-4, `${months} months at ${height} m: head ${headShare(c).toFixed(4)} against ${headShare(make(near)).toFixed(4)}`);
  }
  for (const d of VALID) assert.ok(!make(d).notes.some((n) => n.includes('outside the proposed range')), d.id);
});

test('a body that cannot be solved says so: overlaps are reported, never hidden', () => {
  // the widest thighs on the shortest heavy woman: the legs open to the solver's limit and the thighs still meet
  const wide = dnaFromId('F_H01_C10'); wide.body_fat = 1; wide.proportions.thigh_volume = 1;
  const c = make(wide);
  assert.equal(c.solved, false);
  assert.ok(c.corrections.some((k) => k.rule === 'legs-limit' && k.detail.includes('overlap')));
  // No valid DNA found so far overlaps in the rest pose (6,000 extreme random bodies were searched): the sweep below
  // keeps checking that any overlap would be in the corrections.
  // over many random valid DNAs: every overlap in the rest pose is in the corrections, and solved tells the two apart
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let unsolved = 0;
  for (let i = 0; i < 1500; i++) {
    const months = Math.floor(rnd() * 1441), sex = rnd() < 0.5 ? 'male' : 'female';
    const d = presetDNA({ sex, age_months: months, level: 1 + Math.floor(rnd() * 10), build: 1 + Math.floor(rnd() * 10) });
    if (months < gen.ADULT_MONTHS && rnd() < 0.5) d.height_m = +(0.25 + rnd() * 2.25).toFixed(2);
    for (const k of ['bone_structure', 'muscle_mass', 'body_fat']) if (rnd() < 0.5) d[k] = rnd() < 0.3 ? Math.round(rnd()) : +rnd().toFixed(2);
    for (const [name, keys] of Object.entries(GROUPS)) for (const k of keys) {
      if (months < gen.ADULT_MONTHS && k.startsWith('breast')) continue;
      if (rnd() < 0.35) d[name][k] = rnd() < 0.3 ? Math.round(rnd()) : +rnd().toFixed(2);
    }
    if (GROUPS.fat_distribution.every((k) => d.fat_distribution[k] === 0)) d.fat_distribution.abdomen = 1;
    const r = generate(d);
    assert.ok(r.ok, `${JSON.stringify(d)}: ${JSON.stringify(r.errors)}`);
    const at = inspect(r);
    assert.equal(at.nonFinite, 0); assert.equal(at.degenerate, 0, JSON.stringify(d));
    assert.ok(Math.abs(at.min[1]) < 0.5 * MM, `feet at ${at.min[1]}: ${JSON.stringify(d)}`);
    assert.ok(Math.abs(r.measures.height_built - d.height_m) < 0.5 * MM, `built ${r.measures.height_built}: ${JSON.stringify(d)}`);
    const overlaps = collisions(r).length;
    assert.equal(r.corrections.filter((k) => k.rule === 'overlap' && k.channel === 'pose.rest').length, overlaps);
    assert.equal(r.solved, !r.corrections.some((k) => k.rule === 'overlap' || k.rule.endsWith('-limit')));
    if (!r.solved) unsolved++;
  }
  assert.ok(unsolved < 400, `${unsolved} of 1500 random bodies could not be solved`);
});

test('posture never lifts the feet: a tilted pelvis stands on the floor to the hundredth of a millimetre', () => {
  for (const tilt of [0, 0.25, 0.75, 1]) for (const id of ['M_H05_C04', 'F_H01_C10', 'M_H10_C01']) {
    const d = dnaFromId(id); d.posture.pelvic_tilt = tilt; d.posture.spine_curvature = 1 - tilt;
    const c = make(d), at = inspect(c);
    assert.ok(Math.abs(at.min[1]) < 0.01 * MM, `${id} tilt ${tilt}: feet at ${at.min[1]}`);
    assert.ok(Math.abs(c.measures.height_built - d.height_m) < 0.5 * MM); assert.deepEqual(c.bones[0].head, [0, 0, 0]);
    assert.deepEqual(collisions(c), []);
  }
});

test('a raised arm leaves no gap at the shoulder: the ball stays with the trunk and reaches into the chest', () => {
  for (const d of [dnaFromId('M_H05_C04'), dnaFromId('F_H05_C08'), byId.EXT_M_H10_C10, presetDNA({ age_months: 6 }), presetDNA({ sex: 'female', age_months: 108 })]) {
    const c = make(d), piece = Object.fromEntries(c.pieces.map((p) => [p.name, p]));
    for (const s of ['L', 'R']) {
      assert.equal(piece['Shoulder_' + s].bone, 'Clavicle_' + s);
      const sign = s === 'L' ? 1 : -1, joint = c.bones.find((b) => b.name === 'UpperArm_' + s).head;
      let inner = Infinity; for (let i = piece['Shoulder_' + s].v0; i < piece['Shoulder_' + s].v1; i++) inner = Math.min(inner, sign * c.positions[3 * i]);
      let chest = -Infinity; for (let i = piece.Chest.v0; i < piece.Chest.v1; i++) if (Math.abs(c.positions[3 * i + 1] - joint[1]) < 0.03 * d.height_m) chest = Math.max(chest, sign * c.positions[3 * i]);
      assert.ok(inner < chest - 0.002 * d.height_m, `${d.id} ${s}: the ball ends ${((inner - chest) * 1000).toFixed(1)} mm short of the chest`);
      // raising the arm does not move the ball
      const raised = posedPositions(c, { ['UpperArm_' + s]: quat(Z, sign * 80) }), rest = posedPositions(c);
      for (let i = 3 * piece['Shoulder_' + s].v0; i < 3 * piece['Shoulder_' + s].v1; i++) assert.equal(raised[i], rest[i]);
    }
  }
});

// ---------------------------------------------------------------- cost

test('performance on the CPU is measured (the GPU is not: see README.md)', (t) => {
  const dnas = GRID.slice(0, 100);
  for (const d of dnas.slice(0, 10)) generate(d);   // warm up
  const start = process.hrtime.bigint();
  for (const d of dnas) generate(d);
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / dnas.length;
  t.diagnostic(`${ms.toFixed(3)} ms per character (${gen.TRIANGLES[1]} triangles), ${Math.round(1000 / ms)} characters per second`);
  assert.ok(ms < 20, `${ms.toFixed(2)} ms per character`);
});

test('memory: generating thousands of characters keeps nothing', (t) => {
  if (typeof globalThis.gc !== 'function') { t.diagnostic('run with node --expose-gc to measure the heap; checked instead that results hold no shared state'); }
  const a = make(dnaFromId('M_H05_C04')), b = make(dnaFromId('M_H05_C04'));
  assert.notEqual(a.positions.buffer, b.positions.buffer); assert.notEqual(a.dna, b.dna); assert.notEqual(a.bones[0].head, b.bones[0].head);
  a.positions.fill(0); a.dna.proportions.head_size = 1; a.resolved.proportions.head_size = 1;
  assert.deepEqual(make(dnaFromId('M_H05_C04')).positions, b.positions, 'a caller that edits a result does not change the next one');
  if (typeof globalThis.gc === 'function') {
    globalThis.gc(); const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 4000; i++) generate(GRID[i % GRID.length]);
    globalThis.gc(); const grown = (process.memoryUsage().heapUsed - before) / 1e6;
    t.diagnostic(`heap after 4000 characters: ${grown.toFixed(2)} MB more`);
    assert.ok(grown < 8, `${grown.toFixed(1)} MB kept`);
  }
});

test('colliders are apart from the mesh: one capsule per piece, inside its piece', () => {
  const c = make(dnaFromId('M_H05_C04'));
  assert.equal(colliders(c).length, c.pieces.length);
  for (const k of colliders(c)) assert.ok(k.r > 0 && [...k.a, ...k.b].every(Number.isFinite), k.name);
  const hit = collisions(c, { UpperArm_L: quat(Z, -40) });   // an arm pushed through the body is seen
  assert.ok(hit.some((x) => [x.a, x.b].includes('Forearm_L') || [x.a, x.b].includes('Hand_L') || [x.a, x.b].includes('UpperArm_L')), JSON.stringify(hit));
});
