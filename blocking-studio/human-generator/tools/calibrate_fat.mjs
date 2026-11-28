// Measures how much fat each region of the mesh holds, and prints the shares FAT_SHARE in generator.js must have for
// the weights of fat_distribution to share out a constant amount of fat.
//
//   node blocking-studio/human-generator/tools/calibrate_fat.mjs
//
// For each region it builds the reference adult (the mean of the two presets, H05) with all the fat on that region
// alone, and measures the volume gained over the same body with no fat. The level the region reached is in the
// output (resolved.fat_level), so the gain at level 1 is the gain measured over that level. Run it again after any
// change to the fat amounts in sections(); the tests compare FAT_SHARE with what this measures.
import { pathToFileURL } from 'node:url';
import { generate, presetDNA, volume, GROUPS } from '../generator.js';

const REGIONS = GROUPS.fat_distribution, BODY_FAT = 0.7;
export function measure() {
  const capacity = Object.fromEntries(REGIONS.map((k) => [k, 0]));
  for (const sex of ['male', 'female']) {
    const lean = generate({ ...presetDNA({ sex }), body_fat: 0 });
    for (const region of REGIONS) {
      const dna = { ...presetDNA({ sex }), body_fat: BODY_FAT };
      dna.fat_distribution = Object.fromEntries(REGIONS.map((k) => [k, k === region ? 1 : 0]));
      const c = generate(dna);
      capacity[region] += (volume(c) - volume(lean)) / c.resolved.fat_level[region] / 2;
    }
  }
  const total = REGIONS.reduce((a, k) => a + capacity[k], 0);
  return { capacity, share: Object.fromEntries(REGIONS.map((k) => [k, capacity[k] / total])), total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { capacity, share, total } = measure();
  console.log('region     litres at level 1   share');
  for (const k of REGIONS) console.log(k.padEnd(10), (capacity[k] * 1000).toFixed(2).padStart(8), '          ', share[k].toFixed(3));
  console.log('total     ', (total * 1000).toFixed(2).padStart(8));
  console.log('\nconst FAT_SHARE = { ' + REGIONS.map((k) => `${k}: ${share[k].toFixed(3)}`).join(', ') + ' };');
}
