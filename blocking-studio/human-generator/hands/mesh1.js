// mesh1.js - hand level 1, mode B ('preset'): one rigid piece on the hand bone, baked from the SAME solved skeleton as
// level 0 (the posed joints, bone frames and fingertips that rig.worldSkeleton returns). No pose table of its own: a
// pose only moves vertices; the index is one per variant for every pose, size, age, side and control.
//
// Two variants, both built (buildHand({ level: 1, variant })); the maintainer chooses:
//   'budget'    40 triangles (the maintainer's proposed 24 to 40): palm 18, finger x4 a tetrahedron (4), thumb a bent wedge (6)
//   'readable'  70 triangles: the fewest found in which the 24 poses stay told apart (58), plus the skirt that keeps the
//               wrist joint closed (+12). Palm with a thenar facet and the skirt 32, index a bent tube (10), middle /
//               ring / little a bent wedge (6 each), thumb a bent tube (10).
// Every piece is a closed shell (every edge used once in each direction). The base of the palm is the forearm's wrist
// ring itself, the six points exactly; below it the base (BASE) closes the joint as far as the variant's count allows.
//
// The look of level 0, reduced: the palm is level 0's own palm vertices (the wrist ring, the knuckle corners, in
// 'readable' the thenar), so the palm does not jump between the levels; the digits start inside the palm at their
// joints with level 0's start-cap size, and the knuckle corners are raised just enough (level0Palm) that no digit base
// shows at any MCP flexion, spread or twist.
//
// THE SHARED HELPERS (exported as _lod) are also used by mesh2.js and mesh3.js: the level-0 palm of a hand, a digit's
// posed chain, a smooth "far end" of a curled digit, rings in a bone frame, and the topology builder.

import { vec, FINGERS, DIGIT_BONES, wristRingPoints, skeleton as bindSkeleton } from './rig.js';
import { palmPiece as level0PalmPiece, _internal as level0Internal } from './mesh0.js';

const { add, sub, scl, dot, cross, len, nrm } = vec;

export const LEVEL = 1;
export const MODE = 'preset';
const K0 = 0.94;   // a digit's base, of its first segment's start size (level 0's start caps): hidden in the palm

// ------------------------------------------------------------------------------------------------ shared helpers
// The level-0 palm's 22 vertices for these dimensions (mesh0's own fit): 0-5 the wrist ring W, 6-13 the mid palm
// (6 palm radial corner, 7 thenar, 8 hypothenar, 9 palm ulnar corner, 10 back ulnar corner, 11 back ulnar of the ridge,
// 12 back radial of the ridge, 13 back radial corner), 14-17 the palm-side knuckles (radial corner, index/middle,
// ring/little, ulnar corner), 18-21 the back knuckles (ulnar corner, ring/little, index/middle, radial corner); the
// level-0 connector's depth below the pivot; and `knuckles`: the four knuckle corners (front radial, front ulnar, back
// ulnar, back radial) raised together by `raise`, so that a roof through the corners alone (no cascade of knuckles)
// still holds the proximal phalanges' start caps at every MCP flexion, spread and twist within the limits (level 0's
// own sweep samples, the 0.94 caps, a margin of 2 m).
const P0CACHE = new Map();
export const clearPalmCache = () => P0CACHE.clear();
export function level0Palm(d) {
  let hit = P0CACHE.get(d.key);
  if (!hit) {
    const bones = bindSkeleton(d), P = level0PalmPiece(d, bones), V = P.verts;
    const cap = (g) => [[-K0 * g.hw0, 0, -K0 * g.ht0], [K0 * g.hw0, 0, -K0 * g.ht0], [K0 * g.hw0, 0, K0 * g.ht0], [-K0 * g.hw0, 0, K0 * g.ht0]];
    const starts = { thumb: cap(d.thumb.segs[0]) };
    for (const f of FINGERS) starts[f] = cap(d.fingers[f].segs[0]);
    const { fingerPts } = level0Internal.palmSamples(d, bones, starts);
    const [kr, ku] = [V[14], V[17]];
    let raise = 0;
    for (const f of FINGERS) for (const q of fingerPts[f]) {
      const u = (q[0] - ku[0]) / (kr[0] - ku[0]);
      raise = Math.max(raise, q[1] + 2 * d.m - (ku[1] + (kr[1] - ku[1]) * u));
    }
    const knuckles = [14, 17, 18, 21].map((i) => [V[i][0], V[i][1] + raise, V[i][2]]);
    hit = { verts: V.map((v) => v.slice()), knuckles, raise, connectorBelow: P.connectorBelow };
    if (P0CACHE.size > 400) P0CACHE.delete(P0CACHE.keys().next().value);
    P0CACHE.set(d.key, hit);
  }
  return hit;
}

// A digit's posed chain from the solved skeleton: joints J[0..2] (MCP, PIP, DIP; the thumb CMC, MCP, IP), J[3] the
// fingertip, and the three bone frames.
export function chain(skel, digit) {
  const B = DIGIT_BONES[digit].map((b) => skel.bones[b]);
  return { J: [B[0].head, B[1].head, B[2].head, skel.tips[digit]], ax: B.map((b) => b.axes) };
}

// The smooth "far end" of a digit seen from a point: the weighted mean of candidate points, the weights
// exp(k (dist - max) / scale) (a soft maximum of the distance, so it moves continuously with the pose). An open digit
// gives its tip; a curled one the front of the curl (the PIP or the DIP), which is what shows from afar.
export function farEnd(points, from, scale, k = 30) {
  const ds = points.map((p) => len(sub(p, from))), mx = Math.max(...ds);
  let s = 0, acc = [0, 0, 0];
  points.forEach((p, i) => { const w = Math.exp(k * (ds[i] - mx) / scale); s += w; acc = add(acc, scl(p, w)); });
  return scl(acc, 1 / s);
}

// An orthonormal ring frame: n along the digit (toward its end), x across (the flexion axis, made perpendicular to n),
// m = x * n the pad side (as a bone's +Z when n is its +Y).
export function ringFrame(xAxis, n) {
  const nn = nrm(n), x = nrm(sub(xAxis, scl(nn, dot(xAxis, nn))));
  return { x, n: nn, m: cross(x, nn) };
}
// A three-sided ring around c: two corners on the back (dorsal) side, one keel on the pad side; the order matches
// level 0's rings (-x back, +x back, pad), so loft/cap below wind outward.
export function triRing(c, F, hw, htBack, htPad = htBack) {
  return [add(c, add(scl(F.x, -hw), scl(F.m, -htBack))), add(c, add(scl(F.x, hw), scl(F.m, -htBack))), add(c, scl(F.m, htPad))];
}
// A joint ring mitred between the incoming and outgoing directions; its depth scaled by 1 / cos(half the bend), at most
// `maxScale`, so the tube keeps its thickness through moderate bends and pinches a little at extreme ones.
export function mitreRing(c, xAxis, uIn, uOut, hw, ht, maxScale = 1.5) {
  const n = add(nrm(uIn), nrm(uOut));
  const F = ringFrame(xAxis, len(n) > 1e-9 ? n : uIn);
  const k = Math.min(maxScale, 1 / Math.max(1e-6, dot(F.n, nrm(uIn))));
  return triRing(c, F, hw, k * ht);
}
// One joint for a digit's two inner joints J1 and J2: their soft-weighted mean by the distance from the chord J0 -> tip
// (the joint that sticks out of the chord wins, smoothly, so a tripod thumb bends at its IP and a fist finger at its
// PIP); the bend axis and the sizes [[hw, ht] at J1, at J2] blended the same way. Returns { c, x, hw, ht }.
export function blendedJoint(J, ax, sizes, scale, k = 40) {
  const u = nrm(sub(J[3], J[0]));
  const off = [J[1], J[2]].map((p) => { const r = sub(p, J[0]); return len(sub(r, scl(u, dot(r, u)))); });
  const mx = Math.max(...off), w = off.map((o) => Math.exp(k * (o - mx) / scale)), a = w[0] / (w[0] + w[1]), b = 1 - a;
  return { c: add(scl(J[1], a), scl(J[2], b)), x: add(scl(ax[1].x, a), scl(ax[2].x, b)), hw: a * sizes[0][0] + b * sizes[1][0], ht: a * sizes[0][1] + b * sizes[1][1] };
}

// Triangle lists (local indices). A ring runs (-x back, +x back, pad) around the digit's axis; loft(a, b) joins two
// rings with outward faces, capStart closes the first ring (facing back down the digit), fan closes the last ring on a
// point. These are level 0's conventions (mesh0.js) applied to three-sided rings.
export const loft = (a, b) => { const t = []; for (let k = 0; k < a.length; k++) { const k1 = (k + 1) % a.length; t.push([a[k], b[k], b[k1]], [a[k], b[k1], a[k1]]); } return t; };
export const capStart = (r) => { const t = []; for (let k = 1; k + 1 < r.length; k++) t.push([r[0], r[k], r[k + 1]]); return t; };
export const capEnd = (r) => { const t = []; for (let k = 1; k + 1 < r.length; k++) t.push([r[0], r[k + 1], r[k]]); return t; };
export const fan = (r, p) => r.map((v, k) => [v, p, r[(k + 1) % r.length]]);

// The six wrist points' triangles: the ring closed flat (facing -Y), or a hexagonal pyramid on an apex below it.
export const RING_CAP = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5]];
export const ringPyramid = (apex) => [0, 1, 2, 3, 4, 5].map((k) => [k, (k + 1) % 6, apex]);

// The topology of a list of shells [{ name, verts, tris (local) }] -> { index, shells: [{ name, firstVertex, vertices,
// firstTriangle, triangles }], vertices, triangles }.
export function topology(shells) {
  const index = [], table = [];
  let v0 = 0;
  for (const s of shells) {
    const t0 = index.length / 3;
    for (const t of s.tris) index.push(v0 + t[0], v0 + t[1], v0 + t[2]);
    table.push({ name: s.name, firstVertex: v0, vertices: s.verts, firstTriangle: t0, triangles: s.tris.length });
    v0 += s.verts;
  }
  return { index, shells: table, vertices: v0, triangles: index.length / 3 };
}

// ------------------------------------------------------------------------------------------------------ the palm
// The palm's own vertex numbers: 0-5 W (exact), 6 front radial knuckle corner, 7 front ulnar, 8 back ulnar, 9 back
// radial (the raised corners), in 'thenar' 10 the thenar mass (level 0's vertex 7), then the base's vertices.
//   'box'     the ring to the four knuckle corners: 12 triangles
//   'thenar'  the box with its palm face split on the thenar vertex (a four-facet bulge low on the thumb side): 14
const PALMS = {
  box: {
    from: ['K0', 'K1', 'K2', 'K3'],
    tris: [[1, 6, 7], [1, 7, 2], [5, 4, 8], [5, 8, 9], [0, 6, 1], [0, 9, 6], [0, 5, 9], [3, 8, 4], [3, 7, 8], [3, 2, 7], [6, 9, 8], [6, 8, 7]],
  },
  thenar: {
    from: ['K0', 'K1', 'K2', 'K3', 7],
    tris: [[1, 6, 10], [6, 7, 10], [7, 2, 10], [2, 1, 10], [5, 4, 8], [5, 8, 9], [0, 6, 1], [0, 9, 6], [0, 5, 9], [3, 8, 4], [3, 7, 8], [3, 2, 7],
      [6, 9, 8], [6, 8, 7]],
  },
};

// The base under the ring (depths in units of level 0's collar depth below the pivot):
//   'pyramid'  a hexagonal pyramid on an apex at pyramid.apex below the ring (6 triangles; a flat cap would be 4). It
//              covers the forearm's end at rest, but its faces slope in from the ring, so at flexion with deviation the
//              forearm's rim shows: a gap of up to 8.6 mm on the reference hand (levels report).
//   'skirt'    a second hexagon B at skirt.ring below the ring, flared by skirt.scale so the faces under the ring run
//              straight down and out, then a pyramid on B (18 triangles): the forearm's rim stays covered to 0.9 mm
//              over flexion -70..70 and deviation -20..30 (reference hand), about level 0's closure.
export const BASE = { pyramid: { apex: 1.0 }, skirt: { ring: 0.6, scale: 1.05, apex: 1.2 } };
const BASE_VERTS = { pyramid: 1, skirt: 7 };
function baseTris(kind, first) {   // `first`: the palm's first base vertex
  if (kind === 'pyramid') return ringPyramid(first);
  const B = [0, 1, 2, 3, 4, 5].map((k) => first + k);
  return [...loft(B, [0, 1, 2, 3, 4, 5]), ...[0, 1, 2, 3, 4, 5].map((k) => [B[k], B[(k + 1) % 6], first + 6])];
}

// ------------------------------------------------------------------------------------------------- the variants
// digit kinds:
//   'tetra'  a straight tetrahedron: a three-sided base at the first joint, the apex at the digit's far end (4 / 4)
//   'bent'   a wedge: two pad corners and a back corner at the first joint, the back of the blended joint (the knuckle
//            that shows in a fist), the tip (6 triangles / 5 vertices)
//   'tube'   a three-sided tube: a ring at the first joint, a mitred ring at the blended joint, the tip (10 / 7)
const SPECS = {
  budget: { palm: 'box', base: 'pyramid', fingers: { index: 'tetra', middle: 'tetra', ring: 'tetra', pinky: 'tetra' }, thumb: 'bent' },
  readable: { palm: 'thenar', base: 'skirt', fingers: { index: 'tube', middle: 'bent', ring: 'bent', pinky: 'bent' }, thumb: 'tube' },
};
export const DEFAULT_VARIANT = 'budget';

const DIGIT_SHELL = {
  tetra: { verts: 4, tris: [...capStart([0, 1, 2]), ...fan([0, 1, 2], 3)] },
  // a0 (pad, -x) 0, b0 (pad, +x) 1, c0 (back) 2 at the first joint; the knuckle 3; the tip 4
  bent: { verts: 5, tris: [[0, 2, 1], [0, 1, 4], [1, 2, 3], [1, 3, 4], [0, 3, 2], [0, 4, 3]] },
  tube: { verts: 7, tris: [...capStart([0, 1, 2]), ...loft([0, 1, 2], [3, 4, 5]), ...fan([3, 4, 5], 6)] },
};
const NAME = (f) => f[0].toUpperCase() + f.slice(1);
function variantShells(spec) {
  const palm = PALMS[spec.palm], first = 6 + palm.from.length;
  const shells = [{ name: 'Palm', verts: first + BASE_VERTS[spec.base], tris: [...palm.tris, ...baseTris(spec.base, first)] }];
  for (const f of FINGERS) shells.push({ name: NAME(f), ...DIGIT_SHELL[spec.fingers[f]] });
  shells.push({ name: 'Thumb', ...DIGIT_SHELL[spec.thumb] });
  return shells;
}
const TOPO = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, topology(variantShells(s))]));
export const VARIANTS = Object.fromEntries(Object.entries(TOPO).map(([k, t]) => [k, {
  triangles: t.triangles, vertices: t.vertices, pieces: Object.fromEntries(t.shells.map((s) => [s.name, [s.triangles, s.vertices]])) }]));
export const TRIANGLES = VARIANTS[DEFAULT_VARIANT].triangles;
export const VERTICES = VARIANTS[DEFAULT_VARIANT].vertices;

// ------------------------------------------------------------------------------------------------- the geometry
// A digit's vertices for its kind. g0 = [hw, ht] at the first joint (the start cap), sizes = [[hw, ht] at J1, at J2].
export function digitVerts(kind, C, g0, sizes, d, inward = 0) {
  const { J: Jc, ax } = C;
  // the first joint's ring may be moved in toward the palm's mid-plane (x = 0, z = 0): the thumb's CMC sits near the
  // palm's surface, and a ring moved in stays hidden in a palm with fewer faces than level 0's
  const J = inward ? [[(1 - inward) * Jc[0][0], Jc[0][1], (1 - inward) * Jc[0][2]], Jc[1], Jc[2], Jc[3]] : Jc;
  if (kind === 'tetra') return [...triRing(J[0], ringFrame(ax[0].x, ax[0].y), K0 * g0[0], K0 * g0[1]), farEnd([J[1], J[2], J[3]], J[0], d.L)];
  const j = blendedJoint(J, ax, sizes, d.L), uIn = sub(j.c, J[0]), uOut = sub(J[3], j.c);
  const ring = mitreRing(j.c, j.x, uIn, uOut, j.hw, j.ht);
  if (kind === 'tube') return [...triRing(J[0], ringFrame(ax[0].x, uIn), K0 * g0[0], K0 * g0[1]), ...ring, J[3]];
  // bent: the first joint's corners (pad pair, back) across the chord to the joint; the knuckle = the joint ring's back middle
  const F0 = ringFrame(ax[0].x, uIn), hw = K0 * g0[0], ht = K0 * g0[1];
  return [add(J[0], add(scl(F0.x, -hw), scl(F0.m, ht))), add(J[0], add(scl(F0.x, hw), scl(F0.m, ht))), add(J[0], scl(F0.m, -ht)),
    scl(add(ring[0], ring[1]), 0.5), J[3]];
}
// the digits' first rings moved in from the joint toward the palm's mid-plane (digitVerts), so they stay hidden in the
// box palm at every pose, size and control (measured over the levels' checks: the thumb's CMC sits near the palm's
// surface, the little finger's MCP near the ulnar side)
export const INWARD = { thumb: 0.2, fingers: 0.05 };
const fingerSizes = (g) => [[g[0].hw0, g[0].ht0], [[g[0].hw1, g[0].ht1], [g[1].hw1, g[1].ht1]]];
const thumbSizes = (g) => [[g[0].hw0, g[0].ht0], [[g[1].hw0, g[1].ht0], [g[2].hw0, g[2].ht0]]];
function palmVerts(d, spec) {
  const P0 = level0Palm(d), W = wristRingPoints(d.ring), c = P0.connectorBelow;
  const own = PALMS[spec.palm].from.map((i) => (typeof i === 'number' ? P0.verts[i] : P0.knuckles[+i[1]]).slice());
  if (spec.base === 'pyramid') return [...W, ...own, [0, -BASE.pyramid.apex * c, 0]];
  const k = BASE.skirt;
  return [...W, ...own, ...W.map((v) => [v[0] * k.scale, -k.ring * c, v[2] * k.scale]), [0, -k.apex * c, 0]];
}

// build({ dims, skeleton, pose, angles, variant }) -> { positions, index, pieces, variant, diagnostics } (canonical right)
export function build(input) {
  const { dims: d, skeleton: skel } = input;
  const name = input.variant ?? DEFAULT_VARIANT;
  const spec = SPECS[name];
  if (!spec) throw new Error(`level 1 has no variant "${name}" (it has ${Object.keys(SPECS).join(', ')})`);
  const T = TOPO[name];
  const verts = [...palmVerts(d, spec)];
  for (const f of FINGERS) verts.push(...digitVerts(spec.fingers[f], chain(skel, f), ...fingerSizes(d.fingers[f].segs), d, INWARD.fingers));
  verts.push(...digitVerts(spec.thumb, chain(skel, 'thumb'), ...thumbSizes(d.thumb.segs), d, INWARD.thumb));
  if (verts.length !== T.vertices) throw new Error(`level 1 ${name}: ${verts.length} vertices built, ${T.vertices} in the topology`);
  const positions = new Array(3 * verts.length);
  verts.forEach((v, i) => { positions[3 * i] = v[0]; positions[3 * i + 1] = v[1]; positions[3 * i + 2] = v[2]; });
  const pieces = T.shells.map((s) => ({ ...s, name: `L1_${s.name}` }));
  return { positions, index: T.index.slice(), pieces, variant: name, diagnostics: [`level 1 '${name}': ${T.triangles} triangles, ${T.vertices} vertices, one rigid piece on the hand bone`] };
}

export const _lod = { K0, level0Palm, chain, farEnd, ringFrame, triRing, mitreRing, blendedJoint, digitVerts, loft, capStart, capEnd, fan, RING_CAP, ringPyramid, topology };
