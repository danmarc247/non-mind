import { describe, it, expect } from 'vitest';
import { createGame, step, actions, GIFTS, GIFT_LIFETIME, serialize, deserialize } from '../../src/game/index.js';
import { gameAt, addLeaf } from './helpers.js';
import { extendedBot } from './bots.js';

const offer = (G, kind) => { G.gift = { kind, t: GIFT_LIFETIME }; };
const totals = (G) => ({ affect: G.affect, attention: G.attention, insight: G.insight, composure: G.composure, units: G.units.length, links: G.units.reduce((n, u) => n + u.link, 0) });

describe('surprises (Transcend, Actualize, Convolute)', () => {
  it('never appear before stage 2, then appear rarely and leave after their lifetime', () => {
    const G = createGame(4); let seen = 0, firstAt = null, gone = 0;
    for (let t = 0; t < 3600; t += 0.25) {
      extendedBot(G, t); step(G, 0.25);
      for (const e of G.events) { if (e.type === 'gift') { seen++; firstAt ??= G.t; expect(G.stage).toBeGreaterThanOrEqual(2); expect(Object.keys(GIFTS)).toContain(e.kind); } if (e.type === 'giftGone') gone++; }
      G.events.length = 0;
    }
    expect(seen).toBeGreaterThanOrEqual(3);      // an hour holds a few
    expect(seen).toBeLessThanOrEqual(16);        // but they stay rare: at least ~4 minutes apart
    expect(gone).toBeGreaterThanOrEqual(seen - 1); // untaken ones simply leave
    expect(firstAt).toBeGreaterThan(60);
  });

  it('an offer lasts exactly its lifetime and taking nothing changes nothing', () => {
    const G = gameAt(6, 3); const before = totals(G);
    offer(G, 'actualize');
    for (let t = 0; t < GIFT_LIFETIME - 0.5; t += 0.25) { G.phase = 'prep'; G.phaseT = 0; step(G, 0.25); }
    expect(G.gift).toBeTruthy();
    for (let t = 0; t < 1; t += 0.25) { G.phase = 'prep'; G.phaseT = 0; step(G, 0.25); }
    expect(G.gift).toBeNull();
    expect(totals(G).units).toBe(before.units); expect(totals(G).links).toBe(before.links);
  });

  for (const kind of Object.keys(GIFTS)) {
    it(`${kind} never takes anything away`, () => {
      for (const seed of [1, 2, 3]) {
        const G = createGame(seed);
        for (let t = 0; t < 900; t += 0.25) { extendedBot(G, t); step(G, 0.25); G.events.length = 0; }
        const before = totals(G);
        offer(G, kind);
        expect(actions.takeGift(G)).toBe(kind);
        const after = totals(G);
        for (const k of Object.keys(before)) expect(after[k], `${kind} ${k} seed ${seed}`).toBeGreaterThanOrEqual(before[k]);
        expect(G.gift).toBeNull();
        expect(actions.takeGift(G)).toBe(false); // nothing left to take
      }
    });
  }

  it('transcend lifts the lowest seated regulator by exactly one link and never past 11', () => {
    const G = gameAt(6, 5);
    const a = addLeaf(G, 'suppression', { link: 2, seat: { ring: 0, dir: 0 } }), b = addLeaf(G, 'containment', { link: 5, seat: { ring: 0, dir: 5 } });
    offer(G, 'transcend'); actions.takeGift(G);
    expect(a.link).toBe(3); expect(b.link).toBe(5);
    a.link = 11; b.link = 11; const att = G.attention;
    offer(G, 'transcend'); actions.takeGift(G);
    expect(a.link).toBe(11); expect(b.link).toBe(11); expect(G.attention).toBe(att + 2);
  });

  it('convolute fills the arrivals with families already held', () => {
    const G = gameAt(6, 5);
    addLeaf(G, 'rumination'); addLeaf(G, 'attunement');
    offer(G, 'convolute'); actions.takeGift(G);
    expect(G.shop.every((id) => ['rumination', 'attunement'].includes(id))).toBe(true);
  });

  it('an offer survives a save and a reset simply drops it', () => {
    const G = gameAt(6, 7); offer(G, 'actualize');
    expect(deserialize(serialize(G)).gift.kind).toBe('actualize');
    expect(actions.nonMind(G).gift).toBeNull();
  });
});
