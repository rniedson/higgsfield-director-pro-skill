// Growth and aging curves: how each part of the body changes with age, from birth to old age.
//
// Growing is not scaling: the head, the legs, the arms, the neck, the breadths and the depth of the trunk each follow
// their own curve. A curve is a short table of knots (age in months, value) joined by a monotone cubic, so a value never
// overshoots between two knots and nothing jumps where one stage ends and the next begins.
//
// What these numbers are: curves for a low-poly mannequin, shaped after published growth references (see README.md for
// the sources and for what was checked against them). They are not clinical data and must not be used as such.

const YEAR = 12;

// A monotone cubic through the knots (Fritsch-Carlson). Constant before the first knot and after the last, and it
// leaves and arrives flat there, so a curve has no kink where its change starts or ends.
export function curve(knots) {
  const x = knots.map((k) => k[0]), y = knots.map((k) => k[1]), n = x.length;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = x[0] > 0 ? 0 : d[0]; m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (age) => {
    if (age <= x[0]) return y[0];
    if (age >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (age > x[i + 1]) i++;
    const h = x[i + 1] - x[i], t = (age - x[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const years = (pairs) => curve(pairs.map(([a, v]) => [a * YEAR, v]));

// ---------------------------------------------------------------- stature

// The reference stature of each age, in metres: what H05 means for a minor. The knots are the medians of the WHO Child
// Growth Standards (birth to 5 years) and of the WHO Growth Reference 2007 (5 to 19 years), read from the WHO's printed
// tables on 2026-11-27 (see README.md). Under 24 months the WHO measures recumbent length, from 24 months standing
// height, 0.7 cm less for the same child: the knot at 24 months is the standing height, so the curve stays continuous
// and grows a little slower between 21 and 24 months.
const WHO_MEDIAN = {
  male: [[0, 0.499], [1, 0.547], [2, 0.584], [3, 0.614], [4, 0.639], [5, 0.659], [6, 0.676], [9, 0.72], [12, 0.757], [15, 0.791],
    [18, 0.823], [21, 0.851], [24, 0.871], [30, 0.919], [36, 0.961], [48, 1.033], [60, 1.1], [72, 1.16], [84, 1.217], [96, 1.273],
    [108, 1.326], [120, 1.378], [132, 1.431], [144, 1.491], [156, 1.56], [168, 1.632], [180, 1.69], [192, 1.729], [204, 1.752],
    [216, 1.761], [228, 1.765]],
  female: [[0, 0.491], [1, 0.537], [2, 0.571], [3, 0.598], [4, 0.621], [5, 0.64], [6, 0.657], [9, 0.701], [12, 0.74], [15, 0.775],
    [18, 0.807], [21, 0.837], [24, 0.857], [30, 0.907], [36, 0.951], [48, 1.027], [60, 1.094], [72, 1.151], [84, 1.208], [96, 1.266],
    [108, 1.325], [120, 1.386], [132, 1.45], [144, 1.512], [156, 1.564], [168, 1.598], [180, 1.617], [192, 1.625], [204, 1.629],
    [216, 1.631], [228, 1.632]],
};
export const STATURE_KNOTS = WHO_MEDIAN;
const MEDIAN = { male: curve(WHO_MEDIAN.male), female: curve(WHO_MEDIAN.female) };
export const stature = (sex, months) => MEDIAN[sex](months);
// How far from the reference a minor's height may be before the generator notes it: the ratios the adult scale has to
// its own reference (1.40 and 2.20 m against 1.75 m). The WHO's own range, two standard deviations, is about 8%.
export const STATURE_RANGE = [0.8, 1.26];

// The stature the body's shape is drawn for. A child's is the median of its age. An adult's is 1.75 m for BOTH sex
// presets: that is this generator's height scale (H05), a choice of the maintainer and not anthropometry (the WHO median
// at 18 is 1.76 m for boys and 1.63 m for girls). Between 15 and 18 years one eases into the other.
export const ADULT_STATURE = 1.75;
const ease = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
export const shapeStature = (sex, months) => { const w = ease((months - 180) / 36); return w === 0 ? stature(sex, months) : w === 1 ? ADULT_STATURE : stature(sex, months) * (1 - w) + ADULT_STATURE * w; };

// ---------------------------------------------------------------- proportions

// The head's height (chin to top) in metres at the reference stature: a quarter of a newborn's length, about an eighth
// of an adult's height (4.0 heads at birth, 4.9 at two years, 6.6 at nine, 7.7 for an adult). The artist's canon, not
// measured data.
export const headHeight = curve([[0, 0.125], [6, 0.155], [12, 0.167], [24, 0.178], [60, 0.191], [108, 0.203], [180, 0.22], [216, 0.2275]]);
// Full cheeks make the lower face of a young child round: a factor on the lower ring of the head.
export const jaw = years([[0, 1.18], [2, 1.15], [6, 1.08], [12, 1.0]]);

// The legs' share of the body below the chin, against the adult's (1). Set so that the crotch sits where the sitting
// height ratio puts it at each age: about a third of the length at birth, 0.39 at two years, 0.47 at nine, 0.48 at
// twelve (the leggiest age) and 0.47 for an adult.
export const legShare = curve([[0, 0.834], [6, 0.847], [12, 0.879], [24, 0.916], [48, 0.957], [72, 0.997], [108, 1.033], [144, 1.046],
  [180, 1.025], [216, 1.0]]);
// The arms' length against the adult's share of the body below the chin.
export const armShare = years([[0, 1.04], [2, 1.02], [6, 1.0]]);
// The neck's length against the adult's: an infant has almost none, and its shoulders sit right under its head.
export const neckShare = years([[0, 0.4], [1, 0.5], [3, 0.68], [6, 0.84], [12, 1.0]]);

// Breadth, depth and size of each region against the adult's at the same stature: one curve a region, because a child
// is not an adult scaled down, nor a stocky one. A newborn's skull is broad for its height, its neck thick, its trunk
// as deep as it is wide and its belly deeper than its chest, with no waist and no hip flare; hands and feet are large
// for the limbs. Each ratio multiplies only the lean part of a ring (fat and muscle are added after, on their own
// scale) and is 1 from 18 years on. The knots are this generator's proposal: see README.md.
const REGION_AGES = [0, 6, 12, 24, 60, 108, 180, 216];   // months
const REGION = {
  skullWidth: [1.15, 1.19, 1.14, 1.12, 1.09, 1.06, 1.03, 1],
  skullDepth: [1.12, 1.14, 1.11, 1.10, 1.07, 1.05, 1.02, 1],
  shoulders: [1.15, 1.03, 1.01, 1.02, 0.99, 0.98, 0.95, 1],
  chestWidth: [1.26, 1.20, 1.17, 1.12, 1.04, 1.01, 0.96, 1],
  chestDepth: [1.56, 1.41, 1.32, 1.19, 1.04, 0.97, 0.93, 1],   // also the back of the whole trunk: the back is one surface
  waist: [1.44, 1.34, 1.28, 1.23, 1.14, 1.08, 1.00, 1],
  belly: [2.19, 1.81, 1.63, 1.56, 1.33, 1.13, 0.95, 1],
  hips: [1.00, 0.91, 0.94, 0.95, 0.92, 0.89, 0.93, 1],
  neck: [1.85, 1.60, 1.47, 1.32, 1.16, 1.06, 0.97, 1],
  arm: [1.19, 1.09, 1.02, 0.94, 0.89, 0.87, 0.90, 1],
  thigh: [1.02, 1.12, 1.08, 1.04, 1.00, 1.01, 0.97, 1],
  calf: [1.04, 1.11, 1.09, 1.04, 1.01, 1.01, 0.98, 1],
  hand: [1.44, 1.36, 1.32, 1.26, 1.16, 1.11, 1.02, 1],
  foot: [1.28, 1.26, 1.24, 1.21, 1.15, 1.12, 1.02, 1],
};
const REGION_CURVES = Object.fromEntries(Object.entries(REGION).map(([k, v]) => [k, curve(v.map((y, i) => [REGION_AGES[i], y]))]));
export const REGIONS = Object.keys(REGION);
export const regions = (months) => Object.fromEntries(REGIONS.map((k) => [k, REGION_CURVES[k](months)]));

// ---------------------------------------------------------------- maturity

// Skeletal maturity, 0 (a child's body) to 1 (the adult presets fully applied). The default depends on age and on the
// sex preset; the DNA may move it (aging.skeletal_maturity), but only inside the window of the age: maturity cannot run
// ahead of age (0 under 8 years, full maturity not before 15), and from 21 years everybody is mature. The earliest edge
// runs about two years ahead of the female default; it is a choice for this generator, not a clinical bound.
const MATURITY = {
  male: years([[9.5, 0], [12, 0.15], [14, 0.5], [16, 0.85], [18, 1]]),
  female: years([[8, 0], [10, 0.15], [12, 0.5], [14, 0.85], [16, 1]]),
};
const EARLIEST = years([[8, 0], [10, 0.4], [12, 0.75], [15, 1]]), LATEST = years([[13, 0], [16, 0.5], [18, 0.85], [21, 1]]);
export const maturity = (sex, months) => MATURITY[sex](months);
export const maturityWindow = (months) => [LATEST(months), EARLIEST(months)];
// The adult channels (the bust) have a gate of their own, by age alone: nothing under 18 years, whatever the maturity,
// and the adult preset comes in over the three years that follow, so nothing jumps at 18.
export const adultPreset = (months) => ease((months - 216) / 36);

// ---------------------------------------------------------------- build

// The body fat of the average build at each age (the build presets are adult silhouettes): infants carry more.
export const neutralFat = years([[0, 0.3], [0.5, 0.4], [1, 0.38], [2, 0.32], [4, 0.24], [7, 0.2], [12, 0.22], [18, 0.26]]);
// How much of a build preset's distance from the average applies at each age.
export const buildRange = years([[0, 0.3], [2, 0.4], [6, 0.6], [12, 0.8], [18, 1.0]]);

// ---------------------------------------------------------------- aging and function

// Mild defaults: an older character reads as older, not as frail. Each one is a control the DNA can set to zero.
export const muscleAtrophy = years([[50, 0], [75, 0.2], [85, 0.3], [100, 0.4]]);
export const skinLaxity = years([[40, 0], [75, 0.4], [85, 0.45], [100, 0.5]]);
// What a young child can do yet, for the animation layer. Adults default to 1 at every age: age is not frailty.
export const balance = years([[0, 0], [0.5, 0.1], [1, 0.35], [2, 0.6], [4, 0.8], [7, 0.95], [10, 1]]);
export const motorControl = years([[0, 0.1], [0.5, 0.25], [1, 0.4], [2, 0.6], [4, 0.8], [7, 0.95], [10, 1]]);
export const strength = years([[0, 0.05], [1, 0.15], [4, 0.3], [9, 0.5], [14, 0.8], [18, 1]]);

// The motion library and the reference stance of each stage: an infant is not an adult scaled down. The stance turns
// to standing at 12 months, the median age of walking alone in the WHO's motor development study (windows of achievement:
// sitting without support 3.8 to 9.2 months, crawling 5.2 to 13.5, standing alone 6.9 to 16.9, walking alone 8.2 to 17.6).
export function motorProfile(months) {
  if (months < 1) return { library: 'newborn', stance: 'recumbent', movements: ['lying'] };
  if (months < 12) return { library: 'infant', stance: 'recumbent', movements: ['rolling', 'sitting', 'crawling', 'standing with assistance'] };
  if (months < 48) return { library: 'toddler', stance: 'standing', movements: ['first steps', 'balance'] };
  if (months < 144) return { library: 'child', stance: 'standing', movements: ['walking', 'running', 'playing'] };
  if (months < 216) return { library: 'adolescent', stance: 'standing', movements: ['varied'] };
  return { library: 'adult', stance: 'standing', movements: ['full'] };
}
