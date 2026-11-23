// Lineage map renderer (PixiJS v8). Lazy-loaded by src/ui/Lineage.jsx, so pixi never lands in the main bundle.
// A radial painting: ten family directions, every live unit as a painted node with its genome tree
// branching outward to the family leaves, mutations as satellites, and consumed ancestors as blurred ghosts.
import {
  Application, Container, Graphics, Sprite, Texture, Text, Circle,
  DisplacementFilter, BlurFilter, ColorMatrixFilter,
} from 'pixi.js';
import { FAMILY, FAMILIES, LINKS } from '../../game/data.js';
import { leafCount } from '../../game/genome.js';
import { MUTATION } from '../../game/content/mutations.js';
import { unitColors, ASPECT_TONES } from '../../gfx/palettes/families.js';
import { mixStagePalette, linearToSrgb } from '../../gfx/palettes/stages.js';
import { TONES } from '../type/tones.js';
import { mood } from '../../gfx/mood.js';
import { lineage, ancestry, snapUnit } from './log.js';
import { LINEAGE_TEXT } from './text.js';

// ---------- colour ----------
const hexN = (h) => parseInt(h.slice(1), 16);
const T = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, hexN(v)]));
const c255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgbN = (c) => (c255(c[0]) << 16) | (c255(c[1]) << 8) | c255(c[2]);
const splitN = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const mixN = (a, b, t) => { const x = splitN(a), y = splitN(b); return rgbN(x.map((v, i) => v + (y[i] - v) * t)); };
const gradeOf = (link) => Math.round(4 + ((link - 1) * 8) / 11); // same remap as sculpt.js
const OP_TONE = { link: T.ultra, integrate: T.teal, subtract: T.blood, split: T.violet, repurpose: T.tangerine, ending: T.leaf };

// ---------- genome helpers (weights mirror genome.js) ----------
function weights(g, w = 1, out = []) {
  if (g.t === 'leaf') out.push([g, w]);
  else {
    const wb = g.op === 'carve' ? 0.35 : 0.5;
    weights(g.a, w * (1 - wb) * (g.op === 'carve' ? 1.25 : 1.15), out);
    weights(g.b, w * wb * 1.15, out);
  }
  return out;
}
const headOf = (g) => weights(g).sort((x, y) => y[1] - x[1])[0][0];
function colorsOf(leafG, link) {
  const c = unitColors(leafG.f, gradeOf(link));
  let a = rgbN(c.a), b = rgbN(c.b), h = rgbN(c.c);
  if (leafG.pole > 0) { a = mixN(a, T.paper, 0.45); b = mixN(b, T.paper, 0.45); }
  if (leafG.pole < 0) { a = mixN(a, T.ink, 0.45); b = mixN(b, T.ink, 0.45); }
  return { a, b, c: h, glow: c.glow };
}
const angleOf = (dir) => -Math.PI / 2 + (dir * Math.PI) / 5;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- brush ----------
function cubic(p0, p1, p2, p3, n = 14) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
      m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
function offsetPts(pts, amp, freq, phase = 0) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const o = amp * Math.sin(phase + (i / (pts.length - 1)) * Math.PI * freq);
    return [p[0] - ty * o, p[1] + tx * o];
  });
}
// A tapered stroke of paint: filled ribbon with a slight bristle wobble in its width.
function ribbon(gr, pts, w0, w1, color, alpha = 1, seed = 0) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const k = i / (pts.length - 1);
    const w = (w0 + (w1 - w0) * k) * (0.86 + 0.14 * Math.sin(seed + i * 1.9)) * 0.5;
    L.push(pts[i][0] - ty * w, pts[i][1] + tx * w); R.push(pts[i][0] + ty * w, pts[i][1] - tx * w);
  }
  const poly = L.slice();
  for (let i = R.length - 2; i >= 0; i -= 2) poly.push(R[i], R[i + 1]);
  gr.poly(poly).fill({ color, alpha });
}
function line(gr, pts, width, color, alpha = 1) {
  gr.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gr.lineTo(pts[i][0], pts[i][1]);
  gr.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}
function dashed(gr, pts, width, color, alpha = 1, on = 2) {
  for (let i = 0; i + 1 < pts.length; i += on + 1) line(gr, pts.slice(i, i + on + 1), width, color, alpha);
}

// ---------- unit bodies: the shape hints the family form ----------
function drawBody(gr, form, r, col, w = 2.5) {
  const ink = { width: w, color: T.ink, join: 'round' };
  switch (form) {
    case 'lens':
      gr.ellipse(0, 0, r * 1.28, r * 0.78).fill(col.a).stroke(ink);
      gr.ellipse(-r * 0.25, -r * 0.18, r * 0.55, r * 0.26).fill({ color: col.b, alpha: 0.95 });
      break;
    case 'slab':
      gr.roundRect(-r, -r * 0.8, 2 * r, 1.6 * r, r * 0.28).fill(col.a).stroke(ink);
      gr.roundRect(-r * 0.7, -r * 0.18, r * 1.4, r * 0.36, r * 0.12).fill(col.b);
      break;
    case 'knot': {
      const p = []; for (let i = 0; i < 48; i++) { const t = (i / 48) * Math.PI * 2, rr = r * (0.8 + 0.26 * Math.sin(3 * t)); p.push(Math.cos(t) * rr, Math.sin(t) * rr); }
      gr.poly(p).fill(col.a).stroke(ink);
      gr.circle(0, 0, r * 0.34).fill(col.b).stroke({ width: 1.5, color: T.ink });
      break;
    }
    case 'shard':
      gr.poly([0, -r * 1.25, r * 0.95, r * 0.6, -r * 0.7, r * 0.85]).fill(col.a).stroke(ink);
      gr.poly([0, -r * 0.6, r * 0.4, r * 0.35, -r * 0.3, r * 0.45]).fill({ color: col.b, alpha: 0.9 });
      break;
    case 'rings':
      gr.circle(0, 0, r).fill(col.a).stroke(ink);
      gr.circle(0, 0, r * 0.64).stroke({ width: 3, color: col.b });
      gr.circle(0, 0, r * 0.28).fill(col.c).stroke({ width: 1.5, color: T.ink });
      break;
    case 'spike':
      gr.star(0, 0, 7, r * 1.25, r * 0.58).fill(col.a).stroke(ink);
      gr.circle(0, 0, r * 0.34).fill(col.b);
      break;
    case 'shell': {
      gr.circle(0, 0, r).fill(col.a).stroke(ink);
      const p = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.2, rr = r * 0.85 * (1 - t); p.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      line(gr, p, 2.4, col.b);
      break;
    }
    case 'flame':
      gr.moveTo(0, -r * 1.35).bezierCurveTo(r * 1.15, -r * 0.2, r * 0.95, r * 0.95, 0, r * 0.95)
        .bezierCurveTo(-r * 0.95, r * 0.95, -r * 1.15, -r * 0.2, 0, -r * 1.35).closePath().fill(col.a).stroke(ink);
      gr.moveTo(0, -r * 0.4).bezierCurveTo(r * 0.5, r * 0.1, r * 0.45, r * 0.7, 0, r * 0.7)
        .bezierCurveTo(-r * 0.45, r * 0.7, -r * 0.5, r * 0.1, 0, -r * 0.4).closePath().fill(col.b);
      break;
    case 'bowl':
      gr.arc(0, -r * 0.2, r * 1.1, 0, Math.PI).closePath().fill(col.a).stroke(ink);
      gr.moveTo(-r * 1.25, -r * 0.2).lineTo(r * 1.25, -r * 0.2).stroke({ width: 3.2, color: col.b, cap: 'round' });
      gr.circle(0, -r * 0.55, r * 0.3).fill(col.c).stroke({ width: 1.5, color: T.ink });
      break;
    case 'orbit':
      gr.circle(0, 0, r * 1.18).stroke({ width: 1.4, color: T.ink, alpha: 0.6 });
      gr.circle(0, 0, r * 0.8).fill(col.a).stroke(ink);
      gr.circle(r * 0.84, -r * 0.84, r * 0.27).fill(col.b).stroke({ width: 1.5, color: T.ink });
      break;
    default:
      gr.circle(0, 0, r).fill(col.a).stroke(ink);
  }
}

// ---------- genome tree, laid out outward from the node (u = outward, v = lateral) ----------
const LEAF_GAP = 15, LEVEL = 22;
function layoutTree(g) {
  let li = 0; const out = [];
  const maxD = (n) => (n.t === 'leaf' ? 0 : 1 + Math.max(maxD(n.a), maxD(n.b)));
  const D = maxD(g);
  const walk = (n, lvl) => {
    if (n.t === 'leaf') { const o = { n, u: D * LEVEL, v: li++ * LEAF_GAP, kids: [] }; out.push(o); return o; }
    const a = walk(n.a, lvl + 1), b = walk(n.b, lvl + 1);
    const o = { n, u: lvl * LEVEL, v: (a.v + b.v) / 2, kids: [a, b] }; out.push(o); return o;
  };
  const root = walk(g, 0);
  const mid = ((li - 1) * LEAF_GAP) / 2;
  for (const o of out) o.v -= mid;
  return { root, nodes: out, depth: D, width: li * LEAF_GAP };
}
function drawTree(gr, g, link, startU, seed) {
  const L = layoutTree(g);
  const P = (o) => [startU + o.u, o.v];
  const stub = cubic([0, 0], [startU * 0.4, 0], [startU * 0.7, 0], P(L.root), 6);
  ribbon(gr, stub, 5, 4, colorsOf(headOf(g), link).a, 0.95, seed);
  const edge = (p, k, isB) => {
    const a = P(p), b = P(k), du = b[0] - a[0];
    const pts = cubic(a, [a[0] + du * 0.55, a[1]], [b[0] - du * 0.45, b[1]], b, 12);
    const kc = colorsOf(headOf(k.n), link);
    const op = p.n.op;
    if (op === 'carve' && isB) {
      // the carved-in part: a hard ink wedge with a paper cut down its middle
      ribbon(gr, pts, 5.5, 1.2, T.ink, 0.95, seed + 3);
      line(gr, pts.slice(2, -2), 1.1, T.paper, 0.95);
    } else if (op === 'mix') {
      ribbon(gr, offsetPts(pts, 2.6, 3, seed), 4, 2.4, kc.a, 0.9, seed + 1);
      line(gr, offsetPts(pts, -2.2, 3, seed), 1.1, kc.b, 0.9);
    } else {
      // blend: two strands braided into one
      ribbon(gr, pts, 4.2, 2.6, kc.a, 0.92, seed + 2);
      line(gr, offsetPts(pts, 1.8, 2, seed + (isB ? 1.5 : 0)), 1.2, kc.b, 0.95);
    }
  };
  for (const o of L.nodes) if (o.kids.length) { edge(o, o.kids[0], false); edge(o, o.kids[1], true); }
  for (const o of L.nodes) {
    const [x, y] = P(o);
    if (o.n.t === 'leaf') {
      const c = colorsOf(o.n, link);
      gr.circle(x + 3, y, 5.6).fill(c.a).stroke({ width: 1.6, color: T.ink });
      if (o.n.pole > 0) gr.circle(x + 3, y - 1.5, 1.8).fill(T.paper);
      if (o.n.pole < 0) gr.circle(x + 3, y, 1.9).fill(T.ink);
    } else {
      gr.circle(x, y, o.n.op === 'carve' ? 2.6 : 2.2).fill(o.n.op === 'carve' ? T.ink : T.paper).stroke({ width: 1.2, color: T.ink });
    }
  }
  return L;
}

// ---------- noise texture for the wet-paint wobble ----------
function noiseTexture(size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  const G = 8, grid = Array.from({ length: (G + 1) * (G + 1) * 2 }, (_, i) => hash(i + 1));
  const at = (gx, gy, ch) => grid[((gy % G) * (G + 1) + (gx % G)) * 2 + ch];
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * G, fy = (y / size) * G, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const o = (y * size + x) * 4;
    for (let ch = 0; ch < 2; ch++) {
      const a = at(ix, iy, ch), b = at(ix + 1, iy, ch), c = at(ix, iy + 1, ch), d = at(ix + 1, iy + 1, ch);
      img.data[o + ch] = Math.round(255 * (a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty));
    }
    img.data[o + 2] = 128; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(cv);
  tex.source.addressMode = 'repeat';
  return tex;
}

// ---------- the scene ----------
const R_SEED = 104, R_UNIT = 215, R_GHOST = 470;

export async function createLineageScene(host, { getGame, getSelected, onHover, onSelect }) {
  const app = new Application();
  await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl' });
  try { await document.fonts?.ready; } catch { /* fonts optional */ }
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';

  const world = new Container();
  const ground = new Container(), ghostLayer = new Container(), liveLayer = new Container();
  const ghostEdges = new Graphics(), liveEdges = new Graphics();
  ghostLayer.addChild(ghostEdges);
  world.addChild(ground, ghostLayer, liveEdges, liveLayer);
  app.stage.addChild(world);

  // filters: wet wobble on everything, blur on the past, overwhelm drains the colour
  const noise = new Sprite(noiseTexture()); noise.renderable = false; noise.scale.set(2.2);
  app.stage.addChild(noise);
  const wobble = new DisplacementFilter({ sprite: noise, scale: 5 });
  const drain = new ColorMatrixFilter();
  world.filters = [wobble, drain];
  ghostLayer.filters = [new BlurFilter({ strength: 1.6, quality: 2 })];
  ghostLayer.alpha = 0.5;

  const nodes = new Map(); // id -> { c, p:[x,y], anchor, r, ghost, snap, ... }
  let sig = '', selRing = null, t0 = performance.now(), hovered = null, endings = -1;

  // ---- ground: center, family seeds, spokes ----
  const center = new Graphics(), centerRing = new Graphics();
  function drawGround() {
    ground.removeChildren().forEach((c) => c.destroy({ children: true }));
    const spokes = new Graphics();
    for (const f of FAMILIES) {
      const a = angleOf(f.dir), c = colorsOf({ f: f.id, pole: 0 }, 6);
      const pts = [[Math.cos(a) * 150, Math.sin(a) * 150], [Math.cos(a) * 620, Math.sin(a) * 620]];
      const seg = []; for (let i = 0; i <= 40; i++) seg.push([pts[0][0] + (pts[1][0] - pts[0][0]) * i / 40, pts[0][1] + (pts[1][1] - pts[0][1]) * i / 40]);
      dashed(spokes, seg, 2, c.a, 0.28, 1);
      const seed = new Graphics(); drawBody(seed, f.form, 8, c, 2); seed.position.set(Math.cos(a) * R_SEED, Math.sin(a) * R_SEED);
      const label = new Text({ text: f.name, style: { fontFamily: 'Londrina Solid', fontSize: 14, fill: T['ink-2'], letterSpacing: 0.5 }, resolution: 3 });
      label.anchor.set(0.5); label.position.set(Math.cos(a) * (R_SEED + 34), Math.sin(a) * (R_SEED + 26)); label.alpha = 0.85;
      ground.addChild(seed, label);
    }
    // outer faint ring: where the gone are kept
    const ring = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; ring.push([Math.cos(a) * R_GHOST, Math.sin(a) * R_GHOST]); }
    dashed(spokes, ring, 1.4, T['ink-2'], 0.14, 1);
    ground.addChildAt(spokes, 0);
    ground.addChild(center, centerRing);
  }
  function drawCenter(G) {
    const p = mixStagePalette(Math.min(17, mood.stage || G.stage || 0));
    const s = (c) => rgbN(c.map(linearToSrgb));
    center.clear();
    center.circle(0, 0, 52).fill(s(p.primary)).stroke({ width: 3, color: T.ink });
    center.circle(0, 0, 37).stroke({ width: 2.5, color: T.paper });
    center.circle(0, 0, 33).fill(s(p.secondary));
    center.circle(0, 0, 18).fill(s(p.accent)).stroke({ width: 2, color: T.paper });
    centerRing.clear();
    const n = G.endings || 0;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; centerRing.moveTo(Math.cos(a) * 62, Math.sin(a) * 62).lineTo(Math.cos(a + 0.12) * 62, Math.sin(a + 0.12) * 62); }
    centerRing.stroke({ width: 2, color: T.ink, alpha: 0.45, cap: 'round' });
    for (let i = 0; i < Math.min(40, n); i++) { const a = (i / Math.max(8, n)) * Math.PI * 2; centerRing.circle(Math.cos(a) * 70, Math.sin(a) * 70, 3).fill(T.paper).stroke({ width: 1.2, color: T.ink }); }
  }

  // ---- notes ----
  const bornBy = () => { const m = new Map(); for (const e of lineage.log) if (e.id != null && (e.type === 'integrate' || e.type === 'subtract')) m.set(e.id, e.type); for (const e of lineage.log) if (e.to) for (const d of e.to) m.set(d, 'split'); return m; };
  function noteLive(u, born) {
    if (u.link > 1) return LINKS[u.link - 1].text;
    if (born.has(u.id)) return LINEAGE_TEXT.born[born.get(u.id)];
    return FAMILY[headOf(u.g).f].text;
  }

  // ---- build nodes ----
  function makeNode(id, snap, ghost, born, G) {
    const g = snap.g, head = headOf(g), fam = FAMILY[head.f], col = colorsOf(head, snap.link);
    const leavesN = leafCount(g);
    const r = (ghost ? 0.75 : 1) * (11 + 1.8 * fam.tier + 1.4 * leavesN);
    const c = new Container();
    const art = new Container(); c.addChild(art);
    const tree = new Graphics(), body = new Graphics(), rings = new Graphics(), sats = new Graphics();
    const ringsN = ghost ? 1 : snap.link, ringR = r + 5 + ringsN * 3.3;
    // a soft glow for the late links
    if (!ghost && col.glow > 0.05) body.circle(0, 0, ringR + 6).fill({ color: col.c, alpha: 0.25 * col.glow });
    drawBody(body, fam.form, r, col);
    for (let i = 1; i <= ringsN; i++) rings.circle(0, 0, r + 4 + i * 3.3).stroke({ width: 1.7, color: i % 2 ? col.b : T.paper, alpha: 0.95 });
    if (!ghost && ringsN) rings.circle(0, 0, ringR + 1.2).stroke({ width: 1.2, color: T.ink, alpha: 0.5 });
    let treeLen = 0, treeW = 0;
    if (!ghost) {
      const L = drawTree(tree, g, snap.link, ringR + 6, id);
      treeLen = ringR + 6 + L.depth * LEVEL + 10; treeW = L.width;
    }
    // mutations: small satellites in the tone of their aspect
    const muts = snap.muts || [];
    muts.forEach((m, i) => {
      const M = MUTATION[m]; if (!M) return;
      const a = Math.PI * 0.75 + (i - (muts.length - 1) / 2) * 0.42, rr = ringR + 9;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr, tone = hexN(ASPECT_TONES[M.aspect] || TONES.ink);
      if (M.rarity >= 3) sats.star(x, y, 5, 5.4, 2.4).fill(tone).stroke({ width: 1.2, color: T.ink });
      else if (M.rarity === 2) sats.poly([x, y - 4.6, x + 3.6, y, x, y + 4.6, x - 3.6, y]).fill(tone).stroke({ width: 1.2, color: T.ink });
      else sats.circle(x, y, 3.2).fill(tone).stroke({ width: 1.2, color: T.ink });
    });
    const treeC = new Container(); treeC.addChild(tree);
    art.addChild(treeC, rings, body, sats);
    c.eventMode = 'static'; c.cursor = ghost ? 'help' : 'pointer';
    c.hitArea = new Circle(0, 0, ringR + 4);
    const old = nodes.get(id);
    const dir = fam.dir, jitter = (hash(id) - 0.5) * 0.5;
    const n = {
      id, c, art, treeC, ghost, snap, r: ringR, treeLen, treeW, dir, jitter, phase: hash(id + 9) * 6.28,
      p: old ? old.p : null, cause: snap.gone?.why,
      title: snap.full || snap.name,
      note: ghost ? LINEAGE_TEXT.gone[snap.gone?.why] || '' : noteLive(snap, born),
      meta: `link ${snap.link} · ${leavesN} gene${leavesN > 1 ? 's' : ''}${muts.length ? ` · ${muts.length} mark${muts.length > 1 ? 's' : ''}` : ''}`,
      tone: Object.keys(TONES).find((k) => fam.colors[0] === k) || 'ink',
    };
    c.on('pointerover', (e) => { hovered = n; onHover?.({ x: e.global.x, y: e.global.y, title: n.title, note: n.note, meta: n.meta, tone: n.tone, ghost }); });
    c.on('pointermove', (e) => { if (hovered === n) onHover?.({ x: e.global.x, y: e.global.y, title: n.title, note: n.note, meta: n.meta, tone: n.tone, ghost }); });
    c.on('pointerout', () => { if (hovered === n) { hovered = null; onHover?.(null); } });
    c.on('pointertap', () => { if (!ghost && !drag.moved) onSelect?.(id); });
    return n;
  }

  function rebuild(G) {
    const born = bornBy();
    for (const u of G.units) snapUnit(u, G.t);
    const live = G.units.filter((u) => !u.busy || true);
    const liveIds = new Set(live.map((u) => u.id));
    const ghosts = [...lineage.snaps.values()].filter((s) => s.gone && !liveIds.has(s.id)).sort((a, b) => b.gone.t - a.gone.t).slice(0, 70);
    const keep = new Map();
    for (const u of live) keep.set(u.id, makeNode(u.id, lineage.snaps.get(u.id), false, born, G));
    for (const s of ghosts) keep.set(s.id, makeNode(s.id, s, true, born, G));
    for (const [, n] of nodes) n.c.destroy({ children: true });
    nodes.clear();
    liveLayer.removeChildren(); ghostLayer.removeChildren(); ghostLayer.addChild(ghostEdges);
    for (const [id, n] of keep) { nodes.set(id, n); (n.ghost ? ghostLayer : liveLayer).addChild(n.c); }
    // ghost -> descendants
    const edges = ancestry();
    for (const n of nodes.values()) n.down = [];
    for (const e of edges) { const a = nodes.get(e.from); if (a && a.ghost && nodes.has(e.to)) a.down.push({ id: e.to, kind: e.kind }); }
    // sibling index among ghosts feeding the same descendant, to fan them
    const fan = new Map();
    for (const n of nodes.values()) if (n.ghost && n.down.length) { const k = n.down[0].id; const i = fan.get(k) || 0; fan.set(k, i + 1); n.fan = i; }
    for (const n of nodes.values()) if (!n.p) n.p = initialPos(n);
    drawCenter(G);
  }

  function anchorOf(n) {
    if (!n.ghost) {
      const a = angleOf(n.dir) + n.jitter, rr = R_UNIT + 18 * leafCount(n.snap.g) + 4 * n.snap.link;
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    }
    const downs = n.down.map((d) => nodes.get(d.id)).filter((d) => d && d.p);
    if (downs.length) {
      const mx = downs.reduce((s, d) => s + d.p[0], 0) / downs.length, my = downs.reduce((s, d) => s + d.p[1], 0) / downs.length;
      // ghosts fan around what they became, in a small half-crown on the far side of it
      const f = n.fan || 0, side = f % 2 ? 1 : -1, step = Math.ceil(f / 2);
      const base = Math.atan2(my, mx), dist = (downs[0].ghost ? 48 : 70) + 16 * Math.floor(f / 6);
      const a = base + side * step * 0.55;
      return [mx + Math.cos(a) * dist, my + Math.sin(a) * dist];
    }
    const a = angleOf(n.dir) + n.jitter * 1.5;
    const rr = n.cause === 'ending' ? 82 : n.cause === 'repurpose' ? 150 : R_GHOST + 30 * hash(n.id + 3);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  }
  const initialPos = (n) => { const a = anchorOf(n); return [a[0] + (hash(n.id + 1) - 0.5) * 20, a[1] + (hash(n.id + 2) - 0.5) * 20]; };
  // collision circle: body plus half the tree, pushed outward along the radial
  function hull(n) {
    const a = Math.atan2(n.p[1], n.p[0]), off = n.treeLen * 0.42;
    return [n.p[0] + Math.cos(a) * off, n.p[1] + Math.sin(a) * off, Math.max(n.r, n.treeLen * 0.5, n.treeW * 0.5 + 4) + 4];
  }
  function relax(iter = 1) {
    const list = [...nodes.values()];
    for (let it = 0; it < iter; it++) {
      for (const n of list) {
        const a = anchorOf(n), k = n.ghost ? 0.05 : 0.04;
        n.p[0] += (a[0] - n.p[0]) * k; n.p[1] += (a[1] - n.p[1]) * k;
        const d = Math.hypot(n.p[0], n.p[1]), min = n.ghost && (n.cause === 'ending') ? 70 : n.ghost ? 120 : 165;
        if (d < min) { const s = min / (d || 1); n.p[0] *= s; n.p[1] *= s; }
      }
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < list.length; i++) {
        const A = list[i], ha = hull(A);
        for (let j = i + 1; j < list.length; j++) {
          const B = list[j], hb = hull(B);
          let dx = hb[0] - ha[0], dy = hb[1] - ha[1]; const d = Math.hypot(dx, dy) || 0.01, need = ha[2] + hb[2];
          if (d >= need) continue;
          dx /= d; dy /= d; const push = (need - d) * 0.5;
          const wa = A.ghost && !B.ghost ? 1 : !A.ghost && B.ghost ? 0 : 0.5;
          A.p[0] -= dx * push * wa * 2; A.p[1] -= dy * push * wa * 2;
          B.p[0] += dx * push * (1 - wa) * 2; B.p[1] += dy * push * (1 - wa) * 2;
        }
      }
    }
  }

  function drawEdges() {
    ghostEdges.clear(); liveEdges.clear();
    for (const n of nodes.values()) {
      if (!n.ghost) continue;
      const tone = OP_TONE[n.cause] || T['ink-2'];
      const targets = n.down.map((d) => nodes.get(d.id)).filter(Boolean).map((d) => d.p);
      if (!targets.length && n.cause === 'ending') targets.push([0, 0]);
      if (!targets.length && n.cause === 'repurpose') { const a = angleOf(n.dir); targets.push([Math.cos(a) * R_SEED, Math.sin(a) * R_SEED]); }
      for (const tp of targets) {
        const a = n.p, mid = [(a[0] + tp[0]) / 2, (a[1] + tp[1]) / 2], bend = 0.18;
        const ctl = [mid[0] - (tp[1] - a[1]) * bend, mid[1] + (tp[0] - a[0]) * bend];
        const pts = cubic(a, ctl, ctl, tp, 18);
        dashed(ghostEdges, pts, 3, tone, 0.85, 1);
      }
    }
  }

  function selection() {
    const id = getSelected?.();
    if (selRing) { selRing.destroy(); selRing = null; }
    const n = id != null && nodes.get(id);
    if (!n) return;
    selRing = new Graphics();
    const pts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push([Math.cos(a) * (n.r + 7), Math.sin(a) * (n.r + 7)]); }
    dashed(selRing, pts, 3.2, T.magenta, 1, 2);
    n.c.addChild(selRing);
  }

  function sync() {
    const G = getGame(); if (!G) return;
    const s = G.units.map((u) => `${u.id}:${u.link}:${(u.muts || []).length}:${u.g === lineage.snaps.get(u.id)?.g ? 1 : 0}`).join(',') + `|${lineage.rev}|${getSelected?.()}`;
    if (s !== sig) {
      const first = !sig;
      sig = s; rebuild(G); selection();
      if (first) { relax(260); fit(); }
    }
    if (endings !== G.endings) { endings = G.endings; drawCenter(G); }
  }

  // ---- view: pan, zoom, pinch ----
  const view = { x: 0, y: 0, s: 1 };
  const applyView = () => { world.position.set(view.x, view.y); world.scale.set(view.s); };
  function fit() {
    const w = app.screen.width, h = app.screen.height;
    let x0 = -180, x1 = 180, y0 = -180, y1 = 180;
    const live = [...nodes.values()].filter((n) => !n.ghost);
    for (const n of live.length ? live : nodes.values()) { const hh = hull(n); x0 = Math.min(x0, hh[0] - hh[2]); x1 = Math.max(x1, hh[0] + hh[2]); y0 = Math.min(y0, hh[1] - hh[2]); y1 = Math.max(y1, hh[1] + hh[2]); }
    view.s = Math.max(0.3, Math.min(1.8, Math.min(w / (x1 - x0 + 80), (h - 150) / (y1 - y0 + 60))));
    view.x = w / 2 - ((x0 + x1) / 2) * view.s; view.y = h / 2 - ((y0 + y1) / 2) * view.s;
    applyView();
  }
  const zoomAt = (sx, sy, f) => {
    const ns = Math.max(0.2, Math.min(4, view.s * f)); f = ns / view.s;
    view.x = sx - (sx - view.x) * f; view.y = sy - (sy - view.y) * f; view.s = ns; applyView();
  };
  const drag = { pts: new Map(), moved: false, last: null, dist: 0 };
  const cv = app.canvas;
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onWheel = (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0015)); };
  const onDown = (e) => { drag.pts.set(e.pointerId, local(e)); if (drag.pts.size === 1) drag.moved = false; if (drag.pts.size === 2) { const [a, b] = [...drag.pts.values()]; drag.dist = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
  const onMove = (e) => {
    drag.at = local(e);
    if (!drag.pts.has(e.pointerId)) return;
    const prev = drag.pts.get(e.pointerId), cur = local(e);
    if (drag.pts.size === 1) {
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 0) { view.x += dx; view.y += dy; applyView(); }
      drag.total = (drag.total || 0) + Math.abs(dx) + Math.abs(dy); if (drag.total > 5) drag.moved = true;
    }
    drag.pts.set(e.pointerId, cur);
    if (drag.pts.size === 2) {
      const [a, b] = [...drag.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (drag.dist) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / drag.dist);
      drag.dist = d; drag.moved = true;
    }
  };
  const onUp = (e) => { drag.pts.delete(e.pointerId); if (!drag.pts.size) { drag.total = 0; setTimeout(() => { drag.moved = false; }, 0); } };
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);

  drawGround();
  sync();

  // ---- the living part ----
  let frames = 0;
  app.ticker.add((tk) => {
    const t = (performance.now() - t0) / 1000, G = getGame();
    frames++; if (typeof window !== 'undefined') window.__lineageFrames = frames;
    relax(1);
    for (const n of nodes.values()) {
      n.c.position.set(n.p[0], n.p[1]);
      n.treeC.rotation = Math.atan2(n.p[1], n.p[0]);
      const br = 1 + 0.025 * Math.sin(t * 1.3 + n.phase);
      n.art.scale.set(br);
    }
    if (hovered && drag.at) {
      // the pointer left the node without pixi noticing (fast drags, zoom): drop the tip
      const sx = view.x + hovered.p[0] * view.s, sy = view.y + hovered.p[1] * view.s;
      if (drag.moved || Math.hypot(drag.at[0] - sx, drag.at[1] - sy) > (hovered.r + 8) * view.s) { hovered = null; onHover?.(null); }
    }
    if (selRing) { selRing.rotation = t * 0.6; selRing.scale.set(1 + 0.06 * Math.sin(t * 4)); }
    drawEdges();
    centerRing.rotation = t * 0.08;
    noise.x = (noise.x + tk.deltaTime * 0.35) % 512; noise.y = (noise.y + tk.deltaTime * 0.22) % 512;
    const ov = G ? G.overwhelm || 0 : 0;
    wobble.scale.x = wobble.scale.y = 4 + 6 * ov;
    drain.reset(); drain.saturate(-0.85 * ov, false); if (ov > 0.5) drain.contrast((ov - 0.5) * 0.4, true);
  });

  return {
    app, sync, fit,
    // screen positions of live nodes (CSS px inside the canvas), for tests and the gallery
    points: () => [...nodes.values()].filter((n) => !n.ghost).map((n) => ({ id: n.id, x: view.x + n.p[0] * view.s, y: view.y + n.p[1] * view.s })),
    zoom: (f) => zoomAt(app.screen.width / 2, app.screen.height / 2, f),
    destroy() {
      cv.removeEventListener('wheel', onWheel); cv.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    },
  };
}
