// shells.js - the drawn shells of a lower level of detail checked against each other. The solver's exact test
// (rig.penetrations) runs on level 0's convex pieces; levels 1 and 2 draw other shapes from the same skeleton (wedges,
// tubes, one finger mass), which can go into each other where level 0's pieces do not. So these are checked on what is
// drawn: every vertex of a shell and samples along its edges against every other shell, inside by the winding number,
// the depth the distance to that shell's surface.
//
// A digit starts inside the palm (its first ring, `base` vertices, is hidden there): against the palm, a digit's own
// base ring is not counted, and along an edge that leaves the base only what comes back in after the edge has left the
// palm counts (a digit that re-enters the palm). Every other pair counts wherever one is inside the other.
// Plain JavaScript, no dependencies.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// the winding number of a closed shell around p (1 inside, 0 outside; van Oosterom and Strackee's solid angle)
function winding(p, S) {
  let w = 0;
  for (const [i, j, k] of S.T) {
    const a = sub(S.V[i], p), b = sub(S.V[j], p), c = sub(S.V[k], p), la = len(a), lb = len(b), lc = len(c);
    w += 2 * Math.atan2(dot(a, cross(b, c)), la * lb * lc + dot(a, b) * lc + dot(a, c) * lb + dot(b, c) * la);
  }
  return w / (4 * Math.PI);
}
function pointTriangle(p, a, b, c) {   // the distance from p to a triangle (Ericson's closest point)
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return len(sub(p, lerp(a, b, d1 / (d1 - d3))));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return len(sub(p, lerp(a, c, d2 / (d2 - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return len(sub(p, lerp(b, c, (d4 - d3) / ((d4 - d3) + (d5 - d6)))));
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return len(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}
const depthIn = (p, S) => (winding(p, S) > 0.5 ? S.T.reduce((m, [i, j, k]) => Math.min(m, pointTriangle(p, S.V[i], S.V[j], S.V[k])), Infinity) : 0);

function shellsOf(positions, index, pieces) {
  return pieces.map((pc) => {
    const V = [], T = [], E = new Set();
    for (let i = 0; i < pc.vertices; i++) { const v = pc.firstVertex + i; V.push([positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]]); }
    for (let t = pc.firstTriangle; t < pc.firstTriangle + pc.triangles; t++) {
      const tri = [0, 1, 2].map((k) => index[3 * t + k] - pc.firstVertex);
      T.push(tri);
      for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) E.add(a < b ? `${a},${b}` : `${b},${a}`);
    }
    const lo = [0, 1, 2].map((k) => Math.min(...V.map((v) => v[k]))), hi = [0, 1, 2].map((k) => Math.max(...V.map((v) => v[k])));
    return { name: pc.name, V, T, E: [...E].map((e) => e.split(',').map(Number)), lo, hi };
  });
}

// overlaps(positions, index, pieces, { palm, base, samples }) -> [{ a, b, depth }] for every ordered pair of shells
// where a goes into b, the deepest point's depth (metres), largest first. palm: the name of the shell the digits start
// in; base: how many first vertices of a digit shell are its base ring.
export function overlaps(positions, index, pieces, { palm, base = 3, samples = 8 } = {}) {
  const S = shellsOf(positions, index, pieces), out = [];
  for (const A of S) for (const B of S) {
    if (A === B || A.name === palm) continue;
    if ([0, 1, 2].some((k) => A.hi[k] < B.lo[k] || A.lo[k] > B.hi[k])) continue;
    const inPalm = B.name === palm, isBase = (v) => inPalm && v < base;
    let depth = 0;
    A.V.forEach((p, v) => { if (!isBase(v)) depth = Math.max(depth, depthIn(p, B)); });
    for (const [a, b] of A.E) {
      if (isBase(a) && isBase(b)) continue;
      if (isBase(a) || isBase(b)) {   // from the base: only a re-entry after the edge has left the palm
        const [p, q] = isBase(a) ? [A.V[a], A.V[b]] : [A.V[b], A.V[a]];
        let left = false;
        for (let s = 1; s <= 2 * samples; s++) {
          const x = lerp(p, q, s / (2 * samples + 1)), dd = depthIn(x, B);
          if (dd === 0) left = true; else if (left) depth = Math.max(depth, dd);
        }
      } else for (let s = 1; s <= samples; s++) depth = Math.max(depth, depthIn(lerp(A.V[a], A.V[b], s / (samples + 1)), B));
    }
    if (depth > 0) out.push({ a: A.name, b: B.name, depth });
  }
  return out.sort((x, y) => y.depth - x.depth);
}
