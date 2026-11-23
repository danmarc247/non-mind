// Genomes: every regulator is a tree. Leaves are family genes; nodes are operations.
// The same tree drives stats, name, aspects AND the 3D form (see gfx/sculpt.js).
import { FAMILY, LINKS, ASPECT_IDS } from './data.js';

export const MAX_LEAVES = 6;

export const leaf = (family, pole = 0) => ({ t: 'leaf', f: family, pole }); // pole: -1 devalued, 0 whole, +1 idealized
export const node = (op, a, b, k = 0.3) => ({ t: 'node', op, a, b, k }); // op: 'blend' | 'carve' | 'mix'

export function leaves(g, out = []) {
  if (g.t === 'leaf') out.push(g);
  else { leaves(g.a, out); leaves(g.b, out); }
  return out;
}
export const leafCount = (g) => leaves(g).length;
export const depth = (g) => (g.t === 'leaf' ? 0 : 1 + Math.max(depth(g.a), depth(g.b)));
export const key = (g) => (g.t === 'leaf' ? `${g.f}${g.pole ? (g.pole > 0 ? '+' : '-') : ''}` : `(${key(g.a)}${g.op[0]}${key(g.b)})`);

// Weight of each leaf: carved-in leaves and deeper leaves count less.
function weights(g, w = 1, out = []) {
  if (g.t === 'leaf') out.push([g, w]);
  else {
    const wb = g.op === 'carve' ? 0.35 : 0.5;
    weights(g.a, w * (1 - wb) * (g.op === 'carve' ? 1.25 : 1.15), out);
    weights(g.b, w * wb * 1.15, out);
  }
  return out;
}

const ADJ = {
  reappraisal: 'Reappraised', suppression: 'Suppressed', rumination: 'Ruminative', avoidance: 'Avoidant', attunement: 'Attuned',
  projection: 'Projected', dissociation: 'Dissociated', sublimation: 'Sublimated', containment: 'Contained', equanimity: 'Equanimous',
};
const poleName = (l) => (l.pole > 0 ? 'Idealized ' : l.pole < 0 ? 'Devalued ' : '') + FAMILY[l.f].name;

export function nameOf(g) {
  if (g.t === 'leaf') return poleName(g);
  const ws = weights(g).sort((x, y) => y[1] - x[1]);
  const head = ws[0][0];
  const mods = [...new Set(ws.slice(1).map(([l]) => ADJ[l.f]).filter((a) => a !== ADJ[head.f]))].slice(0, 2);
  const joiner = g.op === 'carve' ? 'Hollowed ' : '';
  return `${mods.join(' ')} ${joiner}${poleName(head)}`.trim();
}

// Aspects: weighted vote of leaves, top 2 (hybrids of 4+ leaves keep 3).
export function aspectsOf(g) {
  const score = {};
  for (const [l, w] of weights(g)) for (const a of FAMILY[l.f].aspects) score[a] = (score[a] || 0) + w;
  const n = leafCount(g) >= 4 ? 3 : 2;
  return Object.entries(score).sort((x, y) => y[1] - x[1] || ASPECT_IDS.indexOf(x[0]) - ASPECT_IDS.indexOf(y[0])).slice(0, n).map((e) => e[0]);
}

// Base stats: weighted blend of leaf stats; poles skew them; hybrids get a small synergy bonus per leaf.
export function baseStats(g) {
  const ws = weights(g);
  const tot = ws.reduce((s, [, w]) => s + w, 0);
  const out = { tol: 0, sal: 0, lat: 0, reach: 0, opa: 0, lab: 0, rec: 0 };
  for (const [l, w] of ws) {
    const s = FAMILY[l.f].stats;
    const p = l.pole;
    out.tol += w * s.tol * (p > 0 ? 0.6 : p < 0 ? 1.5 : 1);
    out.sal += w * s.sal * (p > 0 ? 1.7 : p < 0 ? 0.7 : 1);
    out.lat += (w / tot) * s.lat * (p > 0 ? 0.85 : 1);
    out.reach = Math.max(out.reach, s.reach * (0.6 + 0.4 * (w / tot)));
    out.opa += (w / tot) * s.opa;
    out.lab += (w / tot) * (s.lab + (p ? 0.25 : 0));
    out.rec += (w / tot) * s.rec;
  }
  const syn = 1 + 0.12 * (ws.length - 1);
  out.tol *= syn; out.sal *= syn;
  return out;
}

export const tierOf = (g) => Math.min(5, Math.max(...leaves(g).map((l) => FAMILY[l.f].tier)));
export const abilityOf = (g) => FAMILY[weights(g).sort((x, y) => y[1] - x[1])[0][0].f].ability;
export const echoAbilityOf = (g) => { const ws = weights(g).sort((x, y) => y[1] - x[1]); return ws[1] && ws[1][0].f !== ws[0][0].f ? FAMILY[ws[1][0].f].ability : null; };

// Trim a tree to MAX_LEAVES by dropping the lightest leaves (they survive as `ghosts`: stat residue).
export function prune(g) {
  let ghosts = 0;
  while (leafCount(g) > MAX_LEAVES) {
    const light = weights(g).sort((x, y) => x[1] - y[1])[0][0];
    g = removeLeaf(g, light); ghosts++;
  }
  return { g, ghosts };
}
function removeLeaf(g, target) {
  if (g.t === 'leaf') return g;
  if (g.a === target) return g.b;
  if (g.b === target) return g.a;
  return { ...g, a: removeLeaf(g.a, target), b: removeLeaf(g.b, target) };
}

// Complexity contributed by one unit: structure x ladder.
export const complexityOf = (u) => (leafCount(u.g) + depth(u.g) * 0.5 + (u.ghosts || 0) * 0.5) * (1 + (u.link - 1) * 0.35) + u.traits.length * 0.25;

// Heritable traits: union of parents, capped; a link-up adds the link's trait.
export function inheritTraits(a, b, rng) {
  const pool = [...a.traits, ...b.traits];
  const out = [];
  for (const t of pool) if (!out.includes(t) || rng() < 0.35) out.push(t); // duplicates sometimes double up
  return out.slice(0, 10);
}
export const traitForLink = (n) => LINKS[n - 1].trait;
