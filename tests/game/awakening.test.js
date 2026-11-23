// Awakening: what stage 17 opens. A restart from the very beginning that keeps only the count of
// awakenings (a small lasting yield bonus) and the book. Engine API only.
import { describe, it, expect } from 'vitest';
import { createGame, actions, serialize, deserialize, STAGES, unlocked, affectMul, AWAKENING_BONUS, awakeningBonus } from '../../src/game/index.js';
import { gameAt } from './helpers.js';

const LAST = STAGES.length - 1;

describe('awakening', () => {
  it('is what the last stage opens', () => {
    expect(STAGES[LAST].unlock).toBe('awakening');
    const G = createGame(1);
    expect(unlocked(G, 'awakening')).toBe(false);
    G.stage = LAST; expect(unlocked(G, 'awakening')).toBe(true);
  });

  it('is refused before the last stage and changes nothing', () => {
    const G = gameAt(LAST - 1, 31);
    const before = serialize(G);
    expect(actions.awaken(G)).toBe(false);
    expect(serialize(G)).toBe(before);
  });

  it('starts from the very beginning: no residue, depth, endings or progress; one more awakening', () => {
    const G = gameAt(LAST, 32);
    G.mu = 500; G.depth = 7; G.endings = 2; G.bestStage = LAST; G.totalT = 9000; G.awakenings = 1;
    const before = serialize(G);
    const N = actions.awaken(G);
    expect(N).not.toBe(G);
    expect(serialize(G)).toBe(before);
    expect(N.awakenings).toBe(2);
    expect([N.mu, N.depth, N.endings, N.bestStage, N.totalT, N.stage, N.t]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(N.units).toEqual([]);
    expect(N.events.some((e) => e.type === 'awaken' && e.n === 2)).toBe(true);
    // apart from the count and the book it is exactly a first game
    const first = createGame(G.seed, { awakenings: 2, cards: [], cardMisses: 0 });
    const strip = (g) => { const o = JSON.parse(serialize(g)); delete o.log; delete o.lastKoan; return o; };
    expect(strip(N)).toEqual(strip(first));
  });

  it('keeps the book', () => {
    const G = gameAt(LAST, 33);
    G.cards = ['first_step', 'open_hand']; G.cardMisses = 2;
    const N = actions.awaken(G);
    expect(N.cards).toEqual(['first_step', 'open_hand']);
    expect(N.cards).not.toBe(G.cards);
    expect(N.cardMisses).toBe(2);
  });

  it('each awakening adds the same small share of yield, and nothing else', () => {
    expect(AWAKENING_BONUS).toBeGreaterThan(0);
    expect(AWAKENING_BONUS).toBeLessThanOrEqual(0.1);
    const a = createGame(5), b = createGame(5, { awakenings: 1 }), c = createGame(5, { awakenings: 3 });
    expect(awakeningBonus(a)).toBe(0);
    expect(awakeningBonus(c)).toBeCloseTo(3 * AWAKENING_BONUS, 12);
    expect(affectMul(b) / affectMul(a)).toBeCloseTo(1 + AWAKENING_BONUS, 12);
    expect(affectMul(c) / affectMul(a)).toBeCloseTo(1 + 3 * AWAKENING_BONUS, 12);
    expect(b.attention).toBe(a.attention);
  });

  it('the count survives non-mind and a save', () => {
    const G = gameAt(3, 34);
    G.awakenings = 4;
    expect(actions.nonMind(G).awakenings).toBe(4);
    expect(deserialize(serialize(G)).awakenings).toBe(4);
  });
});
