import { describe, it, expect } from 'vitest';
import {
  createGame, step, defaultBot, serialize, leaf, FAMILIES, HABITS, UPGRADES, SPELLS, VERBS,
  TIER_COST, aspectsOf, habitCost, suggestions, nextSuggestion, unlocked,
} from '../../src/game/index.js';
import { gameAt, addLeaf } from './helpers.js';

const tier1 = FAMILIES.filter((f) => f.tier === 1).map((f) => f.id);
const snap = (G) => serialize(G) + '|' + G.rng.get() + '|' + G.events.length + '|' + JSON.stringify(G.battle ?? null);

describe('advisor rules', () => {
  it('a fresh game suggests only attend', () => {
    const list = suggestions(createGame(1));
    expect(list.map((s) => s.id)).toEqual(['attend']);
    expect(list[0].target).toBe('attend');
  });

  it('twin buy (shop:<i>) outranks a plain buy', () => {
    const G = gameAt(1);
    G.attention = 10;
    addLeaf(G, tier1[0], { seat: { ring: 0, dir: 0 } });
    G.shop = [tier1[1], null, null, tier1[0], null];
    const list = suggestions(G);
    const twin = list.find((s) => s.id === `twin-${tier1[0]}`);
    const buy = list.find((s) => s.id === 'buy');
    expect(twin.target).toBe('shop:3');
    expect(buy).toBeTruthy();
    expect(twin.weight).toBeGreaterThan(buy.weight);
    expect(list.indexOf(twin)).toBeLessThan(list.indexOf(buy));
  });

  it('a bench unit with free seats yields a unit:<id> seat suggestion', () => {
    const G = gameAt(0);
    const u = addLeaf(G, tier1[0]);
    const s = suggestions(G).find((x) => x.id === 'seat');
    expect(s.target).toBe(`unit:${u.id}`);
  });

  it('overwhelm >= 1 yields reset first with weight >= 90', () => {
    const G = gameAt(3);
    G.overwhelm = 1.2; G.attention = 10; G.affect = 1e6;
    addLeaf(G, tier1[0]);
    const list = suggestions(G);
    expect(list[0].id).toBe('reset-now');
    expect(list[0].target).toBe('reset');
    expect(list[0].weight).toBeGreaterThanOrEqual(90);
  });
});

function validate(G, s) {
  const where = `${s.id} -> ${s.target}`;
  for (const k of ['id', 'target', 'text', 'plain']) expect(typeof s[k] === 'string' && s[k].length > 0, `${where}: ${k}`).toBe(true);
  expect(Number.isFinite(s.weight), where).toBe(true);
  const [kind, a, b] = s.target.split(':');
  const unit = (id) => G.units.find((u) => String(u.id) === id);
  switch (kind) {
    case 'shop': { const id = G.shop[+a]; expect(id, where).toBeTruthy(); expect(G.attention, where).toBeGreaterThanOrEqual(TIER_COST[FAMILIES.find((f) => f.id === id).tier - 1]); break; }
    case 'unit': expect(unit(a), where).toBeTruthy(); expect(unit(a).busy, where).toBeFalsy(); break;
    case 'op': expect(['integrate', 'subtract', 'split', 'repurpose']).toContain(a); expect(unit(b), where).toBeTruthy(); expect(unit(b).busy, where).toBeFalsy(); break;
    case 'habit': { const h = HABITS.find((x) => x.id === a); expect(h, where).toBeTruthy(); expect(G.affect, where).toBeGreaterThanOrEqual(habitCost(G, h)); break; }
    case 'upgrade': { const u = UPGRADES.find((x) => x.id === a); expect(u, where).toBeTruthy(); expect(G.upgrades[a], where).toBeFalsy(); expect(G.affect, where).toBeGreaterThanOrEqual(u.cost); break; }
    case 'spell': { const sp = SPELLS.find((x) => x.id === a); expect(sp, where).toBeTruthy(); expect(G.insight, where).toBeGreaterThanOrEqual(sp.cost); break; }
    case 'verb': {
      const v = VERBS.find((x) => x.id === a), u = unit(b);
      expect(v, where).toBeTruthy(); expect(u, where).toBeTruthy(); expect(u.busy, where).toBeFalsy(); expect(G.verbs[a], where).toBeFalsy();
      if (v.needs) expect(aspectsOf(u.g).includes(v.needs) || u.traits.includes('fade'), where).toBe(true);
      break;
    }
    case 'xp': case 'attend': case 'reroll': case 'stance': case 'mirror': case 'attendant': case 'reset': case 'lineage': case 'codex': break;
    default: throw new Error('unknown target ' + s.target);
  }
}

describe('advisor over simulated play', () => {
  it('every suggestion is well-formed, true to the rules, and never mutates G', () => {
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const G = createGame(seed);
      for (let t = 0; t < 1500; t += 0.1) {
        defaultBot(G, t); step(G, 0.1); G.events.length = 0;
        if (Math.round(t * 10) % 600 === 599) {
          const before = snap(G);
          let list;
          expect(() => { list = suggestions(G); }).not.toThrow();
          expect(snap(G)).toBe(before);
          expect(list.length).toBeGreaterThan(0);
          for (const s of list) { validate(G, s); checked++; }
          for (let i = 1; i < list.length; i++) expect(list[i - 1].weight).toBeGreaterThanOrEqual(list[i].weight);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  }, 120000);

  it('suggestions does not throw on a malformed state', () => {
    expect(() => suggestions({})).not.toThrow();
  });
});

describe('nextSuggestion', () => {
  const rich = () => {
    const G = gameAt(2);
    G.attention = 12; G.affect = 1e5;
    addLeaf(G, tier1[0]);
    return G;
  };

  it('does not repeat a non-urgent id within the cooldown and cycles through 3+ ids', () => {
    const G = rich();
    expect(suggestions(G).filter((s) => s.weight < 90).length).toBeGreaterThanOrEqual(3);
    const mem = {}, shown = [];
    for (let now = 0; now < 85; now += 5) { const s = nextSuggestion(G, mem, now, 90); if (s) shown.push(s.id); }
    expect(new Set(shown).size).toBe(shown.length);
    expect(new Set(shown).size).toBeGreaterThanOrEqual(3);
  });

  it('returns null rather than throwing when nothing is available', () => {
    const G = createGame(1), mem = {};
    expect(nextSuggestion(G, mem, 0)?.id).toBe('attend');
    let r;
    expect(() => { r = nextSuggestion(G, mem, 1); }).not.toThrow();
    expect(r).toBeNull();
    expect(() => nextSuggestion({}, {}, 0)).not.toThrow();
  });

  it('urgent suggestions can recur after 40 s but not before', () => {
    const G = gameAt(3);
    G.overwhelm = 1; G.attention = 10; G.affect = 1e5;
    addLeaf(G, tier1[0]);
    const mem = {};
    expect(nextSuggestion(G, mem, 0).id).toBe('reset-now');
    for (const now of [10, 20, 39]) expect(nextSuggestion(G, mem, now)?.id).not.toBe('reset-now');
    expect(nextSuggestion(G, mem, 41).id).toBe('reset-now');
  });
});
