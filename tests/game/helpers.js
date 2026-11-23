// Shared helpers for the game tests. Engine API only; never mutates src.
import { createGame, step, leaf, FAMILIES } from '../../src/game/index.js';

export const FAMILY_IDS = FAMILIES.map((f) => f.id);

/** Fresh game, optionally fast-forwarded to a stage (stage gates read G.stage directly). */
export function gameAt(stage = 0, seed = 1) {
  const G = createGame(seed);
  G.stage = stage;
  return G;
}

/** Push a unit straight into state (bypasses fuse so tests can stage exact situations). */
export function addRaw(G, g, { link = 1, traits = ['ache'], seat = null, ghosts = 0 } = {}) {
  const u = { id: G.nextUid++, g, link, traits: traits.slice(), seat, ghosts, born: G.t };
  G.units.push(u);
  return u;
}
export const addLeaf = (G, family, opts) => addRaw(G, leaf(family), opts);

/** Step with a fixed dt until `pred(G)` or `maxSeconds`. Returns seconds used. */
export function stepUntil(G, pred, maxSeconds = 600, dt = 0.1) {
  let t = 0;
  while (t < maxSeconds && !pred(G)) { step(G, dt); t += dt; }
  return t;
}

/** Collect every finite-number violation in a plain state tree. */
export function badNumbers(obj, path = 'G', out = [], seen = new Set()) {
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(`${path}=${obj}`); return out; }
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return out;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) badNumbers(v, `${path}.${k}`, out, seen);
  return out;
}
