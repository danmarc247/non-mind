// Functional tests for three side systems: the 22 cards, the advisor, and the locale layer.
// Engine API only. Every expected number is derived from exported constants and functions, so balance
// tuning does not break these tests; only a change of rule does.
import { describe, it, expect, afterAll, vi } from 'vitest';
import {
  createGame, step, actions, serialize, deserialize, leaf, node, nameOf, FAMILIES, FAMILY, CARDS, cardById, cardBoon,
  CARD_LIFETIME, ASPECT_IDS, affectMul, capacityOf, unitStats, aspectTiers, muGain, ringsOpen, suggestions, nextSuggestion,
  SUGGESTION_LIFETIME, SUGGESTION_GAP, BENCH, COSTS, STAGES, LINKS, TRAITS, ASPECTS, WAVE_ARC, HABITS, UPGRADES, SPELLS,
  VERBS, MOODS, STANCES, STRESSORS, STRESSOR_AFFIXES, MUTATIONS, KOANS, ABILITIES, unlocked,
} from '../../src/game/index.js';
import { STRESSOR_EXTRA } from '../../src/game/content/stressors.js';
import { NAMING } from '../../src/game/genome.js';
import { encodeSave, decodeSave } from '../../src/game/savecode.js';
import { game, wipe, exportSave, importSave } from '../../src/game/store.js';
import { setLocale, getLocale, initialLocale, LOCALE_SWITCH, onLocale } from '../../src/i18n/index.js';
import DE from '../../src/i18n/de/data.js';
import DE_MUT from '../../src/i18n/de/mutations.js';
import DE_KOANS from '../../src/i18n/de/koans.js';
import DE_CARDS from '../../src/i18n/de/cards.js';
import { gameAt, addLeaf, addRaw, badNumbers } from './helpers.js';
import { extendedBot } from './bots.js';

const FIDS = FAMILIES.map((f) => f.id);
const tier1 = FAMILIES.filter((f) => f.tier === 1).map((f) => f.id);
const BOON_KINDS = ['affect', 'attention', 'insight', 'tolerance', 'salience', 'capacity', 'residue'];
const idsOfKind = (kind) => CARDS.filter((c) => c.boon.kind === kind).map((c) => c.id);
const sumOfKind = (kind, field = 'pct') => CARDS.filter((c) => c.boon.kind === kind).reduce((n, c) => n + c.boon[field], 0);
const snap = (G) => serialize(G) + '|' + G.rng.get() + '|' + JSON.stringify(G.events) + '|' + JSON.stringify(G.battle ?? null);

/** Step and keep the events of each step (G.events is cleared afterwards, as the UI does). */
function run(G, seconds, dt = 0.25, each = null) {
  const evs = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) { step(G, dt); for (const e of G.events) evs.push({ ...e, at: G.t }); G.events.length = 0; if (each && each(G) === false) break; }
  return evs;
}

// ======================================================================================= CARDS
describe('cards: the catalogue', () => {
  it('holds exactly 22 cards, n 0..21 in order, unique ids and symbols, valid aspect and boon', () => {
    expect(CARDS.length).toBe(22);
    CARDS.forEach((c, i) => expect(c.n).toBe(i));
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(22);
    expect(new Set(CARDS.map((c) => c.symbol)).size).toBe(22);
    for (const c of CARDS) {
      for (const k of ['id', 'name', 'principle', 'quote', 'symbol', 'tone']) expect(typeof c[k] === 'string' && c[k].length > 0, `${c.id}.${k}`).toBe(true);
      expect(['article', 'original']).toContain(c.quoteSource);
      expect(ASPECT_IDS).toContain(c.aspect);
      expect(BOON_KINDS).toContain(c.boon.kind);
      // attention is a flat amount per won wave; every other boon is a percentage
      const field = c.boon.kind === 'attention' ? 'flat' : 'pct';
      expect(Number.isFinite(c.boon[field]) && c.boon[field] > 0, `${c.id} boon`).toBe(true);
      expect(Object.keys(c.boon).sort()).toEqual(['kind', field].sort());
      expect(cardById[c.id]).toBe(c);
    }
    // every boon kind is carried by at least one card, so every effect is reachable
    for (const k of BOON_KINDS) expect(idsOfKind(k).length, k).toBeGreaterThan(0);
  });
});

describe('cards: offers', () => {
  it('no card is offered before stage 1, however long one waits', () => {
    const G = createGame(11);
    const evs = run(G, 900);
    expect(G.stage).toBe(0);
    expect(G.cardOffer).toBeNull();
    expect(evs.filter((e) => e.type === 'cardAppear')).toEqual([]);
  });

  it('an offer arrives only after the timer, lives CARD_LIFETIME seconds, then leaves with cardGone', () => {
    const G = gameAt(1, 12);
    const firstAfter = G.cardT;
    const evs = run(G, 2000, 0.1, (g) => (g.cardOffer ? false : undefined));
    const appear = evs.filter((e) => e.type === 'cardAppear');
    expect(appear.length).toBe(1);
    expect(appear[0].at).toBeGreaterThanOrEqual(firstAfter - 1e-6);
    const o = G.cardOffer;
    expect(o.id).toBe(appear[0].id);
    expect(cardById[o.id]).toBeTruthy();
    expect(o.t).toBe(CARD_LIFETIME);
    expect(Number.isFinite(o.x) && Number.isFinite(o.z)).toBe(true);
    // still there just before the lifetime ends
    let gone = run(G, CARD_LIFETIME - 0.3, 0.1);
    expect(gone.filter((e) => e.type === 'cardGone')).toEqual([]);
    expect(G.cardOffer?.id).toBe(o.id);
    gone = run(G, 0.6, 0.1);
    expect(gone.filter((e) => e.type === 'cardGone').map((e) => e.id)).toEqual([o.id]);
    expect(G.cardOffer).toBeNull();
    expect(G.cards).toEqual([]);
  });

  it('collecting adds the card exactly once, emits cardCollect with the count, and clears the offer', () => {
    const G = gameAt(3, 13);
    G.cards = ['first_step', 'open_hand'];
    G.cardOffer = { id: 'lamp_alone', t: 10, x: 1, z: 2 };
    const c = actions.collectCard(G);
    expect(c).toBe(cardById.lamp_alone);
    expect(G.cards).toEqual(['first_step', 'open_hand', 'lamp_alone']);
    expect(G.cardOffer).toBeNull();
    const ev = G.events.filter((e) => e.type === 'cardCollect');
    expect(ev).toEqual([{ type: 'cardCollect', id: 'lamp_alone', n: cardById.lamp_alone.n, x: 1, z: 2, count: 3 }]);
    expect(G.log.at(-1).text).toContain(cardById.lamp_alone.name);
    // nothing to collect now; and an offer of an owned card is refused without duplicating it
    expect(actions.collectCard(G)).toBe(false);
    G.cardOffer = { id: 'lamp_alone', t: 10, x: 0, z: 0 };
    expect(actions.collectCard(G)).toBe(false);
    expect(G.cards.filter((id) => id === 'lamp_alone').length).toBe(1);
    expect(G.cardOffer).toBeNull();
  });

  it('a card already held is never offered again (only the missing one keeps coming)', () => {
    const G = gameAt(4, 14);
    const missing = CARDS[17].id;
    G.cards = CARDS.map((c) => c.id).filter((id) => id !== missing);
    const evs = run(G, 3000);          // offers are left to expire, so the same card may come again and again
    const appear = evs.filter((e) => e.type === 'cardAppear');
    expect(appear.length).toBeGreaterThanOrEqual(5);
    expect(new Set(appear.map((e) => e.id))).toEqual(new Set([missing]));
    expect(evs.filter((e) => e.type === 'cardGone').length).toBeGreaterThanOrEqual(appear.length - 1);
  });

  it('a patient collector across resets completes all 22 in bounded game time; then offers stop and nothing breaks', () => {
    const RUN = 900;
    // expected seconds per offer: mean timer (80 + 90/2) over the 0.6 chance; plus the 70 s wait every run
    const perOffer = (80 + 45) / 0.6;
    const bound = 3 * (22 * perOffer + Math.ceil((22 * perOffer) / RUN) * 70);
    const times = [];
    for (const seed of [21, 22, 23]) {
      let G = createGame(seed), total = 0, collected = 0;
      while (G.cards.length < 22 && total < bound) {
        for (let i = 0; i < 5; i++) actions.attend(G);
        run(G, RUN, 0.25, (g) => { if (g.cardOffer) { const before = g.cards.length; expect(actions.collectCard(g)).toBeTruthy(); expect(g.cards.length).toBe(before + 1); collected++; } if (g.cards.length >= 22) return false; });
        total += G.t;
        if (G.cards.length < 22) { const N = actions.nonMind(G); expect(N).not.toBe(G); expect(N.cards).toEqual(G.cards); G = N; }
      }
      expect(G.cards.length, `seed ${seed} after ${total.toFixed(0)} s`).toBe(22);
      expect(collected).toBe(22);
      expect(new Set(G.cards)).toEqual(new Set(CARDS.map((c) => c.id)));
      times.push(Math.round(total));
      // once the set is complete: no further offer, and the game keeps running cleanly
      const evs = run(G, 2500);
      expect(evs.filter((e) => e.type === 'cardAppear')).toEqual([]);
      expect(G.cardOffer).toBeNull();
      expect(G.cards.length).toBe(22);
      expect(badNumbers(G)).toEqual([]);
      const N = actions.nonMind(G);
      expect(N.cards.length).toBe(22);
      expect(run(N, 600).filter((e) => e.type === 'cardAppear')).toEqual([]);
    }
    console.log(`[cards] game seconds to collect all 22 (runs of ${RUN} s, with resets): ${times.join(', ')} (bound ${Math.round(bound)})`);
    for (const t of times) expect(t).toBeLessThan(bound);
  }, 60000);
});

describe('cards: each boon has exactly its stated effect and stacks additively', () => {
  const stage8 = () => {
    const G = gameAt(8, 31);
    G.mu = 40; G.endings = 2; G.complexity = 30; G.composure = 60; G.stats.earned = 1e6; G.level = 4;
    addLeaf(G, 'reappraisal', { link: 4, seat: { ring: 0, dir: 0 } });
    addLeaf(G, FIDS[3], { link: 3, seat: { ring: 0, dir: 5 } });
    return G;
  };
  const others = (kind) => CARDS.filter((c) => c.boon.kind !== kind).map((c) => c.id);

  it('cardBoon sums every held card of a kind', () => {
    const G = gameAt(1);
    G.cards = CARDS.map((c) => c.id);
    for (const k of BOON_KINDS) expect(cardBoon(G, k, k === 'attention' ? 'flat' : 'pct')).toBe(sumOfKind(k, k === 'attention' ? 'flat' : 'pct'));
    G.cards = [];
    for (const k of BOON_KINDS) expect(cardBoon(G, k)).toBe(0);
  });

  it('affect: affectMul rises by exactly the summed pct (additive, not compounded); other cards do nothing', () => {
    const G = stage8();
    const base = affectMul(G);
    const ids = idsOfKind('affect');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    G.cards = [ids[0]];
    expect(affectMul(G) / base).toBeCloseTo(1 + cardById[ids[0]].boon.pct / 100, 12);
    G.cards = ids;
    expect(affectMul(G) / base).toBeCloseTo(1 + sumOfKind('affect') / 100, 12);
    G.cards = others('affect');
    expect(affectMul(G)).toBeCloseTo(base, 9);
    // the boon reaches the real economy: a click pays affectMul-scaled affect
    G.cards = ids; const a = actions.attend(G); G.cards = []; const b = actions.attend(G);
    expect(a / b).toBeCloseTo(1 + sumOfKind('affect') / 100, 9);
  });

  it('attention: a won wave pays exactly the summed flat amount more (and the event pay is unchanged)', () => {
    const make = (cards) => { const G = gameAt(1, 41); G.cards = cards; G.attention = 12; addLeaf(G, 'equanimity', { link: 8, seat: { ring: 0, dir: 0 } }); return G; };
    const A = make([]), B = make(idsOfKind('attention'));
    let winA = null, winB = null;
    for (let i = 0; i < 2400 && !winA; i++) {
      step(A, 0.1); step(B, 0.1);
      winA = A.events.find((e) => e.type === 'waveWin'); winB = B.events.find((e) => e.type === 'waveWin');
      A.events.length = 0; B.events.length = 0;
    }
    expect(winA).toBeTruthy();
    expect(winB).toEqual(winA);
    expect(B.attention - A.attention).toBe(sumOfKind('attention', 'flat'));
  });

  it('insight: regen per second is multiplied by exactly 1 + summed pct', () => {
    const regen = (cards) => { const G = gameAt(5, 51); G.level = 6; G.insight = 0; G.cards = cards; step(G, 0.2); return G.insight; };
    const base = regen([]);
    expect(base).toBeCloseTo((1 + 0.15 * 6) * 0.2, 12);
    expect(regen(idsOfKind('insight')) / base).toBeCloseTo(1 + sumOfKind('insight') / 100, 12);
    expect(regen(others('insight'))).toBeCloseTo(base, 12);
  });

  it('tolerance and salience: unitStats scale by exactly 1 + summed pct, each only its own stat', () => {
    const G = stage8();
    const u = G.units[0], tiers = aspectTiers(G);
    const base = unitStats(G, u, tiers);
    G.cards = idsOfKind('tolerance');
    let s = unitStats(G, u, tiers);
    expect(s.tol / base.tol).toBeCloseTo(1 + sumOfKind('tolerance') / 100, 12);
    expect(s.sal).toBeCloseTo(base.sal, 9);
    G.cards = idsOfKind('salience');
    s = unitStats(G, u, tiers);
    expect(s.sal / base.sal).toBeCloseTo(1 + sumOfKind('salience') / 100, 12);
    expect(s.tol).toBeCloseTo(base.tol, 9);
    G.cards = [...idsOfKind('salience'), ...idsOfKind('tolerance')];
    s = unitStats(G, u, tiers);
    expect(s.sal / base.sal).toBeCloseTo(1 + sumOfKind('salience') / 100, 12);
    expect(s.tol / base.tol).toBeCloseTo(1 + sumOfKind('tolerance') / 100, 12);
    for (const k of ['lat', 'reach', 'opa', 'lab', 'rec']) expect(s[k]).toBe(base[k]);
    // and the battle uses it: a wave started with the cards fields the boosted unit
    G.cards = idsOfKind('tolerance');
    const want = unitStats(G, u, aspectTiers(G)).tol;
    actions.ready(G); step(G, 0.1);
    expect(G.phase).toBe('fight');
    expect(G.battle.units.find((c) => c.uid === u.id).max).toBeCloseTo(want, 9);
  });

  it('capacity: capacityOf and the stepped capacity scale by exactly 1 + summed pct', () => {
    for (const stage of [1, 9, 17]) {
      const G = gameAt(stage, 61);
      expect(capacityOf(G)).toBeCloseTo(40 * (1 + 0.3 * stage), 9);
      G.cards = idsOfKind('capacity');
      expect(capacityOf(G)).toBeCloseTo(40 * (1 + 0.3 * stage) * (1 + sumOfKind('capacity') / 100), 9);
      step(G, 0.1);
      expect(G.capacity).toBeCloseTo(capacityOf(G), 9);
    }
  });

  it('residue: muGain is floor(base gain x (1 + summed pct)), and the reset pays exactly that', () => {
    const G = gameAt(17, 71);
    G.stats.peak = 4321; G.overwhelm = 1; G.depth = 3; G.mu = 17;
    const base = muGain(G);
    expect(base).toBeGreaterThan(100);
    G.cards = idsOfKind('residue');
    const boosted = muGain(G);
    expect(boosted).toBe(Math.floor(base * (1 + sumOfKind('residue') / 100)));
    expect(boosted).toBeGreaterThan(base);
    const N = actions.nonMind(G);
    expect(N.mu).toBe(17 + boosted);
    G.cards = others('residue');
    expect(muGain(G)).toBe(base);
  });
});

describe('cards: persistence through reset, save and wipe', () => {
  it('cards survive nonMind (in order, unduplicated) and an open offer does not', () => {
    const G = gameAt(9, 81);
    G.cards = ['the_turning', 'first_step', 'whole_turn'];
    G.cardOffer = { id: 'dim_water', t: 12, x: 0, z: 1 };
    const N = actions.nonMind(G);
    expect(N.cards).toEqual(['the_turning', 'first_step', 'whole_turn']);
    expect(N.cards).not.toBe(G.cards);
    expect(N.cardOffer).toBeNull();
    expect(N.depth).toBe(G.depth + 1);
    // the kept cards keep working in the new run
    expect(cardBoon(N, 'affect')).toBe(cardBoon(G, 'affect'));
  });

  it('cards, the open offer and the card timer round-trip through serialize and the save code', () => {
    const G = gameAt(6, 82);
    G.cards = ['half_veil', 'clean_ending'];
    G.cardOffer = { id: 'tight_knot', t: 7.5, x: -2, z: 3 };
    G.cardT = 33.25;
    const D = deserialize(serialize(G));
    expect(D.cards).toEqual(G.cards);
    expect(D.cardOffer).toEqual(G.cardOffer);
    expect(D.cardT).toBe(G.cardT);
    const r = decodeSave(encodeSave(serialize(G)));
    expect(r.ok).toBe(true);
    const E = deserialize(r.json);
    expect(E.cards).toEqual(G.cards);
    expect(actions.collectCard(E).id).toBe('tight_knot');
    expect(E.cards).toEqual(['half_veil', 'clean_ending', 'tight_knot']);
  });

  it('the store: export/import keeps cards; wipe (a full restart, per README "wipe of everything") clears them', () => {
    const G = gameAt(5, 83);
    G.cards = CARDS.slice(0, 7).map((c) => c.id); G.mu = 99; G.depth = 4;
    game.G = G;
    const code = exportSave();
    wipe();
    expect(game.G).not.toBe(G);
    expect(game.G.cards).toEqual([]);
    expect(game.G.mu).toBe(0);
    expect(game.G.depth).toBe(0);
    expect(game.G.stage).toBe(0);
    expect(importSave(code)).toEqual({ ok: true });
    expect(game.G.cards).toEqual(G.cards);
    expect(game.G.mu).toBe(99);
    wipe();
  });
});

// ======================================================================================= ADVISOR
const freeSeat = (C) => { const taken = new Set(C.units.filter((o) => o.seat).map((o) => o.seat.ring * 10 + o.seat.dir)); for (let i = 0; i < ringsOpen(C) * 10; i++) if (!taken.has(i)) return { ring: Math.floor(i / 10), dir: i % 10 }; return null; };
/** Perform what a suggestion points at on C. true/false = the action's result; null = not an action target. */
function perform(C, s) {
  const [kind, a, b] = s.target.split(':');
  const bench = C.units.filter((u) => !u.seat && !u.busy);
  switch (kind) {
    case 'shop': return actions.buy(C, +a);
    case 'reroll': return actions.reroll(C);
    case 'xp': return actions.buyXp(C);
    case 'unit': { const seat = freeSeat(C); return !!seat && actions.place(C, +a, seat); }
    case 'op': {
      if (a === 'split') return actions.split(C, +b);
      if (a === 'repurpose') return actions.repurpose(C, +b);
      const other = bench.find((u) => u.id !== +b);
      return !!other && !!actions[a](C, +b, other.id);
    }
    case 'habit': return actions.buyHabit(C, a);
    case 'upgrade': return actions.buyUpgrade(C, a);
    case 'spell': return actions.cast(C, a);
    case 'verb': return actions.startVerb(C, a, +b);
    case 'stance': return actions.chooseStance(C, 'toward');
    case 'mirror': return actions.mirror(C);
    case 'attendant': return actions.buyAttendant(C);
    case 'reset': return actions.nonMind(C) !== C;
    case 'card': return !!actions.collectCard(C);
    case 'attend': return actions.attend(C) > 0;
    case 'lineage': case 'codex': return null;
    default: throw new Error(`unknown target ${s.target}`);
  }
}
const copy = (G) => deserialize(serialize(G));
/** All suggestions whose action fails on a copy, as "id -> target". */
const invalid = (G, skip = []) => suggestions(G).filter((s) => !skip.includes(s.id) && perform(copy(G), s) === false).map((s) => `${s.id} -> ${s.target} @stage ${G.stage}`);

// one long late-game run shared by the play tests (cheap to reuse, expensive to repeat)
let PLAY = null;
function playSamples() {
  if (PLAY) return PLAY;
  PLAY = { samples: [], offerSecs: 0, cardMismatch: [], mutated: [], stages: new Set() };
  for (const seed of [2, 5]) {
    const G = createGame(seed);
    for (let i = 0; i < 40000; i++) {
      const t = i * 0.1;
      extendedBot(G, t); step(G, 0.1); G.events.length = 0;
      if (i % 10 === 0) {
        const list = suggestions(G), card = list.find((s) => s.target === 'card');
        if (G.cardOffer) PLAY.offerSecs++;
        if (!!card !== !!G.cardOffer || (card && card.id !== `card-${G.cardOffer.id}`)) PLAY.cardMismatch.push(`${seed}@${t.toFixed(1)}`);
      }
      if (i % 300 === 150) {
        const before = snap(G);
        const list = suggestions(G);
        if (snap(G) !== before) PLAY.mutated.push(`${seed}@${t.toFixed(1)}`);
        PLAY.samples.push({ seed, t, stage: G.stage, list, json: serialize(G), ow: G.overwhelm });
        PLAY.stages.add(G.stage);
      }
    }
  }
  return PLAY;
}

describe('advisor: suggestions are true at high stages', () => {
  it('with extendedBot play to stage 17: every actionable suggestion succeeds on a copy, and suggestions never mutate G', () => {
    const P = playSamples();
    expect(P.stages.has(17)).toBe(true);
    expect(P.samples.filter((s) => s.stage >= 12).length).toBeGreaterThan(100);
    expect(P.mutated).toEqual([]);
    const bad = [];
    let acted = 0;
    for (const smp of P.samples) {
      for (const s of smp.list) {
        if (s.id === 'stuck') continue;   // covered by BUG advisor-stuck below
        const r = perform(deserialize(smp.json), s);
        if (r === false) bad.push(`${s.id} -> ${s.target} (seed ${smp.seed} t ${smp.t.toFixed(0)} stage ${smp.stage})`);
        if (r === true) acted++;
      }
      for (let i = 1; i < smp.list.length; i++) expect(smp.list[i - 1].weight).toBeGreaterThanOrEqual(smp.list[i].weight);
      expect(new Set(smp.list.map((s) => s.id)).size).toBe(smp.list.length);
    }
    expect(bad).toEqual([]);
    expect(acted).toBeGreaterThan(500);
  }, 60000);

  it('the card suggestion is present exactly while an offer exists (sampled every second of play)', () => {
    const P = playSamples();
    expect(P.offerSecs).toBeGreaterThan(100);
    expect(P.cardMismatch).toEqual([]);
    const G = gameAt(15, 91); G.cardOffer = { id: 'plain_gladness', t: 3, x: 0, z: 0 };
    expect(suggestions(G).find((s) => s.target === 'card').id).toBe('card-plain_gladness');
    run(G, 3.5, 0.1);
    expect(G.cardOffer).toBeNull();
    expect(suggestions(G).some((s) => s.target === 'card')).toBe(false);
  });

  it('reset comes first whenever overwhelm is 1, in play and in a crowded constructed state', () => {
    const P = playSamples();
    const full = P.samples.filter((s) => s.ow >= 1);
    expect(full.length).toBeGreaterThan(10);
    for (const s of full) expect(s.list[0].id).toBe('reset-now');
    const G = gameAt(17, 92);
    G.overwhelm = 1; G.affect = 1e15; G.attention = 40; G.insight = 100; G.cardOffer = { id: 'first_step', t: 9, x: 0, z: 0 };
    addLeaf(G, tier1[0]); addLeaf(G, tier1[1]);
    const list = suggestions(G);
    expect(list[0].id).toBe('reset-now');
    expect(list[0].plain).toContain(String(muGain(G)));
    expect(list.some((s) => s.target === 'card')).toBe(true);
    expect(invalid(G)).toEqual([]);
  });

  it('constructed late-game states (stage 9..17, mirrors, verbs, insight, full board) give only valid suggestions and are not mutated', () => {
    for (const stage of [9, 11, 13, 15, 17]) {
      const G = gameAt(stage, 100 + stage);
      G.level = 6; G.attention = 25; G.affect = 1e13; G.insight = 100; G.mirrors = stage >= 16 ? 1 : 0;
      G.stats.links = 4; G.moods.push({ kind: 'dread', t: 50, id: G.nextUid++ });
      G.shop = [tier1[0], tier1[1], FIDS[5], null, FIDS[9]];
      addLeaf(G, tier1[0], { link: 2, seat: { ring: 0, dir: 0 } });
      addRaw(G, node('blend', leaf(FIDS[2]), leaf(FIDS[7])), { link: 3, seat: { ring: 0, dir: 5 } });
      addRaw(G, node('carve', leaf(FIDS[4]), leaf(FIDS[6])), { link: 2 });
      for (const f of [FIDS[1], FIDS[3], FIDS[8]]) addLeaf(G, f);
      const before = snap(G);
      const list = suggestions(G);
      expect(snap(G)).toBe(before);
      expect(list.length).toBeGreaterThan(6);
      expect(invalid(G)).toEqual([]);
    }
  });
});

describe('advisor: rotation', () => {
  it('nextSuggestion never mutates G and only ever returns a currently valid suggestion', () => {
    const P = playSamples();
    for (const smp of P.samples.filter((s, i) => i % 5 === 0)) {
      const G = deserialize(smp.json), before = snap(G), mem = {};
      for (let k = 0; k < 6; k++) {
        const s = nextSuggestion(G, mem, k * (SUGGESTION_LIFETIME + SUGGESTION_GAP));
        if (s) expect(suggestions(G).map((x) => x.id)).toContain(s.id);
      }
      expect(snap(G)).toBe(before);
    }
  });

  // BUG advisor-starve. src/game/advisor.js:95 (nextSuggestion): the score is weight + min(30, since/20).
  // A suggestion that was never shown can add at most +30, so whenever five or more suggestions outweigh a
  // low one by more than ~25 they keep taking turns (each is blocked 90 s = 4 calls at the UI pace of
  // SUGGESTION_LIFETIME + SUGGESTION_GAP = 21 s) and the low one is never shown. The comment promises
  // "a patient player is walked through everything that is currently possible".
  // Observed (state below, 300 calls): subtract, verb-dream, attend, lineage, codex never returned;
  // expected: every id within 4 x list.length calls. Repro: gameAt(14); attention 30; affect 1e9;
  // insight 100; level 3; four tier-1 leaves on the bench; call nextSuggestion every 21 s.
  it('FIXED advisor-starve: every valid suggestion is returned within a bounded number of calls', () => {
    const G = gameAt(14, 7);
    G.attention = 30; G.affect = 1e9; G.insight = 100; G.level = 3; G.stats.links = 5;
    for (const f of FIDS.slice(0, 4)) addLeaf(G, f);
    const ids = suggestions(G).map((s) => s.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    const mem = {}, seen = new Set(), dt = SUGGESTION_LIFETIME + SUGGESTION_GAP;
    for (let k = 0; k < 4 * ids.length; k++) { const s = nextSuggestion(G, mem, k * dt); if (s) seen.add(s.id); }
    expect(ids.filter((id) => !seen.has(id))).toEqual([]);
  });
});

describe('advisor: known false suggestions', () => {
  // BUG advisor-stuck. src/game/advisor.js:73 (the 'stuck' rule): its target is op:integrate:<id> whenever
  // two units wait, without checking insight >= COSTS.integrate (the 'integrate' rule at :53 does check),
  // and otherwise 'xp' without checking attention >= COSTS.xp or level < 10.
  // Observed in extendedBot play at stage 17 (seeds 2 and 5): target 'xp' with attention 0, buyXp fails;
  // constructed: insight 5 at stage 6, integrate fails. Expected: the rule only fires with a doable target.
  // Smallest repro: gameAt(1); attention 0; habituation 3 -> suggestions has stuck -> xp; buyXp returns false.
  it('FIXED advisor-stuck: the "stuck" suggestion only points at an action that can be done now', () => {
    const bad = [];
    let G = gameAt(6); G.insight = 5; G.habituation = 4; addLeaf(G, FIDS[0]); addLeaf(G, FIDS[1]);
    bad.push(...invalid(G).filter((x) => x.startsWith('stuck')));
    G = gameAt(17); G.attention = 0; G.habituation = 3; G.level = 6; addLeaf(G, FIDS[0], { seat: { ring: 0, dir: 0 } });
    bad.push(...invalid(G).filter((x) => x.startsWith('stuck')));
    for (const smp of playSamples().samples) for (const s of smp.list) if (s.id === 'stuck' && perform(deserialize(smp.json), s) === false) bad.push(`stuck -> ${s.target} play seed ${smp.seed}`);
    expect(bad).toEqual([]);
  });

  // BUG advisor-bench-full. src/game/advisor.js:55 ('split') and :34 ('first-buy') do not check the bench:
  // split needs bench < BENCH (game.js:206, "There is nowhere for the second part to wait.") and buy needs
  // bench < BENCH unless a link-1 twin exists (game.js:154, "The bench is full.").
  // Observed: with 8 units waiting (one a hybrid) at stage 9 and insight 100, 'split' is suggested and
  // actions.split returns false; with 8 waiting, none seated and an affordable non-twin shop slot,
  // 'first-buy' is suggested and actions.buy returns false. Expected: neither is suggested then.
  it('FIXED advisor-bench-full: split and first-buy are not suggested while the bench is full', () => {
    const bad = [];
    let G = gameAt(9); G.insight = 100;
    addRaw(G, node('blend', leaf(FIDS[0]), leaf(FIDS[1])));
    for (let i = 1; i < BENCH; i++) addLeaf(G, FIDS[(i + 1) % 10]);
    bad.push(...invalid(G).filter((x) => x.startsWith('split')));
    G = gameAt(3); G.attention = 10; G.insight = 0;
    for (let i = 0; i < BENCH; i++) addLeaf(G, FIDS[i % 10], { link: 2 });
    G.shop = [tier1[0], null, null, null, null];
    bad.push(...invalid(G).filter((x) => x.startsWith('first-buy')));
    expect(bad).toEqual([]);
  });
});

// ======================================================================================= LOCALE
// German is hidden (LOCALE_SWITCH = false) but the swap code ships, so it has to be sound.
const store = new Map();
vi.stubGlobal('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null });

const TABLES = { FAMILIES, ABILITIES, TRAITS, LINKS, ASPECTS, STAGES, WAVE_ARC, HABITS, UPGRADES, SPELLS, VERBS, MOODS, STANCES, STRESSORS, STRESSOR_EXTRA, STRESSOR_AFFIXES, MUTATIONS, KOANS, CARDS };
const GENOMES = [
  ...FIDS.flatMap((f) => [leaf(f), leaf(f, 1), leaf(f, -1)]),
  ...FIDS.map((f, i) => node('blend', leaf(f), leaf(FIDS[(i + 3) % 10], 1))),
  ...FIDS.map((f, i) => node('carve', leaf(f, -1), leaf(FIDS[(i + 5) % 10]))),
  node('blend', node('carve', leaf(FIDS[0]), leaf(FIDS[4])), node('blend', leaf(FIDS[7], 1), leaf(FIDS[2]))),
];
const names = () => GENOMES.map(nameOf);
const snapTables = (omitStageLabel = true) => {
  const out = {};
  for (const [k, v] of Object.entries(TABLES)) out[k] = JSON.parse(JSON.stringify(v));
  if (omitStageLabel) out.STAGES = out.STAGES.map(({ label, ...rest }) => rest);
  out.NAMING = { adj: { ...NAMING.adj }, idealized: NAMING.idealized, devalued: NAMING.devalued, hollowed: NAMING.hollowed };
  out.names = names();
  out.stageIds = STAGES.map((s) => s.id);
  return out;
};
const EN0 = snapTables();           // English, before the locale layer has ever run
const DICT = { ...DE, mutations: DE_MUT, cards: DE_CARDS };
const LIVE = { families: FAMILIES, abilities: ABILITIES, traits: TRAITS, aspects: ASPECTS, arcs: WAVE_ARC, habits: HABITS, upgrades: UPGRADES, spells: SPELLS, verbs: VERBS, moods: MOODS, stances: STANCES, stressors: [...STRESSORS, ...STRESSOR_EXTRA], affixes: STRESSOR_AFFIXES, mutations: MUTATIONS, cards: CARDS };
const FIELDS = ['name', 'text', 'field', 'witness', 'hint', 'basis', 'epithet', 'label', 'principle', 'quote'];
const entries = (list) => (Array.isArray(list) ? list.map((o) => [o.id, o]) : Object.entries(list));
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const STRONG = { f: 'e', m: 'er', n: 'es' };   // German strong adjective endings, nominative, no article

describe('locale', () => {
  afterAll(async () => { await setLocale('en'); });

  it('initialLocale() is "en" while LOCALE_SWITCH is false, even with a saved "de" and a German browser', () => {
    expect(LOCALE_SWITCH).toBe(false);
    store.set('non-mind-locale', 'de');
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(initialLocale()).toBe('en');
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
    store.clear();
    expect(getLocale()).toBe('en');
  });

  it('German covers every id and field of every game table, and setLocale("de") writes all of it', async () => {
    let calls = 0; const off = onLocale(() => calls++);
    expect(await setLocale('de')).toBe('de');
    off();
    expect(calls).toBe(1);
    expect(getLocale()).toBe('de');
    expect(store.get('non-mind-locale')).toBe('de');
    const missing = [], notWritten = [];
    for (const [k, list] of Object.entries(LIVE)) for (const [id, o] of entries(list)) {
      const d = DICT[k]?.[id];
      if (!d) { missing.push(`${k}.${id}`); continue; }
      for (const f of FIELDS) if (f in o && !(f in d)) missing.push(`${k}.${id}.${f}`);
      for (const [f, v] of Object.entries(d)) if (o[f] !== v) notWritten.push(`${k}.${id}.${f}`);
    }
    LINKS.forEach((o, i) => { const d = DE.links[i]; if (!d) missing.push(`links.${i}`); else for (const [f, v] of Object.entries(d)) if (o[f] !== v) notWritten.push(`links.${i}.${f}`); });
    for (const f of ['name', 'text']) LINKS.forEach((o, i) => { if (f in EN0.LINKS[i] && !(f in (DE.links[i] || {}))) missing.push(`links.${i}.${f}`); });
    STAGES.forEach((o, i) => { const d = DE.stages[i]; if (!d) missing.push(`stages.${i}`); else { if (o.label !== d.id) notWritten.push(`stages.${i}.label`); if (o.hint !== d.hint) notWritten.push(`stages.${i}.hint`); } });
    for (const [k, pool] of Object.entries(EN0.KOANS)) {
      if (Array.isArray(pool)) { if (!DE_KOANS[k]) missing.push(`koans.${k}`); else expect(KOANS[k]).toEqual(DE_KOANS[k]); }
      else for (const s of Object.keys(pool)) { if (!DE_KOANS[k]?.[s]) missing.push(`koans.${k}.${s}`); else expect(KOANS[k][s]).toEqual(DE_KOANS[k][s]); }
    }
    for (const f of FIDS) { if (!DE.adj[f]) missing.push(`adj.${f}`); if (!STRONG[DE.gender[f]]) missing.push(`gender.${f}`); }
    expect(missing).toEqual([]);
    expect(notWritten).toEqual([]);
  });

  it('German names inflect by the head family\'s gender; stage ids stay English while label changes', async () => {
    await setLocale('de');
    for (const f of FIDS) {
      const g = DE.gender[f], end = STRONG[g];
      expect(nameOf(leaf(f))).toBe(DE.families[f].name);
      expect(nameOf(leaf(f, 1))).toBe(`${cap(DE.poles.idealizedStem + end)} ${DE.families[f].name}`);
      expect(nameOf(leaf(f, -1))).toBe(`${cap(DE.poles.devaluedStem + end)} ${DE.families[f].name}`);
      // carve: the base is the head; the modifier and "hollowed" decline to the head's gender
      const other = FIDS.find((x) => x !== f && DE.gender[x] !== g) || FIDS.find((x) => x !== f);
      expect(nameOf(node('carve', leaf(f), leaf(other)))).toBe(`${cap(DE.adj[other] + end)} ${cap(DE.poles.hollowedStem + end)} ${DE.families[f].name}`);
    }
    // all three genders actually occur, so the rule is exercised
    expect(new Set(FIDS.map((f) => DE.gender[f]))).toEqual(new Set(['f', 'm', 'n']));
    expect(STAGES.map((s) => s.id)).toEqual(EN0.stageIds);
    STAGES.forEach((s, i) => expect(s.label).toBe(DE.stages[i].id));
    expect(STAGES.some((s) => s.label !== s.id)).toBe(true);
    // logic keyed on ids still works in German
    const G = gameAt(0, 5);
    for (let i = 0; i < 5; i++) actions.attend(G);
    step(G, 0.1);
    expect(G.stage).toBe(1);
    expect(G.events.find((e) => e.type === 'stage').id).toBe('explore');
    expect(unlocked(G, 'shop')).toBe(true);
  });

  it('switching twice in a row is stable (de,de equals de; en,en equals en)', async () => {
    await setLocale('de'); const de1 = snapTables(false);
    await setLocale('de'); const de2 = snapTables(false);
    expect(de2).toEqual(de1);
    await setLocale('en'); const en1 = snapTables();
    await setLocale('en'); const en2 = snapTables();
    expect(en2).toEqual(en1);
    expect(de1.names).not.toEqual(en1.names);
  });

  it('setLocale("de") then setLocale("en") restores every table, NAMING and every generated name (TRAITS aside, see BUG locale-traits)', async () => {
    await setLocale('de');
    expect(names()).not.toEqual(EN0.names);
    await setLocale('en');
    const back = snapTables();
    const { TRAITS: t1, ...rest1 } = back, { TRAITS: t0, ...rest0 } = EN0;
    expect(rest1).toEqual(rest0);
    for (const [id, o] of Object.entries(TRAITS)) expect(o.text).toBe(t0[id].text);
    // the shown stage word in English is the id itself
    STAGES.forEach((s) => expect(s.label).toBe(s.id));
    expect(getLocale()).toBe('en');
    // and a second full cycle lands on the same tables
    await setLocale('de'); await setLocale('en');
    expect(snapTables()).toEqual(back);
  });

  // BUG locale-traits. src/i18n/index.js:38 (write): Object.assign(o, en[k][id], dict[k][id]) only resets the
  // fields the English snapshot has. German TRAITS entries carry a `name` (src/i18n/de/data.js:55-68) that
  // English TRAITS (src/game/data.js:47-60) do not have, so after de -> en every TRAITS[id].name stays German.
  // Observed: TRAITS.ache.name === 'Schmerz' after setLocale('de'); setLocale('en'). Expected: no name field
  // (as before). Fix: delete keys of the previous dict that the English snapshot lacks, or give English
  // TRAITS a name. Latent today (the Inspector reads only TRAITS[t].text), hence minor.
  it('FIXED locale-traits: de -> en restores TRAITS exactly', async () => {
    await setLocale('de'); await setLocale('en');
    expect(JSON.parse(JSON.stringify(TRAITS))).toEqual(EN0.TRAITS);
  });

  // BUG locale-stage-log. src/game/game.js:352 (step): the stage line is `${s.id.toUpperCase()}. ${s.hint}`,
  // so a German game logs the English id next to the German hint ("EXPLORE. Was aus der Ferne ..."),
  // although src/i18n/index.js:40 says "stage ids drive logic and stay English; the shown word is `label`".
  // Expected: the line begins with the label ("ERKUNDEN. ..."). Fix: `(s.label || s.id).toUpperCase()`.
  it('FIXED locale-stage-log: in German the stage log line shows the German label, not the English id', async () => {
    await setLocale('de');
    const G = gameAt(0, 6);
    for (let i = 0; i < 5; i++) actions.attend(G);
    step(G, 0.1);
    const line = G.log.find((l) => l.kind === 'stage');
    expect(line.text.startsWith(`${STAGES[1].label.toUpperCase()}. `)).toBe(true);
  });

  it('a German game simulated for 300 s (fresh, and from a constructed late state) logs no undefined or NaN', async () => {
    await setLocale('de');
    const lines = [];
    const play = (G, secs) => {
      for (let i = 0; i < secs * 10; i++) {
        extendedBot(G, i * 0.1); if (G.cardOffer) actions.collectCard(G); step(G, 0.1);
        for (const e of G.events) if (e.type === 'say') lines.push(e.text);
        G.events.length = 0;
      }
      for (const l of G.log) lines.push(l.text);
      expect(badNumbers(G)).toEqual([]);
    };
    play(createGame(9), 300);
    const L = gameAt(16, 10);
    L.level = 6; L.attention = 40; L.affect = 1e12; L.insight = 100; L.mirrors = 1; L.stance = 'toward'; L.cardT = 1;
    addLeaf(L, FIDS[0], { link: 3, seat: { ring: 0, dir: 0 } });
    addRaw(L, node('blend', leaf(FIDS[2]), leaf(FIDS[7], 1)), { link: 4, seat: { ring: 1, dir: 3 } });
    addLeaf(L, FIDS[0], { link: 3 }); addLeaf(L, FIDS[5]); addLeaf(L, FIDS[6]);
    play(L, 300);
    expect(lines.length).toBeGreaterThan(30);
    const bad = lines.filter((s) => typeof s !== 'string' || /undefined|NaN|\[object|null/.test(s));
    expect(bad).toEqual([]);
    // the log really is German: lines from the German pools appear
    const dePool = new Set(Object.values(DE_KOANS).flatMap((v) => (Array.isArray(v) ? v : Object.values(v).flat())));
    expect(lines.filter((s) => dePool.has(s)).length).toBeGreaterThan(5);
    await setLocale('en');
  }, 30000);
});
