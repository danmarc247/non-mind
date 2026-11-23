// Lifecycle tests: RESET (actions.nonMind), RESTART (store wipe / reload) and SAVE (serialize, the save code,
// the store's autosave, export and import). Engine API and store only; deterministic per seed.
// Known bugs are kept as it.fails('BUG <id>: ...') with the cause, observed vs expected and a minimal reproduction.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createGame, step, actions, serialize, deserialize, muGain, SAVE_KEY, FAMILIES } from '../../src/game/index.js';
import { encodeSave, decodeSave } from '../../src/game/savecode.js';
import { gameAt, addLeaf, addRaw, badNumbers } from './helpers.js';
import { extendedBot, resettingBot } from './bots.js';

// ---------------------------------------------------------------- helpers
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const STAT_KEYS = Object.keys(createGame(1).stats);
// cardMisses joined the kept fields when a missed card began to make the next one stay longer
const META_KEYS = ['mu', 'endings', 'depth', 'bestStage', 'totalT', 'cards', 'cardMisses'];

/** Bot play with fixed dt; events are cleared each step as the UI does. Returns the game (which may be replaced). */
function play(G, seconds, { dt = 0.1, bot = extendedBot, t0 = 0 } = {}) {
  let t = t0;
  for (let i = 0, n = Math.round(seconds / dt); i < n; i++) { G = bot(G, t) || G; step(G, dt); t += dt; G.events.length = 0; }
  return G;
}

/** Every non-finite number in the live state, plus stats counters that are not finite numbers, plus a NaN residue gain. */
function health(D) {
  const { rng, gain, ...rest } = D;
  const bad = badNumbers(rest);
  for (const k of STAT_KEYS) if (!Number.isFinite(D.stats?.[k])) bad.push(`stats.${k}=${D.stats?.[k]}`);
  if (!Number.isFinite(muGain(D))) bad.push(`muGain=${muGain(D)}`);
  return bad;
}

/**
 * Reset G and check the whole contract: the old game is untouched; meta is exactly mu + muGain(old), endings, depth + 1,
 * max(bestStage, stage), totalT + t and a copy of the cards; every run field equals a fresh createGame run with that meta;
 * the rng is that fresh rng advanced only by the reset koan; the log starts as a fresh log; exactly one reset event.
 */
function resetAndCheck(G) {
  const before = serialize(G), gain = muGain(G);
  expect(Number.isFinite(gain) && gain >= 0).toBe(true);
  const meta = { mu: G.mu + gain, endings: G.endings, depth: G.depth + 1, bestStage: Math.max(G.bestStage, G.stage), totalT: G.totalT + G.t, cards: (G.cards || []).slice(), cardMisses: G.cardMisses || 0 };
  const N = actions.nonMind(G);
  expect(N).not.toBe(G);
  expect(serialize(G)).toBe(before);
  expect(Object.fromEntries(META_KEYS.map((k) => [k, N[k]]))).toEqual(meta);
  expect(N.cards).not.toBe(G.cards);
  const F = createGame(G.seed, meta);
  for (const k of new Set([...Object.keys(N), ...Object.keys(F)])) {
    if (['rng', 'gain', 'log', 'events', 'lastKoan'].includes(k)) continue;
    expect(JSON.stringify(N[k]), `run field ${k}`).toBe(JSON.stringify(F[k]));
  }
  expect(typeof N.rng).toBe('function'); expect(typeof N.gain).toBe('function');
  // the rng: fresh for (seed, depth), advanced by the few draws of the reset koan and nothing else
  const r = createGame(G.seed, meta).rng; let draws = -1;
  for (let i = 0; i <= 8; i++) { if (r.get() === N.rng.get()) { draws = i; break; } r(); }
  expect(draws).toBeGreaterThanOrEqual(0);
  expect(N.log.slice(0, F.log.length)).toEqual(F.log);
  expect(N.log.some((l) => l.text === 'Simple again.' && l.kind === 'reset')).toBe(true);
  expect(N.events.filter((e) => e.type === 'reset')).toEqual([{ type: 'reset', gain, depth: G.depth + 1 }]);
  // the new run shares nothing mutable with the old one
  N.cards.push('x'); N.units.push({}); N.stats.clicks += 99; N.habits.breath = 7;
  expect(serialize(G)).toBe(before);
  N.cards.pop(); N.units.pop(); N.stats.clicks -= 99; delete N.habits.breath;
  return N;
}

// ---------------------------------------------------------------- store with fake localStorage and window
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  const api = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null };
  Object.defineProperty(api, 'length', { get: () => m.size, configurable: true });
  return new Proxy(api, {
    ownKeys: () => [...m.keys()],
    getOwnPropertyDescriptor: (_, k) => (m.has(k) ? { enumerable: true, configurable: true, value: m.get(k) } : undefined),
  });
}
/** A fresh store module over a fake localStorage holding `init`. */
async function loadStore(init = {}, { throwing = false } = {}) {
  vi.resetModules();
  const ls = throwing ? new Proxy({}, { get: () => { throw new Error('blocked'); } }) : fakeStorage(init);
  const listeners = {};
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('window', { addEventListener: (n, f) => { (listeners[n] ||= []).push(f); }, dispatch: (n) => (listeners[n] || []).forEach((f) => f()) });
  const store = await import('../../src/game/store.js');
  return { store, ls, win: globalThis.window };
}
afterAll(() => { vi.unstubAllGlobals(); });

// A late save shared by the forward-compatibility and hostile-save tests: stage 17, a verb under way, hybrids.
let LATE = null;
beforeAll(() => {
  let G = play(createGame(42), 1500);
  for (let i = 0; i < 3000 && !Object.values(G.verbs).some(Boolean); i++) { extendedBot(G, 1500 + i * 0.1); step(G, 0.1); G.events.length = 0; }
  LATE = serialize(G);
}, 120000);

// ======================================================================================= 1. RESET AT AWKWARD MOMENTS
describe('reset: actions.nonMind at awkward moments', () => {
  it('stage 0 refuses and returns the very same, unchanged game (also when residue would be large)', () => {
    const G = createGame(3); G.stats.peak = 1e6; G.t = 40; const before = serialize(G);
    expect(actions.nonMind(G)).toBe(G);
    expect(serialize(G)).toBe(before);
  });

  it('stage 1 (the first moment it is allowed): a fresh run, residue paid, playable again', () => {
    const G = createGame(4);
    for (let i = 0; i < 5; i++) actions.attend(G);
    step(G, 0.1);
    expect(G.stage).toBe(1);
    const N = resetAndCheck(G);
    expect(N.depth).toBe(1); expect(N.bestStage).toBe(1);
    expect(play(N, 60).stage).toBeGreaterThanOrEqual(1);
  });

  it('right after another reset: the second press refuses (stage 0), and two real resets in a row stack meta exactly', () => {
    const G = gameAt(9, 21); G.stats.peak = 500; G.t = 321; G.mu = 4; G.endings = 1; G.cards = ['first_step'];
    const N = resetAndCheck(G);
    const sN = serialize(N);
    expect(actions.nonMind(N)).toBe(N);
    expect(serialize(N)).toBe(sN);
    for (let i = 0; i < 5; i++) actions.attend(N);
    step(N, 0.1);
    const M = resetAndCheck(N);
    expect(M.depth).toBe(2); expect(M.endings).toBe(1); expect(M.bestStage).toBe(9);
    expect(M.totalT).toBeCloseTo(321 + 0.1, 9);
    expect(M.mu).toBe(N.mu + muGain(N));
    expect(M.cards).toEqual(['first_step']);
  });

  it('a constructed lost wave with verbs running, moods, an offered card and a gift: a fresh run all the same', () => {
    const G = gameAt(14, 23); G.cycle = 4; G.wave = 9; G.stats.peak = 300;
    addLeaf(G, 'reappraisal', { seat: { ring: 0, dir: 0 } });
    const a = addLeaf(G, 'suppression', { traits: ['ache', 'fade'] }), b = addLeaf(G, 'rumination', { traits: ['ache', 'fade'] }); // fade counts as every aspect
    expect(actions.startVerb(G, 'rest', a.id)).toBe(true);
    expect(actions.startVerb(G, 'confide', b.id)).toBe(true);
    G.cardOffer = { id: 'dim_water', t: 9, x: 1, z: 2 };
    G.gift = { kind: 'actualize', t: 4 }; G.giftT = 3;
    G.moods.push({ kind: 'dread', t: 50, id: 999 });
    actions.ready(G);
    let lost = false;
    for (let i = 0; i < 4000 && !lost; i++) { step(G, 0.1); G.events.length = 0; lost = G.phase === 'lost'; }
    expect(lost).toBe(true);
    expect(G.units.filter((u) => u.busy).length).toBe(2);
    expect(G.moods.length).toBeGreaterThan(0);
    const N = resetAndCheck(G);
    expect(N.verbs).toEqual({}); expect(N.moods).toEqual([]); expect(N.gift).toBe(null); expect(N.cardOffer).toBe(null);
    expect(N.phase).toBe('prep'); expect(N.battle).toBe(null);
  });

  it('in natural play: mid-fight, won, lost, verbs running, card drifting, gift offered, moods, overwhelm 1 (seed 42)', () => {
    const need = {
      fight: (G) => G.phase === 'fight' && G.battle && G.battle.enemies.length > 0,
      won: (G) => G.phase === 'won',
      lost: (G) => G.phase === 'lost',
      verbs: (G) => Object.values(G.verbs).some(Boolean),
      card: (G) => !!G.cardOffer,
      gift: (G) => !!G.gift,
      moods: (G) => G.moods.length > 0,
      overwhelm: (G) => G.overwhelm >= 1,
    };
    const seen = {};
    const G = createGame(42);
    for (let t = 0; t < 3600 && Object.keys(seen).length < Object.keys(need).length; t += 0.1) {
      extendedBot(G, t); step(G, 0.1); G.events.length = 0;
      for (const [k, p] of Object.entries(need)) if (!seen[k] && G.stage >= 1 && p(G)) {
        const N = resetAndCheck(G);
        seen[k] = { stage: G.stage, gain: N.mu - G.mu };
        if (k === 'overwhelm') expect(N.mu - G.mu).toBe(muGain(G)); // doubled gain is muGain's own rule
        // the new run plays on from simple
        const P = play(N, 40);
        expect(health(P)).toEqual([]);
        expect(P.stage).toBeGreaterThanOrEqual(1);
      }
    }
    expect(Object.keys(seen).sort()).toEqual(Object.keys(need).sort());
  });
});

// ======================================================================================= 2. FIFTY RESETS
describe('reset: fifty consecutive resets with resettingBot play between', () => {
  const runs = [];
  beforeAll(() => {
    // resettingBot lets go at overwhelm 1 (as the advisor says to) or after 600 s of a run
    let G = createGame(7), t = 0, s6 = null;
    for (let steps = 0; runs.length < 50 && steps < 400000; steps++) {
      const prev = G;
      const N = resettingBot(G, t, 600);
      if (N !== prev) {
        runs.push({ fresh: JSON.parse(serialize(N)), freshRef: JSON.parse(serialize(createGame(prev.seed, { mu: N.mu, endings: N.endings, depth: N.depth, bestStage: N.bestStage, totalT: N.totalT, cards: N.cards, cardMisses: N.cardMisses }))), old: prev, size: serialize(prev).length, stage: prev.stage, s6, N, gain: muGain(prev), oldMeta: Object.fromEntries(META_KEYS.map((k) => [k, prev[k]])), t: prev.t });
        G = N; t = 0; s6 = null;
      }
      step(G, 0.25); t += 0.25; G.events.length = 0;
      if (s6 === null && G.stage >= 6) s6 = G.t;
    }
  }, 120000);

  it('fifty resets happen; residue, depth, bestStage and totalT are monotonic and exact; every new run is fresh and finite', () => {
    expect(runs).toHaveLength(50);
    runs.forEach((r, i) => {
      expect(r.N.depth).toBe(i + 1);
      expect(r.N.mu).toBe(r.oldMeta.mu + r.gain);
      expect(r.N.mu).toBeGreaterThanOrEqual(r.oldMeta.mu);
      expect(r.N.bestStage).toBe(Math.max(r.oldMeta.bestStage, r.stage));
      expect(r.N.totalT).toBeGreaterThan(r.oldMeta.totalT);
      expect(r.fresh.stage).toBe(0); expect(r.fresh.units).toEqual([]); expect(r.fresh.t).toBe(0);
      for (const k of Object.keys(r.freshRef)) if (!['log', 'lastKoan', 'rs'].includes(k)) expect(JSON.stringify(r.fresh[k]), `run ${i + 1} field ${k}`).toBe(JSON.stringify(r.freshRef[k]));
      expect(health(r.old)).toEqual([]);
      if (i > 0) expect(r.oldMeta.mu).toBe(runs[i - 1].N.mu);
    });
    expect(runs[49].N.mu).toBeGreaterThan(runs[0].N.mu);
  });

  it('the serialized save stays bounded (no growth with depth)', () => {
    const sizes = runs.map((r) => r.size);
    expect(Math.max(...sizes)).toBeLessThan(32 * 1024);
    const early = Math.max(...sizes.slice(0, 10)), late = Math.max(...sizes.slice(-10));
    expect(late).toBeLessThanOrEqual(early * 1.5);
  });

  it('with deep meta but no early letting-go, a run reaches stage 6 sooner than a first run (the economy itself deepens)', () => {
    const at6 = (G) => { for (let t = 0; t < 600; t += 0.25) { extendedBot(G, t); step(G, 0.25); G.events.length = 0; if (G.stage >= 6) return G.t; } return Infinity; };
    const first = at6(createGame(7));
    expect(first).toBeLessThan(600);
    expect(at6(createGame(7, { mu: runs[30].N.mu, depth: 30 }))).toBeLessThanOrEqual(first);
  });

  // BUG deep-run-collapse (major). Cause: residue multiplies affect (game.js:79, 1 + 0.04 mu) and so habits and lifetime
  // earnings, which both feed complexity (game.js:394: sqrt(habitsOwned)*1.2 + 2.5*log10(1+earned)), while capacity no longer
  // grows with residue or depth (game.js:72). From about depth 12 (mu ~ 480, seed 7) overwhelm reaches 1 at stage 3 within
  // ~45 s; a player who lets go when overwhelmed (resettingBot; the advisor puts reset first at overwhelm 1) never sees stage 6
  // again, and the runs shrink to 45-second loops. Observed: first run reaches stage 6 at ~230 s; runs 12, 13, 15, 16, 18, 21-23
  // and 25-49 never reach it. Expected: later runs reach stage 6 no later than the first.
  // Reproduction: let G = createGame(7, { mu: 1000, depth: 20 }); extendedBot + step(0.25) -> overwhelm 1 at stage 3-5 near 50 s.
  it.fails('BUG deep-run-collapse: every later run reaches stage 6 no later than the first', () => {
    expect(runs[0].s6).not.toBe(null);
    const late = runs.slice(1).map((r, i) => ({ run: i + 1, s6: r.s6 ?? Infinity }));
    expect(late.filter((r) => r.s6 > runs[0].s6)).toEqual([]);
  });
});

// ======================================================================================= 3. SAVE ROUND TRIPS
describe('save: round trips at 25 random moments of a long run (incl. mid-fight)', () => {
  it('serialize/deserialize and the store codec keep every persistent field; both copies then step identically for 300 steps', async () => {
    const { store } = await loadStore();
    const SKIP = ['rng', 'gain', 'battle', 'events', 'phase', 'phaseT'];
    const r = prng(99);
    const T = 1800, dt = 0.1, N = Math.round(T / dt);
    // 12 plain random moments and 13 that wait for the next mid-fight step
    const plain = new Set(Array.from({ length: 12 }, () => 200 + Math.floor(r() * (N - 400))));
    const fightAfter = Array.from({ length: 13 }, () => 200 + Math.floor(r() * (N - 400))).sort((a, b) => a - b);
    let fi = 0, samples = 0, midFight = 0, exact = 0;
    let shadows = [];
    const G = createGame(11);
    let t = 0;
    for (let i = 0; i < N; i++) {
      extendedBot(G, t); for (const s of shadows) extendedBot(s.C, t);
      step(G, dt); for (const s of shadows) step(s.C, dt);
      t += dt;
      // exact moments: a wave just ended into prep at phaseT 0, where serialize loses nothing at all: the copy and the
      // original itself must stay identical, event for event
      for (const s of shadows) { expect(JSON.stringify(s.C.events)).toBe(JSON.stringify(G.events)); s.left--; }
      shadows = shadows.filter((s) => { if (s.left > 0) return true; expect(serialize(s.C)).toBe(serialize(G)); expect(JSON.stringify(s.C.battle)).toBe(JSON.stringify(G.battle)); return false; });
      G.events.length = 0; for (const s of shadows) s.C.events.length = 0;
      if (exact < 5 && !shadows.length && i % 1000 > 900 && G.phase === 'prep' && G.phaseT === 0 && G.battle === null) { shadows.push({ C: deserialize(serialize(G)), left: 300 }); exact++; }

      let take = plain.has(i);
      if (!take && fi < fightAfter.length && i >= fightAfter[fi] && G.phase === 'fight') { take = true; fi++; }
      if (!take) continue;
      samples++; if (G.phase === 'fight') midFight++;
      const before = serialize(G);
      const A = deserialize(serialize(G));
      store.game.G = G;
      const code = store.exportSave();
      expect(store.importSave(code)).toEqual({ ok: true });
      const B = store.game.G;
      expect(B).not.toBe(G);
      expect(serialize(G)).toBe(before); // saving never touches the running game
      for (const C of [A, B]) {
        for (const k of Object.keys(G)) if (!SKIP.includes(k)) expect(JSON.stringify(C[k]), `field ${k}`).toBe(JSON.stringify(G[k]));
        expect(Object.keys(C).filter((k) => !(k in G))).toEqual([]);
        expect(C.rng.get()).toBe(G.rng.get());
        // the only deliberate loss: the phase restarts at prep with phaseT 0, no battle, no queued events
        expect([C.phase, C.phaseT, C.battle, C.events]).toEqual(['prep', 0, null, []]);
      }
      let tt = t;
      for (let k = 0; k < 300; k++) {
        extendedBot(A, tt); extendedBot(B, tt); step(A, dt); step(B, dt); tt += dt;
        expect(JSON.stringify(B.events)).toBe(JSON.stringify(A.events));
        A.events.length = 0; B.events.length = 0;
      }
      expect(serialize(B)).toBe(serialize(A));
      expect(JSON.stringify(B.battle)).toBe(JSON.stringify(A.battle));
      expect(health(A)).toEqual([]);
    }
    expect(samples).toBe(25);
    expect(midFight).toBeGreaterThanOrEqual(13);
    expect(exact).toBeGreaterThanOrEqual(3);
  });
});

// ======================================================================================= 4. FORWARD COMPATIBILITY
describe('save: forward compatibility (older saves missing fields)', () => {
  const load = (mut) => { const d = JSON.parse(LATE); mut(d); return deserialize(JSON.stringify(d)); };
  const play200 = (D) => play(D, 20);

  it('the late save holds the optional state worth deleting', () => {
    const d = JSON.parse(LATE);
    expect(d.stage).toBe(17);
    expect(Object.values(d.verbs).some(Boolean)).toBe(true);
    expect(d.units.some((u) => u.parentLinks)).toBe(true);
    expect(d.units.some((u) => (u.muts || []).length)).toBe(true);
  });

  it('deleting any one top-level field: deserialize, 200 bot steps, no throw, finite state, a finite reset', () => {
    const keys = Object.keys(JSON.parse(LATE));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      const D = play200(load((d) => { delete d[k]; }));
      expect(health(D), `without ${k}`).toEqual([]);
      if (D.stage >= 1) expect(Number.isFinite(actions.nonMind(D).mu), `without ${k}`).toBe(true);
    }
  });

  it('deleting the optional per-unit fields (muts, parentLinks, ghosts, born, busy) on every unit is harmless', () => {
    for (const k of ['muts', 'parentLinks', 'ghosts', 'born', 'busy']) {
      const D = play200(load((d) => { for (const u of d.units) delete u[k]; }));
      expect(health(D), `units without ${k}`).toEqual([]);
    }
  });

  it('a unit without traits (a required field) is refused by importSave rather than crashing later', async () => {
    const { store } = await loadStore();
    const d = JSON.parse(LATE); delete d.units.find((u) => u.seat).traits;
    const prev = store.game.G;
    expect(store.importSave(encodeSave(JSON.stringify(d))).ok).toBe(false);
    expect(store.game.G).toBe(prev);
  });

  // BUG save-stats-merge (critical: corrupts progression and destroys residue). Cause: deserialize (game.js:476) does
  // Object.assign(G, rest) which replaces createGame's whole `stats` object with the saved one, so a save from before a
  // counter existed (exchanges, echoes, seasons were added later) leaves it undefined. `++` then gives NaN, stage needs on
  // it can never pass (stage 13 needs echoes >= 20), and without peak or earned the complexity, affect and muGain become NaN,
  // so the next reset writes mu = NaN, which survives every later reset. Expected: missing counters default to 0.
  // Reproduction: const d = JSON.parse(serialize(G)); delete d.stats.peak; const D = deserialize(JSON.stringify(d));
  // step(D, 0.1); D.stats.peak -> NaN; actions.nonMind(D).mu -> NaN. Fix: G.stats = { ...G.stats, ...(d.stats || {}) }.
  for (const k of STAT_KEYS) {
    it.fails(`BUG save-stats-merge: a save without stats.${k} plays 200 steps with every counter finite and a finite reset`, () => {
      const D = play200(load((d) => { delete d.stats[k]; }));
      expect(health(D)).toEqual([]);
      expect(Number.isFinite(actions.nonMind(D).mu)).toBe(true);
    });
  }
});

// ======================================================================================= 5. HOSTILE SAVES
describe('save: hostile saves are refused cleanly or sanitised, never a crash later in step', () => {
  let store;
  beforeAll(async () => { ({ store } = await loadStore()); }, 60000);
  // A plain player: attends, buys, readies, seats the bench, integrates, sells and repurposes the bench now and then.
  function driver(D, t) {
    actions.attend(D);
    for (let i = 0; i < 5; i++) actions.buy(D, i);
    const free = () => { const taken = new Set(D.units.filter((o) => o.seat).map((o) => o.seat.ring * 10 + o.seat.dir)); for (let s = 0; s < 30; s++) if (!taken.has(s)) return { ring: Math.floor(s / 10), dir: s % 10 }; return null; };
    const bench = D.units.filter((u) => !u.seat && !u.busy);
    if (bench[0] && free()) actions.place(D, bench[0].id, free());
    if (bench.length >= 2) actions.integrate(D, bench[0].id, bench[1].id);
    if (Math.round(t * 4) % 97 === 0 && bench.length) actions.sell(D, bench[bench.length - 1].id);
    if (Math.round(t * 4) % 131 === 0 && bench.length) actions.repurpose(D, bench[0].id);
    actions.ready(D);
  }
  /** Import; return 'rejected' (game untouched) or the health problems after 150 s of play and a reset. */
  function attempt(code) {
    const prev = store.game.G;
    const r = store.importSave(code);
    if (!r.ok) { expect(typeof r.error).toBe('string'); expect(store.game.G).toBe(prev); return 'rejected'; }
    const D = store.game.G;
    let t = 0;
    for (let i = 0; i < 600; i++) { driver(D, t); step(D, 0.25); t += 0.25; D.events.length = 0; }
    const bad = health(D);
    if (D.stage >= 1) { const N = actions.nonMind(D); if (!Number.isFinite(N.mu)) bad.push(`reset mu=${N.mu}`); step(N, 0.1); }
    return bad;
  }
  const late = (mut) => { const d = JSON.parse(LATE); mut(d); return encodeSave(JSON.stringify(d)); };
  const seated = (d) => d.units.find((u) => u.seat);

  it('the codec refuses truncated, foreign, wrong-version and malformed codes, leaving the game as it was', () => {
    const code = encodeSave(LATE);
    for (const bad of [code.slice(0, -12), code.slice(0, 30), `NM2.${code.slice(4)}`, encodeSave(LATE, 2), encodeSave(LATE, '1'),
      encodeSave(LATE.slice(0, Math.floor(LATE.length / 2))), encodeSave('{"seed":1,"units":[],"stage":NaN,"rs":1}'),
      encodeSave('{"seed":1,"units":[],"stage":Infinity,"rs":1}'), encodeSave('{"seed":"x","units":[],"stage":1,"rs":1}'),
      late((d) => { d.units = null; }), late((d) => { d.units = 'many'; }), late((d) => { d.stage = '3'; }), late((d) => { delete d.rs; }),
      late((d) => { d.stage = 1e999; }), '', null, 17, {}, LATE])
      expect(attempt(bad)).toBe('rejected');
  });

  const SAFE = {
    'null numerics': (d) => { for (const k of ['affect', 'attention', 'insight', 'composure', 't', 'cycle', 'depth', 'mu']) d[k] = null; },
    'unknown shop ids with an empty board': (d) => { d.units = []; d.verbs = {}; d.shop = ['nope', 'nope', 'nope', 'nope', 'nope']; d.attention = 0; },
    'negative resources': (d) => { d.affect = -1e9; d.attention = -50; d.insight = -1e6; },
    'level out of range': (d) => { d.level = 99; },
    'stage past the end': (d) => { d.stage = 99; },
    'two units on one seat': (d) => { const s = d.units.filter((u) => u.seat); s[1].seat = { ...s[0].seat }; },
    'duplicate unit ids': (d) => { d.units[1].id = d.units[0].id; d.nextUid = 1; },
    'unknown traits, mutations, moods, upgrades, stance, cards, card offer': (d) => {
      d.units[0].traits = ['zzz', 'zzz']; d.units[0].muts = ['nope']; d.moods = [{ kind: 'nope', t: 5 }]; d.upgrades = { nope: true };
      d.stance = 'nope'; d.cards = ['nope', 'nope']; d.cardOffer = { id: 'nope', t: 5, x: 0, z: 0 };
    },
    'a verb that holds nobody, a unit busy in an unknown verb': (d) => { d.verbs = { dream: { t: 1, unit: 123456 } }; d.units[0].busy = 'nope'; },
    'null cards and lastKoan, wrong phase': (d) => { d.cards = null; d.lastKoan = null; d.phase = 'fight'; },
    'a gift of an unknown kind': (d) => { d.gift = { kind: 'nope', t: 3 }; },
  };
  for (const [name, mut] of Object.entries(SAFE)) {
    it(`sanitised or tolerated: ${name}`, () => { const r = attempt(late(mut)); if (r !== 'rejected') expect(r).toEqual([]); });
  }

  // BUG import-validate (critical: an accepted save crashes the live loop or turns the state to NaN; reachable only with a
  // hand-made code, since the checksum guards accidents). Cause: store.js:74 proves a save by stepping a copy for only 0.1 s,
  // in prep, and neither decodeSave (savecode.js:52) nor deserialize (game.js:472-480) checks ranges or types, so faults that
  // fire at the next wave start, on an empty board or in arithmetic pass. Expected: refused (ok: false) or sanitised.
  // Causes per case: link outside 1..11 on a seated unit -> battle.js:51 LINKS[u.link - 1].mult at wave start (~5 s);
  // log null -> game.js:70 say(); wave null -> battle.js:88 WAVE_ARC[-1].id at wave start; level null -> game.js:99
  // SHOP_ODDS[-1] in rollShop at the wave's end; a seat outside the board ->
  // battle.js:20 ARENA.rings[ring] undefined -> NaN positions (place() validates seats, deserialize does not); a card offer
  // without t -> game.js:381 t stays NaN and the offer never leaves;
  // mu < 0 -> battle.js:61 Math.pow(mu, 0.7) = NaN; mirrors 1000 -> 2^1000 = Infinity -> NaN; a habit count as text and an
  // affect of 1e999 -> NaN / Infinity through step. Reproduction: late((d) => { seated(d).link = 99; }) then importSave -> ok,
  // tick for 6 s -> TypeError. Fix: validate in deserialize (clamp link to 1..11, drop units of unknown families, coerce
  // numerics with finite defaults and clamp mu >= 0 and mirrors to a small range, arrays default to [], shop ids filtered).
  const HOSTILE = {
    'a seated unit at link 99': (d) => { seated(d).link = 99; },
    'a seated unit at link 0': (d) => { seated(d).link = 0; },
    'a seated unit at link 2.5': (d) => { seated(d).link = 2.5; },
    'a seated unit at link null': (d) => { seated(d).link = null; },
    'log null': (d) => { d.log = null; },
    'wave null': (d) => { d.wave = null; },
    'level null': (d) => { d.level = null; },
    'seats out of range (ring 9 / dir 40, ring -1, a string)': (d) => { const s = d.units.filter((u) => u.seat); s[0].seat = { ring: 9, dir: 40 }; s[1].seat = { ring: -1, dir: -1 }; s[2].seat = 'x'; },
    'a card offer without a timer': (d) => { d.cardOffer = { id: 'first_step' }; d.cards = []; },
    'negative residue': (d) => { d.mu = -100; },
    'a thousand mirrors': (d) => { d.mirrors = 1000; },
    'a habit count as text': (d) => { d.habits = { breath: 'x' }; },
    'affect 1e999 (parses as Infinity)': null,
  };
  for (const [name, mut] of Object.entries(HOSTILE)) {
    it.fails(`BUG import-validate: ${name} is refused or sanitised, never a crash or NaN later`, () => {
      const code = mut ? late(mut) : encodeSave(LATE.replace(/"affect":[^,]+,/, '"affect":1e999,'));
      if (!mut) expect(decodeSave(code).ok).toBe(true);
      let r;
      expect(() => { r = attempt(code); }).not.toThrow();
      if (r !== 'rejected') expect(r).toEqual([]);
    });
  }
});

// ======================================================================================= 6. THE STORE
describe('store: start, act, select, pending, wipe, autosave, load', () => {
  it('tick() before start() does nothing; after start() it steps', async () => {
    const { store } = await loadStore();
    const before = serialize(store.game.G);
    for (let i = 0; i < 50; i++) store.tick(0.1);
    expect(serialize(store.game.G)).toBe(before);
    store.start();
    store.tick(0.1);
    expect(store.game.G.t).toBeCloseTo(0.1, 9);
    store.game.paused = true; store.tick(0.1);
    expect(store.game.G.t).toBeCloseTo(0.1, 9);
  });

  it('act, select and two-step choose: integrate via setPending + choose; the same unit cancels; no selection gives no pending', async () => {
    const { store } = await loadStore();
    const G = gameAt(3, 31); store.game.G = G; store.start();
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'), c = addLeaf(G, 'rumination');
    expect(store.act('attend')).toBeGreaterThan(0);
    expect(G.stats.clicks).toBe(1);
    store.setPending('integrate');
    expect(store.game.pending).toBe(null); // nothing selected
    store.select(a.id); expect(store.game.selected).toBe(a.id);
    store.select(a.id); expect(store.game.selected).toBe(null);
    store.select(a.id); store.setPending('integrate');
    expect(store.game.pending).toEqual({ kind: 'integrate', a: a.id });
    store.choose(a.id); // the same unit: cancels and toggles the selection off
    expect(store.game.pending).toBe(null); expect(store.game.selected).toBe(null);
    store.select(a.id); store.setPending('integrate'); store.choose(b.id);
    expect(G.stats.integrations).toBe(1);
    const h = G.units.find((u) => u.g.t === 'node');
    expect(store.game.selected).toBe(h.id); expect(store.game.pending).toBe(null);
    expect(h.parentLinks).toEqual([1, 1]);
    expect(G.units.map((u) => u.id).sort()).toEqual([c.id, h.id].sort());
  });

  it('a pending integrate is cancelled by a reset, by a wipe and by an import; a later choose integrates nothing', async () => {
    const { store } = await loadStore();
    const code = store.exportSave();
    for (const how of ['reset', 'wipe', 'import']) {
      const G = gameAt(3, 32); store.game.G = G; G.stats.peak = 100;
      const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression');
      store.select(a.id); store.setPending('integrate');
      expect(store.game.pending).toEqual({ kind: 'integrate', a: a.id });
      if (how === 'reset') { const N = store.act('nonMind'); expect(store.game.G).toBe(N); expect(N).not.toBe(G); expect(N.events.some((e) => e.type === 'reset')).toBe(true); }
      if (how === 'wipe') store.wipe();
      if (how === 'import') expect(store.importSave(code)).toEqual({ ok: true });
      expect(store.game.pending, how).toBe(null); expect(store.game.selected, how).toBe(null);
      const now = store.game.G, ints = now.stats.integrations;
      expect(() => store.choose(b.id)).not.toThrow();
      expect(now.stats.integrations, how).toBe(ints);
      expect(G.stats.integrations, how).toBe(0);
    }
  });

  it('act("nonMind") at stage 0 keeps the same game', async () => {
    const { store } = await loadStore();
    const G = store.game.G; const before = serialize(G);
    expect(store.act('nonMind')).toBe(G);
    expect(store.game.G).toBe(G); expect(serialize(G)).toBe(before);
  });

  it('wipe() is a full restart (README: "a confirmed wipe of everything, including residue"): fresh game, no cards, no residue, save and guide keys gone, other keys kept', async () => {
    const { store, ls } = await loadStore();
    const G = gameAt(9, 33); G.mu = 250; G.depth = 6; G.endings = 2; G.bestStage = 17; G.totalT = 9999; G.cards = ['first_step', 'dim_water'];
    addLeaf(G, 'reappraisal'); store.game.G = G; store.select(G.units[0].id); store.setPending('integrate');
    store.saveNow();
    ls.setItem('non-mind-tut-step', '4'); ls.setItem('nonmind-nudge-mem', '{}'); ls.setItem('non-mind-locale', 'en'); ls.setItem('non-mind-sound', 'off');
    store.wipe();
    const W = store.game.G;
    expect(W).not.toBe(G);
    expect(store.game.selected).toBe(null); expect(store.game.pending).toBe(null);
    const F = createGame(W.seed);
    for (const k of new Set([...Object.keys(W), ...Object.keys(F)])) if (!['rng', 'gain'].includes(k)) expect(JSON.stringify(W[k]), k).toBe(JSON.stringify(F[k]));
    expect(W.rng.get()).toBe(F.rng.get());
    expect([W.mu, W.depth, W.endings, W.bestStage, W.totalT, W.cards]).toEqual([0, 0, 0, 0, 0, []]);
    expect(ls.getItem(SAVE_KEY)).toBe(null);
    expect(ls.getItem('non-mind-tut-step')).toBe(null); expect(ls.getItem('nonmind-nudge-mem')).toBe(null);
    expect(ls.getItem('non-mind-locale')).toBe('en'); expect(ls.getItem('non-mind-sound')).toBe('off');
    expect(G.mu).toBe(250); // the old object is not reused
  });

  it('autosave every 10 s writes a loadable save equal to the game; a reload restores it; before-reload saves too', async () => {
    const { store, ls, win } = await loadStore();
    const G = gameAt(6, 34); addLeaf(G, 'reappraisal', { seat: { ring: 0, dir: 0 } }); store.game.G = G; store.start();
    let n = 0;
    while (ls.getItem(SAVE_KEY) === null && n < 100) { store.tick(0.25); n++; }
    expect(n).toBe(41); // saveT passes 10 on the 41st quarter second
    const saved = ls.getItem(SAVE_KEY);
    expect(saved).toBe(serialize(store.game.G));
    expect(serialize(deserialize(saved))).toBe(saved);
    expect(decodeSave(encodeSave(saved)).ok).toBe(true);
    for (let i = 0; i < 7; i++) store.tick(0.25);
    win.dispatch('nonmind:before-reload');
    const atReload = ls.getItem(SAVE_KEY);
    expect(atReload).toBe(serialize(store.game.G));
    const { store: again } = await loadStore({ [SAVE_KEY]: atReload });
    expect(serialize(again.game.G)).toBe(atReload);
    expect(again.game.started).toBe(false);
    again.start(); for (let i = 0; i < 40; i++) again.tick(0.25);
    expect(health(again.game.G)).toEqual([]);
  });

  it('a corrupt or unreadable stored save falls back to a new game that plays', async () => {
    for (const init of [{ [SAVE_KEY]: '{"seed":5,"units":[' }, { [SAVE_KEY]: 'garbage' }, { [SAVE_KEY]: '{"seed":5,"units":null}' }, { [SAVE_KEY]: 'null' }]) {
      const { store } = await loadStore(init);
      expect(store.game.G.stage).toBe(0); expect(store.game.G.t).toBe(0); expect(store.game.G.units).toEqual([]);
      store.start(); for (let i = 0; i < 40; i++) store.tick(0.25);
      expect(health(store.game.G)).toEqual([]);
    }
    const { store } = await loadStore({}, { throwing: true });
    expect(store.game.G.stage).toBe(0);
    expect(store.saveNow().ok).toBe(false);
  });

  // BUG store-load-unvalidated (critical: the game cannot start until storage is cleared). Cause: store.js:12 load() only
  // falls back when deserialize throws; a stored save that parses but is semantically broken is adopted, and the first
  // wave start throws in tick (battle.js:51 for a bad link, genome.js:99 complexityOf for a unit without traits) on every
  // frame. importSave guards with a pre-step (store.js:74); load() has no guard at all. Observed: tick throws TypeError.
  // Expected: fall back to a new game (or sanitise). Reproduction: localStorage[SAVE_KEY] = '{"seed":5,"stage":2,"rs":1,
  // "units":[{"id":1,"g":{"t":"leaf","f":"reappraisal","pole":0},"link":1,"seat":{"ring":0,"dir":0}}]}', import store, start(),
  // tick(0.1). Fix: validate like importSave (deserialize, step a copy through a wave start) and fall back on failure.
  it.fails('BUG store-load-unvalidated: a stored save that parses but is broken still gives a game that ticks', async () => {
    const bad = JSON.stringify({ seed: 5, stage: 2, rs: 1, units: [{ id: 1, g: { t: 'leaf', f: FAMILIES[0].id, pole: 0 }, link: 1, seat: { ring: 0, dir: 0 } }] });
    const { store } = await loadStore({ [SAVE_KEY]: bad });
    store.start();
    expect(() => { for (let i = 0; i < 100; i++) store.tick(0.1); }).not.toThrow();
  });
});
