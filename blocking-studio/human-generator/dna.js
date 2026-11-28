// Human DNA v1.0: the contract a character's DNA must meet, checked before any geometry is built.
//
// The DNA may come from a file or from another program, so it is untrusted data: every field is checked for type,
// range and finiteness, unknown keys are refused, and nothing is clamped or repaired. A DNA that fails comes back with
// the list of what is wrong, and the caller keeps its last valid character.
//
// Two stages, as in the contract's fixtures (tests/fixtures/dna_invalid_14.json): "schema" is the shape of the data
// (tests/fixtures/dna.schema.json), "semantic" is the five rules that tie fields to each other. The semantic rules are
// only checked on a DNA whose shape is right.

export const DNA_CONTRACT = '1.0';

// Stages A01..A10 by age in months: each stage ends before the month given here. Presets, not clinical classes.
export const STAGES = [
  { id: 'A01', label: 'Newborn', until: 1 }, { id: 'A02', label: 'Infant', until: 12 },
  { id: 'A03', label: 'Toddler', until: 48 }, { id: 'A04', label: 'Early childhood', until: 84 },
  { id: 'A05', label: 'Middle childhood', until: 144 }, { id: 'A06', label: 'Adolescence', until: 216 },
  { id: 'A07', label: 'Young adult', until: 360 }, { id: 'A08', label: 'Mature adult', until: 720 },
  { id: 'A09', label: 'Older adult', until: 960 }, { id: 'A10', label: 'Oldest adult', until: 1441 },
];
export const MAX_AGE_MONTHS = 1440;      // a limit of the contract's tests, not a biological one
export const ADULT_MONTHS = 216;         // 18 years: from here on, the adult height scale and the adult channels apply
export const RECUMBENT_MONTHS = 24;      // under two years, height_m is the recumbent length
export const stageOf = (months) => STAGES.find((s) => months < s.until).id;

export const HEIGHTS = [1.40, 1.50, 1.60, 1.70, 1.75, 1.80, 1.90, 2.00, 2.10, 2.20];   // H01..H10, the adult scale
const levels = (letter, n) => Array.from({ length: n }, (_, i) => letter + String(i + 1).padStart(2, '0'));
export const HEIGHT_LEVELS = levels('H', 10);
export const STAGE_IDS = STAGES.map((s) => s.id);

export const GROUPS = {
  proportions: ['head_size', 'neck_length', 'neck_width', 'shoulder_width', 'chest_width', 'chest_depth', 'breast_volume',
    'breast_projection', 'waist_width', 'abdomen_volume', 'hip_width', 'glute_volume', 'glute_projection', 'torso_length',
    'arm_length', 'leg_length', 'hand_size', 'foot_size', 'thigh_volume'],
  fat_distribution: ['abdomen', 'chest', 'arms', 'hips', 'glutes', 'thighs', 'calves'],
  aging: ['skeletal_maturity', 'muscle_atrophy', 'skin_laxity'],
  functional: ['joint_mobility', 'balance', 'motor_control', 'strength'],
  posture: ['spine_curvature', 'pelvic_tilt', 'shoulder_alignment'],
};
export const CHANNELS = ['bone_structure', 'muscle_mass', 'body_fat'];   // top-level 0..1 channels, null = the preset
export const ADULT_ONLY = ['breast_volume', 'breast_projection'];        // proportions a minor's DNA must leave null
export const TOP_KEYS = ['id', 'sex', 'age_months', 'development_stage', 'height_level', 'height_m', 'height_mode', 'build',
  'seed', ...CHANNELS, ...Object.keys(GROUPS), 'lod'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined;
const MAX_ERRORS = 50;   // a hostile DNA with a million unknown keys must not cost a million messages

// A plain copy of a DNA in which every value was read exactly once: the top level and its groups, own keys only. What
// is checked is then what is built, even if the object handed in answers differently each time it is read.
export function snapshot(input) {
  if (!isObject(input)) return input;
  const copy = (source, deep) => {
    const out = {};
    for (const k of Reflect.ownKeys(source)) {
      const v = source[k];
      Object.defineProperty(out, k, { value: deep && isObject(v) ? copy(v, false) : v, enumerable: true, writable: true, configurable: true });
    }
    return out;
  };
  return copy(input, true);
}

// Checks a DNA against the contract. Returns { ok, errors }, each error as { stage, code, path, message }.
export function validate(input) { return check(snapshot(input)); }

// The same check on a DNA that is already a snapshot (generate() checks the copy it builds from).
export function check(dna) {
  const errors = [];
  const fail = (stage, code, path, message) => {
    if (errors.length < MAX_ERRORS) errors.push({ stage, code, path, message });
    else if (errors.length === MAX_ERRORS) errors.push({ stage, code: 'TOO_MANY_ERRORS', path: '', message: `more than ${MAX_ERRORS} errors: the list stops here` });
  };
  if (!isObject(dna)) { fail('schema', 'TYPE', '', 'the DNA must be an object'); return { ok: false, errors }; }

  const keys = (obj, allowed, base) => {
    for (const k of Reflect.ownKeys(obj)) if (!allowed.includes(k)) fail('schema', 'UNKNOWN_KEY', base + String(k), `unknown key: ${base}${String(k)}`);
    for (const k of allowed) if (!own(obj, k)) fail('schema', 'REQUIRED', base + k, `missing key: ${base}${k}`);
  };
  const oneOf = (path, v, allowed) => {
    if (!allowed.includes(v)) fail('schema', 'ENUM', path, `${path} must be one of ${allowed.join(', ')}`);
  };
  const number = (path, v, lo, hi, integer) => {
    if (!isNumber(v)) return fail('schema', 'TYPE', path, `${path} must be a finite number`);
    if (integer && !Number.isInteger(v)) return fail('schema', 'TYPE', path, `${path} must be an integer`);
    if (v < lo || v > hi) fail('schema', 'RANGE', path, `${path} must be between ${lo} and ${hi}, got ${v}`);
  };
  const channel = (path, v) => { if (v !== null) number(path, v, 0, 1); };   // null inherits from the preset

  keys(dna, TOP_KEYS, '');
  if (own(dna, 'id')) {
    if (typeof dna.id !== 'string') fail('schema', 'TYPE', 'id', 'id must be a string');
    else if (!/^[A-Za-z0-9_-]{1,80}$/.test(dna.id)) fail('schema', 'PATTERN', 'id', 'id must be 1 to 80 letters, digits, "_" or "-"');
  }
  if (own(dna, 'sex')) oneOf('sex', dna.sex, ['male', 'female']);
  if (own(dna, 'age_months')) number('age_months', dna.age_months, 0, MAX_AGE_MONTHS, true);
  if (own(dna, 'development_stage')) oneOf('development_stage', dna.development_stage, STAGE_IDS);
  if (own(dna, 'height_level')) oneOf('height_level', dna.height_level, HEIGHT_LEVELS);
  if (own(dna, 'height_m')) number('height_m', dna.height_m, 0.25, 2.5);
  if (own(dna, 'height_mode')) oneOf('height_mode', dna.height_mode, ['standing', 'recumbent']);
  if (own(dna, 'build')) number('build', dna.build, 1, 10, true);
  if (own(dna, 'seed')) number('seed', dna.seed, 0, 4294967295, true);
  if (own(dna, 'lod')) number('lod', dna.lod, 0, 4, true);
  for (const k of CHANNELS) if (own(dna, k)) channel(k, dna[k]);
  for (const [name, allowed] of Object.entries(GROUPS)) {
    if (!own(dna, name)) continue;
    if (!isObject(dna[name])) { fail('schema', 'TYPE', name, `${name} must be an object`); continue; }
    keys(dna[name], allowed, name + '.');
    for (const k of allowed) if (own(dna[name], k)) channel(`${name}.${k}`, dna[name][k]);
  }
  if (errors.length) return { ok: false, errors };

  const age = dna.age_months, adult = age >= ADULT_MONTHS;
  if (dna.development_stage !== stageOf(age)) {
    fail('semantic', 'STAGE_MISMATCH', 'development_stage', `age_months ${age} is stage ${stageOf(age)}, not ${dna.development_stage}`);
  }
  const mode = age < RECUMBENT_MONTHS ? 'recumbent' : 'standing';
  if (dna.height_mode !== mode) {
    fail('semantic', 'HEIGHT_MODE_MISMATCH', 'height_mode', `at ${age} months the height is measured ${mode}`);
  }
  const scale = HEIGHTS[HEIGHT_LEVELS.indexOf(dna.height_level)];
  if (adult && Math.abs(dna.height_m - scale) > 1e-6) {
    fail('semantic', 'ADULT_HEIGHT_MISMATCH', 'height_m', `an adult at ${dna.height_level} is ${scale} m tall, got ${dna.height_m}`);
  }
  if (!adult) {
    for (const k of ADULT_ONLY) {
      if (dna.proportions[k] !== null) {
        fail('semantic', 'MINOR_ADULT_CHANNEL', `proportions.${k}`, `proportions.${k} is an adult channel: it must be null under ${ADULT_MONTHS} months`);
      }
    }
  }
  const weights = Object.values(dna.fat_distribution);
  if (weights.every((w) => w !== null) && weights.reduce((a, b) => a + b, 0) <= 0) {
    fail('semantic', 'ZERO_FAT_WEIGHTS', 'fat_distribution', 'the fat weights cannot all be zero');
  }
  return { ok: errors.length === 0, errors };
}

// A DNA with every channel left to the presets: the starting point of the editor and of the ids below.
export function blankDNA(fields) {
  const nulls = (keys) => Object.fromEntries(keys.map((k) => [k, null]));
  const age = fields.age_months ?? 360;
  return {
    id: fields.id ?? 'character', sex: fields.sex ?? 'male', age_months: age, development_stage: stageOf(age),
    height_level: fields.height_level ?? 'H05', height_m: fields.height_m ?? 1.75,
    height_mode: age < RECUMBENT_MONTHS ? 'recumbent' : 'standing', build: fields.build ?? 4, seed: fields.seed ?? 0,
    bone_structure: null, muscle_mass: null, body_fat: null,
    ...Object.fromEntries(Object.entries(GROUPS).map(([name, keys]) => [name, nulls(keys)])),
    lod: fields.lod ?? 1,
  };
}
