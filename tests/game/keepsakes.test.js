// What drifts in: it is announced, a miss makes the next one stay longer, and attendants gather what
// would otherwise leave. Engine API only; numbers come from exported constants and functions.
import { describe, it, expect } from 'vitest';
import { createGame, step, actions, serialize, deserialize, CARD_LIFETIME, CARDS, cardLifetime } from '../../src/game/index.js';
import { gameAt } from './helpers.js';

function run(G, seconds, dt = 0.1, each = null) {
  const evs = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) { step(G, dt); for (const e of G.events) evs.push({ ...e, at: G.t }); G.events.length = 0; if (each && each(G) === false) break; }
  return evs;
}
const untilOffer = (G) => run(G, 4000, 0.1, (g) => (g.cardOffer ? false : undefined));

describe('what drifts in: announced', () => {
  it('an arrival writes one log line of kind "card" that does not name the card', () => {
    const G = gameAt(1, 21);
    const before = G.log.length;
    const evs = untilOffer(G);
    expect(evs.filter((e) => e.type === 'cardAppear').length).toBe(1);
    const lines = G.log.slice(before).filter((l) => l.kind === 'card');
    expect(lines.length).toBe(1);
    const c = CARDS.find((x) => x.id === G.cardOffer.id);
    expect(lines[0].text).not.toContain(c.name);
    expect(lines[0].text.length).toBeGreaterThan(10);
  });
});

describe('what drifts in: a miss is forgiven', () => {
  it('cardLifetime grows with each miss, never shrinks, and is capped', () => {
    const G = gameAt(1, 22);
    const at = (n) => { G.cardMisses = n; return cardLifetime(G); };
    expect(at(0)).toBe(CARD_LIFETIME);
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(50)).toBe(at(500));
    expect(at(50)).toBeLessThanOrEqual(CARD_LIFETIME * 3);
    for (let n = 0; n < 12; n++) expect(at(n + 1)).toBeGreaterThanOrEqual(at(n));
  });

  it('a card that leaves counts one miss; the next one stays for cardLifetime and says how long it has', () => {
    const G = gameAt(1, 23);
    untilOffer(G);
    expect(G.cardOffer.t).toBe(CARD_LIFETIME);
    expect(G.cardOffer.life).toBe(CARD_LIFETIME);
    const gone = run(G, CARD_LIFETIME + 1);
    expect(gone.filter((e) => e.type === 'cardGone').length).toBe(1);
    expect(G.cardMisses).toBe(1);
    untilOffer(G);
    expect(G.cardOffer.t).toBe(cardLifetime(G));
    expect(G.cardOffer.t).toBeGreaterThan(CARD_LIFETIME);
    expect(G.cardOffer.life).toBe(G.cardOffer.t);
  });

  it('keeping one clears the misses', () => {
    const G = gameAt(1, 24);
    G.cardMisses = 3;
    untilOffer(G);
    expect(actions.collectCard(G)).toBeTruthy();
    expect(G.cardMisses).toBe(0);
  });

  it('misses survive a save and a reset', () => {
    const G = gameAt(2, 25);
    G.cardMisses = 2;
    expect(deserialize(serialize(G)).cardMisses).toBe(2);
    const N = actions.nonMind(G);
    expect(N.cardMisses).toBe(2);
  });
});

describe('what drifts in: attendants gather it', () => {
  it('with no attendant, a card that runs out is gone', () => {
    const G = gameAt(1, 26);
    untilOffer(G);
    const id = G.cardOffer.id;
    run(G, CARD_LIFETIME + 1);
    expect(G.cards).not.toContain(id);
  });

  it('with an attendant, a card that runs out is kept, announced as such, and is no miss', () => {
    const G = gameAt(1, 26);
    G.attendants = 1;
    untilOffer(G);
    const id = G.cardOffer.id;
    const evs = run(G, CARD_LIFETIME + 1);
    expect(G.cards).toContain(id);
    expect(G.cardOffer).toBeNull();
    expect(evs.filter((e) => e.type === 'cardGone')).toEqual([]);
    const got = evs.filter((e) => e.type === 'cardCollect');
    expect(got.length).toBe(1);
    expect(got[0].id).toBe(id);
    expect(got[0].by).toBe('attendant');
    expect(G.cardMisses || 0).toBe(0);
  });

  it('an attendant never gathers early: the card stays for its whole time first', () => {
    const G = gameAt(1, 27);
    G.attendants = 3;
    untilOffer(G);
    const id = G.cardOffer.id;
    run(G, CARD_LIFETIME - 1);
    expect(G.cardOffer?.id).toBe(id);
    expect(G.cards).not.toContain(id);
  });
});
