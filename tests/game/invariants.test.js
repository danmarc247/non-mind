import { describe, it, expect } from 'vitest';
import { createGame, step, defaultBot, unitCap, key } from '../../src/game/index.js';
import { badNumbers } from './helpers.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// Property-style: run the default bot and check structural invariants every simulated second (and at the end).
function checkInvariants(G, tag) {
  const bad = badNumbers(G);
  expect(bad, `${tag}: non-finite numbers`).toEqual([]);
  expect(G.affect, `${tag}: affect`).toBeGreaterThanOrEqual(0);
  expect(G.attention, `${tag}: attention`).toBeGreaterThanOrEqual(0);
  expect(G.insight, `${tag}: insight`).toBeGreaterThanOrEqual(0);
  expect(G.composure, `${tag}: composure`).toBeLessThanOrEqual(G.composureMax);
  const ids = G.units.map((u) => u.id);
  expect(new Set(ids).size, `${tag}: unique unit ids`).toBe(ids.length);
  const seated = G.units.filter((u) => u.seat);
  expect(seated.length, `${tag}: seated <= unitCap`).toBeLessThanOrEqual(unitCap(G));
  const seats = seated.map((u) => `${u.seat.ring}:${u.seat.dir}`);
  expect(new Set(seats).size, `${tag}: no shared seat`).toBe(seats.length);
  for (const u of G.units) {
    expect(u.link).toBeGreaterThanOrEqual(1); expect(u.link).toBeLessThan(12);
    expect(u.traits.length).toBeLessThanOrEqual(10 + 1);
    expect(key(u.g)).toBeTruthy();
  }
  expect(G.overwhelm).toBeGreaterThanOrEqual(0); expect(G.overwhelm).toBeLessThanOrEqual(1);
  expect(G.stage).toBeGreaterThanOrEqual(0); expect(G.stage).toBeLessThanOrEqual(17);
  expect(G.level).toBeGreaterThanOrEqual(1); expect(G.level).toBeLessThanOrEqual(10);
}

describe('invariants: 20 seeds x simulate(600)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const G = createGame(seed);
      const dt = 0.1;
      for (let i = 0; i < 6000; i++) {
        defaultBot(G, i * dt); step(G, dt); G.events.length = 0;
        if (i % 100 === 99) checkInvariants(G, `seed ${seed} t=${G.t.toFixed(1)}`);
      }
      checkInvariants(G, `seed ${seed} final`);
      expect(G.stats.clicks).toBeGreaterThan(0);
    });
  }
});

describe('invariants: odd step sizes', () => {
  it('large and tiny dts keep the state finite', () => {
    for (const dt of [0.01, 0.25, 5]) {
      const G = createGame(9);
      for (let i = 0; i < 400; i++) { defaultBot(G, i * 0.1); step(G, dt); G.events.length = 0; }
      expect(badNumbers(G)).toEqual([]);
    }
  });
});
