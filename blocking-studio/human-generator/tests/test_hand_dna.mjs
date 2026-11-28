// The Hand DNA's contract (hands/index.js: validateHands, validateHandSide, buildHand, blendHands, buildHands, and the
// options of generate()): what is checked is what is built, nothing is refused or accepted silently, and no input
// throws. One test for each finding of the contract review. Run from the repository's root with:
//   node --test blocking-studio/human-generator/tests/test_hand_dna.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as gen from '../generator.js';
import * as H from '../hands/index.js';
import { getPose } from '../hands/poses.js';

const { generate, presetDNA, dnaFromId } = gen;
const WOMAN = dnaFromId('F_H05_C04');
const L = () => ({ pose: 'HP01' }), R = () => ({ pose: 'HP01' });
const both = () => ({ left: L(), right: R() });
const clone = (o) => JSON.parse(JSON.stringify(o));
const codes = (r) => r.errors.map((e) => `${e.stage} ${e.code} ${e.path}`);
const has = (r, code, path) => r.errors.some((e) => e.stage === 'hands' && e.code === code && e.path === path);
const refused = (r, code, path, what) => { assert.equal(r.ok, false, what); assert.ok(has(r, code, path), `${what}: ${JSON.stringify(codes(r))}`); };
const accepted = (r, what) => { assert.ok(r.ok, `${what}: ${JSON.stringify(r.errors)}`); return r; };
const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
const handDnaSection = () => { const at = README.indexOf('### The Hand DNA'), next = README.indexOf('\n### ', at + 1); return README.slice(at, next); };

test('validateHands reads the block once: a getter, a Proxy or a toJSON cannot change what is checked, and buildHands builds that copy', () => {
  // toJSON on the prototype answers a different block (level 7, HP25): the own data is what is checked and returned
  class Spec { constructor() { this.left = { pose: 'HP01' }; this.right = { pose: 'HP01' }; } toJSON() { return { mode: 'preset', level: 7, left: { pose: 'HP25' }, right: { pose: 'HP01' } }; } }
  const v = accepted(H.validateHands(new Spec()), 'own data, toJSON ignored');
  assert.deepEqual(v.spec, both()); assert.equal(v.spec.level, undefined);
  const built = accepted(H.buildHands(new Spec(), { level: 1 }), 'buildHands of the same block');
  assert.equal(built.left.pose, 'HP01'); assert.equal(built.right.pose, 'HP01'); assert.equal(built.level, 1);
  // a getter is refused and never called (it could answer differently each time)
  let reads = 0;
  const getter = { left: L(), right: { get pose() { reads++; return reads <= 4 ? 'HP01' : 'HP24'; } } };
  refused(H.validateHands(getter), 'TYPE', 'right.pose', 'a getter');
  refused(H.buildHands(getter), 'TYPE', 'right.pose', 'a getter, buildHands');
  assert.equal(reads, 0, 'the getter is never called');
  let dom = 0;
  refused(H.validateHands({ ...both(), get dominant_hand() { dom++; return dom === 1 ? 'right' : 'banana'; } }), 'TYPE', 'dominant_hand', 'a getter on the top level');
  // a Proxy whose traps throw is refused, never thrown
  const boom = new Proxy({}, { ownKeys() { throw new Error('nope'); } });
  refused(H.validateHands(boom), 'TYPE', '', 'a Proxy whose ownKeys throws');
  refused(H.validateHands({ left: L(), right: new Proxy({ pose: 'HP01' }, { getOwnPropertyDescriptor() { throw new Error('no descriptor'); } }) }), 'TYPE', 'right.pose', 'a Proxy whose descriptor trap throws');
  // the spec is a copy: changing the block afterwards does not change it
  const block = { left: L(), right: { pose: 'HP06', fingers: { index: { curl: 0.5 } } } };
  const s = accepted(H.validateHands(block), 'a plain block').spec;
  block.right.pose = 'HP25'; block.right.fingers.index.curl = 7;
  assert.equal(s.right.pose, 'HP06'); assert.equal(s.right.fingers.index.curl, 0.5);
  assert.notEqual(s.right, block.right); assert.notEqual(s.right.fingers, block.right.fingers);
});

test('inherited sides do not count (the direct API and generate() agree), and buildHands never throws', () => {
  for (const inherited of [Object.create(both()), { __proto__: both() }]) {
    const v = H.validateHands(inherited);
    assert.equal(v.ok, false); assert.equal(v.spec, null);
    assert.deepEqual(codes(v), ['hands REQUIRED left', 'hands REQUIRED right']);
    let b;
    assert.doesNotThrow(() => { b = H.buildHands(inherited); });
    assert.deepEqual(codes(b), codes(v));
    assert.deepEqual(codes(generate(WOMAN, { hands: inherited })), codes(v), 'generate() says the same');
  }
  // an inherited key of a side does not count either
  refused(H.validateHands({ left: L(), right: Object.create({ pose: 'HP01' }) }), 'REQUIRED', 'right.pose', 'an inherited pose');
  // whatever is handed in, buildHands returns { ok: false, errors }
  const odd = [null, undefined, 7, 'HP01', [], new Proxy({}, { ownKeys() { throw new Error('nope'); } }), { ...both(), level: 7 }, { left: L(), right: { pose: 1n } }];
  for (const x of odd) {
    let r;
    assert.doesNotThrow(() => { r = H.buildHands(x); }, String(x));
    assert.equal(r.ok, false); assert.ok(r.errors.length > 0 && r.errors.every((e) => e.stage === 'hands' && typeof e.path === 'string' && e.message.length > 0), JSON.stringify(r.errors));
  }
  // and its own options are checked: a level that is not one, an option bag that is not an object
  refused(H.buildHands(both(), { level: 7 }), 'RANGE', 'opts.level', 'opts.level 7');
  refused(H.buildHands(both(), { level: '1' }), 'TYPE', 'opts.level', 'opts.level "1"');
  refused(H.buildHands(both(), 'x'), 'TYPE', 'opts', 'opts a string');
});

test('unknown keys that are symbols or non-enumerable are refused, on the direct API and through generate()', () => {
  refused(H.validateHands({ [Symbol('x')]: 1, ...both() }), 'UNKNOWN_KEY', 'Symbol(x)', 'a symbol key');
  refused(H.validateHands({ left: L(), right: { pose: 'HP01', [Symbol('curl')]: 1 } }), 'UNKNOWN_KEY', 'right.Symbol(curl)', 'a symbol key of a side');
  refused(H.validateHands(Object.defineProperty(both(), 'extra', { value: 1, enumerable: false })), 'UNKNOWN_KEY', 'extra', 'a non-enumerable unknown key');
  const nonEnumFinger = { left: L(), right: { pose: 'HP01', fingers: Object.defineProperty({}, 'thumb', { value: { curl: 1 }, enumerable: false }) } };
  refused(H.validateHands(nonEnumFinger), 'UNKNOWN_KEY', 'right.fingers.thumb', 'a non-enumerable unknown key of fingers');
  // a key the schema has, but not enumerable: refused (JSON and Object.keys would not see it, so it is not "given")
  refused(H.validateHands(Object.defineProperty(both(), 'size', { value: 0.9, enumerable: false })), 'TYPE', 'size', 'a non-enumerable allowed key');
  assert.equal(H.validateHandSide({ pose: 'HP01', [Symbol('s')]: 0 }, 'right').map((e) => `${e.code} ${e.path}`).join(), 'UNKNOWN_KEY right.Symbol(s)');
  // through generate(): the hands block and generate()'s own options
  assert.deepEqual(codes(generate(WOMAN, { hands: { [Symbol('x')]: 1, ...both() } })), ['hands UNKNOWN_KEY Symbol(x)']);
  const curl = { left: L(), right: Object.defineProperty({ pose: 'HP01' }, 'curl', { value: 1, enumerable: false }) };
  assert.deepEqual(codes(generate(WOMAN, { hands: curl })), ['hands UNKNOWN_KEY right.curl']);
  assert.deepEqual(codes(generate(WOMAN, { [Symbol('x')]: 1 })), ['generator UNKNOWN_KEY options.Symbol(x)']);
  assert.deepEqual(codes(generate(WOMAN, Object.defineProperty({}, 'hands', { value: both(), enumerable: false }))), ['generator TYPE options.hands']);
  // the read-once copy through generate() still reads a getter once (tests/test_hands.mjs), and builds that value
  let reads = 0;
  const c = generate(WOMAN, { hands: { left: L(), right: { get pose() { reads++; return reads === 1 ? 'HP10' : 'HP25'; } } } });
  assert.ok(c.ok); assert.equal(c.hands.right.pose, 'HP10'); assert.equal(reads, 1);
});

test('a mirror with both sides given keeps the source side and says, in notes, which block it replaced', () => {
  const spec = { mirror: 'right_to_left', left: { pose: 'HP05', fingers: { index: { curl: 0.5 } } }, right: { pose: 'HP07' } };
  const v = accepted(H.validateHands(spec), 'both sides and a mirror (index.html sends that)');
  assert.deepEqual(v.spec.left, { pose: 'HP07' }); assert.notEqual(v.spec.left, v.spec.right);
  assert.equal(v.notes.length, 1); assert.match(v.notes[0], /right_to_left/); assert.match(v.notes[0], /left/); assert.match(v.notes[0], /HP05/); assert.match(v.notes[0], /HP07/);
  const ltr = accepted(H.validateHands({ mirror: 'left_to_right', left: { pose: 'HP10' }, right: { pose: 'HP04' } }), 'left_to_right');
  assert.equal(ltr.spec.right.pose, 'HP10'); assert.match(ltr.notes.join(' '), /the right hand's block given \(pose HP04\)/);
  // nothing replaced, nothing said
  assert.deepEqual(accepted(H.validateHands({ mirror: 'right_to_left', right: { pose: 'HP07' } }), 'only the source').notes, []);
  assert.deepEqual(accepted(H.validateHands(both()), 'no mirror').notes, []);
  assert.deepEqual(H.validateHands({ left: L() }).notes, [], 'a refused block has no notes');
  // buildHands and generate() carry the note
  assert.deepEqual(accepted(H.buildHands(spec, { level: 1 }), 'buildHands').notes, v.notes);
  const c = accepted(generate(WOMAN, { hands: spec }), 'generate()');
  assert.equal(c.hands.left.pose, 'HP07'); assert.ok(c.hands.notes.includes(v.notes[0]), JSON.stringify(c.hands.notes));
});

test('NaN, Infinity and BigInt are named in the messages, never shown as null, and never throw', () => {
  const msg = (r, path) => r.errors.find((e) => e.path === path)?.message ?? `(no error at ${path}: ${JSON.stringify(r.errors)})`;
  for (const [v, shown] of [[NaN, 'NaN'], [Infinity, 'Infinity'], [-Infinity, '-Infinity']]) {
    const r = H.validateHands({ ...both(), size: v });
    assert.match(msg(r, 'size'), new RegExp(`got ${shown}\\)`)); assert.doesNotMatch(msg(r, 'size'), /got null/);
    assert.match(msg(H.validateHands({ left: L(), right: { pose: 'HP06', grip_radius_m: v } }), 'right.grip_radius_m'), new RegExp(`got ${shown}\\)`));
    assert.match(msg(H.validateHands({ left: L(), right: { pose: 'HP06', fingers: { index: { curl: v } } } }), 'right.fingers.index.curl'), new RegExp(`got ${shown}\\)`));
  }
  let r;
  assert.doesNotThrow(() => { r = H.validateHands({ ...both(), size: 1n, level: 2n, mode: 3n }); });
  assert.match(msg(r, 'size'), /got 1n/); assert.match(msg(r, 'level'), /got 2n/); assert.match(msg(r, 'mode'), /got 3n/);
  assert.doesNotThrow(() => { r = H.buildHand({ pose: 'HP01', level: 0, variant: 5n }); });
  assert.equal(r.ok, false);
  const a = accepted(H.buildHand({ pose: 'HP01', level: 3 }), 'a level 3 hand');
  assert.match(H.blendHands(a, a, NaN).errors[0].message, /got NaN\)/);
});

test('buildHand returns INVALID_POSE for a malformed pose object instead of throwing', () => {
  const nan = clone(getPose('HP01')); nan.fingers.index.mcp_flex_deg = NaN;   // JSON turned it to null: set it back
  const cases = [
    [nan, /index\.mcp/],
    [{ fingers: {}, thumb: {} }, /index/],
    [{ ...clone(getPose('HP01')), thumb: { ...clone(getPose('HP01')).thumb, ip_flex_deg: Infinity } }, /thumb\.ip/],
    [{ ...clone(getPose('HP06')), contact: { type: 'cylinder', radius_m: -0.01 } }, /radius/],
    [{ ...clone(getPose('HP06')), contact: 'cylinder' }, /contact/],
    [{ ...clone(getPose('HP06')), contact: { type: 'banana', radius_m: 0.02 } }, /contact type/],
    [{ ...clone(getPose('HP01')), id: 1n }, /BigInt|serialize/i],
  ];
  for (const [pose, why] of cases) {
    let r;
    assert.doesNotThrow(() => { r = H.buildHand({ pose, level: 0 }); });
    assert.equal(r.ok, false); assert.deepEqual(r.errors.map((e) => `${e.code} ${e.path}`), ['INVALID_POSE pose']); assert.match(r.errors[0].message, why);
  }
  assert.deepEqual(H.buildHand({ pose: [], level: 0 }).errors.map((e) => `${e.code} ${e.path}`), ['TYPE pose']);
  // a well-formed pose object still builds, as its id does
  const own = accepted(H.buildHand({ pose: clone(getPose('HP04')), level: 3 }), 'a copied pose object');
  assert.deepEqual(own.positions, accepted(H.buildHand({ pose: 'HP04', level: 3 }), 'HP04').positions);
});

test('blendHands refuses two hands built on different bodies (BLEND_INCOMPATIBLE body)', () => {
  const small = { length: 0.15, ring: { w: 0.017, f: 0.024, b: 0.024 } };
  const a = accepted(H.buildHand({ pose: 'HP01', level: 1 }), 'reference body'), b = accepted(H.buildHand({ pose: 'HP06', level: 1, body: small }), 'small body');
  const r = H.blendHands(a, b, 0.5);
  assert.equal(r.ok, false); assert.deepEqual(r.errors.map((e) => `${e.code} ${e.path}`), ['BLEND_INCOMPATIBLE body']);
  // a hand-level control changes the dimensions too
  const big = accepted(H.buildHand({ pose: 'HP06', level: 1, controls: { size: 0.9 } }), 'size 0.9');
  assert.deepEqual(H.blendHands(a, big, 0.5).errors.map((e) => `${e.code} ${e.path}`), ['BLEND_INCOMPATIBLE body']);
  // one body: blended, and the wrist record is the base's
  const c = accepted(H.buildHand({ pose: 'HP06', level: 1 }), 'HP06 reference');
  const m = accepted(H.blendHands(a, c, 0.5), 'one body');
  for (let a3 = 0; a3 < 3; a3++) assert.ok(Math.abs(m.wrist.ring[0][a3] - m.positions[a3]) < 1e-12, 'the wrist record matches the base');
  // something that is not a built hand is refused, not thrown
  assert.deepEqual(H.blendHands({ ok: true }, a, 0.5).errors.map((e) => e.code), ['TYPE']);
});

test('the Hand DNA takes null only where its schema lists it', () => {
  const side = (block) => ({ left: L(), right: { pose: 'HP06', ...block } });
  const refusedNull = [
    [side({ grip_strength: null }), 'right.grip_strength'], [side({ object: null }), 'right.object'],
    [side({ fingers: null }), 'right.fingers'], [side({ fingers: { index: null } }), 'right.fingers.index'],
    ...['curl', 'spread', 'twist', 'length', 'thickness'].map((k) => [side({ fingers: { ring: { [k]: null } } }), `right.fingers.ring.${k}`]),
    [side({ thumb: null }), 'right.thumb'], ...['flexion', 'abduction', 'opposition'].map((k) => [side({ thumb: { [k]: null } }), `right.thumb.${k}`]),
    [{ ...both(), mirror: null }, 'mirror'], [{ left: L(), right: null }, 'right'], [{ left: L(), right: { pose: null } }, 'right.pose'],
  ];
  for (const [spec, path] of refusedNull) {
    const v = H.validateHands(spec);
    assert.equal(v.ok, false, path); assert.ok(v.errors.some((e) => e.path === path && (e.code === 'TYPE' || e.code === 'REQUIRED')), `${path}: ${JSON.stringify(codes(v))}`);
    assert.equal(generate(WOMAN, { hands: spec }).ok, false, `${path} through generate()`);
  }
  // the schema's nulls: the default
  const nulls = { mode: null, level: null, size: null, palm_width: null, finger_length: null, finger_thickness: null, dominant_hand: null,
    left: L(), right: { pose: 'HP06', grip_radius_m: null, object: { shape: null, orientation_deg: null } } };
  assert.deepEqual(accepted(H.validateHands(nulls), 'the listed nulls').spec, nulls);
  // the README says so
  assert.match(handDnaSection(), /null[^.]*only where the schema lists it/i);
  // buildHand's own grip and controls still take null as the default (what the generator hands it)
  accepted(H.buildHand({ pose: 'HP06', level: 3, grip: { grip_radius_m: null, object: null, grip_strength: null }, controls: { fingers: null, thumb: null } }), 'buildHand nulls');
});

test('buildHand refuses unknown argument and body keys, and a body outside the range of hands', () => {
  const at = (args) => H.buildHand(args).errors?.map((e) => `${e.code} ${e.path}`) ?? [];
  assert.deepEqual(at({ pose: 'HP01', level: 0, sid: 'left' }), ['UNKNOWN_KEY sid']);
  assert.deepEqual(at({ pose: 'HP01', level: 0, [Symbol('side')]: 'left' }), ['UNKNOWN_KEY Symbol(side)']);
  assert.deepEqual(at({ level: 0, body: { colour: 'red' } }), ['UNKNOWN_KEY body.colour']);
  assert.deepEqual(at({ level: 0, body: { ring: { w: 0.02, f: 0.03, b: 0.03, x: 1 } } }), ['UNKNOWN_KEY body.ring.x']);
  assert.deepEqual(at({ level: 0, body: { length: 1e200 } }), ['RANGE body.length']);
  assert.deepEqual(at({ level: 0, body: { length: 0.001 } }), ['RANGE body.length']);
  assert.deepEqual(at({ level: 0, body: { length: '0.18' } }), ['TYPE body.length']);
  assert.deepEqual(at({ level: 0, body: { ring: { w: 1e300 } } }), ['RANGE body.ring.w']);
  assert.deepEqual(at({ level: 0, body: { ring: { f: 1e-5 } } }), ['RANGE body.ring.f']);
  assert.deepEqual(at({ level: 0, body: { fem: 2 } }), ['RANGE body.fem']);
  assert.deepEqual(at({ level: 0, body: { months: -1 } }), ['RANGE body.months']);
  assert.deepEqual(at({ level: 0, body: 'adult' }), ['TYPE body']);
  assert.deepEqual(at(null), ['TYPE ']);
  assert.deepEqual(H.HAND_BODY_RANGE, { length: [0.02, 0.45], ring: [0.0015, 0.08] });
  // the range holds every hand generate() gives: the smallest bodies the human DNA allows build at hand level 0
  for (const [sex, months, muscle] of [['female', 215, null], ['female', 144, 0]]) {
    const dna = { ...presetDNA({ sex, age_months: months, level: 1, build: 1 }), height_m: 0.25, muscle_mass: muscle, bone_structure: muscle };
    const c = accepted(generate(dna, { hands: { level: 0, ...both() } }), `${sex} ${months} months at 0.25 m`);
    const b = c.hands.left.body;
    assert.ok(b.length >= H.HAND_BODY_RANGE.length[0] && Math.min(b.ring.w, b.ring.f, b.ring.b) >= H.HAND_BODY_RANGE.ring[0], JSON.stringify(b));
  }
});

test('every control key is checked at its own path: unknown keys, numbers given as strings, and both ends of every range', () => {
  const only = (spec, code, path, what) => {
    const v = H.validateHands(spec);
    assert.equal(v.ok, false, what); assert.deepEqual(v.errors.map((e) => `${e.stage} ${e.code} ${e.path}`), [`hands ${code} ${path}`], what);
  };
  const side = (block) => ({ left: L(), right: { pose: 'HP06', ...block } });
  // unknown keys inside each finger, an unknown finger, inside the thumb and the object
  for (const f of ['index', 'middle', 'ring', 'pinky']) only(side({ fingers: { [f]: { bend: 1 } } }), 'UNKNOWN_KEY', `right.fingers.${f}.bend`, `fingers.${f}.bend`);
  for (const f of ['thumb', 'little', 'Index']) only(side({ fingers: { [f]: { curl: 0 } } }), 'UNKNOWN_KEY', `right.fingers.${f}`, `fingers.${f}`);
  for (const k of ['curl', 'bend', 'twist']) only(side({ thumb: { [k]: 0 } }), 'UNKNOWN_KEY', `right.thumb.${k}`, `thumb.${k}`);
  only(side({ object: { shape: 'cylinder', radius: 0.02 } }), 'UNKNOWN_KEY', 'right.object.radius', 'object.radius');
  // numbers given as strings
  for (const [block, path] of [[{ thumb: { flexion: '0.5' } }, 'right.thumb.flexion'], [{ fingers: { index: { curl: '1' } } }, 'right.fingers.index.curl'],
    [{ grip_strength: '0.5' }, 'right.grip_strength'], [{ grip_radius_m: '0.02' }, 'right.grip_radius_m'], [{ object: { orientation_deg: '10' } }, 'right.object.orientation_deg'],
    [{ fingers: { pinky: { thickness: '0.5' } } }, 'right.fingers.pinky.thickness'], [{ thumb: { opposition: new Number(0.5) } }, 'right.thumb.opposition']]) only(side(block), 'TYPE', path, path);
  only({ ...both(), size: '0.5' }, 'TYPE', 'size', 'size "0.5"');
  // both ends of every range: the end is taken, just past it is refused (and the same in buildHand's own arguments)
  const past = (x, dir) => x + dir * Math.max(1, Math.abs(x)) * 1e-9;
  const ranges = [];
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    for (const k of ['curl', 'spread', 'twist']) ranges.push([`right.fingers.${f}.${k}`, -1, 1, (x) => side({ fingers: { [f]: { [k]: x } } }), (x) => ({ controls: { fingers: { [f]: { [k]: x } } } }), `controls.fingers.${f}.${k}`]);
    for (const k of ['length', 'thickness']) ranges.push([`right.fingers.${f}.${k}`, 0, 1, (x) => side({ fingers: { [f]: { [k]: x } } }), (x) => ({ controls: { fingers: { [f]: { [k]: x } } } }), `controls.fingers.${f}.${k}`]);
  }
  for (const k of ['flexion', 'abduction', 'opposition']) ranges.push([`right.thumb.${k}`, -1, 1, (x) => side({ thumb: { [k]: x } }), (x) => ({ controls: { thumb: { [k]: x } } }), `controls.thumb.${k}`]);
  for (const k of ['size', 'palm_width', 'finger_length', 'finger_thickness']) ranges.push([k, 0, 1, (x) => ({ ...both(), [k]: x }), (x) => ({ controls: { [k]: x } }), `controls.${k}`]);
  ranges.push(['right.grip_strength', 0, 1, (x) => side({ grip_strength: x }), (x) => ({ grip: { grip_strength: x } }), 'grip.grip_strength']);
  ranges.push(['right.grip_radius_m', 0, H.MAX_GRIP_RADIUS_M, (x) => side({ grip_radius_m: x }), (x) => ({ grip: { grip_radius_m: x } }), 'grip.grip_radius_m']);
  ranges.push(['right.object.orientation_deg', -90, 90, (x) => side({ object: { orientation_deg: x } }), (x) => ({ grip: { object: { orientation_deg: x } } }), 'grip.object.orientation_deg']);
  ranges.push(['level', 0, 4, (x) => ({ ...both(), level: x }), null, null]);
  for (const [path, lo, hi, dna, args, argPath] of ranges) {
    for (const end of [lo, hi]) accepted(H.validateHands(dna(end)), `${path} = ${end}`);
    // below the radius's range is its own code (README: NEGATIVE_RADIUS); a level is an integer, so 1 past its ends
    const low = path === 'level' ? lo - 1 : past(lo, -1), high = path === 'level' ? hi + 1 : past(hi, 1);
    only(dna(low), path === 'right.grip_radius_m' ? 'NEGATIVE_RADIUS' : 'RANGE', path, `${path} = ${low}`);
    only(dna(high), 'RANGE', path, `${path} = ${high}`);
    if (!args) continue;
    for (const [x, code] of [[low, path === 'right.grip_radius_m' ? 'NEGATIVE_RADIUS' : 'RANGE'], [high, 'RANGE'], ['0.5', 'TYPE']]) {
      assert.deepEqual(H.buildHand({ pose: 'HP06', level: 3, ...args(x) }).errors?.map((e) => `${e.code} ${e.path}`), [`${code} ${argPath}`], `buildHand ${argPath} = ${x}`);
    }
  }
});

test('the exported pose list and the pose library are frozen: no module can change what validates', () => {
  assert.ok(Object.isFrozen(H.POSES)); assert.throws(() => H.POSES.push('HP25'), TypeError);
  assert.equal(H.POSES.length, 24);
  refused(H.validateHands({ left: L(), right: { pose: 'HP25' } }), 'UNKNOWN_POSE', 'right.pose', 'HP25 after the push');
  for (const list of [H.HAND_MODES, H.MIRROR_MODES, H.OBJECT_SHAPES]) { assert.ok(Object.isFrozen(list)); assert.throws(() => list.push('x'), TypeError); }
  const lib = H.HAND_POSE_LIBRARY, p = lib.poses[0];
  for (const o of [lib, lib.poses, lib.notes, p, p.fingers, p.fingers.index, p.thumb, p.contact]) assert.ok(Object.isFrozen(o));
  assert.throws(() => { p.fingers.index.mcp_flex_deg = 90; }, TypeError);
  assert.throws(() => { lib.poses.push({}); }, TypeError);
  assert.equal(getPose('HP01').fingers.index.mcp_flex_deg, 15, 'HP01 is unchanged');
});

test('the 0.5 m bound on grip_radius_m is documented in the README\'s Hand DNA schema', () => {
  assert.equal(H.MAX_GRIP_RADIUS_M, 0.5);
  assert.match(handDnaSection(), /"grip_radius_m": "null \| 0\.\.0\.5 \(metres\)"/);
  accepted(H.validateHands({ left: L(), right: { pose: 'HP06', grip_radius_m: 0.5 } }), '0.5');
  const v = H.validateHands({ left: L(), right: { pose: 'HP06', grip_radius_m: 0.5000001 } });
  refused(v, 'RANGE', 'right.grip_radius_m', '0.5000001'); assert.match(v.errors[0].message, /0\.\.0\.5 m/);
});

test('buildHands names, in the errors of buildHand, paths that exist in the Hand DNA (or the option they came from)', () => {
  // the mapping of buildHand's argument paths
  const map = [['controls.size', 'size'], ['controls.finger_thickness', 'finger_thickness'], ['controls.fingers.index.curl', 'right.fingers.index.curl'],
    ['controls.thumb', 'right.thumb'], ['controls', 'right'], ['grip.grip_radius_m', 'right.grip_radius_m'], ['grip.object.shape', 'right.object.shape'],
    ['grip', 'right'], ['pose', 'right.pose'], ['mode', 'mode'], ['level', 'level'], ['', 'right']];
  for (const [from, to] of map) assert.equal(H.handDnaPath('right', from), to, from);
  assert.equal(H.handDnaPath('left', 'body.ring.w', 'bodyLeft'), 'opts.bodyLeft.ring.w');
  assert.equal(H.handDnaPath('left', 'body.length'), 'body.length');
  // through buildHands: a body that cannot be a hand names the option it came from, for the side it was given
  assert.deepEqual(codes(H.buildHands(both(), { bodyRight: { length: 1e200 }, level: 3 })), ['hands RANGE opts.bodyRight.length']);
  assert.deepEqual(codes(H.buildHands(both(), { body: { length: '0.18' }, level: 3 })), ['hands TYPE opts.body.length', 'hands TYPE opts.body.length']);
  // and every path of a refused block is one the block can have
  const top = ['', 'mode', 'level', 'size', 'palm_width', 'finger_length', 'finger_thickness', 'dominant_hand', 'mirror', 'left', 'right'];
  const r = H.buildHands({ size: 2, left: { pose: 'HP06', grip_radius_m: -1, fingers: { index: { curl: 3 } } }, right: { pose: 'HP99', object: { shape: 'cone' } } });
  assert.equal(r.ok, false);
  for (const e of r.errors) assert.ok(top.includes(e.path.split('.')[0]) && !/(^|\.)(grip|controls)(\.|$)/.test(e.path), e.path);
});
