// Fits the thumb of each of the library's 24 poses to this mesh with no controls and no grip, on the generator's preset
// hand at each knot of the child weight, and writes hands/fit.js, the thumb every hand starts from
// (rig.solveHand, "THE LIBRARY'S FIT").
//
//   node blocking-studio/human-generator/tools/fit_hand_poses.mjs           writes hands/fit.js
//   node blocking-studio/human-generator/tools/fit_hand_poses.mjs --check   exits 1 if hands/fit.js is not what it fits
//
// For each pose the solver runs from the authored angles at the adult knot ({ fit: false }), then at each younger knot
// from the knot before it; where the thumb overlaps the palm or misses its contact on this mesh it moves the thumb, and
// that thumb is kept, with the contact's miss it reaches. Run it again after any change to the proportions, the level-0 pieces or the solver; the
// tests compare hands/fit.js with what this fits.
import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as rig from '../hands/rig.js';
import * as mesh0 from '../hands/mesh0.js';
import { POSE_IDS, getPose } from '../hands/poses.js';
import { POSE_FIT } from '../hands/fit.js';
import { generate, presetDNA } from '../generator.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6, r9 = (x) => Math.round(x * 1e9) / 1e9, f1 = (x) => (Math.round(x * 10) / 10).toString();
const DATA = { cmc: 'cmc_flex_deg', mcp: 'mcp_flex_deg', ip: 'ip_flex_deg', opposition: 'opposition_deg', abduction: 'abduction_deg' };

// The knots, adult first: the knots of the child weight; the weight-0 knot is fitted on an adult (360 months).
export const FIT_KNOTS = rig.CHILD_WEIGHT_KNOTS.slice().reverse().map(([months, weight]) => ({ months, weight }));
// The hand a knot is fitted on: the generator's own presets at that age (the mean of the male and female preset's
// hand length and wrist ring; no fat, the sex preset's weight 0), so the fit is the pose on the hand the generator
// builds at that age and a preset character needs no correction of its own.
export function knotBody(months) {
  const age = months === 168 ? 360 : months, hands = { level: 4, left: { pose: 'HP01' }, right: { pose: 'HP01' } };
  const bodies = ['male', 'female'].map((sex) => {
    const c = generate(presetDNA({ sex, age_months: age }), { hands });
    if (!c.ok) throw new Error(`the ${sex} preset at ${age} months did not build: ${JSON.stringify(c.errors)}`);
    return c.hands.right.body;
  });
  const mean = (f) => (f(bodies[0]) + f(bodies[1])) / 2;
  return { length: mean((b) => b.length), ring: { w: mean((b) => b.ring.w), f: mean((b) => b.ring.f), b: mean((b) => b.ring.b) }, months: age, fem: 0, fat: 0 };
}
function contextAt(months) {
  const d = rig.handDimensions(knotBody(months), {});
  const bones = rig.skeleton(d), P = mesh0.pieces(d, bones);
  return rig.makeRig(d, bones, P.bones);
}

export function fitLibrary() {
  const ctxs = FIT_KNOTS.map((k) => contextAt(k.months)), out = {};
  for (const id of POSE_IDS) {
    const pose = getPose(id), authored = rig.readPose(pose).thumb, knots = [];
    let prev = null;
    FIT_KNOTS.forEach((k, i) => {
      // the adult knot from the authored angles, every younger one from the knot before it
      const r = rig.solveHand(ctxs[i], pose, {}, {}, { fit: prev ?? false });
      const thumb = Object.fromEntries(rig.THUMB_VARS.map((v) => [v, r6(r.angles.thumb[v] ?? 0)]));
      const changes = rig.THUMB_VARS.filter((v) => Math.abs(thumb[v] - (authored[v] ?? 0)) >= 0.05).map((v) => `${v} ${f1(authored[v] ?? 0)}->${f1(thumb[v])}`);
      const knot = { months: k.months, weight: k.weight, thumb, movers: r.thumb ? r.thumb.movers.map(r6) : (prev?.movers ?? null),
        miss_m: r.thumb ? r9(r.thumb.miss_m / ctxs[i].d.s) : 0, error_m: r.thumb ? r9(r.thumb.error_m / ctxs[i].d.s) : 0,
        changed: changes.length > 0, detail: changes.length ? `thumb ${changes.join(', ')} at ${k.months} months` : `the authored thumb kept at ${k.months} months` };
      knots.push(knot);
      prev = knot;
    });
    out[id] = { source: rig.poseHash(pose), authored: Object.fromEntries(Object.entries(DATA).map(([k, n]) => [n, pose.thumb[n]])), knots };
  }
  return out;
}

// the largest difference between two fits (degrees, curl factors and millimetres together; 0 when they agree)
export function fitDifference(a, b) {
  let worst = 0;
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    if (!x || !y || x.source !== y.source || x.knots.length !== y.knots.length) return Infinity;
    x.knots.forEach((p, i) => {
      const q = y.knots[i];
      if (p.months !== q.months || p.changed !== q.changed || (p.movers === null) !== (q.movers === null)) { worst = Infinity; return; }
      for (const v of rig.THUMB_VARS) worst = Math.max(worst, Math.abs(p.thumb[v] - q.thumb[v]));
      (p.movers ?? []).forEach((m, j) => { worst = Math.max(worst, Math.abs(m - q.movers[j])); });
      worst = Math.max(worst, 1000 * Math.abs(p.miss_m - q.miss_m), 1000 * Math.abs(p.error_m - q.error_m));
    });
  }
  return worst;
}

function write(fit) {
  const lines = Object.entries(fit).map(([id, f]) => `  ${id}: ${JSON.stringify(f)},`);
  const text = `// hands/fit.js - GENERATED by tools/fit_hand_poses.mjs; do not edit by hand (tests/test_hands.mjs checks it).
// The thumb of each library pose fitted to this mesh (no controls, no grip) on the generator's preset hand at each knot
// of the child weight (tools/fit_hand_poses.mjs knotBody), adult first, each knot solved from the one before it: source (a hash of the pose's
// data in poses.js), authored (the pose's thumb as given), knots [{ months, weight (the child weight), thumb (the rig's
// angles a hand of that age starts from, degrees), movers (the curl factors of the fingers a tip contact moves, or
// null), miss_m and error_m (the contact's miss and the solver's error, metres scaled to the reference hand's length,
// as CONTACT_TOLERANCE is), changed,
// detail }].
export const POSE_FIT = {
${lines.join('\n')}
};
`;
  writeFileSync(fileURLToPath(new URL('../hands/fit.js', import.meta.url)), text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = performance.now(), fit = fitLibrary();
  if (process.argv.includes('--check')) {
    const diff = fitDifference(fit, POSE_FIT);
    console.log(diff <= 1e-4 ? `hands/fit.js is up to date (largest difference ${diff})` : `hands/fit.js is out of date (largest difference ${diff}): run this tool again`);
    process.exit(diff <= 1e-4 ? 0 : 1);
  }
  write(fit);
  for (const [id, f] of Object.entries(fit)) {
    console.log(id, f.knots.map((k) => `${k.months}m: ${rig.THUMB_VARS.map((v) => f1(k.thumb[v])).join('/')} miss ${(k.miss_m * 1000).toFixed(1)}`).join(' | '));
  }
  console.log(`hands/fit.js written in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
