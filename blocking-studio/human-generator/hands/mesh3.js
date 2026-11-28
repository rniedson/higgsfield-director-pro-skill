// mesh3.js - hand level 3, mode C ('simplified'): a mitten, one closed wedge of 12 triangles and 8 vertices, one
// topology. Posed from the SAME solved skeleton as level 0 (rig.worldSkeleton): no pose table of its own.
//
// The wrist ring W (the six points exactly, closed flat underneath) to one end edge T (a radial and an ulnar corner):
// T follows the finger mass's end (mesh2's fingerEnds), but never comes lower than the back knuckles, and its depth
// is the mean of the finger mass's and the knuckles' (a fist reads as a block, an open hand as a paddle). No thumb.
// Faces (0-5 W, 6 T radial, 7 T ulnar): the cap under the ring, the palm side W1 W2 -> T, the back W5 W4 -> T, the
// radial side W0 W5 T6 W1, the ulnar side W3 W2 T7 W4.

import { wristRingPoints } from './rig.js';
import { _lod } from './mesh1.js';
import { fingerEnds } from './mesh2.js';

const { level0Palm, topology, RING_CAP } = _lod;

export const LEVEL = 3;
export const MODE = 'simplified';

const MAIN = { verts: 8, tris: [...RING_CAP, [1, 6, 7], [1, 7, 2], [5, 4, 7], [5, 7, 6], [0, 5, 6], [0, 6, 1], [3, 2, 7], [3, 7, 4]] };
const TOPO = topology([{ name: 'Main', ...MAIN }]);
export const TRIANGLES = TOPO.triangles;
export const VERTICES = TOPO.vertices;
export const SHAPE = { depth: 0.15, lift: 1 };   // T: its depth between the finger mass's end (0) and the back knuckles (1); lift 1 = never below the knuckles

export function build(input) {
  const { dims: d, skeleton: skel } = input;
  const P0 = level0Palm(d), E = fingerEnds(skel, d);
  const corner = (t, k) => [t[0], t[1] + SHAPE.lift * Math.max(0, k[1] - t[1]), t[2] + SHAPE.depth * (k[2] - t[2])];
  const verts = [...wristRingPoints(d.ring), corner(E.radial, P0.knuckles[3]), corner(E.ulnar, P0.knuckles[2])];
  const positions = new Array(3 * verts.length);
  verts.forEach((v, i) => { positions[3 * i] = v[0]; positions[3 * i + 1] = v[1]; positions[3 * i + 2] = v[2]; });
  return { positions, index: TOPO.index.slice(), pieces: TOPO.shells.map((s) => ({ ...s, name: `L3_${s.name}` })),
    diagnostics: [`level 3: ${TOPO.triangles} triangles, ${TOPO.vertices} vertices (a mitten)`] };
}
