#!/usr/bin/env node
// tools/hand_sheets.mjs - the technical sheets of the procedural hand (hands/): orthographic, flat-shaded drawings of
// the hand system for review, in the style of the maintainer's reference sheet (white, flat grey, angular).
//
//   node tools/hand_sheets.mjs <out dir> [--only name,...]
//
// Writes one SVG file a sheet into <out dir>; a folder inside the repository is refused. Every mesh is drawn by a small
// software z-buffer (orthographic, flat shaded, 3x supersampled; outline, crease and optional wireframe lines are found
// in image space, so a hidden edge is never drawn), rasterised to RGBA, written as a PNG with node:zlib and embedded in
// the SVG as a data URI; the labels, tables and diagrams are SVG on top. A back face that shows (an open end, a hole,
// an inverted triangle) is painted RED and counted: every sheet prints its count in its footer and on the console.
//
// Sheets (the names --only takes):
//   poses       the 24 poses in three views (palm, thumb side, three-quarter), one sheet a built level (and variant)
//   exploded    the pieces of level 0 apart, numbered like the reference sheet; the joints and their names
//   bones       the bone hierarchy (names, joints, axes, limits) and the skeleton drawn on the hand; the left hand
//   limits      the joint-limit table and the extreme poses (fingers, spread, thumb, wrist)
//   wireframes  every level's mesh with its triangle, vertex and bone counts
//   wrist       the universal wrist interface: ring, pivot, axes, connector, forearm end, wrist -70 / 0 / +70
//   objects     holding objects: a cylinder at three radii, sphere, card, pen, phone, bag handle; tilt and shape
//   lod         the levels side by side for 6 poses, with their counts and level 0's box and centroid
//   ages        six bodies from the generator (newborn to 80 years): real size and normalised
// Every level is built on the body it is drawn for (the hand library solves each body exactly).
//
// Everything is the canonical RIGHT hand unless a panel says otherwise, the reference adult hand (rig.REFERENCE_BODY:
// 184 mm, wrist ring w 21, f 30, b 30 mm) except on the ages sheet, whose bodies come from generate(). Objects whose
// size is not in the data are drawn at a stated size (a card: ISO/IEC 7810 ID-1, 85.6 x 54 x 0.76 mm; the rest are
// this tool's or the rig's proposals) and are only drawn: the card and the pen are not part of the solve.

import { mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import * as zlib from 'node:zlib';
import { resolve, dirname, relative, isAbsolute, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from '../hands/index.js';
import * as rig from '../hands/rig.js';
import * as mesh0 from '../hands/mesh0.js';
import { getPose } from '../hands/poses.js';
import * as G from '../generator.js';
import * as growth from '../growth.js';

const DEG = Math.PI / 180;
const SHEETS = ['poses', 'exploded', 'bones', 'limits', 'wireframes', 'wrist', 'objects', 'lod', 'ages'];
const REF = rig.REFERENCE_BODY;
const mm = (x, k = 1) => (x * 1000).toFixed(k);

// ------------------------------------------------------------------------------------------------------- vectors
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => scl(a, 1 / len(a));
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const Q = rig.quat;
const qWrist = (flex, dev) => Q.mul(Q.axis([1, 0, 0], flex * DEG), Q.axis([0, 0, 1], dev * DEG));
const pts = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 3) o.push([flat[i], flat[i + 1], flat[i + 2]]); return o; };
const mapFlat = (flat, f) => { const o = new Array(flat.length); for (let i = 0; i < flat.length; i += 3) { const p = f([flat[i], flat[i + 1], flat[i + 2]]); o[i] = p[0]; o[i + 1] = p[1]; o[i + 2] = p[2]; } return o; };

// -------------------------------------------------------------------------------------------------------- views
// A view is a rotation whose rows are the camera's right, up and toward vectors in hand space (orthographic).
const mat3mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
function viewYPR(yaw = 0, pitch = 0, roll = 0) {   // yaw about +Y, then pitch about +X, then roll about the view axis
  const c = (d) => Math.cos(d * DEG), s = (d) => Math.sin(d * DEG);
  const Ry = [[c(yaw), 0, s(yaw)], [0, 1, 0], [-s(yaw), 0, c(yaw)]];
  const Rx = [[1, 0, 0], [0, c(pitch), -s(pitch)], [0, s(pitch), c(pitch)]];
  const Rz = [[c(roll), -s(roll), 0], [s(roll), c(roll), 0], [0, 0, 1]];
  return mat3mul(Rz, mat3mul(Rx, Ry));
}
function viewBasis(right, up) {   // the camera's right and (approximate) up, in hand space
  const r = nrm(right), u = nrm(sub(up, scl(r, dot(up, r))));
  return [r, u, cross(r, u)];
}
function viewLook(toward, upHint) {   // the camera on the `toward` side, looking back at the origin
  const t = nrm(toward), r = nrm(cross(upHint, t));
  return [r, cross(t, r), t];
}
// The views of the sheets. Palm: the camera on +Z (the right hand's thumb on the right). Thumb side: the camera on +X.
const VIEW = {
  palm: viewYPR(0, 0, 0), back: viewYPR(180, 0, 0), thumb: viewYPR(-90, 0, 0), ulnar: viewYPR(90, 0, 0),
  q34: viewYPR(-38, 16, 0),
};
const VIEW_NAME = { palm: 'palm', back: 'back', thumb: 'thumb side', ulnar: 'little-finger side', q34: 'three-quarter' };

// ----------------------------------------------------------------------------------------------- the z-buffer
const SS = 3;                                    // supersampling
const LIGHT = nrm([-0.42, 0.58, 0.70]);         // in view space: from the upper left, in front
const GREY = [206, 208, 212], CONN = [160, 166, 175], OBJ = [126, 166, 204], FORE = [194, 186, 174], RED = [226, 74, 62];
const EDGE = { outline: [50, 56, 64], crease: [118, 124, 132], wire: [64, 70, 80], ghost: [186, 190, 196] };
function shade(base, n) {
  const d = Math.max(0, dot(n, LIGHT));
  const k = 0.50 + 0.52 * d;
  return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
}

// Renders meshes into a w x h panel. mesh: { positions (flat), index, color | triColors, pieceOf (a piece a
// triangle: outlines are drawn between pieces), pieceCount, wire, ghost (0..1, toward white), backColor (instead of
// red, for a back face shown on purpose), noEdge }. wire: every visible triangle edge, on a lighter fill, lines one
// sample thicker. Returns { w, h, rgba, backPx, project(p) -> [x, y, depth] }.
function renderPanel({ w, h, scale, center = [0, 0, 0], view = VIEW.palm, meshes, wire = false, crease = 26, depthTol = 0.004, ss = SS, thick = wire }) {
  w = Math.round(w); h = Math.round(h);
  const W = w * ss, Hh = h * ss, N = W * Hh, k = scale * ss;
  const zb = new Float64Array(N).fill(-Infinity), id = new Int32Array(N).fill(-1), col = new Uint8ClampedArray(N * 3);
  const info = [];
  let pieceBase = 0;
  const raster = (x0, y0, z0, x1, y1, z1, x2, y2, z2, g, c) => {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(Hh - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) return;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) return;
    const inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
        const z = w0 * z0 + w1 * z1 + w2 * z2, i = y * W + x;
        if (z > zb[i]) { zb[i] = z; id[i] = g; col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
      }
    }
  };
  for (const m of meshes) {
    if (!m || !m.index || !m.index.length) continue;
    const pos = m.positions, ix = m.index, nv = pos.length / 3, V = new Float64Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const x = pos[3 * i] - center[0], y = pos[3 * i + 1] - center[1], z = pos[3 * i + 2] - center[2];
      for (let r = 0; r < 3; r++) V[3 * i + r] = view[r][0] * x + view[r][1] * y + view[r][2] * z;
    }
    for (let t = 0; t < ix.length / 3; t++) {
      const a = 3 * ix[3 * t], b = 3 * ix[3 * t + 1], c = 3 * ix[3 * t + 2];
      const e1 = [V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]], e2 = [V[c] - V[a], V[c + 1] - V[a + 1], V[c + 2] - V[a + 2]];
      const n3 = cross(e1, e2), L = len(n3);
      if (!(L > 1e-16)) continue;
      const n = scl(n3, 1 / L), front = n[2] > 0;
      let c3 = front ? shade(m.triColors ? m.triColors[t] : (m.color ?? GREY), n) : (m.backColor ?? RED);
      if (m.ghost) c3 = c3.map((v) => v + (255 - v) * m.ghost);
      else if (front && (m.wire ?? wire)) c3 = c3.map((v) => v + (255 - v) * 0.35);
      const g = info.length;
      info.push({ piece: pieceBase + (m.pieceOf ? m.pieceOf[t] : 0), n, wire: m.wire ?? wire, back: !front && !m.backColor, ghost: !!m.ghost, noEdge: !!m.noEdge });
      raster(W / 2 + V[a] * k, Hh / 2 - V[a + 1] * k, V[a + 2], W / 2 + V[b] * k, Hh / 2 - V[b + 1] * k, V[b + 2], W / 2 + V[c] * k, Hh / 2 - V[c + 1] * k, V[c + 2], g, c3);
    }
    pieceBase += m.pieceCount ?? 1;
  }
  // the lines, in image space: between pieces and against the background (outline), across a crease, along every
  // triangle edge (wireframe), or across a depth step inside one piece
  const out = new Uint8ClampedArray(N * 4);
  let back = 0;
  for (let i = 0; i < N; i++) if (id[i] >= 0) { out[4 * i] = col[3 * i]; out[4 * i + 1] = col[3 * i + 1]; out[4 * i + 2] = col[3 * i + 2]; out[4 * i + 3] = 255; if (info[id[i]].back) back++; }
  const cosC = Math.cos(crease * DEG);
  // edge kinds by priority: 1 ghost, 2 crease, 3 wire, 4 outline
  const KIND = [null, EDGE.ghost, EDGE.crease, EDGE.wire, EDGE.outline];
  const edgeOf = (a, b, i, j) => {
    if (a === b) return 0;
    if (a < 0 || b < 0) { const A = info[a < 0 ? b : a]; return A.noEdge ? 0 : A.ghost ? 1 : 4; }
    const A = info[a], B = info[b];
    if (A.noEdge && B.noEdge) return 0;
    const gh = A.ghost && B.ghost;
    if (A.piece !== B.piece) return gh ? 1 : 4;
    if (A.wire || B.wire) return gh ? 1 : 3;
    if (dot(A.n, B.n) < cosC) return gh ? 1 : 2;
    if (Math.abs(zb[i] - zb[j]) > depthTol) return gh ? 1 : 4;
    return 0;
  };
  let E = new Uint8Array(N);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < Hh ? i + W : -1]) {
      if (j < 0) continue;
      const e = edgeOf(id[i], id[j], i, j);
      if (e) { if (e > E[i]) E[i] = e; if (e > E[j]) E[j] = e; }
    }
  }
  if (thick) {   // one sample wider (left and up) for the wireframe and the outlines
    const F2 = E.slice();
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, e = E[i];
      if (e < 3) continue;
      if (x > 0 && F2[i - 1] < e) F2[i - 1] = e;
      if (y > 0 && F2[i - W] < e) F2[i - W] = e;
    }
    E = F2;
  }
  for (let i = 0; i < N; i++) if (E[i]) { const c = KIND[E[i]]; out[4 * i] = c[0]; out[4 * i + 1] = c[1]; out[4 * i + 2] = c[2]; out[4 * i + 3] = 255; }
  // down-sample (premultiplied)
  const rgba = new Uint8ClampedArray(w * h * 4), n2 = ss * ss;
  for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const i = 4 * ((oy * ss + sy) * W + ox * ss + sx), al = out[i + 3] / 255;
      r += out[i] * al; g += out[i + 1] * al; b += out[i + 2] * al; a += al;
    }
    const o = 4 * (oy * w + ox);
    if (a > 0) { rgba[o] = r / a; rgba[o + 1] = g / a; rgba[o + 2] = b / a; rgba[o + 3] = 255 * a / n2; }
  }
  const project = (p) => { const q = sub(p, center); return [w / 2 + dot(view[0], q) * scale, h / 2 - dot(view[1], q) * scale, dot(view[2], q)]; };
  return { w, h, rgba, backPx: back / n2, project };
}

// --------------------------------------------------------------------------------------------------------- PNG
let CRC_TABLE = null;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  CRC_TABLE ??= new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  let c = -1; for (const x of buf) c = CRC_TABLE[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0;
}
function pngRGBA(w, h, rgba) {
  const raw = Buffer.alloc((4 * w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (4 * w + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + 4 * w * y, 4 * w).copy(raw, y * (4 * w + 1) + 1); }
  const chunk = (type, data) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 7 })), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------------------------------------- the SVG sheet
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const INK = '#1d2329', MUTED = '#59626c', LINE = '#a3aab2', BADGE = '#666d75';
const AX = { x: '#d9480f', y: '#2b8a3e', z: '#1c7ed6' };   // the axis colours (X orange-red, Y green, Z blue)

class Sheet {
  constructor(name, w, h) { this.name = name; this.w = Math.round(w); this.h = Math.round(h); this.px = new Uint8ClampedArray(this.w * this.h * 4); this.under = []; this.over = []; this.backPx = 0; this.notes = []; }
  // composite a rendered panel at (x, y); returns the projection into sheet coordinates
  put(panel, x, y) {
    x = Math.round(x); y = Math.round(y);
    for (let py = 0; py < panel.h; py++) {
      const sy = y + py; if (sy < 0 || sy >= this.h) continue;
      for (let px = 0; px < panel.w; px++) {
        const sx = x + px; if (sx < 0 || sx >= this.w) continue;
        const i = 4 * (py * panel.w + px), o = 4 * (sy * this.w + sx), a = panel.rgba[i + 3] / 255;
        if (a <= 0) continue;
        const b = this.px[o + 3] / 255, ao = a + b * (1 - a);
        for (let c = 0; c < 3; c++) this.px[o + c] = (panel.rgba[i + c] * a + this.px[o + c] * b * (1 - a)) / ao;
        this.px[o + 3] = 255 * ao;
      }
    }
    this.backPx += panel.backPx;
    return (p) => { const q = panel.project(p); return [x + q[0], y + q[1]]; };
  }
  text(x, y, s, o = {}) {
    (o.under ? this.under : this.over).push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.italic ? ' font-style="italic"' : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(s)}</text>`);
  }
  rect(x, y, w, h, o = {}) {
    (o.under === false ? this.over : this.under).push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${o.rx ?? 0}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`);
  }
  line(x1, y1, x2, y2, o = {}) {
    (o.under ? this.under : this.over).push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${o.stroke ?? INK}" stroke-width="${o.sw ?? 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''}${o.arrow ? ` marker-end="url(#arrow-${o.arrow})"` : ''}/>`);
  }
  circle(cx, cy, r, o = {}) {
    (o.under ? this.under : this.over).push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ''}/>`);
  }
  poly(p, o = {}) {
    (o.under ? this.under : this.over).push(`<polygon points="${p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linejoin="round"/>`);
  }
  raw(s, under = false) { (under ? this.under : this.over).push(s); }
  svg() {
    const png = pngRGBA(this.w, this.h, this.px).toString('base64');
    const arrows = Object.entries({ x: AX.x, y: AX.y, z: AX.z, ink: INK, muted: MUTED }).map(([k, c]) =>
      `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" font-family="${FONT}">`
      + `<defs>${arrows}</defs><rect width="100%" height="100%" fill="#ffffff"/>${this.under.join('')}`
      + `<image x="0" y="0" width="${this.w}" height="${this.h}" href="data:image/png;base64,${png}"/>${this.over.join('')}</svg>\n`;
  }
}

// the sheet's title bar, a panel frame, a badge, wrapped text, the footer
// The title on the left; the two subtitles on the right, sized and wrapped to the room left (widths estimated from
// Helvetica's caps: about 0.6 em a character).
function header(S, title, sub1, sub2) {
  S.rect(14, 12, S.w - 28, 74, { rx: 8, stroke: LINE, sw: 1.4, fill: '#fff' });
  let ts = 34; while (title.length * ts * 0.6 > S.w * 0.55 && ts > 24) ts -= 1;
  S.text(34, 49 + ts * 0.4, title, { size: ts, weight: 800, spacing: 0.3 });
  const xr = Math.max(34 + title.length * ts * 0.6 + 70, S.w - 820), room = S.w - 36 - xr;
  let s1 = 15; while (sub1.length * s1 * 0.6 > room && s1 > 11) s1 -= 0.5;
  const l1 = wrap(sub1, Math.floor(room / (s1 * 0.6))), l2 = wrap(sub2, Math.floor(room / (11.5 * 0.6)));
  S.line(xr - 24, 26, xr - 24, 72, { stroke: LINE, sw: 1.4 });
  const lines = [...l1.map((s) => [s, s1, '#2f363d']), ...l2.map((s) => [s, 11.5, MUTED])].slice(0, 4);
  const lh = lines.length <= 2 ? 23 : lines.length === 3 ? 17 : 14.5;
  let y = 49 - (lines.length - 1) * lh / 2 + 5;
  for (const [s, size, fill] of lines) { S.text(xr, y, s, { size, fill, spacing: 0.3 }); y += lh; }
}
function panel(S, x, y, w, h, title, note) {
  S.rect(x, y, w, h, { rx: 9, stroke: LINE, sw: 1.3, fill: '#fff' });
  if (title) S.text(x + 18, y + 31, title, { size: 19, weight: 800, spacing: 0.3 });
  if (note) wrapText(S, x + 18, y + 53, note, Math.floor((w - 36) / 6.9), { size: 13, fill: '#3b434b' });
}
function badge(S, cx, y, s, o = {}) {
  const w = s.length * (o.size ?? 14) * 0.62 + 18, h = (o.size ?? 14) + 9;
  S.rect(cx - w / 2, y, w, h, { rx: 3, fill: o.fill ?? BADGE, under: false });
  S.text(cx, y + h - 6.5, s, { size: o.size ?? 14, weight: 700, fill: '#fff', anchor: 'middle' });
}
function numberDot(S, x, y, n, r = 13) {
  S.circle(x, y, r, { fill: '#3a4048', stroke: '#fff', sw: 1.5 });
  S.text(x, y + 5, String(n), { size: r * 1.15, weight: 700, fill: '#fff', anchor: 'middle' });
}
function wrap(s, max) {
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  return lines;
}
function wrapText(S, x, y, s, max, o = {}) {
  const lh = o.lh ?? (o.size ?? 12) * 1.32; let n = 0;
  for (const line of wrap(s, max)) { S.text(x, y + n * lh, line, o); n++; }
  return y + n * lh;
}
function footer(S, extra = '') {
  const back = Math.round(S.backPx);
  S.text(24, S.h - 16, `Visible back faces (drawn red): ${back} px. Canonical right hand unless stated; orthographic; one material, flat shading. ${extra}`.trim(), { size: 12, fill: back ? '#c92a2a' : MUTED });
  S.text(S.w - 24, S.h - 16, 'tools/hand_sheets.mjs', { size: 12, fill: MUTED, anchor: 'end' });
}
function viewLabel(S, x, y, s) { S.text(x, y, s, { size: 11, fill: MUTED, anchor: 'middle', spacing: 0.3 }); }

// ------------------------------------------------------------------------------------------------- the meshes
// a closed convex solid's triangles turned to face away from a centre
function orientOutward(P, index, c) {
  const ix = index.slice();
  for (let t = 0; t < ix.length; t += 3) {
    const a = P[ix[t]], b = P[ix[t + 1]], d = P[ix[t + 2]];
    const n = cross(sub(b, a), sub(d, a)), m = scl(add(add(a, b), d), 1 / 3);
    if (dot(n, sub(m, c)) < 0) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
  }
  return ix;
}
const flat = (P) => P.flat();
function convexMesh(P, tris, color = OBJ, o = {}) {
  const c = scl(P.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / P.length);
  return { positions: flat(P), index: orientOutward(P, tris.flat(), c), color, pieceCount: 1, ...o };
}
const perpOf = (a) => nrm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
function prism(p0, p1, R, n = 12, color = OBJ, o = {}) {   // a closed n-sided prism from p0 to p1
  const a = nrm(sub(p1, p0)), u = perpOf(a), v = cross(a, u), P = [], T = [];
  for (const base of [p0, p1]) for (let k = 0; k < n; k++) { const t = 2 * Math.PI * (k + 0.5) / n; P.push(add(base, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t))))); }
  for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; T.push([k, k1, n + k1], [k, n + k1, n + k]); }
  for (let k = 1; k + 1 < n; k++) { T.push([0, k, k + 1], [n, n + k, n + k + 1]); }
  return convexMesh(P, T, color, o);
}
function cone(p0, p1, R, n = 12, color = OBJ) {
  const a = nrm(sub(p1, p0)), u = perpOf(a), v = cross(a, u), P = [], T = [];
  for (let k = 0; k < n; k++) { const t = 2 * Math.PI * (k + 0.5) / n; P.push(add(p0, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t))))); }
  P.push(p1);
  for (let k = 0; k < n; k++) T.push([k, (k + 1) % n, n]);
  for (let k = 1; k + 1 < n; k++) T.push([0, k, k + 1]);
  return convexMesh(P, T, color);
}
function box(c, e, h, color = OBJ, o = {}) {   // centre, three unit axes, three half-sizes
  const P = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) P.push(add(c, add(scl(e[0], sx * h[0]), add(scl(e[1], sy * h[1]), scl(e[2], sz * h[2])))));
  const T = [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]];
  return convexMesh(P, T, color, o);
}
function icosphere(c, R, sub2 = 1, color = OBJ) {
  const t = (1 + Math.sqrt(5)) / 2;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
  let T = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub2; s++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? `${a}_${b}` : `${b}_${a}`; if (!mid.has(k)) { P.push(nrm(scl(add(P[a], P[b]), 0.5))); mid.set(k, P.length - 1); } return mid.get(k); };
    T = T.flatMap(([a, b, d]) => { const ab = m(a, b), bd = m(b, d), da = m(d, a); return [[a, ab, da], [b, bd, ab], [d, da, bd], [ab, bd, da]]; });
  }
  return convexMesh(P.map((p) => add(c, scl(p, R))), T, color);
}
// The forearm's end: a six-sided tube of the wrist ring, `length` long below the pivot, open at the wrist (its inside,
// seen through an open end, is a back face: red unless backColor says otherwise), closed at the far end.
function forearm(ring, length = 0.08, o = {}) {
  const top = H.wristRing(ring), P = [...top, ...top.map((p) => [p[0], -length, p[2]])], T = [];
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; T.push([k, k1, 6 + k1], [k, 6 + k1, 6 + k]); }
  for (let k = 1; k + 1 < 6; k++) T.push([6, 6 + k, 6 + k + 1]);
  if (o.closed) for (let k = 1; k + 1 < 6; k++) T.push([0, k, k + 1]);
  const m = convexMesh(P, T, o.color ?? FORE);
  if (o.backColor) m.backColor = o.backColor;
  if (o.map) m.positions = mapFlat(m.positions, o.map);
  return m;
}
// A built hand as a mesh: posed positions, one piece a bone (outlines between pieces), the connector darker.
function handMesh(h, o = {}) {
  const pos = o.bind ? h.positions.slice() : H.posed(h), T = h.triangles;
  const pieceOf = new Int32Array(T), triColors = new Array(T).fill(o.color ?? GREY);
  (h.pieces ?? []).forEach((pc, k) => { for (let t = pc.firstTriangle; t < pc.firstTriangle + pc.triangles; t++) { pieceOf[t] = k; if (/^Connector/i.test(pc.name)) triColors[t] = o.connColor ?? CONN; } });
  return { positions: o.map ? mapFlat(pos, o.map) : pos, index: h.index, pieceOf, pieceCount: Math.max(1, h.pieces?.length ?? 1), triColors, ghost: o.ghost, wire: o.wire };
}

// ---------------------------------------------------------------------------------------------- hands, cached
const BUILT = new Map();
function hand(args) {
  const key = JSON.stringify(args);
  if (!BUILT.has(key)) {
    let h;
    try { h = H.buildHand(args); } catch (e) { h = { ok: false, errors: [{ code: 'THROWN', path: '', message: String(e?.message ?? e).split('\n')[0] }] }; }
    BUILT.set(key, h);
  }
  return BUILT.get(key);
}
const errText = (h) => (h.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ');
const RIGS = new Map();
// The solved skeleton in hand space (tips, pads, bone frames), for drawing what the solve does not hold (a card, a pen).
function skeletonOf(body, pose, controls = {}, grip = {}) {
  const d = rig.handDimensions(body, controls);
  let C = RIGS.get(d.key);
  if (!C) { const bones = rig.skeleton(d), P = mesh0.pieces(d, bones); C = { d, bones, P, ctx: rig.makeRig(d, bones, P.bones) }; RIGS.set(d.key, C); }
  const s = rig.solveHand(C.ctx, typeof pose === 'string' ? getPose(pose) : pose, controls, grip);
  return { ...rig.worldSkeleton(C.ctx, s.rest, s.contact), d, P: C.P };
}

// The levels that exist (level 1 once a variant), and the ones that do not, for every sheet.
function levelEntries() {
  const out = [{ level: 0, mode: 'preset', variant: null, built: true, label: 'LEVEL 0', modeLabel: 'A articulated / B preset', bones: '16 (A) / 1 (B)', tris: mesh0.TRIANGLES, verts: mesh0.VERTICES }];
  for (const L of H.HAND_LEVELS.filter((l) => l.level >= 1 && l.level <= 3)) {
    const modeLabel = L.level === 1 ? 'B preset' : 'C simplified';
    if (!L.built) { out.push({ level: L.level, built: false, error: L.error, label: `LEVEL ${L.level}`, modeLabel }); continue; }
    const vs = L.variants && Object.keys(L.variants).length ? Object.keys(L.variants) : [null];
    for (const v of vs) out.push({ level: L.level, mode: L.modes[0], variant: v, built: true, label: `LEVEL ${L.level}${v ? ` ${v.toUpperCase()}` : ''}`, modeLabel, bones: '1',
      tris: v ? L.variants[v].triangles : L.triangles, verts: v ? L.variants[v].vertices : L.vertices });
  }
  return out;
}
const handArgs = (e, pose, extra = {}) => ({ pose, mode: e.mode, level: e.level, ...(e.variant ? { variant: e.variant } : {}), ...extra });

// ---------------------------------------------------------------------------------------- the objects held
const CARD = { l: 0.0856, w: 0.054, t: 0.00076 };   // ISO/IEC 7810 ID-1 (measured standard)
const PEN = { length: 0.14, tip: 0.016 };          // proposal: a 140 mm pen; its radius is the pose's (5 mm, scaled)
// The object of a built hand (canonical right), drawn: the solver's contact object (cylinder, sphere, box, plane), the
// bag handle of the hook grip, the card of HP21 and the pen of HP12 (not solved: placed from the solved fingertips).
// view: the plane (a table under the palm) is left out when it would hide the hand (camera on its side).
function objectMeshes(h, view, body = REF, o = {}) {
  if (!h?.ok || h.side !== 'right') return [];
  const s = h.dims.length / rig.REF_LENGTH, c = h.contact, out = [], col = o.color ?? OBJ;
  if (c?.object) {
    const ob = c.object;
    if (ob.type === 'cylinder') {
      const hl = (h.pose === 'HP15' ? 0.06 : 0.065) * s;
      out.push(prism(sub(ob.p, scl(ob.a, hl)), add(ob.p, scl(ob.a, hl)), ob.R, 12, col));
      if (h.pose === 'HP15') {   // a bag handle: the bar and two struts down to the bag (along the fingers: the arm hangs)
        for (const sg of [-1, 1]) {
          const e = add(ob.p, scl(ob.a, sg * hl * 0.97)), f = add(add(ob.p, scl(ob.a, sg * hl * 1.25)), [0, 0.032 * s, 0]);
          out.push(prism(e, f, 0.6 * ob.R, 8, col));
        }
      }
    } else if (ob.type === 'sphere') out.push(icosphere(ob.c, ob.R, 1, col));
    else if (ob.type === 'box') out.push(box(ob.c, ob.e, ob.h, col));
    else if (ob.type === 'plane') {   // a table under the palm; left out (its outline kept) where it would hide the hand
      const n = ob.n, u = nrm(sub([1, 0, 0], scl(n, n[0]))), v = cross(n, u), th = 0.006 * s, hu = 0.075 * s, hv = 0.125 * s;
      const c0 = [0.006 * s, 0.1 * s, 0], cs = sub(c0, scl(n, dot(n, sub(c0, ob.p)))), cc = add(cs, scl(n, th / 2));
      if (!view || dot(view[2], n) < 0.3) out.push(box(cc, [u, v, n], [hu, hv, th / 2], col));
      else out.outline = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(cs, add(scl(u, a * hu), scl(v, b * hv))));
    }
  } else if (h.pose === 'HP21' || h.pose === 'HP12') {
    const sk = skeletonOf(body, h.pose, o.controls ?? {}, o.grip ?? {});
    if (h.pose === 'HP21') {   // the card: between the thumb pad and the index's distal phalanx, sticking out of the hand
      const pt = sk.pads.thumb, pi = sk.pads.index, m = lerp3(pt, pi, 0.5), n = nrm(sub(pi, pt));
      let u = sub(m, [0, 0.5 * sk.bones[7].head[1], 0]); u = nrm(sub(u, scl(n, dot(u, n))));
      const v = cross(n, u);
      out.push(box(add(m, scl(u, CARD.l / 2 - 0.014 * s)), [u, v, n], [CARD.l / 2, CARD.w / 2, CARD.t / 2], col));
    } else {                   // the pen: through the three tips, its shaft leaving the hand over the web
      const a = sk.tips.thumb, b = sk.tips.index, d = sk.tips.middle, cen = scl(add(add(a, b), d), 1 / 3);
      const R = (getPose('HP12').contact.radius_m ?? 0.005) * s;
      const ax = penAxis(h, cen, R, s);   // toward the point
      out.push(prism(sub(cen, scl(ax, PEN.length - 0.03)), add(cen, scl(ax, 0.03 - PEN.tip)), R, 6, col));
      out.push(cone(add(cen, scl(ax, 0.03 - PEN.tip)), add(cen, scl(ax, 0.03)), R, 6, col));
    }
  }
  if (o.map) { for (const m of out) m.positions = mapFlat(m.positions, o.map); if (out.outline) out.outline = out.outline.map(o.map); }
  return out;
}
// The pen's axis (toward the point): of the directions whose shaft (its line and four lines 0.8 R off it) crosses
// no triangle of the posed hand, the one nearest the writing direction: the point distal, out of the palm and a
// little ulnar, so the shaft runs back over the web between the thumb and the index. Measured, not assumed.
const PEN_PREF = nrm([-0.2, 0.55, 0.8]);
function segHits(p0, p1, P, idx) {
  const d = sub(p1, p0);
  let n = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const A = P[idx[t]], e1 = sub(P[idx[t + 1]], A), e2 = sub(P[idx[t + 2]], A), q = cross(d, e2), det = dot(e1, q);
    if (Math.abs(det) < 1e-14) continue;
    const f = 1 / det, sv = sub(p0, A), u = f * dot(sv, q);
    if (u < 0 || u > 1) continue;
    const r = cross(sv, e1), v = f * dot(d, r);
    if (v < 0 || u + v > 1) continue;
    const k = f * dot(e2, r);
    if (k >= 0 && k <= 1) n++;
  }
  return n;
}
function penAxis(h, cen, R, s) {
  const P = pts(H.posed(h)), idx = h.index;
  const hits = (ax) => {
    const u = perpOf(ax), v = cross(ax, u);
    let n = 0;
    for (const o of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the shaft behind the tips, 0.8 R round its line
      const off = add(scl(u, o[0] * 0.8 * R), scl(v, o[1] * 0.8 * R));
      n += segHits(add(cen, add(off, scl(ax, -0.02 * s))), add(cen, add(off, scl(ax, -(PEN.length - 0.03)))), P, idx);
    }
    // the point: its line only (the fingertips touch the pen's sides there, as they should)
    return n + segHits(add(cen, scl(ax, 0.012 * s)), add(cen, scl(ax, 0.03)), P, idx);
  };
  let best = null;
  const N = 900;
  for (let i = 0; i < N; i++) {   // a Fibonacci sphere of directions
    const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    const ax = [r * Math.cos(th), y, r * Math.sin(th)], score = dot(ax, PEN_PREF);
    if (score < 0.2) continue;
    const n = hits(ax);
    if (!best || n < best.n || (n === best.n && score > best.score)) best = { ax, n, score };
  }
  return best.ax;
}
function objectText(h) {
  const c = h?.contact;
  if (!h?.ok) return '';
  if (h.pose === 'HP21' && !c?.object) return `card ${mm(CARD.l)} x ${mm(CARD.w)} mm (drawn)`;
  if (h.pose === 'HP12' && !c?.object) return `pen r ${mm((getPose('HP12').contact.radius_m ?? 0.005) * h.dims.length / rig.REF_LENGTH)} mm (drawn)`;
  if (!c?.object) return 'no object';
  const ob = c.object;
  if (ob.type === 'box') return ob.plate ? `phone ${mm(2 * ob.h[0], 0)} x ${mm(2 * ob.h[1], 0)} x ${mm(2 * ob.h[2], 0)} mm` : `square bar ${mm(2 * ob.h[1], 0)} mm`;
  if (ob.type === 'plane') return 'plane (a table)';
  if (h.pose === 'HP15') return `bag handle r ${mm(ob.R)} mm`;
  return `${c.type === 'cradle' ? 'cradled ' : ''}${ob.type} r ${mm(ob.R)} mm`;
}

// geometry measures
function bboxOf(P) { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const p of P) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } return { lo, hi }; }
function volumeCentroid(positions, index) {
  const P = pts(positions); let V = 0, c = [0, 0, 0];
  for (let t = 0; t < index.length; t += 3) {
    const a = P[index[t]], b = P[index[t + 1]], d = P[index[t + 2]], v = dot(a, cross(b, d)) / 6;
    V += v; c = add(c, scl(add(add(a, b), d), v / 4));
  }
  return Math.abs(V) > 1e-15 ? scl(c, 1 / V) : scl(P.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / P.length);
}
function drawBox3(S, proj, bb, o = {}) {   // the 12 edges of an axis-aligned box, projected
  const c = (i) => [i & 1 ? bb.hi[0] : bb.lo[0], i & 2 ? bb.hi[1] : bb.lo[1], i & 4 ? bb.hi[2] : bb.lo[2]];
  for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
    const p = proj(c(a)), q = proj(c(b)); S.line(p[0], p[1], q[0], q[1], { stroke: o.stroke ?? '#4c6ef5', sw: o.sw ?? 1, dash: o.dash ?? '4 3' });
  }
}
function cross2(S, p, r, stroke, sw = 1.6) { S.line(p[0] - r, p[1], p[0] + r, p[1], { stroke, sw }); S.line(p[0], p[1] - r, p[0], p[1] + r, { stroke, sw }); }
function axesAt(S, proj, origin, axes, length, o = {}) {   // a triad: X orange-red, Y green, Z blue
  const p0 = proj(origin);
  for (const k of ['x', 'y', 'z']) {
    const p1 = proj(add(origin, scl(axes[k], length)));
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1.5) { S.circle(p0[0], p0[1], 2.2, { fill: AX[k] }); continue; }
    S.line(p0[0], p0[1], p1[0], p1[1], { stroke: AX[k], sw: o.sw ?? 1.8, arrow: o.arrow === false ? null : k });
    if (o.labels) S.text(p1[0] + (p1[0] >= p0[0] ? 5 : -5), p1[1] + (p1[1] > p0[1] ? 13 : -4), o.labels[k] ?? k.toUpperCase(), { size: o.labelSize ?? 13, weight: 700, fill: AX[k], anchor: p1[0] >= p0[0] ? 'start' : 'end' });
  }
}
// the six ring points of a built hand found among its vertices: the largest distance to the nearest vertex
function ringError(h, ring) {
  const P = pts(h.positions), want = H.wristRing(ring, h.side);
  let worst = 0; for (const w of want) { let best = Infinity; for (const p of P) best = Math.min(best, len(sub(p, w))); worst = Math.max(worst, best); }
  return worst;
}
const shortDiag = (h) => {
  const g = (h.diagnostics ?? []).find((s) => s.startsWith('grip solved on')), t = (h.diagnostics ?? []).find((s) => s.startsWith('thumb solved for'));
  const curl = g ? (g.match(/curl (.*?)(;|$)/)?.[1] ?? '').replace(/ x/g, ' x') : '';
  const err = t ? t.match(/contact error ([\d.]+) mm/)?.[1] : null;
  return { curl, thumb: err ? `thumb contact error ${err} mm` : '' };
};

// ============================================================================================================ SHEETS

// ------------------------------------------------------------------------------------------- the 24 poses
function sheetPoses(e) {
  const cols = 4, rows = 6, vw = 152, vh = 186, gapv = 4, cellW = 3 * vw + 2 * gapv + 22, cellH = vh + 66, M = 22, top = 104;
  const S = new Sheet(`poses_L${e.level}${e.variant ? '_' + e.variant : ''}`, 2 * M + cols * cellW + 8, top + rows * cellH + 92);
  const tris = hand(handArgs(e, 'HP01')).triangles;
  header(S, `24 POSES - ${e.label}${e.level === 0 ? ' (MODE A POSED = MODE B BAKED)' : ''}`,
    `PALM, THUMB SIDE AND THREE-QUARTER VIEWS, SAME SCALE IN EVERY VIEW`,
    `${e.modeLabel.toUpperCase()} - ${tris} TRIANGLES A HAND - BONES ${e.bones} - THE WRIST PIVOT AT THE SAME PLACE IN EVERY VIEW`);
  const scale = vh / 0.226, center = [0.012, 0.079, 0.012];
  const notBuilt = levelEntries().filter((x) => !x.built).map((x) => `level ${x.level}: ${x.error}`);
  H.POSES.forEach((id, i) => {
    const x0 = M + (i % cols) * cellW + 4, y0 = top + Math.floor(i / cols) * cellH;
    S.rect(x0, y0, cellW - 8, cellH - 8, { rx: 7, stroke: '#c9ced4', sw: 1, fill: '#fff' });
    const h = hand(handArgs(e, id));
    if (!h.ok) { wrapText(S, x0 + 14, y0 + 40, errText(h), 60, { size: 12, fill: '#c92a2a' }); return; }
    ['palm', 'thumb', 'q34'].forEach((v, k) => {
      const obj = objectMeshes(h, VIEW[v]), px = x0 + 11 + k * (vw + gapv), py = y0 + 4;
      const p = renderPanel({ w: vw, h: vh, scale, center, view: VIEW[v], meshes: [handMesh(h), ...obj] });
      const pj = S.put(p, px, py);
      if (obj.outline) S.poly(obj.outline.map((q) => { const r = pj(q); return [Math.min(px + vw - 2, Math.max(px + 2, r[0])), Math.min(py + vh - 2, Math.max(py + 2, r[1]))]; }), { stroke: '#4a7fb0', sw: 1.2, dash: '5 3' });
      viewLabel(S, px + vw / 2, y0 + vh + 12, VIEW_NAME[v] + (obj.outline ? ' (table: outline)' : ''));
    });
    const pose = getPose(id), cx = x0 + (cellW - 8) / 2;
    badge(S, cx - 150, y0 + vh + 22, id, { size: 13 });
    S.text(cx - 112, y0 + vh + 37, pose.name.replace(/_/g, ' ').toUpperCase(), { size: 15, weight: 800 });
    const note = id === 'HP05' ? 'HP14\'s shape, turned up by the arm' : id === 'HP14' ? 'HP05\'s shape, turned down by the arm' : '';
    const nc = h.corrections.length;
    S.text(cx - 112, y0 + vh + 53, `${objectText(h)}${note ? ' - ' + note : ''} - ${nc} correction${nc === 1 ? '' : 's'}`, { size: 11.5, fill: MUTED });
  });
  footer(S, notBuilt.length ? `Not drawn: ${notBuilt.join('; ')}.` : '');
  return S;
}

// --------------------------------------------------------------------------------------------- exploded view
function sheetExploded() {
  const S = new Sheet('exploded', 1960, 830);
  header(S, 'EXPLODED VIEW - LEVEL 0 PIECES', 'MODULAR DECOMPOSITION OF THE RIGHT HAND (BIND POSE: EVERY JOINT AT ZERO)',
    'EVERY PIECE A CLOSED CONVEX SOLID BOUND TO ONE BONE; THE SAME PIECES BUILD EVERY POSE, SIZE, AGE AND SIDE');
  const h = hand({ pose: 'HP02', mode: 'articulated', level: 0 });
  const bi = (name) => rig.BONE_NAMES.indexOf(name);
  // offsets: each digit segment slides along its bone, the connector down the wrist axis
  const gap = 0.013, off = new Map();
  for (const pc of h.pieces) {
    const b = bi(pc.name);
    if (pc.name === 'Connector') off.set(pc.name, [0, -0.03, 0]);
    else if (b <= 0) off.set(pc.name, [0, 0, 0]);
    else { const k = (b - 1) % 3 + 1, dir = Q.rot(h.bones[b].bind, [0, 1, 0]); off.set(pc.name, scl(dir, gap * k + (pc.name.startsWith('Thumb') ? 0.004 : 0))); }
  }
  const P = pts(h.positions), Pex = P.slice();
  for (const pc of h.pieces) for (let v = pc.firstVertex; v < pc.firstVertex + pc.vertices; v++) Pex[v] = add(P[v], off.get(pc.name));
  const m = handMesh(h, { bind: true }); m.positions = flat(Pex);
  panel(S, 14, 100, 1290, 690, 'EXPLODED VIEW', 'The right hand\'s level-0 pieces, seen from the palm side with the fingers to the right and the thumb below. Dashed lines join each joint on the parent piece to the same joint on the child; the pins mark the pivots.');
  const view = viewLook([-0.42, -0.30, 1], [-1, 0, 0]), scale = 3150, W = 1000, Hh = 590, center = [0.012, 0.115, 0];
  const pr = renderPanel({ w: W, h: Hh, scale, center, view, meshes: [m] });
  const proj = S.put(pr, 290, 180);
  for (let b = 1; b < 16; b++) {   // the joints: the parent's side and the child's side of each joint, joined
    const J = h.bones[b].head, pn = rig.BONE_NAMES[h.bones[b].parentIndex], cn = rig.BONE_NAMES[b];
    const a = proj(add(J, off.get(pn))), c = proj(add(J, off.get(cn)));
    S.line(a[0], a[1], c[0], c[1], { stroke: '#495057', sw: 1.2, dash: '4 3' });
    S.circle(a[0], a[1], 3, { fill: '#fff', stroke: '#495057', sw: 1.3 }); S.circle(c[0], c[1], 3, { fill: '#fff', stroke: '#495057', sw: 1.3 });
  }
  { const a = proj([0, 0, 0]), c = proj(off.get('Connector')); S.line(a[0], a[1], c[0], c[1], { stroke: '#495057', sw: 1.2, dash: '4 3' }); cross2(S, a, 6, '#495057', 1.3); }
  // the numbers, as in the reference: 1 palm, 2 thumb metacarpal, 3-5 the phalanges of the top finger, 6 the connector
  const cen = (name) => { const pc = h.pieces.find((p) => p.name === name); return scl(Pex.slice(pc.firstVertex, pc.firstVertex + pc.vertices).reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pc.vertices); };
  const items = [[1, 'Hand', 0], [2, 'Thumb_01', 0], [3, 'Pinky_01', -56], [4, 'Pinky_02', -56], [5, 'Pinky_03', -56], [6, 'Connector', 0]];
  for (const [n, name, dy] of items) {
    const c = proj(cen(name));
    if (dy) S.line(c[0], c[1], c[0], c[1] + dy + 15, { stroke: '#3a4048', sw: 1.2 });
    numberDot(S, c[0], c[1] + dy, n, 15);
  }
  const count = (name) => h.pieces.find((p) => p.name === name);
  const legend = [[1, 'Palm (base of the hand)', count('Hand')], [2, 'Thumb metacarpal', count('Thumb_01')], [3, 'Proximal phalanx (finger)', count('Index_01')],
    [4, 'Middle phalanx (finger)', count('Index_02')], [5, 'Distal phalanx (finger)', count('Index_03')], [6, 'Wrist connector', count('Connector')]];
  legend.forEach(([n, s, pc], i) => {
    const y = 210 + i * 60;
    numberDot(S, 52, y, n, 15);
    S.text(80, y + 6, s, { size: 17, weight: 600 });
    S.text(80, y + 25, `${pc.triangles} triangles, ${pc.vertices} vertices`, { size: 13, fill: MUTED });
  });
  const kinds = {}; for (const pc of h.pieces) kinds[pc.kind] = (kinds[pc.kind] ?? 0) + 1;
  wrapText(S, 34, 596, `${h.pieces.length} pieces: 1 palm, 1 connector, ${kinds.segment} segments (the proximal and middle phalanges of the 4 fingers, the thumb's metacarpal and proximal phalanx), ${kinds.distal} distal phalanges. ${h.triangles} triangles, ${h.vertices} vertices a hand.`, 36, { size: 13.5, fill: '#3b434b' });

  // joints and names: the index and the thumb, straight (bind), each seen across its flexion axis
  panel(S, 1318, 100, 628, 400, 'JOINTS AND NAMES');
  const bindF = { P: h.bones.map((b) => b.head), R: h.bones.map((b) => b.bind) };
  const only = (names) => { const mm2 = handMesh(h, { bind: true }); const ts = h.pieces.filter((p) => names.includes(p.name)).flatMap((p) => Array.from({ length: p.triangles }, (_, t) => p.firstTriangle + t)); return { ...mm2, index: ts.flatMap((t) => [h.index[3 * t], h.index[3 * t + 1], h.index[3 * t + 2]]), pieceOf: ts.map((t) => mm2.pieceOf[t]), triColors: null, color: GREY }; };
  const dR = rig.handDimensions(REF);
  const chain = (names, bones, view, x, y, w, hgt, labels) => {
    const tipLen = names[0].startsWith('Thumb') ? dR.thumb.len[2] : dR.fingers.index.len[2];
    const tip = add(bindF.P[bones[2]], Q.rot(bindF.R[bones[2]], [0, tipLen, 0]));
    const ctr = scl(add(bindF.P[bones[0]], tip), 0.5);
    const p = renderPanel({ w, h: hgt, scale: 4300, center: ctr, view, meshes: [only(names)] });
    const pj = S.put(p, x, y);
    bones.forEach((b, k) => {
      const q = pj(bindF.P[b]), below = k === 1;
      S.circle(q[0], q[1], 6.5, { fill: '#fff', stroke: INK, sw: 2 });
      S.text(q[0], below ? q[1] + 48 : q[1] - 60, labels[k][0], { size: 17, weight: 800, anchor: 'middle' });
      S.text(q[0], below ? q[1] + 64 : q[1] - 44, labels[k][1], { size: 11.5, fill: MUTED, anchor: 'middle' });
      S.line(q[0], below ? q[1] + 8 : q[1] - 8, q[0], below ? q[1] + 32 : q[1] - 40, { stroke: '#adb5bd', sw: 1 });
    });
  };
  const X1 = Q.rot(bindF.R[1], [0, 1, 0]), Z1 = Q.rot(bindF.R[1], [0, 0, 1]);
  chain(['Index_01', 'Index_02', 'Index_03'], [4, 5, 6], viewBasis([0, 1, 0], [0, 0, -1]), 1336, 140, 592, 150,
    [['MCP', 'metacarpophalangeal'], ['PIP', 'proximal interphalangeal'], ['DIP', 'distal interphalangeal']]);
  chain(['Thumb_01', 'Thumb_02', 'Thumb_03'], [1, 2, 3], viewBasis(X1, scl(Z1, -1)), 1336, 300, 592, 160,
    [['CMC', 'carpometacarpal'], ['MCP', 'metacarpophalangeal'], ['IP', 'interphalangeal']]);
  S.text(1336, 486, 'The index and the thumb, straight, each seen across its flexion axis (local +X), the pad down.', { size: 12, fill: MUTED });

  panel(S, 1318, 514, 628, 276, 'THUMB STRUCTURE');
  const T = rig.THUMB_MAP, Lt = rig.LIMITS.thumb;
  const lines = [
    ['CMC', `rotation and opposition at the base (Thumb_01): one quaternion from opposition ${Lt.opposition[0]}..${Lt.opposition[1]}, abduction ${Lt.abduction[0]}..${Lt.abduction[1]}, flexion ${Lt.cmc[0]}..${Lt.cmc[1]} and the solver's twist ${Lt.twist[0]}..${Lt.twist[1]}`],
    ['MCP', `main flexion (Thumb_02), ${Lt.mcp[0]}..${Lt.mcp[1]} about local +X`],
    ['IP', `distal flexion (Thumb_03, the tip), ${Lt.ip[0]}..${Lt.ip[1]} about local +X`],
    ['', `1 articulated metacarpal rising out of the thenar mass, 2 phalanges; bind: ${T.bindAngleDeg} deg radial of +Y, the pad turned ${T.padTwistDeg} deg toward the index`],
  ];
  let y = 566;
  for (const [k, s] of lines) {
    S.rect(1338, y - 9, 8, 8, { fill: '#495057', under: false });
    if (k) S.text(1356, y, k, { size: 15, weight: 800 });
    y = wrapText(S, k ? 1402 : 1356, y, s, k ? 72 : 78, { size: 13, fill: '#2f363d' }) + 9;
  }
  footer(S);
  return S;
}

// --------------------------------------------------------------------------------------------- bone hierarchy
function sheetBones() {
  const S = new Sheet('bones', 1960, 1210);
  header(S, 'BONE HIERARCHY - MODE A', '16 BONES A HAND: HAND + 5 CHAINS OF 3 (SUFFIX _L / _R)',
    'LOCAL +Y ALONG THE BONE, +Z THE PAD SIDE, +X = Y x Z: FLEXION ABOUT +X, SPREAD ABOUT +Z AT THE MCP, TWIST ABOUT +Y');
  const d = rig.handDimensions(REF), Lm = rig.LIMITS, Lt = Lm.thumb;
  panel(S, 14, 100, 1050, 760, 'TREE: NAMES, JOINTS, AXES, LIMITS (DEGREES)', 'Hand_R is the body\'s existing bone (its head is the wrist pivot). Lengths are the reference hand\'s (mm). Modes B and C use the Hand bone alone.');
  const bx = 36, by = 470, bw = 172, bh = 92;
  S.rect(bx, by - bh / 2, bw, bh, { rx: 6, fill: '#495057', under: false });
  S.text(bx + bw / 2, by - 14, 'Hand_R', { size: 18, weight: 800, fill: '#fff', anchor: 'middle' });
  S.text(bx + bw / 2, by + 6, 'wrist pivot (root)', { size: 12, fill: '#e9ecef', anchor: 'middle' });
  S.text(bx + bw / 2, by + 24, 'the forearm\'s Hand bone', { size: 12, fill: '#e9ecef', anchor: 'middle' });
  const chains = [
    ['Thumb', 'thumb', [['CMC', `flex X ${Lt.cmc[0]}..${Lt.cmc[1]}`, `opp ${Lt.opposition[0]}..${Lt.opposition[1]}, abd ${Lt.abduction[0]}..${Lt.abduction[1]}`, `twist Y ${Lt.twist[0]}..${Lt.twist[1]} (solver)`], ['MCP', `flex X ${Lt.mcp[0]}..${Lt.mcp[1]}`], ['IP', `flex X ${Lt.ip[0]}..${Lt.ip[1]}`]]],
    ...['index', 'middle', 'ring', 'pinky'].map((f) => [f[0].toUpperCase() + f.slice(1), f, [['MCP', `flex X ${Lm.mcp[0]}..${Lm.mcp[1]}`, `spread Z ${Lm.spread[f][0]}..${Lm.spread[f][1]}`, `twist Y ${Lm.twist[0]}..${Lm.twist[1]} (control)`], ['PIP', `flex X ${Lm.pip[0]}..${Lm.pip[1]}`], ['DIP', `flex X ${Lm.dip[0]}..${Lm.dip[1]}`]]]),
  ];
  const cx0 = 290, cw = 236, ch = 92, cg = 26;
  chains.forEach(([cap, key, joints], r) => {
    const y = 180 + r * 132, lens = key === 'thumb' ? d.thumb.len : d.fingers[key].len;
    S.line(bx + bw, by, cx0 - 20, y + ch / 2, { stroke: '#6c757d', sw: 1.6 });
    S.line(cx0 - 20, y + ch / 2, cx0, y + ch / 2, { stroke: '#6c757d', sw: 1.6, arrow: 'muted' });
    joints.forEach((j, k) => {
      const x = cx0 + k * (cw + cg);
      S.rect(x, y, cw, ch, { rx: 6, stroke: '#868e96', sw: 1.3, fill: k === 0 ? '#f1f3f5' : '#fff' });
      S.text(x + 12, y + 22, `${cap}_0${k + 1}_R`, { size: 16, weight: 800 });
      S.text(x + cw - 12, y + 22, j[0], { size: 15, weight: 800, fill: '#495057', anchor: 'end' });
      S.text(x + 12, y + 42, j[1], { size: 12.5, fill: AX.x, weight: 600 });
      if (j[2]) S.text(x + 12, y + 59, j[2], { size: 12.5, fill: j[2].startsWith('spread') ? AX.z : MUTED, weight: 600 });
      if (j[3]) S.text(x + 12, y + 76, j[3], { size: 12.5, fill: AX.y, weight: 600 });
      S.text(x + cw - 12, y + ch - 9, `${mm(lens[k])} mm`, { size: 11.5, fill: MUTED, anchor: 'end' });
      if (k < 2) S.line(x + cw, y + ch / 2, x + cw + cg, y + ch / 2, { stroke: '#6c757d', sw: 1.6, arrow: 'muted' });
    });
  });
  S.text(36, 845, 'Joint names: thumb CMC (carpometacarpal), MCP, IP; fingers MCP (metacarpophalangeal), PIP and DIP (proximal and distal interphalangeal).', { size: 12.5, fill: MUTED });

  // the skeleton drawn on the hand: two views and the left hand
  const drawSkeleton = (h, view, x, y, w, hh, title, sub) => {
    const sk = h.bones, F = rig.fk(sk, sk.map((b) => b.rest)), dd = rig.handDimensions(REF);
    const lenOf = (b) => { if (b === 0) return 0; const dg = rig.DIGITS[Math.floor((b - 1) / 3)], k = (b - 1) % 3; return dg === 'thumb' ? dd.thumb.len[k] : dd.fingers[dg].len[k]; };
    const p = renderPanel({ w, h: hh, scale: 2350, center: [h.side === 'left' ? -0.012 : 0.012, 0.085, 0], view, meshes: [handMesh(h, { ghost: 0.72 })] });
    const pj = S.put(p, x, y);
    for (let b = 1; b < 16; b++) {
      const a = pj(F.P[b]), kids = sk.map((s, i) => (s.parentIndex === b ? i : -1)).filter((i) => i >= 0);
      const end = kids.length ? F.P[kids[0]] : add(F.P[b], Q.rot(F.R[b], [0, lenOf(b), 0]));
      const c = pj(end);
      if (sk[b].parentIndex === 0) { const r0 = pj([0, 0, 0]); S.line(r0[0], r0[1], a[0], a[1], { stroke: '#868e96', sw: 1.2, dash: '3 3' }); }
      S.line(a[0], a[1], c[0], c[1], { stroke: INK, sw: 3, cap: 'round' });
      if (!kids.length) S.circle(c[0], c[1], 2.5, { fill: INK });
    }
    for (let b = 1; b < 16; b++) { axesAt(S, pj, F.P[b], { x: Q.rot(F.R[b], [1, 0, 0]), y: Q.rot(F.R[b], [0, 1, 0]), z: Q.rot(F.R[b], [0, 0, 1]) }, 0.011, { sw: 1.6, arrow: false }); const a = pj(F.P[b]); S.circle(a[0], a[1], 3.6, { fill: '#fff', stroke: INK, sw: 1.6 }); }
    const o = pj([0, 0, 0]);
    axesAt(S, pj, [0, 0, 0], { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, 0.03, { sw: 2.4, labels: { x: h.side === 'left' ? 'X (+X is radial on the right)' : 'X radial', y: 'Y', z: 'Z palm' }, labelSize: 12 });
    S.circle(o[0], o[1], 5, { fill: '#fff', stroke: INK, sw: 2 });
    S.text(x + w / 2, y + hh + 18, title, { size: 15, weight: 800, anchor: 'middle' });
    S.text(x + w / 2, y + hh + 35, sub, { size: 12, fill: MUTED, anchor: 'middle' });
  };
  panel(S, 1078, 100, 868, 760, 'THE SKELETON ON THE HAND');
  const hA = hand({ pose: 'HP02', mode: 'articulated', level: 0 }), hB = hand({ pose: 'HP01', mode: 'articulated', level: 0 });
  drawSkeleton(hA, VIEW.palm, 1096, 140, 410, 600, 'HP02 OPEN PALM - PALM VIEW', 'bones (black), joints (circles), local axes');
  drawSkeleton(hB, VIEW.thumb, 1516, 140, 410, 600, 'HP01 RELAXED - THUMB SIDE', 'flexion about each joint\'s local +X');
  // the legend
  panel(S, 14, 874, 1050, 300, 'CONVENTIONS');
  const T = rig.THUMB_MAP;
  const conv = [
    [AX.x, 'X', 'flexion axis: positive bends toward the pad (every joint)'],
    [AX.y, 'Y', 'along the bone toward the tip: twist (roll) at the MCP, a control of +-10 degrees'],
    [AX.z, 'Z', 'the pad (palmar) side: spread at the MCP, positive toward the little finger (the data\'s sign)'],
    [INK, '', `MCP rest = qZ(spread) x qX(flexion) x qY(twist); PIP and DIP rest = qX(flexion)`],
    [INK, '', `Thumb_01: opposition, abduction and CMC flexion mapped to one quaternion (THUMB_MAP: bind ${T.bindAngleDeg}, zero ${T.zeroAngleDeg}, kA ${T.kA}, kE ${T.kE}, kP ${T.kP}, pad twist ${T.padTwistDeg} degrees)`],
    [INK, '', 'Hand frame (the pivot): +Y wrist to fingertips, +X radial (thumb), +Z out of the palm; metres; a left hand is the mirror in X'],
  ];
  conv.forEach(([c, k, s], i) => {
    const y = 930 + i * 36;
    if (k) { S.line(40, y - 5, 74, y - 5, { stroke: c, sw: 3, arrow: k.toLowerCase() }); S.text(84, y, k, { size: 15, weight: 800, fill: c }); }
    else S.rect(52, y - 10, 8, 8, { fill: '#495057', under: false });
    S.text(110, y, s, { size: 13.5, fill: '#2f363d' });
  });
  panel(S, 1078, 874, 868, 300, 'THE LEFT HAND: MIRRORED, NEVER A NEGATIVE SCALE');
  const hL = hand({ pose: 'HP02', side: 'left', mode: 'articulated', level: 0 });
  const pL = renderPanel({ w: 250, h: 214, scale: 930, center: [-0.016, 0.078, 0], view: VIEW.palm, meshes: [handMesh(hL)] });
  S.put(pL, 1100, 918);
  const pR = renderPanel({ w: 250, h: 214, scale: 930, center: [0.016, 0.078, 0], view: VIEW.palm, meshes: [handMesh(hA)] });
  S.put(pR, 1356, 918);
  S.text(1225, 1150, 'Hand_L (HP02), palm view', { size: 13, weight: 700, anchor: 'middle' });
  S.text(1481, 1150, 'Hand_R (HP02), palm view', { size: 13, weight: 700, anchor: 'middle' });
  wrapText(S, 1620, 935, 'Positions x -> -x and the winding flipped; bone rotations (x, y, z, w) -> (x, -y, -z, w): proper rotations. Both seen from the palm: the thumbs point away from each other. Each side takes its own pose and controls; mirror: right_to_left copies one side\'s whole spec to the other.', 38, { size: 13, fill: '#2f363d' });
  footer(S);
  return S;
}

// --------------------------------------------------------------------------------------------- joint limits
function sheetLimits() {
  const S = new Sheet('limits', 1960, 1330);
  header(S, 'JOINT LIMITS AND EXTREME POSES', 'THE RIG\'S LIMITS (PROPOSALS, rig.js LIMITS; WRIST: mesh0.js SHAPE.wrist), IN DEGREES',
    'A POSE OUTSIDE A LIMIT IS CLAMPED AND REPORTED; A CONTROL STOPS AT A LIMIT AND SAYS SO; NOTHING SILENT');
  const L = rig.LIMITS, Wr = mesh0.SHAPE.wrist;
  panel(S, 14, 100, 610, 1196, 'LIMITS');
  const rowsT = [
    ['FINGERS', '', '', '', ''], ['MCP flexion', 'X', '_01', L.mcp[0], L.mcp[1]], ['PIP flexion', 'X', '_02', L.pip[0], L.pip[1]], ['DIP flexion', 'X', '_03', L.dip[0], L.dip[1]],
    ['spread, index', 'Z', 'Index_01', ...L.spread.index], ['spread, middle', 'Z', 'Middle_01', ...L.spread.middle], ['spread, ring', 'Z', 'Ring_01', ...L.spread.ring], ['spread, little', 'Z', 'Pinky_01', ...L.spread.pinky],
    ['twist (control)', 'Y', '_01', L.twist[0], L.twist[1]],
    ['THUMB', '', '', '', ''], ['CMC flexion', 'X', 'Thumb_01', ...L.thumb.cmc], ['opposition', 'map', 'Thumb_01', ...L.thumb.opposition], ['abduction (- adducts)', 'map', 'Thumb_01', ...L.thumb.abduction],
    ['twist (solver only)', 'Y', 'Thumb_01', ...L.thumb.twist], ['MCP flexion', 'X', 'Thumb_02', ...L.thumb.mcp], ['IP flexion', 'X', 'Thumb_03', ...L.thumb.ip],
    ['WRIST (the connector)', '', '', '', ''], ['flexion (+ palmar)', 'X', 'Hand', ...Wr.flexion], ['deviation (+ ulnar)', 'Z', 'Hand', ...Wr.deviation],
  ];
  const tx = 34, cols = [0, 236, 300, 420, 500];
  ['joint', 'axis', 'bone', 'min', 'max'].forEach((s, k) => S.text(tx + cols[k] + (k >= 3 ? 56 : 0), 160, s.toUpperCase(), { size: 12.5, weight: 800, fill: MUTED, anchor: k >= 3 ? 'end' : 'start' }));
  S.line(tx, 170, tx + 560, 170, { stroke: '#868e96', sw: 1.2 });
  rowsT.forEach((r, i) => {
    const y = 198 + i * 30;
    if (!r[1]) { S.text(tx, y, r[0], { size: 14, weight: 800 }); S.line(tx, y + 9, tx + 560, y + 9, { stroke: '#dee2e6' }); return; }
    S.text(tx + 10, y, r[0], { size: 14 });
    S.text(tx + cols[1], y, r[1], { size: 14, weight: 700, fill: r[1] === 'X' ? AX.x : r[1] === 'Y' ? AX.y : r[1] === 'Z' ? AX.z : MUTED });
    S.text(tx + cols[2], y, r[2], { size: 13, fill: MUTED });
    S.text(tx + cols[3] + 56, y, String(r[3]), { size: 14, weight: 600, anchor: 'end' });
    S.text(tx + cols[4] + 56, y, String(r[4]), { size: 14, weight: 600, anchor: 'end' });
    S.line(tx, y + 9, tx + 560, y + 9, { stroke: '#f1f3f5' });
  });
  wrapText(S, tx, 198 + rowsT.length * 30 + 20, 'Opposition and abduction are the data\'s semantic thumb controls, mapped to one rotation of Thumb_01 (THUMB_MAP). The finger twist is a control (+-10 degrees); the thumb twist is used by the contact solver only. The finger controls curl, spread and twist move within these limits; thumb flexion, abduction and opposition likewise.', 74, { size: 12.5, fill: MUTED });

  // the extreme poses
  const base = getPose('HP02');
  const mk = (id, fingers, thumb) => ({ id, name: id, canonical_side: 'right', fingers: Object.fromEntries(['index', 'middle', 'ring', 'pinky'].map((f) => [f, { ...base.fingers[f], ...(fingers[f] ?? fingers.all ?? {}) }])),
    thumb: { ...base.thumb, ...thumb }, contact: { type: 'none', radius_m: null }, gesture_orientation: 'contextual' });
  const F = (mcp, pip, dip) => ({ all: { mcp_flex_deg: mcp, pip_flex_deg: pip, dip_flex_deg: dip } });
  const cases = [
    [mk('MCP_MIN', F(L.mcp[0], 0, 0), {}), 'thumb', `MCP ${L.mcp[0]} (hyperextension)`, 'PIP and DIP 0'],
    [mk('MCP_MAX', F(L.mcp[1], 0, 0), {}), 'thumb', `MCP ${L.mcp[1]}`, 'PIP and DIP 0 (a table-top hand)'],
    [mk('PIPDIP_MAX', F(0, L.pip[1], L.dip[1]), {}), 'thumb', `PIP ${L.pip[1]}, DIP ${L.dip[1]}`, 'MCP 0 (a hook)'],
    [mk('ALL_MAX', F(L.mcp[1], L.pip[1], L.dip[1]), {}), 'thumb', `MCP ${L.mcp[1]}, PIP ${L.pip[1]}, DIP ${L.dip[1]}`, 'every finger joint at its limit'],
    [mk('SPREAD_OUT', { index: { spread_deg: L.spread.index[0] }, middle: { spread_deg: 0 }, ring: { spread_deg: L.spread.ring[1] }, pinky: { spread_deg: L.spread.pinky[1] } }, {}), 'palm', 'spread apart', `index ${L.spread.index[0]}, ring ${L.spread.ring[1]}, little ${L.spread.pinky[1]}`],
    [mk('SPREAD_IN', { index: { spread_deg: L.spread.index[1] }, middle: { spread_deg: 0 }, ring: { spread_deg: L.spread.ring[0] }, pinky: { spread_deg: L.spread.pinky[0] } }, {}), 'palm', 'spread together', `index ${L.spread.index[1]}, ring ${L.spread.ring[0]}, little ${L.spread.pinky[0]}`],
    [mk('THUMB_MIN', {}, { cmc_flex_deg: L.thumb.cmc[0], mcp_flex_deg: L.thumb.mcp[0], ip_flex_deg: L.thumb.ip[0], opposition_deg: L.thumb.opposition[0], abduction_deg: L.thumb.abduction[0] }), 'palm', 'thumb at its minimums', `CMC ${L.thumb.cmc[0]}, MCP ${L.thumb.mcp[0]}, IP ${L.thumb.ip[0]}, opp ${L.thumb.opposition[0]}, abd ${L.thumb.abduction[0]}`],
    [mk('THUMB_MAX', {}, { cmc_flex_deg: L.thumb.cmc[1], mcp_flex_deg: L.thumb.mcp[1], ip_flex_deg: L.thumb.ip[1], opposition_deg: L.thumb.opposition[1], abduction_deg: L.thumb.abduction[1] }), 'palm', 'thumb at its maximums', `CMC ${L.thumb.cmc[1]}, MCP ${L.thumb.mcp[1]}, IP ${L.thumb.ip[1]}, opp ${L.thumb.opposition[1]}, abd ${L.thumb.abduction[1]}`],
  ];
  panel(S, 638, 100, 1308, 1196, 'EXTREME POSES', 'Level 0, reference hand. Fingers seen from the thumb side, spread and thumb from the palm, the wrist with the forearm\'s end. Under each: the angles after the solver, and what it changed.');
  const cw = 318, chh = 250, x0 = 656, y0 = 168, rowH = 372;
  const fmtA = (h, id) => {
    const a = h.angles, f = a.fingers, t = a.thumb, r = (v) => Math.round(v);
    if (/THUMB/.test(id)) return `got CMC ${r(t.cmc_flex_deg)}, MCP ${r(t.mcp_flex_deg)}, IP ${r(t.ip_flex_deg)}, opp ${r(t.opposition_deg)}, abd ${r(t.abduction_deg)}, twist ${r(t.twist_deg)}`;
    if (/SPREAD/.test(id)) return `got spread ${['index', 'middle', 'ring', 'pinky'].map((k) => r(f[k].spread_deg)).join(' / ')} (index / middle / ring / little)`;
    return `got ${['index', 'middle', 'ring', 'pinky'].map((k) => `${r(f[k].mcp_flex_deg)}/${r(f[k].pip_flex_deg)}/${r(f[k].dip_flex_deg)}`).join('  ')} (MCP/PIP/DIP)`;
  };
  cases.forEach(([pose, v, t1, t2], i) => {
    const x = x0 + (i % 4) * cw, y = y0 + Math.floor(i / 4) * rowH;
    const h = hand({ pose, mode: 'preset', level: 0 });
    if (!h.ok) { wrapText(S, x, y + 30, errText(h), 40, { size: 12, fill: '#c92a2a' }); return; }
    const p = renderPanel({ w: cw - 12, h: chh, scale: 1020, center: v === 'thumb' ? [0, 0.085, 0.03] : [0.012, 0.085, 0], view: VIEW[v], meshes: [handMesh(h)] });
    S.put(p, x, y);
    S.text(x + (cw - 12) / 2, y + chh + 18, t1, { size: 15, weight: 800, anchor: 'middle' });
    S.text(x + (cw - 12) / 2, y + chh + 35, t2, { size: 12, fill: MUTED, anchor: 'middle' });
    let yy = wrapText(S, x + 6, y + chh + 54, fmtA(h, pose.id), 50, { size: 11.5, fill: '#2f363d' });
    const rules = [...new Set(h.corrections.map((c) => c.rule))];
    wrapText(S, x + 6, yy + 2, rules.length ? `solver: ${rules.join(', ')}` : 'solver: nothing changed', 50, { size: 11.5, fill: rules.length ? '#9c4a00' : MUTED });
  });
  // the wrist at its limits, with the forearm's end
  const hw = hand({ pose: 'HP02', mode: 'preset', level: 0 }), d = rig.handDimensions(REF);
  const P = mesh0.pieces(d, rig.skeleton(d)), planes = rig.planesOf(P.connector.verts, P.connector.tris);
  [[Wr.flexion[0], 0, 'thumb', 'wrist flexion ' + Wr.flexion[0], 'extension'], [Wr.flexion[1], 0, 'thumb', 'wrist flexion +' + Wr.flexion[1], 'palmar flexion'],
    [0, Wr.deviation[0], 'palm', 'deviation ' + Wr.deviation[0], 'radial'], [0, Wr.deviation[1], 'palm', 'deviation +' + Wr.deviation[1], 'ulnar']].forEach(([fl, dv, v, t1, t2], i) => {
    const x = x0 + i * cw, y = y0 + 2 * rowH, q = qWrist(fl, dv);
    let worst = -Infinity; for (const p of mesh0.forearmRingAt(d, fl, dv)) worst = Math.max(worst, rig.sdPlanes(planes, p));
    const p = renderPanel({ w: cw - 12, h: chh, scale: 700, center: v === 'thumb' ? [0, 0.045, fl < 0 ? -0.05 : 0.05] : [dv > 0 ? -0.025 : 0.02, 0.05, 0], view: VIEW[v], meshes: [handMesh(hw, { map: (pp) => Q.rot(q, pp) }), forearm(d.ring, 0.08)] });
    S.put(p, x, y);
    S.text(x + (cw - 12) / 2, y + chh + 18, t1, { size: 15, weight: 800, anchor: 'middle' });
    S.text(x + (cw - 12) / 2, y + chh + 35, t2, { size: 12, fill: MUTED, anchor: 'middle' });
    S.text(x + 6, y + chh + 54, worst < 0 ? `forearm end inside the collar by ${mm(-worst, 2)} mm` : `forearm end OUT of the collar by ${mm(worst, 2)} mm`, { size: 11.5, fill: worst < 0 ? '#2f363d' : '#c92a2a' });
  });
  footer(S);
  return S;
}

// --------------------------------------------------------------------------------------------- wireframes
function sheetWireframes() {
  const entries = [{ level: 0, mode: 'articulated', built: true, label: 'LEVEL 0', bind: true }, ...levelEntries(), { level: 4, built: true, label: 'LEVEL 4' }];
  const rowOf = (e) => (e.built ? 300 : 86), top = 104, M = 14;
  const S = new Sheet('wireframes', 1960, top + entries.reduce((a, e) => a + rowOf(e) + 12, 0) + 40);
  let y = top;
  header(S, 'WIREFRAMES OF EVERY LEVEL', 'EVERY TRIANGLE EDGE THAT CAN BE SEEN (HIDDEN EDGES ARE NOT DRAWN)', 'ONE TOPOLOGY A LEVEL: THE SAME INDEX FOR EVERY POSE, SIZE, AGE, SIDE AND CONTROL');
  const views = [['HP02', 'palm'], ['HP02', 'thumb'], ['HP04', 'q34'], ['HP06', 'q34'], ['HP11', 'q34']];
  entries.forEach((e) => {
    const rowH = rowOf(e);
    y += e === entries[0] ? 0 : rowOf(entries[entries.indexOf(e) - 1]) + 12;
    S.rect(M, y, S.w - 2 * M, rowH, { rx: 9, stroke: LINE, sw: 1.3, fill: '#fff' });
    const title = e.bind ? 'LEVEL 0 - MODE A BIND MESH' : e.level === 0 ? 'LEVEL 0 - POSED (MODE B BAKES THIS)' : e.label;
    S.text(M + 20, y + 34, title, { size: 19, weight: 800 });
    if (e.level === 4) {
      wrapText(S, M + 20, y + 62, 'No hand: 0 triangles, 0 vertices, 0 bones. The forearm\'s end is closed by the body (the far LOD of a character).', 44, { size: 13.5, fill: '#2f363d' });
      const p = renderPanel({ w: 296, h: rowH - 26, scale: 1225, center: [0, -0.03, 0], view: VIEW.q34, meshes: [forearm(REF.ring, 0.08, { closed: true })], wire: true });
      S.put(p, M + 380, y + 4); viewLabel(S, M + 380 + 148, y + rowH - 8, 'the forearm\'s closed end'); return;
    }
    if (!e.built) { S.text(M + 20, y + 62, `not built yet: ${e.error}. This row fills in when the module exists (run the tool again).`, { size: 13.5, fill: '#c92a2a' }); return; }
    const h0 = hand(e.bind ? { pose: 'HP02', mode: 'articulated', level: 0 } : handArgs(e, 'HP02'));
    if (!h0.ok) { wrapText(S, M + 20, y + 62, errText(h0), 44, { size: 13, fill: '#c92a2a' }); return; }
    const lines = [`${h0.triangles} triangles, ${h0.vertices} vertices`, `mode ${e.bind ? 'A articulated' : e.modeLabel}`, `bones ${e.bind ? '16 (vertices bound to one bone each)' : e.level === 0 ? '16 (A) or 1 (B, baked)' : '1 (the hand bone)'}`];
    if (e.level === 0) {
      const g = {}; for (const pc of h0.pieces) { const k = pc.kind; g[k] ??= { n: 0, t: pc.triangles, v: pc.vertices }; g[k].n++; }
      lines.push(...Object.entries(g).map(([k, v]) => `${v.n} x ${k}: ${v.t} tris, ${v.v} verts`));
    } else if (h0.pieces?.length > 1) lines.push(`${h0.pieces.length} pieces: ${h0.pieces.map((p) => `${p.name} ${p.triangles}`).join(', ')}`);
    let yy = y + 62;
    for (const s of lines) yy = wrapText(S, M + 20, yy, s, 46, { size: 13.5, fill: '#2f363d' }) + 2;
    (e.bind ? [['HP02', 'palm'], ['HP02', 'thumb'], ['HP02', 'q34'], ['HP02', 'back'], ['HP02', 'ulnar']] : views).forEach(([pose, v], k) => {
      const h = hand(e.bind ? { pose, mode: 'articulated', level: 0 } : handArgs(e, pose));
      if (!h.ok) return;
      const p = renderPanel({ w: 296, h: rowH - 26, scale: 1225, center: v === 'thumb' || v === 'ulnar' ? [0, 0.079, 0.02] : [0.012, 0.079, 0.01], view: VIEW[v], meshes: [handMesh(h, { bind: e.bind })], wire: true });
      S.put(p, M + 380 + k * 306, y + 4);
      viewLabel(S, M + 380 + k * 306 + 148, y + rowH - 8, `${e.bind ? 'bind' : pose} - ${VIEW_NAME[v]}`);
    });
  });
  footer(S, 'Level 4 is drawn as the forearm\'s closed end.');
  return S;
}

// ------------------------------------------------------------------------------------------- wrist interface
function sheetWrist() {
  const S = new Sheet('wrist', 1960, 1290);
  header(S, 'UNIVERSAL WRIST INTERFACE', 'THE FOREARM\'S SIX-POINT RING IS THE HAND\'S BASE: SAME POSITIONS TO 1e-9 m, PIVOT AT ITS CENTRE',
    'EVERY MODE AND LEVEL STARTS FROM THE SAME RING; THE CONNECTOR (LEVELS 0 AND 1) CLOSES THE JOINT FOR FLEXION -70..+70, DEVIATION -20..+30');
  const d = rig.handDimensions(REF), ring = d.ring, R6 = H.wristRing(ring);
  const h = hand({ pose: 'HP02', mode: 'preset', level: 0 });
  // 1. assembled and apart
  panel(S, 14, 100, 940, 640, 'THE INTERFACE', 'HP02, level 0, with the forearm\'s end (a six-sided tube of the ring, 80 mm). Left: assembled. Right: the hand lifted 40 mm off the forearm (the forearm\'s open end, inside drawn dark on purpose).');
  const view = viewYPR(-35, 22, 0), sc = 1500;
  const pa = renderPanel({ w: 450, h: 520, scale: sc, center: [0.0, 0.05, 0], view, meshes: [handMesh(h), forearm(ring, 0.08)] });
  const pjA = S.put(pa, 24, 196);
  const lift = [0, 0.075, 0];
  const pb = renderPanel({ w: 450, h: 520, scale: 1250, center: [0.0, 0.07, 0], view, meshes: [handMesh(h, { map: (p) => add(p, lift) }), forearm(ring, 0.08, { backColor: [92, 98, 106] })] });
  const pjB = S.put(pb, 490, 196);
  axesAt(S, pjA, [0, 0, 0], { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, 0.055, { sw: 2.6, labels: { x: '+X radial (thumb)', y: '+Y fingers', z: '+Z palm' }, labelSize: 13 });
  const o = pjA([0, 0, 0]); S.circle(o[0], o[1], 5.5, { fill: '#fff', stroke: INK, sw: 2.2 });
  S.line(o[0] - 6, o[1] + 4, 60, o[1] + 92, { stroke: '#868e96', sw: 1 });
  S.text(40, o[1] + 108, 'pivot: the ring\'s centre, the Hand bone head', { size: 12.5, weight: 700 });
  const ob = pjB([0, 0, 0]); cross2(S, ob, 7, INK, 1.6);
  R6.forEach((p, k) => {   // each number outside its point, along the screen direction from the ring's centre
    const q = pjB(p), dx = q[0] - ob[0], dy = q[1] - ob[1], L = Math.hypot(dx, dy) || 1;
    S.circle(q[0], q[1], 4.5, { fill: '#f08c00', stroke: '#fff', sw: 1.4 });
    S.text(q[0] + 15 * dx / L, q[1] + 15 * dy / L + 5, String(k + 1), { size: 14, weight: 800, fill: '#d9480f', anchor: 'middle' });
  });
  R6.forEach((p, k) => { const a = pjB(p), b = pjB(add(p, lift)); if (k === 0 || k === 3) S.line(a[0], a[1], b[0], b[1], { stroke: '#868e96', sw: 1, dash: '3 3' }); });
  S.text(255, 726, 'assembled', { size: 13, fill: MUTED, anchor: 'middle' });
  S.text(715, 726, 'apart: ring points 1-6 on the forearm\'s end, the connector under the palm', { size: 13, fill: MUTED, anchor: 'middle' });

  // 2. the ring, as numbers
  panel(S, 968, 100, 978, 640, 'THE RING { w, f, b } IN THE HAND FRAME (y = 0)', `Reference adult: w ${mm(ring.w)}, f ${mm(ring.f)}, b ${mm(ring.b)} mm (half-sizes). The hand builder takes the ring as input: it never measures or assumes one. Seen from the forearm, looking toward the fingers.`);
  const cx = 1250, cy = 440, k = 4600;
  const P2 = (p) => [cx + p[0] * k, cy - p[2] * k];   // X to the right, Z (palm) up
  const Cm = mesh0.SHAPE.connector, pad = Cm.pad * d.s;
  const mid = R6.map((v) => { const r = Math.hypot(v[0], v[2]); return [v[0] * Cm.scale + pad * v[0] / r, 0, v[2] * Cm.scale + pad * v[2] / r]; });
  S.poly(mid.map(P2), { stroke: '#868e96', sw: 1.4, dash: '6 4' });
  S.poly(R6.map(P2), { fill: '#f1f3f5', stroke: INK, sw: 2.2 });
  S.line(cx - 200, cy, cx + 200, cy, { stroke: AX.x, sw: 1.6, arrow: 'x' }); S.text(cx + 200, cy - 12, '+X radial (thumb)', { size: 13, weight: 700, fill: AX.x, anchor: 'end' });
  S.line(cx, cy + 150, cx, cy - 150, { stroke: AX.z, sw: 1.6, arrow: 'z' }); S.text(cx + 8, cy - 152, '+Z palm', { size: 13, weight: 700, fill: AX.z });
  S.circle(cx, cy, 6, { fill: '#fff', stroke: INK, sw: 2 }); S.text(cx - 10, cy + 22, 'pivot', { size: 12.5, weight: 700, anchor: 'end' });
  const names = ['(+f, 0, 0) radial corner', '(+f/2, 0, +w) palm, radial', '(-b/2, 0, +w) palm, ulnar', '(-b, 0, 0) ulnar corner', '(-b/2, 0, -w) back, ulnar', '(+f/2, 0, -w) back, radial'];
  const offs = [[12, 24, 'start'], [10, -12, 'start'], [-10, -12, 'end'], [-12, 24, 'end'], [-10, 24, 'end'], [10, 24, 'start']];
  R6.forEach((p, i) => {
    const q = P2(p); S.circle(q[0], q[1], 6, { fill: '#f08c00', stroke: '#fff', sw: 1.5 });
    S.text(q[0] + offs[i][0], q[1] + offs[i][1], `${i + 1}  ${names[i]}`, { size: 13, weight: 600, anchor: offs[i][2] });
    S.text(q[0] + offs[i][0], q[1] + offs[i][1] + 15, `(${mm(p[0])}, 0, ${mm(p[2])}) mm`, { size: 11.5, fill: MUTED, anchor: offs[i][2] });
  });
  S.text(1000, 640, 'dashed: the connector\'s widest ring (the ring x ' + Cm.scale + ' + ' + mm(pad) + ' mm), the collar around the pivot', { size: 12.5, fill: MUTED });
  // ring checks for every built level
  let yy = 664;
  const chk = [], byLevel = new Map();
  for (const e of levelEntries()) { if (!byLevel.has(e.level)) byLevel.set(e.level, []); byLevel.get(e.level).push(e); }
  for (const [lv, es] of byLevel) {   // one line a level: its variants grouped, a failure named on its own
    if (!es[0].built) { chk.push(`level ${lv}: not built yet`); continue; }
    let worst = 0; const ok = [];
    for (const e of es) {
      const hh = hand(handArgs(e, 'HP02'));
      if (hh.ok) { worst = Math.max(worst, ringError(hh, ring)); ok.push(e.variant ?? ''); } else chk.push(`${e.label.toLowerCase()}: ${errText(hh)}`);
    }
    if (ok.length) chk.push(`level ${lv}${es.length > 1 ? ` (${ok.length} variants: ${ok.join(', ')})` : ''}: the six ring points found among the vertices${ok.length > 1 ? ' of each' : ''}, largest error ${worst.toExponential(1)} m`);
  }
  for (const s of chk) yy = wrapText(S, 1000, yy, s, 128, { size: 12.5, fill: '#2f363d', lh: 17 });

  // 3. the wrist bent: -70 / 0 / +70 flexion, -20 / +30 deviation
  panel(S, 14, 754, 1932, 500, 'THE WRIST BENT: NO GAP, NO OPEN END', 'Level 0 HP01 on the fixed forearm, the hand turned about the pivot. Flexion seen from the thumb side, deviation from the palm. Any open end that showed would be drawn red. Measured: how deep the forearm\'s end ring stays inside the collar.');
  const P = mesh0.pieces(d, rig.skeleton(d)), planes = rig.planesOf(P.connector.verts, P.connector.tris);
  const h1 = hand({ pose: 'HP01', mode: 'preset', level: 0 });
  const bends = [[-70, 0, 'thumb', 'flexion -70 (extension)'], [0, 0, 'thumb', 'flexion 0'], [70, 0, 'thumb', 'flexion +70 (palmar)'], [0, -20, 'palm', 'deviation -20 (radial)'], [0, 0, 'palm', 'deviation 0'], [0, 30, 'palm', 'deviation +30 (ulnar)']];
  bends.forEach(([fl, dv, v, t], i) => {
    const q = qWrist(fl, dv), x = 34 + i * 318;
    let worst = -Infinity; for (const p of mesh0.forearmRingAt(d, fl, dv)) worst = Math.max(worst, rig.sdPlanes(planes, p));
    const p = renderPanel({ w: 300, h: 330, scale: 1000, center: [0, 0.035, 0], view: VIEW[v], meshes: [handMesh(h1, { map: (pp) => Q.rot(q, pp) }), forearm(ring, 0.08)] });
    const pj = S.put(p, x, 838);
    const o2 = pj([0, 0, 0]); S.circle(o2[0], o2[1], 4, { fill: '#fff', stroke: INK, sw: 1.8 });
    S.text(x + 150, 1190, t, { size: 15, weight: 800, anchor: 'middle' });
    S.text(x + 150, 1208, worst < 0 ? `ring inside the collar by ${mm(-worst, 2)} mm` : `ring OUT of the collar by ${mm(worst, 2)} mm`, { size: 12.5, fill: worst < 0 ? MUTED : '#c92a2a', anchor: 'middle' });
  });
  footer(S, 'Levels 2 and 3 close the ring with their own base (no connector) and accept a gap at extreme wrist angles (distant characters).');
  return S;
}

// --------------------------------------------------------------------------------------------- holding objects
function sheetObjects() {
  const items = [
    ['HP06', { grip_radius_m: 0.012 }, 'cylinder, r 12 mm'], ['HP06', { grip_radius_m: 0.020 }, 'cylinder, r 20 mm'], ['HP06', { grip_radius_m: 0.032 }, 'cylinder, r 32 mm'], ['HP20', {}, 'sphere (the pose\'s own size)'],
    ['HP21', {}, 'card (ID-1, 85.6 x 54 mm)'], ['HP12', {}, 'pen (tripod)'], ['HP19', {}, 'phone'], ['HP15', {}, 'bag handle (hook)'],
    ['HP06', { object: { shape: 'cylinder', orientation_deg: 40 } }, 'cylinder tilted 40 degrees'], ['HP06', { object: { shape: 'cylinder', orientation_deg: -25 } }, 'cylinder tilted -25 degrees'],
    ['HP06', { object: { shape: 'box', orientation_deg: null } }, 'square bar (shape box)'], ['HP08', {}, 'trigger grip handle'],
  ];
  const cols = 4, vw = 222, vh = 262, cellW = 2 * vw + 34, cellH = vh + 92, top = 104, M = 22;
  const S = new Sheet('objects', 2 * M + cols * cellW, top + 3 * cellH + 50);
  header(S, 'HOLDING OBJECTS', 'THE GRIP ADAPTS TO THE OBJECT\'S RADIUS, SHAPE AND ORIENTATION (LEVEL 0, REFERENCE HAND)',
    'FINGERS CURL TO CONTACT, THE THUMB IS SOLVED ONTO THE OBJECT; THREE-QUARTER AND THUMB-SIDE VIEWS; OBJECTS IN BLUE');
  items.forEach(([pose, grip, title], i) => {
    const x0 = M + (i % cols) * cellW, y0 = top + Math.floor(i / cols) * cellH;
    S.rect(x0 + 4, y0, cellW - 8, cellH - 10, { rx: 7, stroke: '#c9ced4', sw: 1, fill: '#fff' });
    const h = hand({ pose, mode: 'preset', level: 0, grip });
    if (!h.ok) { wrapText(S, x0 + 16, y0 + 40, errText(h), 60, { size: 12, fill: '#c92a2a' }); return; }
    ['q34', 'thumb'].forEach((v, k) => {
      const p = renderPanel({ w: vw, h: vh, scale: 1060, center: [0.01, 0.083, 0.02], view: VIEW[v], meshes: [handMesh(h), ...objectMeshes(h, VIEW[v], REF, { grip })] });
      S.put(p, x0 + 14 + k * (vw + 6), y0 + 4);
    });
    badge(S, x0 + 44, y0 + vh + 8, pose, { size: 13 });
    S.text(x0 + 82, y0 + vh + 24, title.toUpperCase(), { size: 14, weight: 800 });
    const sd = shortDiag(h);
    let yy = wrapText(S, x0 + 16, y0 + vh + 44, `${objectText(h)}${sd.curl ? ' - curl ' + sd.curl : ''}`, 70, { size: 11.5, fill: '#2f363d' });
    if (sd.thumb) S.text(x0 + 16, yy, sd.thumb, { size: 11.5, fill: MUTED });
  });
  footer(S, 'The card and the pen are drawn from the solved fingertips (the solver holds no object for those contacts).');
  return S;
}

// --------------------------------------------------------------------------------------------- LOD comparison
function sheetLod() {
  const poses = ['HP01', 'HP02', 'HP04', 'HP06', 'HP10', 'HP11'];
  const cols = [...levelEntries(), { level: 4, built: true, label: 'LEVEL 4', modeLabel: 'none', bones: '0', tris: 0, verts: 0 }];
  const M = 20, left = 150, top = 196, vh = 236, rowH = vh + 34, vw = Math.round(Math.max(200, Math.min(300, (1900 - left - M - 10 - 10 * cols.length) / cols.length)));
  const rowsB = H.HAND_LEVELS.flatMap((L) => (L.variants && Object.keys(L.variants).length ? Object.entries(L.variants).map(([v, c]) => ({ ...L, label: `${L.level} ${v}`, triangles: c.triangles, vertices: c.vertices })) : [{ ...L, label: String(L.level) }]));
  const tableH = 100 + rowsB.length * 20;
  const S = new Sheet('lod', Math.max(1900, left + M + cols.length * (vw + 10) + 10), top + poses.length * rowH + 20 + tableH + 50);
  header(S, 'LEVELS OF DETAIL SIDE BY SIDE', 'EVERY LEVEL POSED FROM THE SAME SOLVED SKELETON: NO SEPARATE POSE TABLES, NO JUMP',
    'DASHED BLUE: LEVEL 0\'S BOUNDING BOX; CROSS: LEVEL 0\'S CENTROID; DOT: THIS LEVEL\'S CENTROID (THREE-QUARTER VIEW)');
  cols.forEach((e, c) => {
    const x = left + c * (vw + 10);
    S.rect(x, 102, vw, 84, { rx: 6, fill: e.built ? '#f1f3f5' : '#fff5f5', stroke: '#ced4da' });
    S.text(x + vw / 2, 124, e.label, { size: Math.min(16, Math.floor((vw - 14) / (0.64 * e.label.length))), weight: 800, anchor: 'middle' });
    S.text(x + vw / 2, 142, e.modeLabel ?? '', { size: 12, fill: MUTED, anchor: 'middle' });
    S.text(x + vw / 2, 161, e.built ? `${e.tris} tris - ${e.verts} verts` : 'not built yet', { size: 12.5, weight: 600, fill: e.built ? INK : '#c92a2a', anchor: 'middle' });
    if (e.built) S.text(x + vw / 2, 178, `${e.bones} bone${e.bones === '1' ? '' : 's'}`, { size: 12.5, weight: 600, anchor: 'middle' });
  });
  const center = [0.01, 0.075, 0.012], scale = 1020;
  poses.forEach((id, r) => {
    const y = top + r * rowH, h0 = hand({ pose: id, mode: 'preset', level: 0 });
    badge(S, M + 50, y + vh / 2 - 22, id, { size: 14 });
    S.text(M + 50, y + vh / 2 + 18, getPose(id).name.replace(/_/g, ' ').toUpperCase(), { size: 12.5, weight: 800, anchor: 'middle' });
    const P0 = pts(H.posed(h0)), bb0 = bboxOf(P0), c0 = volumeCentroid(H.posed(h0), h0.index);
    cols.forEach((e, c) => {
      const x = left + c * (vw + 10);
      S.rect(x, y, vw, vh + 26, { rx: 6, stroke: '#dee2e6', fill: '#fff' });
      if (!e.built) { S.text(x + vw / 2, y + vh / 2, 'not built yet', { size: 13, fill: '#c92a2a', anchor: 'middle' }); return; }
      if (e.level === 4) {
        const p = renderPanel({ w: vw, h: vh, scale, center, view: VIEW.q34, meshes: [forearm(REF.ring, 0.08, { closed: true })] });
        S.put(p, x, y); S.text(x + vw / 2, y + vh + 16, 'no hand: the forearm\'s end, closed', { size: 11.5, fill: MUTED, anchor: 'middle' }); return;
      }
      const h = hand(handArgs(e, id));
      if (!h.ok) { wrapText(S, x + 8, y + 30, errText(h), 34, { size: 11, fill: '#c92a2a' }); return; }
      const p = renderPanel({ w: vw, h: vh, scale, center, view: VIEW.q34, meshes: [handMesh(h)] });
      const pj = S.put(p, x, y);
      drawBox3(S, pj, bb0, { stroke: '#4c6ef5', sw: 0.9, dash: '4 3' });
      cross2(S, pj(c0), 6, '#4c6ef5', 1.6);
      if (e.level === 0) { S.text(x + vw / 2, y + vh + 16, 'the reference', { size: 11.5, fill: MUTED, anchor: 'middle' }); return; }
      const P = pts(H.posed(h)), bb = bboxOf(P), cc = volumeCentroid(H.posed(h), h.index);
      const dBox = Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(bb.lo[k] - bb0.lo[k]), Math.abs(bb.hi[k] - bb0.hi[k])])), dC = len(sub(cc, c0));
      const q = pj(cc); S.circle(q[0], q[1], 4, { fill: '#e8590c', stroke: '#fff', sw: 1.2 });
      S.text(x + vw / 2, y + vh + 16, `box ${mm(dBox)} mm, centroid ${mm(dC)} mm`, { size: 11.5, fill: MUTED, anchor: 'middle' });
    });
  });
  // the table
  const ty = top + poses.length * rowH + 20;
  S.rect(M, ty, S.w - 2 * M, tableH, { rx: 9, stroke: LINE, sw: 1.3, fill: '#fff' });
  S.text(M + 18, ty + 30, 'THE RENDER BUDGET (MEASURED COUNTS A HAND; TARGETS FROM THE DESIGN)', { size: 17, weight: 800 });
  const target = { 0: '160-260 (as few as the look allows)', 1: '24-40, and a readable variant', 2: '12-20', 3: '6-12', 4: '0' };
  const hx = [M + 24, M + 170, M + 420, M + 560, M + 740, M + 900, M + 1240];
  ['level', 'mode', 'bones', 'triangles', 'vertices', 'target triangles', 'status'].forEach((s, k) => S.text(hx[k], ty + 60, s.toUpperCase(), { size: 12, weight: 800, fill: MUTED }));
  rowsB.forEach((L, i) => {
    const y = ty + 84 + i * 20;
    const vals = [L.label, L.modes.map((m) => m ?? 'none').join(' / '), Object.entries(L.bones).map(([m, b]) => `${b}${Object.keys(L.bones).length > 1 ? ` (${({ articulated: 'A', preset: 'B', simplified: 'C' })[m] ?? m})` : ''}`).join(' / ') || '0',
      L.triangles ?? '-', L.vertices ?? '-', target[L.level], L.built ? 'built' : `not built: ${L.error}`];
    vals.forEach((s, k) => S.text(hx[k], y, String(s), { size: 13, fill: k === 6 && !L.built ? '#c92a2a' : '#2f363d', weight: k === 0 ? 700 : 400 }));
  });
  footer(S, 'Box: the largest difference of a bounding-box face to level 0\'s; centroid: of the closed volume.');
  return S;
}

// ------------------------------------------------------------------------------------------------- ages, bodies
// The body inputs of a character, computed the way generator.js computes them (it is not edited): the hand's length
// is sd.hand (the generator builds its placeholder hand from the wrist pivot down by exactly that length; once the hand
// system is integrated, character.hands carries the length it was given), the wrist ring { w, f, b } is the forearm's
// last ring R['arm' + s].fore[1] (its six vertices around the Hand_L bone head: w sideways, f to the front, b to the
// back), months, the female weight (generator: female ? maturity x adultGate) and the arms' fat level.
function bodyFromGenerator(sex, months) {
  const c = G.generate(G.presetDNA({ sex, age_months: months }));
  if (!c.ok) throw new Error(`generate(${sex}, ${months}): ${JSON.stringify(c.errors)}`);
  const P = (i) => [c.positions[3 * i], c.positions[3 * i + 1], c.positions[3 * i + 2]];
  const head = c.bones.find((b) => b.name === 'Hand_L').head, fa = c.pieces.find((p) => p.name === 'Forearm_L');
  const ringPts = []; for (let i = fa.v1 - 6; i < fa.v1; i++) ringPts.push(P(i));
  const ring = { w: Math.max(...ringPts.map((p) => Math.abs(p[0] - head[0]))), f: Math.max(...ringPts.map((p) => p[2] - head[2])), b: Math.max(...ringPts.map((p) => head[2] - p[2])) };
  const hl = c.hands?.left;
  let length = hl?.body?.length ?? hl?.dims?.length ?? hl?.length ?? null, source = 'character.hands';
  if (!(length > 0)) {
    const hp = c.pieces.find((p) => p.name === 'Hand_L');
    if (hp && hp.v1 - hp.v0 === 8) { const ys = []; for (let i = hp.v0; i < hp.v1; i++) ys.push(c.positions[3 * i + 1]); length = Math.max(...ys) - Math.min(...ys); source = 'sd.hand (the placeholder hand)'; }
  }
  if (!(length > 0)) throw new Error(`cannot find the hand length of generate(${sex}, ${months}): no placeholder hand and no character.hands length`);
  const female = sex === 'female', adult = months >= G.ADULT_MONTHS;
  const asked = adult ? (c.dna.proportions?.breast_volume ?? null) : null;
  const fem = female ? c.resolved.skeletal_maturity * (asked !== null ? 1 : growth.adultPreset(months)) : 0;
  const fat = Math.max(0, Math.min(1, c.resolved.fat_level.arms));
  return { length, ring, months, fem, fat, source, height: c.dna.height_m ?? null };
}
function sheetAges() {
  const bodies = [['NEWBORN', 'male', 0], ['CHILD OF 6', 'female', 72], ['TEENAGER (15)', 'male', 180], ['ADULT WOMAN (30)', 'female', 360], ['ADULT MAN (30)', 'male', 360], ['ADULT OF 80', 'male', 960]]
    .map(([name, sex, months]) => ({ name, sex, months, body: bodyFromGenerator(sex, months) }));
  const cw = 300, M = 20, top = 104, left = 170;
  const rowsH = [330, 300, 300];
  const S = new Sheet('ages', left + M + bodies.length * (cw + 10), top + 168 + rowsH.reduce((a, b) => a + b, 0) + 3 * 20 + 70);
  header(S, 'AGES AND BODIES - ONE LIBRARY FOR EVERYONE', 'SIX BODIES FROM generate(presetDNA): HAND LENGTH sd.hand, THE FOREARM\'S WRIST RING, AGE, SEX, ARM FAT',
    'A CHILD\'S HAND IS NOT AN ADULT HAND SCALED DOWN (THE AGE FACTORS ARE PROPOSALS); AGE IS NOT FRAILTY');
  const hs = bodies.map((b) => ({ ...b, h2: hand({ pose: 'HP02', mode: 'preset', level: 0, body: b.body }), h6: hand({ pose: 'HP06', mode: 'preset', level: 0, body: b.body }) }));
  // the inputs
  hs.forEach((b, i) => {
    const x = left + i * (cw + 10);
    S.rect(x, 104, cw, 154, { rx: 6, fill: '#f8f9fa', stroke: '#ced4da' });
    S.text(x + cw / 2, 128, b.name, { size: 16, weight: 800, anchor: 'middle' });
    const d = rig.handDimensions(b.body), f = d.factors;
    const lines = [`${b.sex}, ${b.months} months, fem ${b.body.fem.toFixed(2)}, arm fat ${b.body.fat.toFixed(2)}`,
      `hand length ${mm(b.body.length)} mm, palm width ${mm(d.W)} mm`,
      `wrist ring w ${mm(b.body.ring.w)}, f ${mm(b.body.ring.f)}, b ${mm(b.body.ring.b)} mm`,
      `child weight ${f.childWeight.toFixed(2)}: palm width x${f.age.palmWidth.toFixed(3)}`,
      `finger length x${f.age.fingerLength.toFixed(3)}, thickness x${f.age.fingerThickness.toFixed(3)}`,
      `palm thickness x${(f.age.palmThickness * f.fat.palmThickness).toFixed(3)}, thumb length x${f.age.thumbLength.toFixed(3)}`];
    lines.forEach((s, k) => S.text(x + 12, 150 + k * 17, s, { size: 12, fill: k === 1 ? INK : '#3b434b', weight: k === 1 ? 700 : 400 }));
  });
  const realScale = 1280, ref = Math.max(...hs.map((b) => b.body.length));
  let y = top + 168;
  const rowTitles = [['REAL SIZE', 'HP02, palm view, same scale; the forearm\'s end below'], ['NORMALISED', 'HP02, every hand drawn at the same length: the proportions'], ['HP06 TIGHT GRIP', 'normalised; the object\'s radius scales with the hand (data radius x L / 184 mm)']];
  rowTitles.forEach(([t, sub], r) => {
    S.rect(M, y, S.w - 2 * M, rowsH[r] + 6, { rx: 9, stroke: LINE, sw: 1.2, fill: '#fff' });
    S.text(M + 14, y + 30, t, { size: 16, weight: 800 });
    wrapText(S, M + 14, y + 52, sub, 20, { size: 12, fill: MUTED });
    hs.forEach((b, i) => {
      const x = left + i * (cw + 10), h = r === 2 ? b.h6 : b.h2;
      if (!h.ok) { wrapText(S, x + 10, y + 40, errText(h), 40, { size: 12, fill: '#c92a2a' }); return; }
      const k = r === 0 ? realScale : realScale * ref / b.body.length * 0.92, s = b.body.length / rig.REF_LENGTH;
      const center = r === 0 ? [0.01, 0.075, 0] : scl([0.012, 0.085, 0.01], s);
      const meshes = [handMesh(h)];
      if (r === 0) meshes.push(forearm(b.body.ring, 0.14 * b.body.length));
      if (r === 2) meshes.push(...objectMeshes(h, VIEW.q34, b.body));
      const p = renderPanel({ w: cw, h: rowsH[r] - 24, scale: k, center, view: r === 2 ? VIEW.q34 : VIEW.palm, meshes });
      S.put(p, x, y + 4);
      S.text(x + cw / 2, y + rowsH[r] - 4, r === 0 ? `${mm(b.body.length, 0)} mm` : r === 1 ? `x${(k / realScale).toFixed(2)} of real size` : objectText(h), { size: 12, fill: MUTED, anchor: 'middle' });
    });
    if (r === 0) {   // a scale bar
      const x = M + 14, yb = y + rowsH[r] - 30;
      S.line(x, yb, x + 0.1 * realScale, yb, { stroke: INK, sw: 2 });
      for (let t = 0; t <= 10; t++) S.line(x + t * 0.01 * realScale, yb, x + t * 0.01 * realScale, yb - (t % 5 === 0 ? 8 : 4), { stroke: INK, sw: 1.2 });
      S.text(x, yb + 16, '0', { size: 11 }); S.text(x + 0.1 * realScale, yb + 16, '100 mm', { size: 11, anchor: 'middle' });
    }
    y += rowsH[r] + 20;
  });
  const idx = hs.map((b) => b.h2.index.join(','));
  const same = idx.every((s) => s === idx[0]);
  footer(S, `Index identical across the six bodies: ${same ? 'yes' : 'NO'} (${hs[0].h2.triangles} triangles). Hand length source: ${[...new Set(bodies.map((b) => b.body.source))].join(', ')}.`);
  return S;
}

// ================================================================================================================ main
function repoRoot() {
  let dir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (let d = dir; ; d = dirname(d)) { if (existsSync(join(d, '.git'))) return d; if (dirname(d) === d) break; }
  return dir;
}
function realish(p) {   // the real path of the deepest existing ancestor, with the rest appended
  let head = resolve(p), tail = [];
  while (!existsSync(head) && dirname(head) !== head) { tail.unshift(basename(head)); head = dirname(head); }
  return join(realpathSync(head), ...tail);
}
function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log('usage: node tools/hand_sheets.mjs <out dir> [--only name,...]\nsheets: ' + SHEETS.join(', '));
    return args.length ? 0 : 1;
  }
  let out = null, only = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') { only = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean); continue; }
    if (args[i].startsWith('--only=')) { only = args[i].slice(7).split(',').map((s) => s.trim()).filter(Boolean); continue; }
    if (args[i].startsWith('-')) { console.error(`unknown option ${args[i]}`); return 1; }
    if (out) { console.error(`one out dir only (got ${out} and ${args[i]})`); return 1; }
    out = args[i];
  }
  if (!out) { console.error('an out dir is needed'); return 1; }
  const unknown = (only ?? []).filter((s) => !SHEETS.includes(s));
  if (unknown.length) { console.error(`unknown sheet(s): ${unknown.join(', ')} (sheets: ${SHEETS.join(', ')})`); return 1; }
  const repo = realish(repoRoot()), target = realish(out), rel = relative(repo, target);
  if (!rel.startsWith('..') && !isAbsolute(rel)) { console.error(`refused: ${target} is inside the repository (${repo}); write the sheets elsewhere`); return 1; }
  mkdirSync(target, { recursive: true });
  const want = only ?? SHEETS, t0 = Date.now();
  const levels = levelEntries();
  console.log(`levels: ${levels.map((e) => (e.built ? `${e.label.toLowerCase()} ${e.tris} tris` : `level ${e.level} not built (${e.error})`)).join('; ')}`);
  const jobs = [];
  for (const name of want) {
    if (name === 'poses') for (const e of levels.filter((x) => x.built)) jobs.push(() => sheetPoses(e));
    else jobs.push({ exploded: sheetExploded, bones: sheetBones, limits: sheetLimits, wireframes: sheetWireframes, wrist: sheetWrist, objects: sheetObjects, lod: sheetLod, ages: sheetAges }[name]);
  }
  let failed = 0;
  for (const job of jobs) {
    const t = Date.now();
    let S;
    try { S = job(); } catch (e) { failed++; console.error(`FAILED ${job.name}: ${e.stack ?? e}`); continue; }
    const file = join(target, `hand_${S.name}.svg`);
    writeFileSync(file, S.svg());
    console.log(`${file}  ${S.w} x ${S.h}  back faces ${Math.round(S.backPx)} px  ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s${failed ? `, ${failed} failed` : ''}`);
  return failed ? 1 : 0;
}
process.exitCode = main(process.argv);
