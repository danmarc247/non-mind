// Lineage memory: a module-level record of what was grown, joined, cut and let go this run.
// Lives as long as the page does (not saved). Light on purpose: no pixi here, this sits in the main bundle.
import { onEvent } from '../../game/store.js';
import { nameOf, key, leaves } from '../../game/genome.js';
import { displayName } from '../../game/game.js';

export const LOG_CAP = 500;
const SNAP_CAP = 900;
const TYPES = new Set(['unitNew', 'link', 'integrate', 'subtract', 'split', 'repurpose', 'ending', 'mutation']);

export const lineage = { log: [], snaps: new Map(), rev: 0 };

// Remember a unit as it is now, so it can be drawn after it is gone.
export function snapUnit(u, t) {
  if (!u) return null;
  const prev = lineage.snaps.get(u.id);
  const s = {
    id: u.id, g: u.g, key: key(u.g), name: nameOf(u.g), full: displayName(u), link: u.link,
    muts: (u.muts || []).slice(), fams: leaves(u.g).map((l) => l.f), born: prev?.born ?? t, gone: prev?.gone ?? null,
  };
  lineage.snaps.delete(u.id); lineage.snaps.set(u.id, s);
  if (lineage.snaps.size > SNAP_CAP) lineage.snaps.delete(lineage.snaps.keys().next().value);
  return s;
}

const byId = (G, id) => G && G.units.find((u) => u.id === id);
function goneAs(id, why, t) { const s = lineage.snaps.get(id); if (s && !s.gone) s.gone = { why, t }; }

export function record(e, G) {
  if (e.type === 'reset') { lineage.log.length = 0; lineage.snaps.clear(); lineage.rev++; return; }
  if (!TYPES.has(e.type)) return;
  const t = G ? G.t : 0;
  if (G) for (const o of G.units) if (!lineage.snaps.has(o.id)) snapUnit(o, t);
  const ent = { type: e.type, t, id: e.id };
  if (e.type === 'link') { ent.from = [e.gone]; ent.link = e.link; goneAs(e.gone, 'link', t); }
  if (e.type === 'integrate' || e.type === 'subtract') { ent.from = [e.a, e.b]; goneAs(e.a, e.type, t); goneAs(e.b, e.type, t); }
  if (e.type === 'split') { ent.to = [e.a, e.b]; goneAs(e.id, 'split', t); snapUnit(byId(G, e.a), t); snapUnit(byId(G, e.b), t); }
  if (e.type === 'repurpose') { ent.habit = e.habit; ent.n = e.n; goneAs(e.id, 'repurpose', t); }
  if (e.type === 'ending') goneAs(e.id, 'ending', t);
  if (e.type === 'mutation') ent.mut = e.mut;
  const u = byId(G, e.id);
  if (u) snapUnit(u, t);
  // a twin bought and fused inside one step was never seen alive: it was the same genome, one rung lower
  if (e.type === 'link' && !lineage.snaps.has(e.gone) && lineage.snaps.has(e.id)) {
    const k = lineage.snaps.get(e.id);
    lineage.snaps.set(e.gone, { ...k, id: e.gone, link: e.link - 1, muts: [], born: t, gone: { why: 'link', t } });
  }
  lineage.log.push(ent);
  if (lineage.log.length > LOG_CAP) lineage.log.splice(0, lineage.log.length - LOG_CAP);
  lineage.rev++;
}

// Ancestor -> descendant edges, read from the log.
export function ancestry() {
  const edges = [];
  for (const e of lineage.log) {
    if (e.from) for (const f of e.from) edges.push({ from: f, to: e.id, kind: e.type });
    if (e.to) for (const d of e.to) edges.push({ from: e.id, to: d, kind: 'split' });
  }
  return edges;
}

let off = null;
export function startLineageLog() { if (!off) off = onEvent(record); return off; }
startLineageLog();
