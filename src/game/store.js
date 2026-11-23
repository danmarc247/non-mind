// Thin reactive wrapper around the mutable game. The sim runs every frame; React reads at ~8 Hz.
import { useSyncExternalStore } from 'react';
import { createGame, step, actions, serialize, deserialize, SAVE_KEY } from './game.js';

const listeners = new Set();
let version = 0;
export const game = { G: null, selected: null, paused: false, started: false };

function load() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) return deserialize(s); } catch { /* corrupt or unavailable: start fresh */ }
  return createGame((Math.random() * 1e9) | 0);
}
game.G = load();

export const notify = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useGame = (sel = (G) => G) => { useSyncExternalStore(subscribe, () => version); return sel(game.G); };
export const useVersion = () => useSyncExternalStore(subscribe, () => version);

// act('buy', 2) -> runs the action, swaps G if the action returns a new game (reset), notifies.
export function act(name, ...args) {
  const r = actions[name](game.G, ...args);
  if (name === 'nonMind') { const ev = r.events; game.G = r; game.selected = null; game.G.events = ev; }
  notify();
  return r;
}
export const select = (id) => { game.selected = game.selected === id ? null : id; notify(); };

let acc = 0, saveT = 0;
const handlers = new Set();
export const onEvent = (fn) => { handlers.add(fn); return () => handlers.delete(fn); };
export function tick(dt) {
  if (game.paused || !game.started) return;
  const G = game.G;
  step(G, dt);
  if (G.events.length) { const evs = G.events.splice(0); for (const e of evs) handlers.forEach((h) => h(e, G)); }
  acc += dt; saveT += dt;
  if (acc > 0.125) { acc = 0; notify(); }
  if (saveT > 10) { saveT = 0; try { localStorage.setItem(SAVE_KEY, serialize(G)); } catch { /* storage full or blocked */ } }
}
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } game.G = createGame((Math.random() * 1e9) | 0); game.selected = null; notify(); }
if (typeof window !== 'undefined') window.__game = game;

// Two-step operations (integrate / subtract): setPending('integrate') with a unit selected, then choose(otherId).
export const setPending = (kind) => { game.pending = game.selected && kind ? { kind, a: game.selected } : null; notify(); };
export function choose(id) {
  if (game.pending && id !== game.pending.a) { const { kind, a } = game.pending; game.pending = null; const u = act(kind, a, id); game.selected = u && u.id ? u.id : null; notify(); return; }
  game.pending = null; select(id);
}
export const start = () => { game.started = true; notify(); };

// ---------- save export / import ----------
export let lastSavedAt = null;   // ms epoch of the last saveNow(), or null
export function saveNow() {
  try { localStorage.setItem(SAVE_KEY, serialize(game.G)); lastSavedAt = Date.now(); notify(); return { ok: true, at: lastSavedAt }; }
  catch { return { ok: false, error: 'storage unavailable' }; }
}
export function exportSave() { return encodeSave(serialize(game.G)); }
export function importSave(str) {
  try {
    const r = decodeSave(str);
    if (!r.ok) return { ok: false, error: r.error };
    const G = deserialize(r.json);
    step(deserialize(r.json), 0.1);               // a rejected save must fail here, not in the live loop
    G.events = [];
    game.G = G; game.selected = null; game.pending = null;
    notify();
    return { ok: true };
  } catch { return { ok: false, error: 'save could not be read' }; }
}
