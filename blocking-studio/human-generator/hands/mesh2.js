// mesh2.js - hand level 2, mode C ('simplified'): the four fingers as ONE volume that curls with the pose, the thumb
// apart; 20 triangles, 14 vertices, one topology. Posed from the SAME solved skeleton as level 0 (rig.worldSkeleton):
// no pose table of its own, a pose only moves the vertices.
//
//   'Main'   16 / 10: the wrist ring W (the six points exactly, closed flat underneath), the two back knuckle corners of
//            the level-0 palm (raised as level 1's so the back stays over the knuckles), and the finger mass's end edge
//            T: a radial corner (the far end of the index and middle fingers) and an ulnar corner (ring and little).
//            Open, T is at the fingertips and the volume is a flat paddle; in a fist T comes back to the front of the
//            curl (the PIP and DIP knuckles), so the volume folds into a block over the palm.
//   'Thumb'   4 / 4: a tetrahedron from a three-sided base inside the palm (the CMC moved in toward the palm's
//            mid-plane, SHAPE) to the thumb's far end (soft-farthest of MCP, IP and tip).
// Faces (Main, vertex numbers 0-5 W, 6 back radial knuckle, 7 back ulnar knuckle, 8 T radial, 9 T ulnar): the cap
// under the ring, the palm side W1 W2 -> T, the back W5 W4 -> knuckles, the top knuckles -> T, the radial side W0 W5
// K T W1, the ulnar side W3 W2 T K W4. The winding is checked by the levels' checks (every shell's volume positive).

import { vec, FINGERS, wristRingPoints } from './rig.js';
import { _lod } from './mesh1.js';

const { add, scl } = vec;
const { K0, level0Palm, chain, farEnd, ringFrame, triRing, topology, RING_CAP } = _lod;

export const LEVEL = 2;
export const MODE = 'simplified';

const MAIN = {
  verts: 10,
  tris: [...RING_CAP, [1, 8, 9], [1, 9, 2], [5, 4, 7], [5, 7, 6], [6, 7, 9], [6, 9, 8], [0, 5, 6], [0, 6, 8], [0, 8, 1], [3, 2, 9], [3, 9, 7], [3, 7, 4]],
};
const THUMB = { verts: 4, tris: [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]] };
const TOPO = topology([{ name: 'Main', ...MAIN }, { name: 'Thumb', ...THUMB }]);
// The thumb tetrahedron's base: thumbBase x level 1's start cap (wider, so that the part that shows past the palm reads
// as a thumb, not a needle), centred on the CMC moved by thumbIn toward the palm's mid-plane (x = 0, z = 0), where the
// wider base stays hidden in the main volume at every pose (measured on the levels' checks).
export const SHAPE = { thumbBase: 1.1, thumbIn: 0.5 };
export const TRIANGLES = TOPO.triangles;
export const VERTICES = TOPO.vertices;

// The finger mass's end edge: for each finger its far end (soft-farthest of PIP, DIP and tip from the MCP), then the
// radial corner = the soft-farthest of the index's and the middle's from the palm's knuckle line, moved out to the
// index's outer side; the ulnar corner the same of the ring's and the little finger's, out to the little finger's side.
export function fingerEnds(skel, d) {
  const far = {}, J0 = {};
  for (const f of FINGERS) { const C = chain(skel, f); J0[f] = C.J[0]; far[f] = farEnd([C.J[1], C.J[2], C.J[3]], C.J[0], d.L); }
  const mid = scl(FINGERS.reduce((a, f) => add(a, J0[f]), [0, 0, 0]), 1 / 4);
  const side = (a, b, out, hw) => {
    const p = farEnd([far[a], far[b]], mid, d.L);
    return [far[out][0] + hw, p[1], p[2]];
  };
  return {
    far, radial: side('index', 'middle', 'index', d.fingers.index.segs[0].hw1),
    ulnar: side('ring', 'pinky', 'pinky', -d.fingers.pinky.segs[0].hw1),
  };
}

export function build(input) {
  const { dims: d, skeleton: skel } = input;
  const P0 = level0Palm(d), E = fingerEnds(skel, d);
  const t = chain(skel, 'thumb'), g = d.thumb.segs;
  const far = farEnd([t.J[1], t.J[2], t.J[3]], t.J[0], d.L), u = vec.nrm(vec.sub(far, t.J[0]));
  const b = [(1 - SHAPE.thumbIn) * t.J[0][0], t.J[0][1], (1 - SHAPE.thumbIn) * t.J[0][2]];   // the CMC moved in toward the palm's mid-plane
  const base = triRing(b, ringFrame(t.ax[0].x, u), SHAPE.thumbBase * K0 * g[0].hw0, SHAPE.thumbBase * K0 * g[0].ht0);
  const verts = [...wristRingPoints(d.ring), P0.knuckles[3].slice(), P0.knuckles[2].slice(), E.radial, E.ulnar, ...base, far];
  if (verts.length !== TOPO.vertices) throw new Error(`level 2: ${verts.length} vertices built, ${TOPO.vertices} in the topology`);
  const positions = new Array(3 * verts.length);
  verts.forEach((v, i) => { positions[3 * i] = v[0]; positions[3 * i + 1] = v[1]; positions[3 * i + 2] = v[2]; });
  return { positions, index: TOPO.index.slice(), pieces: TOPO.shells.map((s) => ({ ...s, name: `L2_${s.name}` })),
    diagnostics: [`level 2: ${TOPO.triangles} triangles, ${TOPO.vertices} vertices (the four fingers as one volume, the thumb apart)`] };
}
