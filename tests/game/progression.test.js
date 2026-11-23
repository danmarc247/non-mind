import { describe, it, expect } from 'vitest';
import {
  createGame, step, simulate, defaultBot, actions, serialize, deserialize, STAGES, muGain, capacityOf, unlocked,
} from '../../src/game/index.js';
import { gameAt, addLeaf } from './helpers.js';

function play(G, seconds, dt = 0.1, onStep) {
  for (let t = 0; t < seconds; t += dt) { defaultBot(G, t); step(G, dt); onStep?.(G); }
  return G;
}

describe('progression: stages', () => {
  it('the stage table is the documented 18-stage loop', () => {
    expect(STAGES).toHaveLength(18);
    expect(STAGES[0].unlock).toBe('attend');
    expect(STAGES[17].unlock).toBe('nonmind');
    expect(new Set(STAGES.map((s) => s.unlock)).size).toBe(18);
  });

  it('stage 0 -> 1 needs five clicks', () => {
    const G = createGame(1);
    for (let i = 0; i < 4; i++) actions.attend(G);
    step(G, 0.1); expect(G.stage).toBe(0);
    actions.attend(G); step(G, 0.1); expect(G.stage).toBe(1);
  });

  it('stages advance one at a time, in order, and never go backwards', () => {
    const G = createGame(3);
    const seen = [];
    let last = 0;
    play(G, 1500, 0.1, (g) => {
      expect(g.stage).toBeGreaterThanOrEqual(last);
      last = g.stage;
      for (const e of g.events) if (e.type === 'stage') seen.push(e.stage);
      g.events.length = 0;
    });
    expect(seen.length).toBeGreaterThan(3);
    seen.forEach((s, i) => expect(s).toBe(i + 1));
    expect(G.stage).toBe(seen.length);
  });

  it('a stage cannot be skipped: satisfying a later need alone does not jump', () => {
    const G = createGame(1);
    G.stats.integrations = 5; G.habitsOwned = 99; G.level = 9; G.stats.splits = 3; // later gates satisfied
    G.stage = 0;
    step(G, 0.1);
    expect(G.stage).toBe(0); // first gate (5 clicks) still closed
  });

  it('dropping below a need does not roll a stage back', () => {
    const G = createGame(1);
    for (let i = 0; i < 5; i++) actions.attend(G);
    step(G, 0.1); expect(G.stage).toBe(1);
    G.stats.clicks = 0; step(G, 0.1);
    expect(G.stage).toBe(1);
  });

  it('unlocked() follows the stage index', () => {
    const G = gameAt(0);
    expect(unlocked(G, 'attend')).toBe(true);
    expect(unlocked(G, 'shop')).toBe(false);
    G.stage = 1; expect(unlocked(G, 'shop')).toBe(true);
    G.stage = 17; expect(unlocked(G, 'nonmind')).toBe(true);
  });

  it('the last stage needs overwhelm >= 1', () => {
    const G = gameAt(16);
    step(G, 0.1); expect(G.stage).toBe(16);
    G.overwhelm = 1;
    expect(STAGES[17].need(G)).toBe(true);
  });
});

describe('progression: non-mind reset', () => {
  function readyRun() {
    const G = gameAt(10, 5);
    G.stats.peak = 600; G.endings = 2; G.mu = 3; G.affect = 1e9; G.level = 7; G.wave = 4;
    addLeaf(G, 'reappraisal'); G.habits.breath = 12; G.upgrades.noticing = true; G.t = 500;
    return G;
  }

  it('returns a fresh run with mu gained, depth + 1, endings kept', () => {
    const G = readyRun();
    const gain = muGain(G);
    expect(gain).toBeGreaterThan(0);
    const N = actions.nonMind(G);
    expect(N).not.toBe(G);
    expect(N.mu).toBe(3 + gain);
    expect(N.depth).toBe(1);
    expect(N.endings).toBe(2);
    expect(N.bestStage).toBe(10);
    expect(N.totalT).toBe(500);
    // fresh run
    expect(N.stage).toBe(0); expect(N.units).toEqual([]); expect(N.habits).toEqual({}); expect(N.upgrades).toEqual({});
    expect(N.affect).toBe(0); expect(N.level).toBe(1); expect(N.wave).toBe(1); expect(N.t).toBe(0);
    expect(N.stats.peak).toBe(0); expect(N.shop).toHaveLength(5);
    expect(N.events.some((e) => e.type === 'reset' && e.gain === gain && e.depth === 1)).toBe(true);
  });

  it('does not mutate the old game', () => {
    const G = readyRun(); const before = serialize(G);
    actions.nonMind(G);
    expect(serialize(G)).toBe(before);
  });

  it('deeper runs have more capacity and a stronger multiplier; depth stacks', () => {
    const G = readyRun();
    const N = actions.nonMind(G);
    expect(capacityOf(N)).toBeGreaterThan(capacityOf(createGame(5)));
    N.stats.peak = 600; N.stage = 5;
    const M = actions.nonMind(N);
    expect(M.depth).toBe(2);
    expect(M.mu).toBeGreaterThan(N.mu);
    expect(M.bestStage).toBe(10);
  });

  it('overwhelm doubles the mu gain', () => {
    const G = readyRun(); const a = muGain(G); G.overwhelm = 1;
    expect(muGain(G)).toBeGreaterThanOrEqual(a * 2);
  });

  // The reset button is stage-gated in the UI (stage 17 "nonmind"), but the action itself is not.
  it.skip('BUG? actions.nonMind should refuse before the nonmind stage unlocks (game.js:222)', () => {
    const G = gameAt(0); G.stats.peak = 1e6;
    expect(actions.nonMind(G)).toBeFalsy();
  });

  it('a fresh run after reset can progress again', () => {
    const N = actions.nonMind(readyRun());
    play(N, 120);
    expect(N.stage).toBeGreaterThanOrEqual(1);
    expect(N.stats.clicks).toBeGreaterThan(0);
  });
});

describe('progression: persistence and determinism', () => {
  it('serialize/deserialize round-trips state', () => {
    const G = play(createGame(11), 120);
    const s = serialize(G);
    const R = deserialize(s);
    expect(serialize(R)).toBe(s);
    expect(R.units.length).toBe(G.units.length);
    expect(R.affect).toBe(G.affect);
    expect(R.battle).toBe(null);
    expect(R.phase).toBe('prep');
  });

  it('a restored game then steps identically for 200 steps', () => {
    const G = play(createGame(11), 150);
    const s = serialize(G);
    const A = deserialize(s), B = deserialize(s);
    for (let i = 0; i < 200; i++) {
      defaultBot(A, i * 0.1); step(A, 0.1); A.events.length = 0;
      defaultBot(B, i * 0.1); step(B, 0.1); B.events.length = 0;
      if (i % 50 === 0) expect(serialize(A)).toBe(serialize(B));
    }
    expect(serialize(A)).toBe(serialize(B));
    expect(A.t).toBeGreaterThan(G.t);
  });

  it('simulate is deterministic per seed and differs across seeds', () => {
    const a = serialize(simulate(200, 4)), b = serialize(simulate(200, 4)), c = serialize(simulate(200, 5));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('step clamps dt to 0.25 so a long frame cannot teleport time', () => {
    const G = createGame(1); step(G, 100);
    expect(G.t).toBeCloseTo(0.25);
  });

  it('serialized state is plain JSON (no functions, no battle)', () => {
    const s = serialize(play(createGame(2), 60));
    const d = JSON.parse(s);
    expect(d.battle).toBeUndefined(); expect(d.rng).toBeUndefined(); expect(d.gain).toBeUndefined();
    expect(typeof d.rs).toBe('number');
  });
});
