// The 22 card marks as plain primitive lists, in one place. The same list generates the GLSL SDF
// (DriftingCard front face) and the inline SVG (Book, CardToast), so the painted 3D mark and the
// ink mark in the book can never drift apart. Pure data + string generation: no three, no React.
//
// Space: y up, the mark sits inside about [-0.8, 0.8]. Primitives:
//   { k: 'L', pts: [[x,y],...], w, closed? }  stroke along a polyline (half-width w)
//   { k: 'C', c: [x,y], r, w }                 ring
//   { k: 'D', c: [x,y], r }                    filled disk
//   { k: 'F', pts: [[x,y],...] }               filled polygon
// Every shape is plain and friendly: emotion, nature, simple geometry. Nothing symbolic beyond that.

const TAU = Math.PI * 2;
const W = 0.075;                     // default ink half-width
const range = (n) => Array.from({ length: n }, (_, i) => i);
const param = (fn, t0, t1, n) => range(n + 1).map((i) => fn(t0 + ((t1 - t0) * i) / n));
const arc = (cx, cy, r, a0, a1, n = 28) => param((a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)], a0, a1, n);
const rot = (pts, a, cx = 0, cy = 0) => pts.map(([x, y]) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; });
const ellipse = (cx, cy, rx, ry, a = 0, n = 36) => rot(param((t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)], 0, TAU, n).slice(0, -1), a, cx, cy);
// teardrop with its tip up; bend > 0 leans the tip to the right
const teardrop = (cx, cy, sx, sy, bend = 0, n = 44) => param((t) => {
  const x = Math.sin(t) * Math.sin(t / 2), y = Math.cos(t), up = (y + 1) / 2;
  return [cx + sx * x + bend * up * up, cy + sy * y];
}, 0, TAU, n).slice(0, -1);
function crescent(R, cx, cy, r) {
  // outer circle (0,0,R) minus inner circle (cx,cy,r): the outer arc away from the bite, then the bite's arc back
  const d = Math.hypot(cx, cy), base = Math.atan2(cy, cx);
  const ao = Math.acos((R * R + d * d - r * r) / (2 * R * d)), ai = Math.acos((r * r + d * d - R * R) / (2 * r * d));
  const outer = arc(0, 0, R, base + ao, base + TAU - ao, 40);
  const inner = arc(cx, cy, r, base + Math.PI + ai, base + Math.PI - ai, 30);
  return [...outer, ...inner.slice(1, -1)];
}

export const SYMBOLS = {
  circle: [{ k: 'C', c: [0, 0], r: 0.56, w: 0.095 }],
  dot: [{ k: 'D', c: [0, 0.02], r: 0.32 }],
  spiral: [{ k: 'L', pts: param((th) => { const r = 0.05 + 0.6 * th / (4.6 * Math.PI); return [r * Math.cos(th + 1.2), r * Math.sin(th + 1.2)]; }, 0, 4.6 * Math.PI, 72), w: 0.068 }],
  wave: [
    { k: 'L', pts: param((x) => [x, 0.24 + 0.14 * Math.sin(x * Math.PI * 1.55 + 0.4)], -0.72, 0.72, 30), w: W },
    { k: 'L', pts: param((x) => [x, -0.2 + 0.14 * Math.sin(x * Math.PI * 1.55 + 0.4)], -0.72, 0.72, 30), w: W },
  ],
  arc: [
    { k: 'L', pts: arc(0, -0.28, 0.58, 0, Math.PI, 30), w: 0.08 },
    { k: 'L', pts: [[-0.74, -0.5], [0.74, -0.5]], w: 0.065 },
  ],
  triangle: [{ k: 'L', pts: [[-0.42, 0.6], [0.64, 0.02], [-0.42, -0.58]], w: 0.08, closed: true }],
  square: [{ k: 'L', pts: rot([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], 0.06), w: 0.08, closed: true }],
  // a plain crossing inside a ring: two paths meet and part
  cross: [
    { k: 'C', c: [0, 0], r: 0.66, w: 0.06 },
    { k: 'L', pts: [[-0.34, -0.34], [0.34, 0.34]], w: 0.085 },
    { k: 'L', pts: [[-0.34, 0.34], [0.34, -0.34]], w: 0.085 },
  ],
  ladder: rot([
    [[-0.3, -0.74], [-0.3, 0.74]], [[0.3, -0.74], [0.3, 0.74]],
    [[-0.3, -0.42], [0.3, -0.42]], [[-0.3, -0.1], [0.3, -0.1]], [[-0.3, 0.22], [0.3, 0.22]], [[-0.3, 0.52], [0.3, 0.52]],
  ].flat(), 0.08).reduce((a, p, i, all) => (i % 2 ? a : [...a, { k: 'L', pts: [p, all[i + 1]], w: i < 4 ? 0.072 : 0.06 }]), []),
  // a simple almond with a dot
  eye: [
    { k: 'L', pts: [...param((x) => [x, 0.34 * (1 - (x / 0.74) ** 2)], -0.74, 0.74, 24), ...param((x) => [x, -0.34 * (1 - (x / 0.74) ** 2)], 0.74, -0.74, 24).slice(1, -1)], w: 0.068, closed: true },
    { k: 'D', c: [0, 0], r: 0.17 },
  ],
  hand: [
    { k: 'D', c: [0, -0.24], r: 0.36 },
    { k: 'L', pts: [[-0.27, -0.1], [-0.28, 0.4]], w: 0.1 },
    { k: 'L', pts: [[-0.09, -0.1], [-0.09, 0.6]], w: 0.1 },
    { k: 'L', pts: [[0.1, -0.1], [0.11, 0.64]], w: 0.1 },
    { k: 'L', pts: [[0.28, -0.12], [0.3, 0.46]], w: 0.095 },
    { k: 'L', pts: [[-0.3, -0.36], [-0.62, 0.02]], w: 0.1 },
  ],
  seed: [
    { k: 'F', pts: ellipse(-0.06, -0.24, 0.3, 0.42, 0.42) },
    { k: 'L', pts: param((t) => [0.08 + 0.2 * t * t, 0.12 + 0.5 * t], 0, 1, 12), w: 0.058 },
    { k: 'F', pts: ellipse(0.42, 0.56, 0.17, 0.075, 0.55, 24) },
  ],
  flame: [
    { k: 'L', pts: teardrop(0, -0.08, 0.5, 0.68, 0.16), w: 0.07, closed: true },
    { k: 'F', pts: teardrop(0.02, -0.32, 0.2, 0.3, 0.05, 28) },
  ],
  drop: [
    { k: 'F', pts: teardrop(0, 0.08, 0.48, 0.62) },
    { k: 'L', pts: param((x) => [x, -0.76 + 0.04 * Math.sin(x * 9)], -0.5, 0.5, 14), w: 0.05 },
  ],
  knot: [
    { k: 'C', c: [-0.25, 0], r: 0.33, w: 0.07 },
    { k: 'C', c: [0.25, 0], r: 0.33, w: 0.07 },
  ],
  // a doorway with two leaves
  gate: [
    { k: 'L', pts: [[-0.46, -0.66], [-0.46, 0.12], ...arc(0, 0.12, 0.46, Math.PI, 0, 22).slice(1, -1), [0.46, 0.12], [0.46, -0.66]], w: 0.075 },
    { k: 'L', pts: [[0, -0.66], [0, 0.56]], w: 0.06 },
    { k: 'L', pts: [[-0.66, -0.68], [0.66, -0.68]], w: 0.06 },
  ],
  scale: [
    { k: 'L', pts: [[0, -0.64], [0, 0.5]], w: 0.07 },
    { k: 'L', pts: [[-0.3, -0.66], [0.3, -0.66]], w: 0.07 },
    { k: 'L', pts: [[-0.62, 0.42], [0.62, 0.42]], w: 0.065 },
    { k: 'L', pts: [[-0.55, 0.42], [-0.55, 0.02]], w: 0.04 },
    { k: 'L', pts: [[0.55, 0.42], [0.55, 0.02]], w: 0.04 },
    { k: 'L', pts: arc(-0.55, 0.02, 0.22, Math.PI, TAU, 16), w: 0.065 },
    { k: 'L', pts: arc(0.55, 0.02, 0.22, Math.PI, TAU, 16), w: 0.065 },
  ],
  // five curved spokes: something turning
  wheel: [
    { k: 'C', c: [0, 0], r: 0.62, w: 0.075 },
    { k: 'D', c: [0, 0], r: 0.13 },
    ...range(5).map((i) => ({ k: 'L', pts: param((r) => { const a = 0.3 + (i * TAU) / 5 + 0.9 * (r - 0.12); return [r * Math.cos(a), r * Math.sin(a)]; }, 0.12, 0.6, 10), w: 0.055 })),
  ],
  moon: [{ k: 'F', pts: rot(crescent(0.6, 0.3, 0.14, 0.5), -0.25) }],
  sun: [
    { k: 'D', c: [0, 0], r: 0.3 },
    ...range(8).map((i) => { const a = (i * TAU) / 8 + 0.2; return { k: 'L', pts: [[0.45 * Math.cos(a), 0.45 * Math.sin(a)], [0.7 * Math.cos(a), 0.7 * Math.sin(a)]], w: 0.062 }; }),
  ],
  // a four-pointed sparkle
  star: [{ k: 'F', pts: rot(param((t) => { const r = 0.12 + 0.62 * Math.abs(Math.cos(2 * t)) ** 5; return [r * Math.cos(t), r * Math.sin(t)]; }, 0, TAU, 96).slice(0, -1), 0.12) }],
  // a hand mirror with a glint
  mirror: [
    { k: 'L', pts: rot(ellipse(0, 0.2, 0.38, 0.46), 0.22, 0, 0), w: 0.075, closed: true },
    { k: 'L', pts: rot([[0, -0.28], [0, -0.8]], 0.22), w: 0.095 },
    { k: 'L', pts: rot([[-0.2, 0.3], [-0.06, 0.48]], 0.22), w: 0.045 },
  ],
};

export const SYMBOL_IDS = Object.keys(SYMBOLS);
export const symbolIndex = (id) => Math.max(0, SYMBOL_IDS.indexOf(id));

/* ------------------------------------------------------------ GLSL */

const f = (v) => { const s = (+v).toFixed(3); return s.includes('.') ? s : s + '.0'; };
const v2 = ([x, y]) => `vec2(${f(x)},${f(y)})`;
function primGLSL(p) {
  if (p.k === 'C') return `d=min(d,abs(length(p-${v2(p.c)})-${f(p.r)})-${f(p.w)});`;
  if (p.k === 'D') return `d=min(d,length(p-${v2(p.c)})-${f(p.r)});`;
  const pts = p.k === 'F' || p.closed ? [...p.pts, p.pts[0]] : p.pts;
  if (p.k === 'L') return range(pts.length - 1).map((i) => `d=min(d,cd_seg(p,${v2(pts[i])},${v2(pts[i + 1])})-${f(p.w)});`).join('');
  // filled polygon: exact distance with winding sign
  return `{float dd=1e9,s=1.0;${range(pts.length - 1).map((i) => `cd_edge(p,${v2(pts[i + 1])},${v2(pts[i])},dd,s);`).join('')}d=min(d,s*sqrt(dd));}`;
}
/** GLSL source: `float cd_symbol(vec2 p, float id)` (needs cd_seg / cd_edge, defined in card.common.glsl). */
export function symbolGLSL() {
  const fns = SYMBOL_IDS.map((id, i) => `float cd_sym${i}(vec2 p){float d=1e9;${SYMBOLS[id].map(primGLSL).join('')}return d;}`).join('\n');
  const pick = SYMBOL_IDS.map((_, i) => `if(id<${i}.5)return cd_sym${i}(p);`).join('');
  return `${fns}\nfloat cd_symbol(vec2 p,float id){${pick}return 1e9;}\n`;
}

/* ------------------------------------------------------------ SVG */

const n2 = (v) => +(+v).toFixed(3);
const path = (pts, close) => `M${pts.map(([x, y]) => `${n2(x)} ${n2(y)}`).join('L')}${close ? 'Z' : ''}`;
/** SVG element descriptors for a symbol (y up; wrap in scale(1,-1)). [{ tag, attrs }] */
export function symbolSVG(id) {
  return (SYMBOLS[id] || SYMBOLS.circle).map((p) => {
    if (p.k === 'C') return { tag: 'circle', attrs: { cx: p.c[0], cy: p.c[1], r: p.r, fill: 'none', strokeWidth: p.w * 2 } };
    if (p.k === 'D') return { tag: 'circle', attrs: { cx: p.c[0], cy: p.c[1], r: p.r, stroke: 'none' } };
    if (p.k === 'F') return { tag: 'path', attrs: { d: path(p.pts, true), stroke: 'none' } };
    return { tag: 'path', attrs: { d: path(p.pts, p.closed), fill: 'none', strokeWidth: p.w * 2 } };
  });
}
