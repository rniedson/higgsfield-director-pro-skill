// Measures how far the thumb of each library pose moves between neighbouring bodies. The thumb is solved for each body
// (rig.solveThumb), from the library's fit for the hand's age (hands/fit.js) in small steps, so that two hands next to
// each other land on answers next to each other; a search that leaves the fit can land them tens of degrees apart,
// which shows as a pop when a character ages. For each pose this prints the largest change of any thumb angle of the
// solved hand between two neighbours, and the pair of bodies where it happens, along two kinds of line:
//   ages               both sexes, presetDNA({ sex, age_months }) at 0 to 216 months in 3-month steps, then 240, 300, 360
//   adult neighbours   both sexes, dnaFromId over the heights H01 to H10 at C05 and over the builds C01 to C10 at H05
//
//   node blocking-studio/human-generator/tools/hand_continuity.mjs                     the 24 poses (slow: minutes)
//   node blocking-studio/human-generator/tools/hand_continuity.mjs --poses HP12,HP21   only these poses
//   node blocking-studio/human-generator/tools/hand_continuity.mjs --no-seed           the search without its seed
//
// --no-seed shows what the seed is for: the thumb still starts from the fit, but the whole range is searched, as
// rig.solvePose does when it is given no fit. It is about ten times slower (the test's sample: 182 s of CPU against
// 18 s, measured on 2026-11-28 on a loaded 8-core Mac): give it a few poses.
// tests/test_hands.mjs bounds a sample of this sweep (the ages at the knots of the child weight, a part of the adult
// neighbours); the whole of it is here. Run it after any change to the solver, the fit or the proportions.
import { pathToFileURL } from 'node:url';
import * as H from '../hands/index.js';
import { generate, presetDNA, dnaFromId } from '../generator.js';

export const THUMB_KEYS = ['cmc_flex_deg', 'mcp_flex_deg', 'ip_flex_deg', 'opposition_deg', 'abduction_deg', 'twist_deg'];
// The bounds tests/test_hands.mjs holds a pose to unless it names the pose: the largest change of a thumb angle between
// two neighbours, degrees (from the issue that asked for the test; the poses above them are listed under the table).
export const BOUND_DEG = { ages: 9, adults: 6 };
export const AGES = [...Array.from({ length: 73 }, (_, i) => 3 * i), 240, 300, 360];   // months
const two = (n) => String(n).padStart(2, '0'), TEN = Array.from({ length: 10 }, (_, i) => two(i + 1));

// A line is a list of bodies { name, dna }, each next to the one before it.
export const ageLine = (sex, ages = AGES) => ages.map((m) => ({ name: `${sex} ${m} months`, dna: presetDNA({ sex, age_months: m }) }));
export const idLine = (ids) => ids.map((id) => ({ name: id, dna: dnaFromId(id) }));
export const heightLine = (s) => idLine(TEN.map((n) => `${s}_H${n}_C05`)), buildLine = (s) => idLine(TEN.map((n) => `${s}_H05_C${n}`));
export const AGE_LINES = () => ['male', 'female'].map((sex) => ageLine(sex));
export const ADULT_LINES = () => ['M', 'F'].flatMap((s) => [heightLine(s), buildLine(s)]);

// the grip block the generator hands the library
const G0 = { grip_radius_m: null, object: null, grip_strength: null };
// Without the seed: a thumb control other than 0 makes rig.solveHand search the whole range from the fit (it passes
// solvePose no fit); one of 1e-9 moves the thumb it starts from by less than 1e-7 degrees.
const NO_SEED = { thumb: { opposition: 1e-9 } };
// A body as the generator hands it to the library (character.hands.left.body); level 4 builds no hand for it.
function bodyOf(b) {
  const c = generate(b.dna, { hands: { level: 4, left: { pose: 'HP01' }, right: { pose: 'HP01' } } });
  if (!c.ok) throw new Error(`${b.name} did not build: ${JSON.stringify(c.errors)}`);
  return c.hands.left.body;
}

// The largest change of a thumb angle between two neighbours of the lines, for each pose:
// { worst: { <pose>: { deg, angle, from, to } }, pairs, bodies, hands (the hands solved) }.
export function continuity(lines, poses = H.POSES, { seed = true, onBody = null } = {}) {
  const worst = Object.fromEntries(poses.map((p) => [p, { deg: 0, angle: null, from: null, to: null }]));
  const done = new Map();
  let pairs = 0, hands = 0;
  const thumbs = (b) => {
    if (done.has(b.name)) return done.get(b.name);
    const body = bodyOf(b), out = {};
    for (const pose of poses) {
      const h = H.buildHand({ pose, body, level: 2, grip: G0, controls: seed ? {} : NO_SEED });
      if (!h.ok) throw new Error(`${pose} on ${b.name} did not build: ${JSON.stringify(h.errors)}`);
      out[pose] = THUMB_KEYS.map((k) => h.angles.thumb[k]); hands++;
    }
    done.set(b.name, out);
    if (onBody) onBody(b.name, done.size);
    return out;
  };
  for (const line of lines) {
    let prev = null;
    for (const b of line) {
      const cur = thumbs(b);
      if (prev) {
        pairs++;
        for (const p of poses) THUMB_KEYS.forEach((k, i) => { const deg = Math.abs(cur[p][i] - prev.thumbs[p][i]); if (deg > worst[p].deg) worst[p] = { deg, angle: k, from: prev.name, to: b.name }; });
      }
      prev = { name: b.name, thumbs: cur };
    }
  }
  return { worst, pairs, bodies: done.size, hands };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), at = args.indexOf('--poses'), seed = !args.includes('--no-seed');
  const poses = at < 0 ? H.POSES : (args[at + 1] ?? '').split(',').filter(Boolean);
  const bad = [...args.filter((a, i) => !['--poses', '--no-seed'].includes(a) && !(at >= 0 && i === at + 1)), ...poses.filter((p) => !H.POSES.includes(p))];
  if (bad.length || !poses.length) {
    console.error(`${bad.length ? `not understood: ${bad.join(', ')}` : 'no pose given'}\nusage: node tools/hand_continuity.mjs [--poses HP12,HP21] [--no-seed]`);
    process.exit(2);
  }
  const t0 = performance.now(), cpu0 = process.cpuUsage();
  const onBody = (name, n) => { if (process.stderr.isTTY) process.stderr.write(`\r${n} bodies: ${name}        `); };
  const ages = continuity(AGE_LINES(), poses, { seed, onBody }), adults = continuity(ADULT_LINES(), poses, { seed, onBody });
  if (process.stderr.isTTY) process.stderr.write('\r' + ' '.repeat(60) + '\r');
  // the rows to a thousandth of a degree (a bound is written from them), the two sentences under them to a tenth
  const f1 = (x) => x.toFixed(1), cell = (w) => `${w.deg.toFixed(3).padStart(6)}  ${(w.angle ?? '').padEnd(14)}  ${(w.angle ? `${w.from} -> ${w.to}` : '').padEnd(38)}`;
  console.log(`The largest change of a thumb angle between neighbouring bodies, degrees, the hand built at level 2${seed ? '' : ', THE SEARCH NOT SEEDED'}`);
  console.log(`pose  | ${'ages'.padEnd(62)} | adult neighbours`);
  for (const p of poses) console.log(`${p}  | ${cell(ages.worst[p])} | ${cell(adults.worst[p]).trimEnd()}`);
  const over = (r, bound) => {
    const above = poses.filter((p) => r.worst[p].deg > bound);
    return `at most ${bound} degrees on ${poses.length - above.length} of the ${poses.length} poses${above.length ? `; above: ${above.map((p) => `${p} ${f1(r.worst[p].deg)}`).join(', ')}` : ''}`;
  };
  console.log(`ages (both sexes, 0 to 216 months in 3-month steps, then 240, 300 and 360: ${ages.pairs} pairs): ${over(ages, BOUND_DEG.ages)}`);
  console.log(`adult neighbours (M_ and F_, H01 to H10 at C05 and C01 to C10 at H05: ${adults.pairs} pairs): ${over(adults, BOUND_DEG.adults)}`);
  const cpu = process.cpuUsage(cpu0);
  console.log(`${ages.hands + adults.hands} hands on ${ages.bodies + adults.bodies} bodies in ${((performance.now() - t0) / 1000).toFixed(1)} s (${((cpu.user + cpu.system) / 1e6).toFixed(1)} s of CPU)`);
}
