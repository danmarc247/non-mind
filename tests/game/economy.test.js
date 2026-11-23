import { describe, it, expect } from 'vitest';
import {
  createGame, step, actions, habitCost, clickValue, affectMul, HABITS, HABIT_GROWTH, SHOP_ODDS, XP_TO_LEVEL, COSTS,
  FAMILIES, UPGRADES, capacityOf, muGain, unitCap,
} from '../../src/game/index.js';
import { gameAt, addLeaf, stepUntil } from './helpers.js';

describe('economy: habits', () => {
  it('habitCost grows 1.15^n from the base', () => {
    const G = gameAt(2);
    for (const h of HABITS) {
      expect(HABIT_GROWTH).toBe(1.15);
      for (const n of [0, 1, 5, 20]) { G.habits[h.id] = n; expect(habitCost(G, h)).toBeCloseTo(h.base * Math.pow(1.15, n), 6); }
    }
  });

  it('buyHabit spends affect and adds the habit', () => {
    const G = gameAt(2);
    const breath = HABITS[0];
    G.affect = 100;
    expect(actions.buyHabit(G, 'breath')).toBe(true);
    expect(G.habits.breath).toBe(1);
    expect(G.affect).toBeCloseTo(100 - breath.base);
    const second = habitCost(G, breath);
    expect(second).toBeCloseTo(11.5);
    actions.buyHabit(G, 'breath');
    expect(G.affect).toBeCloseTo(100 - breath.base - second);
  });

  it('buyHabit with n buys as many as affordable up to n and refuses when broke', () => {
    const G = gameAt(2);
    G.affect = 10 + 11.5 + 13.225 + 0.1;
    expect(actions.buyHabit(G, 'breath', 10)).toBe(true);
    expect(G.habits.breath).toBe(3);
    expect(actions.buyHabit(G, 'breath')).toBe(false);
    expect(G.habits.breath).toBe(3);
  });

  it('habits produce affect through step', () => {
    const G = gameAt(2);
    G.habits.breath = 10;
    const before = G.affect;
    step(G, 0.1);
    expect(G.prod).toBeGreaterThan(0);
    expect(G.affect).toBeGreaterThan(before);
  });
});

describe('economy: yield multipliers', () => {
  it('clickValue baseline and level/wave/cycle scaling', () => {
    const G = gameAt(1);
    expect(clickValue(G)).toBeCloseTo((1 + 0.5) * (1 + 0.1));
    G.level = 5; expect(clickValue(G)).toBeCloseTo((1 + 2.5) * 1.1);
    G.wave = 5; expect(clickValue(G)).toBeCloseTo(3.5 * 1.5);
    G.cycle = 2; expect(clickValue(G)).toBeCloseTo(3.5 * 3.5);
  });

  it('Noticing adds 1% of production to a click', () => {
    const G = gameAt(5); G.prod = 1000;
    const a = clickValue(G); G.upgrades.noticing = true;
    expect(clickValue(G)).toBeGreaterThan(a);
  });

  it('attend pays clickValue (scaled by affectMul) and counts the click', () => {
    const G = gameAt(0);
    const gained = actions.attend(G);
    expect(gained).toBeCloseTo(clickValue(G) * affectMul(G));
    expect(G.stats.clicks).toBe(1);
    expect(G.affect).toBeCloseTo(gained);
  });

  it('affectMul is monotonic in mu and complexity', () => {
    const G = gameAt(0);
    let prev = 0;
    for (const mu of [0, 1, 2, 5, 10, 50, 500]) { G.mu = mu; const m = affectMul(G); expect(m).toBeGreaterThan(prev); prev = m; }
    G.mu = 0; prev = 0;
    for (const c of [0, 1, 10, 25, 100, 1e4]) { G.complexity = c; const m = affectMul(G); expect(m).toBeGreaterThan(prev); prev = m; }
  });

  it('affectMul rises with endings and doubles per mirror', () => {
    const G = gameAt(0);
    const base = affectMul(G);
    G.endings = 3; expect(affectMul(G)).toBeCloseTo(base * 1.3);
    G.endings = 0; G.mirrors = 2; expect(affectMul(G)).toBeCloseTo(base * 4);
  });

  it('capacity grows with stage only (mu no longer matters)', () => {
    const G = gameAt(0);
    expect(capacityOf(G)).toBe(40);
    G.mu = 10; expect(capacityOf(G)).toBe(40);
    G.stage = 5; expect(capacityOf(G)).toBeCloseTo(40 * 2.5);
  });

  it('starting attention is 3 + min(20, floor(sqrt(mu)))', () => {
    expect(createGame(1, { mu: 0 }).attention).toBe(3);
    expect(createGame(1, { mu: 16 }).attention).toBe(7);
    expect(createGame(1, { mu: 1e6 }).attention).toBe(23);
  });

  it('complexity includes earned-affect and wave-depth terms', () => {
    const G = gameAt(0); step(G, 0.1); const c0 = G.complexity;
    G.stats.earned = 1e9; G.wave = 5; step(G, 0.1);
    expect(G.complexity).toBeGreaterThan(c0 + 20);
  });
});

describe('economy: shop and xp', () => {
  it('shop odds sum to 100 at every level', () => {
    expect(SHOP_ODDS).toHaveLength(10);
    for (const row of SHOP_ODDS) expect(row.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('odds never regress toward cheap tiers faster than they should: tier 1 weight is non-increasing', () => {
    for (let i = 1; i < SHOP_ODDS.length; i++) expect(SHOP_ODDS[i][0]).toBeLessThanOrEqual(SHOP_ODDS[i - 1][0]);
  });

  it('a level 1 shop only offers tier 1 families; level 10 can offer tier 5', () => {
    const tierOf = (id) => FAMILIES.find((f) => f.id === id).tier;
    for (let seed = 1; seed <= 20; seed++) {
      const G = createGame(seed);
      expect(G.shop).toHaveLength(5);
      for (const id of G.shop) expect(tierOf(id)).toBe(1);
    }
    const G = gameAt(1); G.level = 10; G.attention = 1e4;
    const seen = new Set();
    for (let i = 0; i < 300; i++) { actions.reroll(G); for (const id of G.shop) seen.add(tierOf(id)); }
    expect(seen.has(5)).toBe(true);
  });

  it('reroll costs COSTS.reroll attention, refuses when short', () => {
    const G = gameAt(1);
    expect(COSTS.reroll).toBe(2);
    G.attention = 5;
    expect(actions.reroll(G)).toBe(true); expect(G.attention).toBe(3);
    expect(actions.reroll(G)).toBe(true); expect(G.attention).toBe(1);
    expect(actions.reroll(G)).toBe(false); expect(G.attention).toBe(1);
  });

  it('buyXp pays and levels at the XP_TO_LEVEL thresholds', () => {
    const G = gameAt(1); G.attention = 1000;
    expect(XP_TO_LEVEL[0]).toBe(2);
    actions.buyXp(G); // +4 xp -> level 2 (cost 2), 2 left
    expect(G.level).toBe(2); expect(G.xp).toBe(2); expect(G.attention).toBe(1000 - COSTS.xp);
    actions.buyXp(G); // 6 >= 4 -> level 3, 2 left
    expect(G.level).toBe(3); expect(G.xp).toBe(2);
  });

  it('xp can cross several levels at once and stops at 10', () => {
    const G = gameAt(1); G.attention = 1e6;
    for (let i = 0; i < 200; i++) actions.buyXp(G);
    expect(G.level).toBe(10);
    const att = G.attention;
    expect(actions.buyXp(G)).toBe(false);
    expect(G.attention).toBe(att);
  });

  it('unitCap follows level and mirrors, capped at 30', () => {
    const G = gameAt(1);
    expect(unitCap(G)).toBe(2);
    G.level = 10; expect(unitCap(G)).toBe(11);
    G.mirrors = 20; expect(unitCap(G)).toBe(30);
  });
});

describe('economy: wave win payout (interest, streak)', () => {
  // A strong seated regulator makes wave 1 trivially winnable.
  function strongGame(attention) {
    const G = gameAt(1); G.attention = attention;
    addLeaf(G, 'equanimity', { link: 8, seat: { ring: 0, dir: 0 } });
    return G;
  }
  const wins = (G) => G.events.filter((e) => e.type === 'waveWin');

  it('the first win pays 4 + interest(attention/10, cap 5) + streak bonus', () => {
    const G = strongGame(30);
    stepUntil(G, (g) => wins(g).length >= 1, 120);
    const w = wins(G)[0];
    expect(w.interest).toBe(3);
    expect(w.pay).toBe(4 + 3 + 0);
    expect(G.attention).toBe(30 + 7);
    expect(G.streak).toBe(1);
    expect(G.wave).toBe(2);
  });

  it('interest is capped at 5 (10 with Thrift of Attention)', () => {
    const G = strongGame(500);
    stepUntil(G, (g) => wins(g).length >= 1, 120);
    expect(wins(G)[0].interest).toBe(5);
    const T = strongGame(500); T.upgrades.thrift = true;
    stepUntil(T, (g) => wins(g).length >= 1, 120);
    expect(wins(T)[0].interest).toBe(10);
  });

  it('streak bonus: +1 per 3 consecutive wins, capped at +3', () => {
    const G = strongGame(0);
    G.attention = 0;
    stepUntil(G, (g) => wins(g).length >= 4, 600);
    const ws = wins(G);
    // pay = 4 + interest + min(3, floor(streak/3)); isolate the streak share
    const streakShare = ws.map((w) => w.pay - 4 - w.interest);
    expect(streakShare.slice(0, 4)).toEqual([0, 0, 1, 1]);
  });

  it('winning raises composure back, gives xp and advances the wave', () => {
    const G = strongGame(0); G.composure = 50;
    stepUntil(G, (g) => wins(g).length >= 1, 120);
    expect(G.composure).toBeGreaterThanOrEqual(50);
    expect(G.xp + (G.level - 1) * 2).toBeGreaterThan(0);
    expect(G.affect).toBeGreaterThan(0);
  });

  it('after ten wins the cycle rolls over', () => {
    const G = strongGame(0);
    stepUntil(G, (g) => g.cycle >= 1, 3000);
    expect(G.cycle).toBe(1);
    expect(G.wave).toBe(1);
  });
});

describe('economy: upgrades and meta gain', () => {
  it('buyUpgrade is gated by stage and cost, once only', () => {
    const G = gameAt(0); G.affect = 1e12;
    const up = UPGRADES.find((u) => u.id === 'noticing');
    expect(actions.buyUpgrade(G, 'noticing')).toBe(false); // stage 0 < 2
    G.stage = up.stage; expect(actions.buyUpgrade(G, 'noticing')).toBe(true);
    expect(G.affect).toBeCloseTo(1e12 - up.cost);
    expect(actions.buyUpgrade(G, 'noticing')).toBe(false);
  });
  it('muGain scales with peak complexity and doubles on overwhelm', () => {
    const G = gameAt(5); G.stats.peak = 100;
    const a = muGain(G); G.stats.peak = 1000; const b = muGain(G);
    expect(b).toBeGreaterThan(a);
    G.overwhelm = 1; // floor() is applied after the doubling, so allow one unit of rounding
    expect(muGain(G)).toBeGreaterThanOrEqual(b * 2);
    expect(muGain(G)).toBeLessThanOrEqual(b * 2 + 1);
  });
});
