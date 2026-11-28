// mesh0.js - hand level 0, the FULL mesh in the reference sheet's style: a faceted palm whose base is exactly the
// forearm's six-point wrist ring, with a thenar mass the thumb's metacarpal rises out of, a hypothenar edge and an
// arched knuckle cascade; three chamfered, tapering segments a finger; the thumb's metacarpal and two phalanges; and a
// closed hexagonal wrist connector around the pivot. Flat shading, one material, angular planes and straight edges.
//
// Every piece is a closed CONVEX solid bound with weight 1 to one bone (the connector to the hand bone), so the rig's
// separating-axis check is exact on what is drawn. A digit segment is three rings: its start cap S at its own joint
// (always inside its parent), a body ring B, and a bevelled end cap E that runs past the next joint far enough to hold
// the child's start cap at every angle within the joint limits (fitted below, "the child's cap inside the parent"): the
// joints stay closed, and the bevel is the knuckle the reference draws. A distal segment tapers to a flat tip face set
// toward the nail. The palm (rings W, M, K below) is fitted to hold the proximal phalanges' start caps at every MCP
// angle and the thumb metacarpal's at every CMC angle, so the thumb's base never shows through the palm wall.
//
// Counts per piece (triangles / vertices): palm 40 / 22, connector 32 / 18, segment 20 / 12 (ten: the proximal and
// middle phalanges and the thumb's metacarpal and proximal phalanx), distal 12 / 8 (five): 332 triangles, 200 vertices
// a hand, for every pose, size, age, side and control. Cheaper pieces and what they lose: a segment as a plain frustum
// (12 / 8; S and E only) loses the bevelled knuckle and must reach a full child half-thickness past the joint, so the
// segments read as overlapping boxes (-80 a hand: 252); a pyramid tip (6 / 5) gives pencil points (-30); the collar as
// a plain hexagonal prism (20 / 12) shows its whole length (about 0.15 L) as a sleeve below the palm at rest (-12); the
// palm without its mid ring (24 / 14) loses the thenar and the hypothenar: the box that blind readers of the sheets named.
//
// Mode A: the mesh in the bind pose (hand space, every finger bone unrotated), the 16 bones and their rest rotations.
// Mode B (level 0): the same mesh posed and baked onto the hand bone.

import { vec, quat, LIMITS, FINGERS, DIGITS, DIGIT_BONES, BONE_NAMES, planesOf, sdPlanes, convexExcess, wristRingPoints, fk } from './rig.js';

const { add, sub, scl, dot, cross, len, nrm, lerp } = vec;
const Q = quat;
const DEG = Math.PI / 180;

export const LEVEL = 0;

// ------------------------------------------------------------------------------------------------ the triangles
// A ring of 4 runs (-x,-z) (+x,-z) (+x,+z) (-x,+z) around the bone's +Y axis; a side quad (a_k, b_k, b_k+1, a_k+1)
// becomes (a_k, b_k, b_k+1), (a_k, b_k+1, a_k+1): counter-clockwise from outside.
const loft = (a, b) => { const t = []; for (let k = 0; k < a.length; k++) { const k1 = (k + 1) % a.length; t.push([a[k], b[k], b[k1]], [a[k], b[k1], a[k1]]); } return t; };
const capStart = (r) => { const t = []; for (let k = 1; k + 1 < r.length; k++) t.push([r[0], r[k], r[k + 1]]); return t; };
const capEnd = (r) => { const t = []; for (let k = 1; k + 1 < r.length; k++) t.push([r[0], r[k + 1], r[k]]); return t; };
const R4 = (o) => [o, o + 1, o + 2, o + 3];
export const SEGMENT_TRIS = [...capStart(R4(0)), ...loft(R4(0), R4(4)), ...loft(R4(4), R4(8)), ...capEnd(R4(8))];      // 20
export const DISTAL_TRIS = [...capStart(R4(0)), ...loft(R4(0), R4(4)), ...capEnd(R4(4))];   // 12: a tapered box with a flat, bevelled tip
const R6 = (o) => [o, o + 1, o + 2, o + 3, o + 4, o + 5];
export const CONNECTOR_TRIS = [...capStart(R6(0)), ...loft(R6(0), R6(6)), ...loft(R6(6), R6(12)), ...capEnd(R6(12))];   // 32: a chamfered hexagonal nut
// The palm: ring W the wrist (0-5, the design's six points: radial side, palm radial, palm ulnar, ulnar side, back
// ulnar, back radial), ring M the mid palm (6-13: palm radial corner, thenar, hypothenar, palm ulnar corner, back ulnar
// corner, back ulnar, back radial, back radial corner) and ring K the knuckles (14-21: palm radial corner, palm index /
// middle, palm ring / little, palm ulnar corner, then the same four on the back). W to M is a zip (each wrist side
// vertex meets two corners), M to K a loft whose quads take the diagonal that keeps the solid convex, and K is closed
// by a roof of three planar quads that runs parallel to Z (the knuckle cascade, arched across the fingers).
const R8 = (o) => [o, o + 1, o + 2, o + 3, o + 4, o + 5, o + 6, o + 7];
const loftD = (a, b, flip) => { const t = []; for (let k = 0; k < a.length; k++) { const k1 = (k + 1) % a.length;
  if (flip[k]) t.push([a[k], b[k], a[k1]], [a[k1], b[k], b[k1]]); else t.push([a[k], b[k], b[k1]], [a[k], b[k1], a[k1]]); } return t; };
export const PALM_ZIP = [[0, 13, 6], [0, 6, 1], [1, 6, 7], [1, 7, 2], [2, 7, 8], [2, 8, 9], [2, 9, 3], [3, 9, 10], [3, 10, 4],
  [4, 10, 11], [4, 11, 5], [5, 11, 12], [5, 12, 13], [5, 13, 0]];
export const PALM_FLIP = [true, false, false, false, false, false, true, false];
export const PALM_ROOF = [[14, 21, 20], [14, 20, 15], [15, 20, 19], [15, 19, 16], [16, 19, 18], [16, 18, 17]];
export const PALM_TRIS = [...capStart(R6(0)), ...PALM_ZIP, ...loftD(R8(6), R8(14), PALM_FLIP), ...PALM_ROOF];   // 4 + 14 + 16 + 6 = 40
export const PIECE_COUNTS = { palm: [40, 22], connector: [32, 18], segment: [20, 12], distal: [12, 8] };
export const TRIANGLES = 40 + 32 + 10 * 20 + 5 * 12;   // 332
export const VERTICES = 22 + 18 + 10 * 12 + 5 * 8;      // 200

// Shape constants (proposals, chosen by looking at the sheets against the reference sheet).
export const SHAPE = {
  startScale: 0.94,          // a segment's start cap, relative to its start size (it hides in the parent)
  bodyBack: 0.35,            // the body ring B sits this many child half-thicknesses before the next joint
  tip: { w: 0.72, t: 0.62, z: -0.20 },   // a distal segment's tip face: half-width and half-thickness (of its end size), centre toward the nail
  connector: { scale: 1.07, pad: 0.0008 },   // the collar: the ring scaled, plus this much (m, reference size) outward
  wrist: { flexion: [-70, 70], deviation: [-20, 30] },   // the wrist angles the collar must close (degrees)
  palm: {
    midY: { radial: 0.42, thenar: 0.27, hypothenar: 0.40, ulnar: 0.46, back: 0.46 },   // ring M's heights (of the middle knuckle's)
    radialOut: 0.012, ulnarOut: 0.010,        // the mid palm's sides out past the knuckle corners (of L): thenar and hypothenar edges
    thenar: { x: 0.50, bulge: 0.050 },        // across (fraction of the radial half-width); out of the palm past the wrist-knuckle line (of L)
    hypothenar: { x: 0.60, bulge: 0.018 },
    corner: 0.006,                            // the mid corners out (of L)
    backX: 0.45, backRidge: 0.006,            // the back's mid vertices across (fraction of the half-width), out (of L): the central ridge
    knuckleRidge: 0.004,                      // the back of the index / middle and ring / little knuckles out (of L)
    pad: 0.020,                               // the palm's pads in front of the knuckles (of L): the palm thicker than the fingers
  },
};

// ---------------------------------------------------------------------------------------------- the digit pieces
// Whether every point of a flat array (x, y, z, x, y, z, ...) is on the inner side of every plane by `limit`: the
// same test as sdPlanes(planes, p) <= limit for each point (the same arithmetic, a NaN failing it), stopping at the
// first point outside. The fits below ask only this, many times over the same points.
const flat = (pts) => { const F = new Float64Array(3 * pts.length); pts.forEach((q, i) => { F[3 * i] = q[0]; F[3 * i + 1] = q[1]; F[3 * i + 2] = q[2]; }); return F; };
function allInside(planes, F, limit) {
  const A = new Float64Array(4 * planes.length);
  planes.forEach((P, k) => { A[4 * k] = P.n[0]; A[4 * k + 1] = P.n[1]; A[4 * k + 2] = P.n[2]; A[4 * k + 3] = P.d; });
  for (let i = 0; i < F.length; i += 3) {
    const x = F[i], y = F[i + 1], z = F[i + 2];
    for (let k = 0; k < A.length; k += 4) if (!(A[k] * x + A[k + 1] * y + A[k + 2] * z - A[k + 3] <= limit)) return false;
  }
  return true;
}
function ringVerts(y, hw, zBack, zPad) { return [[-hw, y, zBack], [hw, y, zBack], [hw, y, zPad], [-hw, y, zPad]]; }

// The bevelled end of a parent segment, fitted so that the child's start cap stays inside it for every child angle
// within [lo, hi] (degrees, about local X at the joint, y = jointY). Returns the end ring's numbers.
function fitEnd(seg, yB, jointY, child, lo, hi, m) {
  const cw = child.hw, ct = child.ht;
  const samples = [];
  for (let th = lo; th <= hi + 1e-9; th += 2.5) {
    const c = Math.cos(th * DEG), s = Math.sin(th * DEG);
    for (const [x, z] of [[-cw, -ct], [cw, -ct], [cw, ct], [-cw, ct]]) samples.push([x, jointY + (-z * s), z * c]);   // qX(th) about the joint
  }
  let yE = jointY + ct + 2 * m;
  const hwE = Math.min(seg.hw1, cw + m);
  const F = flat(samples);
  const inside = (zd, zp, y) => {
    const v = [...ringVerts(0, seg.hw0, -seg.ht0, seg.ht0), ...ringVerts(yB, seg.hw1, -seg.ht1, seg.ht1), ...ringVerts(y, hwE, -zd, zp)];
    return allInside(planesOf(v, SEGMENT_TRIS), F, -0.5 * m);
  };
  for (let grow = 0; grow < 40 && !inside(seg.ht1, seg.ht1, yE); grow++) yE += 0.25 * m;   // rare: lengthen the end
  const bisect = (f) => { let a = 0, b = seg.ht1; if (!f(b)) return b; for (let i = 0; i < 30; i++) { const mid = (a + b) / 2; if (f(mid)) b = mid; else a = mid; } return b; };
  const zd = bisect((z) => inside(z, seg.ht1, yE));
  const zp = bisect((z) => inside(zd, z, yE));
  return { yE, hwE, zd, zp };
}

// the 15 digit pieces in their bones' local frames
function digitPieces(d) {
  const S = SHAPE, m = d.m, out = {};
  const chain = (segs, lims) => segs.map((g, k) => {
    const a = S.startScale, start = ringVerts(0, a * g.hw0, -a * g.ht0, a * g.ht0);
    if (k === 2) {   // distal: a box tapering to a flat tip face set toward the nail (the pad slopes, the nail stays flat)
      const zc = S.tip.z * g.ht1;
      return { kind: 'distal', verts: [...start, ...ringVerts(g.len, S.tip.w * g.hw1, zc - S.tip.t * g.ht1, zc + S.tip.t * g.ht1)], tris: DISTAL_TRIS };
    }
    const child = segs[k + 1], cs = { hw: a * child.hw0, ht: a * child.ht0 };
    const yB = g.len - S.bodyBack * cs.ht;
    const e = fitEnd({ hw0: a * g.hw0, ht0: a * g.ht0, hw1: g.hw1, ht1: g.ht1 }, yB, g.len, cs, lims[k][0], lims[k][1], m);
    return { kind: 'segment', verts: [...start, ...ringVerts(yB, g.hw1, -g.ht1, g.ht1), ...ringVerts(e.yE, e.hwE, -e.zd, e.zp)], tris: SEGMENT_TRIS,
      fit: { child: cs, end: e } };
  });
  out.thumb = chain(d.thumb.segs, [LIMITS.thumb.mcp, LIMITS.thumb.ip]);
  for (const f of FINGERS) out[f] = chain(d.fingers[f].segs, [LIMITS.pip, LIMITS.dip]);
  return out;
}

// ----------------------------------------------------------------------------------------------------- the palm
// The palm's 22 vertices for the fitted numbers p = { y: the knuckle roof's four heights (radial corner, index / middle,
// ring / little, ulnar corner), zF, zB (the palm and back faces at the knuckles), xR, xU (the knuckle corners across),
// th (the thenar raised for the thumb) }. Ring W is the given wrist ring itself; ring M lies on or outside the straight
// line from the wrist to the knuckles (bulges only ever go outward), which keeps the solid convex for any ring and size.
function palmVerts(d, p) {
  const S = SHAPE.palm, w = d.ring.w, F = d.fingers, L = d.L, B = (p.lam ?? 1) * L;   // B: the thenar's and hypothenar's scale
  const W = wristRingPoints(d.ring);
  const xs = [p.xR, (F.index.x + F.middle.x) / 2, (F.ring.x + F.pinky.x) / 2, p.xU], ys = p.y, kr = S.knuckleRidge * L;
  const K = [0, 1, 2, 3].map((i) => [xs[i], ys[i], p.zF]);
  const KB = [3, 2, 1, 0].map((i) => [xs[i], ys[i], p.zB - (i === 1 || i === 2 ? kr : 0)]);
  const yRef = F.middle.y;
  const lerpZ = (z0, z1, y, yk) => z0 + (z1 - z0) * y / yk;
  const front = (z0, y, yk) => Math.max(lerpZ(z0, p.zF, y, yk), p.zF);
  const back = (z0, zk, y, yk) => Math.min(lerpZ(z0, zk, y, yk), zk);
  const yr = S.midY.radial * yRef, yt = S.midY.thenar * yRef, yh = S.midY.hypothenar * yRef, yu = S.midY.ulnar * yRef, yb = S.midY.back * yRef;
  // the mid sides on or outside the straight line from the wrist's side to the knuckle corner (a wrist wider than the
  // knuckles makes a palm that narrows all the way, still convex)
  const c = S.corner * L, xr = Math.max(xs[0], d.ring.f + (xs[0] - d.ring.f) * yr / ys[0]) + S.radialOut * L + 0.5 * p.th;
  const xu = Math.min(xs[3], -d.ring.b + (xs[3] + d.ring.b) * yu / ys[3]) - S.ulnarOut * L;
  // the back's two mid vertices share one height, so the quad they make with the wrist's back edge is planar
  const zRidge = back(-w, p.zB - kr, yb, Math.max(ys[1], ys[2])) - S.backRidge * L;
  const M = [
    [xr, yr, front(0.5 * w, yr, ys[0]) + c + 0.5 * p.th],                            // palm radial corner: the thenar's edge
    [S.thenar.x * xs[0], yt, front(w, yt, ys[1]) + S.thenar.bulge * B + p.th],       // the thenar mass
    [S.hypothenar.x * xs[3], yh, front(w, yh, ys[2]) + S.hypothenar.bulge * B],     // the hypothenar
    [xu, yu, front(0.5 * w, yu, ys[3]) + c],                                         // palm ulnar corner: the hypothenar edge
    [xu, yu, back(-w, p.zB, yu, ys[3]) - c],                                         // back ulnar corner
    [S.backX * xs[3], yb, zRidge],                                                   // back, ulnar of the ridge
    [S.backX * xs[0], yb, zRidge],                                                   // back, radial of the ridge
    [xr, yr, back(-w, p.zB, yr, ys[0]) - c],                                         // back radial corner
  ];
  return [...W, ...M, ...K, ...KB];
}

// A wrist ring far from the reference (very flat, very round) can leave a mid vertex a fraction of a millimetre under
// the plane of a neighbouring facet: such a vertex's facet is lifted outward (palm side +Z, back -Z), never by more
// than a quarter of the palm's depth. The ring W and the knuckles K never move. Returns the excess left (0: convex).
function convexify(V) {
  const start = V.map((v) => v[2]), cap = 0.25 * Math.max(...V.map((v) => Math.abs(v[2])));
  for (let it = 0; it < 60; it++) {
    const pl = planesOf(V, PALM_TRIS);
    let moved = false;
    PALM_TRIS.forEach((t, i) => {
      let worst = 0; for (const v of V) worst = Math.max(worst, dot(pl[i].n, v) - pl[i].d);
      if (worst <= 1e-10) return;
      for (const j of t) if (j >= 6 && j <= 13) {
        const z = V[j][2] + (j <= 9 ? 1 : -1) * 0.5 * worst;
        if (Math.abs(z - start[j]) <= cap) { V[j] = [V[j][0], V[j][1], z]; moved = true; }
      }
    });
    if (!moved) break;
  }
  return convexExcess(V, PALM_TRIS);
}
// The palm's vertices for the fitted numbers: the design's bulges if the solid is convex with them (after convexify),
// else the bulges scaled down in steps until it is (the scale is reported in the fit).
function palmSolid(d, p) {
  for (let lam = p.lam ?? 1; ; lam = Math.max(0, lam - 0.1)) {
    const V = palmVerts(d, { ...p, lam });
    if (convexify(V) <= 1e-10 || lam === 0) return { V, lam };
  }
}

// the points that must stay inside the palm: the proximal phalanges' start caps at every MCP flexion, spread and twist
// within the limits (by finger), and the thumb metacarpal's start cap at every CMC configuration within the limits
// the MCP rotations of the samples, by finger: they depend on the limits alone, so they are built once
const MCP_SAMPLES = {};
function mcpSamples(fn) {
  if (MCP_SAMPLES[fn]) return MCP_SAMPLES[fn];
  const out = [], [slo, shi] = LIMITS.spread[fn];
  for (let fl = LIMITS.mcp[0]; fl <= LIMITS.mcp[1] + 1e-9; fl += 5) for (let sp = slo; sp <= shi + 1e-9; sp += 2.5) for (const tw of [LIMITS.twist[0], 0, LIMITS.twist[1]]) {
    out.push(Q.mul(Q.mul(Q.axis([0, 0, 1], sp * DEG), Q.axis([1, 0, 0], fl * DEG)), Q.axis([0, 1, 0], tw * DEG)));
  }
  return (MCP_SAMPLES[fn] = out);
}
function palmSamples(d, bones, starts) {
  const fingerPts = {}, thumbPts = [];
  for (const fn of FINGERS) {
    const head = bones[DIGIT_BONES[fn][0]].head, c = starts[fn], pts = fingerPts[fn] = [];
    for (const q of mcpSamples(fn)) for (const v of c) pts.push(add(head, Q.rot(q, v)));
  }
  // the thumb's CMC: rotate the metacarpal's start cap by the rig's own Thumb_01 rotation over a grid of the limits
  const T = LIMITS.thumb, bone = bones[1];
  const steps = (r, n) => Array.from({ length: n }, (_, i) => r[0] + (r[1] - r[0]) * i / (n - 1));
  for (const cm of steps(T.cmc, 5)) for (const op of steps(T.opposition, 5)) for (const ab of steps(T.abduction, 5)) for (const tw of steps(T.twist, 3)) {
    const R = Q.mul(bone.bind, restCMC(d, { cmc: cm, opposition: op, abduction: ab, twist: tw }));
    for (const v of starts.thumb) thumbPts.push(add(bone.head, Q.rot(R, v)));
  }
  return { fingerPts, thumbPts };
}
function restCMC(d, a) {   // Thumb_01's rest rotation alone (the same mapping as rig.restFromAngles)
  const t = d.thumb, M = { bindAngleDeg: 32, zeroAngleDeg: 14, kA: 0.9, kE: 0.6, kP: 0.7 };
  const inPlane = M.zeroAngleDeg + M.kA * a.abduction - M.bindAngleDeg;
  const Rw = Q.mul(Q.mul(Q.axis([0, 0, 1], -inPlane * DEG), Q.axis(t.elevAxis, M.kE * a.opposition * DEG)), Q.axis(t.Y, -(M.kP * a.opposition + a.twist) * DEG));
  return Q.mul(Q.mul(Q.mul(Q.conj(t.bindQ), Rw), t.bindQ), Q.axis([1, 0, 0], a.cmc * DEG));
}

// The palm's numbers from the samples, directly: the knuckle faces and corners just outside the proximal caps' sweep,
// the roof's four heights raised until the sweep is under it (and the roof stays convex), then the thenar raised until
// the thumb's metacarpal cap is inside at every CMC angle. A last check pushes out whatever face a sample still crosses.
function fitPalm(d, bones, starts) {
  const m = d.m, F = d.fingers, step = 0.0002 * d.s;
  const { fingerPts, thumbPts } = palmSamples(d, bones, starts);
  const all = FINGERS.flatMap((f) => fingerPts[f]);
  const p = { y: [-Infinity, -Infinity, -Infinity, -Infinity], zF: d.zf + d.eZ + SHAPE.palm.pad * d.L, zB: d.zBack, xR: -Infinity, xU: Infinity, th: 0 };
  for (const q of all) { p.zF = Math.max(p.zF, q[2] + 2 * m); p.zB = Math.min(p.zB, q[2] - 2 * m); }
  for (const q of fingerPts.index) p.xR = Math.max(p.xR, q[0] + 2 * m);
  for (const q of fingerPts.pinky) p.xU = Math.min(p.xU, q[0] - 2 * m);
  const xs = [p.xR, (F.index.x + F.middle.x) / 2, (F.ring.x + F.pinky.x) / 2, p.xU];
  const seg = (x) => (x >= xs[1] ? 0 : x >= xs[2] ? 1 : 2);
  for (const q of all) { const i = [0, 1, 2, 3].reduce((a, k) => (Math.abs(q[0] - xs[k]) < Math.abs(q[0] - xs[a]) ? k : a), 0); p.y[i] = Math.max(p.y[i], q[1] + 2 * m); }
  for (let i = 0; i < 4; i++) if (!Number.isFinite(p.y[i])) p.y[i] = Math.max(...p.y.filter(Number.isFinite));
  let rounds = 0;
  for (; rounds < 100; rounds++) {
    let raised = false;
    for (const q of all) {
      const i = seg(q[0]), u = (xs[i] - q[0]) / (xs[i] - xs[i + 1]);
      const need = q[1] + 2 * m - (p.y[i] * (1 - u) + p.y[i + 1] * u);
      if (need > 1e-12) { p.y[i] += need; p.y[i + 1] += need; raised = true; }
    }
    for (const i of [1, 2]) {   // the roof convex: each inner height on or above the line through its neighbours
      const u = (xs[i - 1] - xs[i]) / (xs[i - 1] - xs[i + 1]), lo = p.y[i - 1] * (1 - u) + p.y[i + 1] * u;
      if (p.y[i] < lo - 1e-12) { p.y[i] = lo; raised = true; }
    }
    if (!raised) break;
  }
  const worst = (pts, v) => { const pl = planesOf(v, PALM_TRIS); let w = -Infinity, wp = null; for (const q of pts) { const s = sdPlanes(pl, q); if (s > w) { w = s; wp = q; } } return { w, wp, pl }; };
  let thSteps = 0;
  for (; thSteps < 250 && worst(thumbPts, palmSolid(d, p).V).w > -m; thSteps++) p.th += step;
  // the last check: anything still outside pushes the face it crosses outward. The samples and the planes are read
  // from flat arrays (the same arithmetic as dot(n, q) - d, in the same order); the pass that finds nothing outside
  // also gives the fingers' clearance.
  const allF = new Float64Array(3 * all.length);
  all.forEach((q, i) => { allF[3 * i] = q[0]; allF[3 * i + 1] = q[1]; allF[3 * i + 2] = q[2]; });
  let pushes = 0, fingerWorst = null;
  for (; pushes < 200; pushes++) {
    const v = palmSolid(d, p).V, pl = planesOf(v, PALM_TRIS), need = new Set();
    const A = new Float64Array(4 * pl.length);
    pl.forEach((P, k) => { A[4 * k] = P.n[0]; A[4 * k + 1] = P.n[1]; A[4 * k + 2] = P.n[2]; A[4 * k + 3] = P.d; });
    let passWorst = -Infinity;
    for (let i = 0, n = all.length; i < n; i++) {
      const x = allF[3 * i], y = allF[3 * i + 1], z = allF[3 * i + 2];
      let w = -Infinity, wk = -1;
      for (let k = 0; k < A.length; k += 4) { const s = A[k] * x + A[k + 1] * y + A[k + 2] * z - A[k + 3]; if (s > w) { w = s; wk = k; } }
      if (w > passWorst) passWorst = w;
      if (w <= -m) continue;
      const wn = pl[wk / 4].n, ax = Math.abs(wn[0]), ay = Math.abs(wn[1]), az = Math.abs(wn[2]);
      if (ay >= ax && ay >= az) need.add(`y${seg(x)}`); else if (ax >= az) need.add(wn[0] > 0 ? 'xR' : 'xU'); else need.add(wn[2] > 0 ? 'zF' : 'zB');
    }
    if (!need.size) { fingerWorst = passWorst; break; }
    for (const k of need) {
      if (k[0] === 'y') { const i = +k[1]; p.y[i] += step; p.y[i + 1] += step; }
      else if (k === 'xR') p.xR += step; else if (k === 'xU') p.xU -= step; else if (k === 'zF') p.zF += step; else p.zB -= step;
    }
  }
  const sol = palmSolid(d, p), v = sol.V;
  p.lam = sol.lam;
  return { p, rounds, thSteps, pushes, fingerClearance: -(fingerWorst ?? worst(all, v).w), thumbClearance: -worst(thumbPts, v).w };
}

// ------------------------------------------------------------------------------------------------- the connector
// A closed hexagonal collar around the pivot, bound to the hand bone, shaped like a chamfered nut: its middle ring is
// the wrist ring scaled out a little (at the pivot's height), and it tapers to a smaller ring below (inside the
// forearm's end at rest, so only a short band shows) and above (inside the palm). Its ends are fitted so that the
// forearm's open end, seen from the hand, stays inside it for every wrist flexion and deviation within SHAPE.wrist:
// no gap opens and no open end shows.
export function forearmRingAt(d, flexDeg, devDeg) {
  // the forearm's end ring seen from the hand: the inverse of the hand's wrist rotation (flexion about +X, then ulnar
  // deviation about +Z: positive deviation moves the fingers toward the little finger)
  const qh = Q.mul(Q.axis([1, 0, 0], flexDeg * DEG), Q.axis([0, 0, 1], devDeg * DEG));
  return wristRingPoints(d.ring).map((v) => Q.rot(Q.conj(qh), v));
}
// the forearm's end ring at every wrist flexion and deviation within SHAPE.wrist (5 and 2.5 degree steps), and the
// connector's reach below and above the pivot that holds it
function connectorSweep(d) {
  const W = SHAPE.wrist, m = d.m, sweep = [];
  for (let fl = W.flexion[0]; fl <= W.flexion[1] + 1e-9; fl += 5) for (let dv = W.deviation[0]; dv <= W.deviation[1] + 1e-9; dv += 2.5) sweep.push(...forearmRingAt(d, fl, dv));
  let c0 = 0, c1 = 0;
  for (const v of sweep) { c0 = Math.max(c0, -v[1]); c1 = Math.max(c1, v[1]); }
  return { sweep, c0: c0 + 2 * m + 0.001 * d.s, c1: c1 + 2 * m + 0.001 * d.s };
}
function connectorPiece(d) {
  const C = SHAPE.connector, pad = C.pad * d.s, m = d.m;
  const base = wristRingPoints(d.ring);
  const mid = base.map((v) => { const r = Math.hypot(v[0], v[2]); return [v[0] * C.scale + pad * v[0] / r, 0, v[2] * C.scale + pad * v[2] / r]; });
  const { sweep, c0, c1 } = connectorSweep(d);
  const ringAt = (y, k) => mid.map((v) => [v[0] * k, y, v[2] * k]);
  const verts = (k0, k1) => [...ringAt(-c0, k0), ...mid, ...ringAt(c1, k1)];
  const F = flat(sweep), inside = (k0, k1) => allInside(planesOf(verts(k0, k1), CONNECTOR_TRIS), F, -m);
  const bisect = (f) => { let a = 0.05, b = 1; if (!f(b)) return b; for (let i = 0; i < 30; i++) { const c = (a + b) / 2; if (f(c)) b = c; else a = c; } return b; };
  const k0 = bisect((k) => inside(k, 1)), k1 = bisect((k) => inside(k0, k));
  return { kind: 'connector', verts: verts(k0, k1), tris: CONNECTOR_TRIS, fit: { below: c0, above: c1, lowerScale: k0, upperScale: k1, closed: inside(k0, k1) } };
}

// --------------------------------------------------------------------------------------------- all the pieces
const PIECES = new Map(), PALMS = new Map();
export const clearPieceCache = () => { PIECES.clear(); PALMS.clear(); };
// The palm alone, fitted as for level 0, and the connector's depth below the pivot: all that levels 1 to 3 take from
// level 0 (mesh1.level0Palm), without fitting the digits' ends or the connector's scales. Cached by the dimensions' key.
export function palmPiece(d, bones) {
  let hit = PALMS.get(d.key);
  if (hit) return hit;
  const a = SHAPE.startScale;
  const startCap = (g) => ringVerts(0, a * g.hw0, -a * g.ht0, a * g.ht0);
  const starts = { thumb: startCap(d.thumb.segs[0]) };
  for (const f of FINGERS) starts[f] = startCap(d.fingers[f].segs[0]);
  const fit = fitPalm(d, bones, starts);
  hit = { fit, verts: palmSolid(d, fit.p).V, connectorBelow: connectorSweep(d).c0 };
  if (PALMS.size > 400) PALMS.delete(PALMS.keys().next().value);
  PALMS.set(d.key, hit);
  return hit;
}
// The level-0 pieces of a hand: { bones: [16 convex pieces, one a bone, in the bone's local frame], connector (hand
// space), fit (what was fitted) }. Cached by the dimensions' key. `bones` is rig.skeleton(d).
export function pieces(d, bones) {
  const hit = PIECES.get(d.key);
  if (hit) return hit;
  const digits = digitPieces(d);
  const { fit, verts } = palmPiece(d, bones);
  const palm = { kind: 'palm', verts: verts.map((v) => v.slice()), tris: PALM_TRIS };
  const list = [palm, ...DIGITS.flatMap((dg) => digits[dg])];
  list.forEach((pc, i) => { pc.name = BONE_NAMES[i]; pc.bone = i; });
  // the connector is fitted on its first read: the solver (rig.makeRig) reads only the 16 bone pieces, and levels 1 to 3
  // only the depth below the pivot (palmPiece), so a body solved at those levels never pays for it
  let connector = null;
  const connectorOnce = () => (connector ??= { ...connectorPiece(d), name: 'Connector', bone: 0 });
  const fitOut = { palm: fit.p, palmFit: { rounds: fit.rounds, thenarSteps: fit.thSteps, pushes: fit.pushes, fingerClearance: fit.fingerClearance, thumbClearance: fit.thumbClearance },
    palmConvexExcess: convexExcess(palm.verts, palm.tris) };
  Object.defineProperty(fitOut, 'connector', { enumerable: true, get: () => connectorOnce().fit });
  const out = { bones: list, fit: fitOut };
  Object.defineProperty(out, 'connector', { enumerable: true, get: connectorOnce });
  if (PIECES.size > 400) PIECES.delete(PIECES.keys().next().value);
  PIECES.set(d.key, out);
  return out;
}

// ------------------------------------------------------------------------------------------------- the meshes
// The bind mesh (mode A): hand-space positions with every finger bone unrotated, one bone a vertex, and the piece table.
export function bindMesh(d, bones, P = pieces(d, bones)) {
  const positions = [], index = [], boneIndex = [], table = [];
  const put = (pc, b, toHand) => {
    const v0 = positions.length / 3, t0 = index.length / 3;
    for (const v of pc.verts) { const w = toHand(v); positions.push(w[0], w[1], w[2]); boneIndex.push(b); }
    for (const t of pc.tris) index.push(v0 + t[0], v0 + t[1], v0 + t[2]);
    table.push({ name: pc.name, bone: BONE_NAMES[b], kind: pc.kind, firstVertex: v0, vertices: pc.verts.length, firstTriangle: t0, triangles: pc.tris.length });
  };
  P.bones.forEach((pc, b) => put(pc, b, (v) => (b === 0 ? v.slice() : add(bones[b].head, Q.rot(bones[b].bind, v)))));
  put(P.connector, 0, (v) => v.slice());
  return { positions, index, boneIndex, pieces: table };
}

// Posed positions of a bind mesh for rest rotations (one a bone): what mode B bakes onto the hand bone.
export function posePositions(mesh, bones, rest) {
  const F = fk(bones, rest), out = new Array(mesh.positions.length);
  for (let v = 0, n = mesh.boneIndex.length; v < n; v++) {
    const b = mesh.boneIndex[v], bn = bones[b];
    const p = [mesh.positions[3 * v], mesh.positions[3 * v + 1], mesh.positions[3 * v + 2]];
    const w = add(F.P[b], Q.rot(F.R[b], Q.rot(Q.conj(bn.bind), sub(p, bn.head))));
    out[3 * v] = w[0]; out[3 * v + 1] = w[1]; out[3 * v + 2] = w[2];
  }
  return out;
}

// internals for the tools and tests
export const _internal = { palmVerts, fitPalm, palmSamples, fitEnd, digitPieces, connectorPiece };
