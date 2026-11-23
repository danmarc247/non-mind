// Functional tests of the HIGH-STAGE mechanics (stages 5..17, links 4..12, cycle 3+ waves, bosses, affixes).
// Engine API only. Expected numbers come from exported data (SPELLS, MOODS, STANCES, LINKS, ABILITIES, WAVE_ARC,
// ASPECTS, STRESSOR_AFFIXES ...) or from the rule text itself; where the only source of a coefficient is the
// nonmind-game-structure skill, it is named once below as DOC_* so a tuning pass changes one line, not the tests.
// Known engine bugs are kept as `it.fails('BUG <id>: ...')` with the cause, observed vs expected and a reproduction.
import { describe, it, expect } from 'vitest';
import {
  createGame, step, actions, serialize, deserialize, leaf, node, key, leaves, leafCount, aspectsOf, abilityOf, echoAbilityOf,
  tierOf, complexityOf, traitForLink, STAGES, LINKS, TRAITS, ABILITIES, FAMILIES, FAMILY, SPELLS, VERBS, MOODS, STANCES,
  WAVE_ARC, STRESSOR, ASPECTS, ASPECT_IDS, ASPECT_THRESHOLDS, COSTS, HABITS, MAX_LEAVES, BENCH, MAX_MUTS, DIRECTIONS,
  BEATS_PER_WAVE, ARENA, BEAT_TIME, gatePos, aspectTiers, unitStats, startWave, stepBattle, ALL_STRESSORS, ANY_STRESSOR,
  STRESSOR_AFFIXES, MUTATIONS, MUTATION, unlocked, unitCap, ringsOpen, mirrorCost, attendantCost, affectMul, clickValue,
  muGain, capacityOf,
} from '../../src/game/index.js';
import { affixChance } from '../../src/game/content/stressors.js';
import { gameAt, addLeaf, addRaw, badNumbers } from './helpers.js';
import { resettingBot } from './bots.js';

// ---- coefficients whose only written source is the skill (nonmind-game-structure); one place to retune
const DOC_OVERWHELM_BAND = 0.12; // overwhelm = clamp((C - capacity) / (capacity * band), 0, 1)
const DOC_DREAD_GATES = 1.5; // "Dread: 3 of them give x1.5 stressors"
const DOC_ENDING_BONUS = 0.1; // each ending: +10% affect and +10% salience, forever
const DOC_INSIGHT_REGEN = (level) => 1 + 0.15 * level; // per second
const DOC_UNIT_CAP = (level, mirrors) => Math.min(30, level + 1 + 2 * mirrors);
const DOC_ATTENDANT = { base: 300, growth: 2.2 };
const DOC_MU_GAIN = (G) => Math.floor(Math.pow(G.stats.peak / 8, 0.8) * (1 + G.stage / 17) * (G.overwhelm >= 1 ? 2 : 1) * (1 + 0.15 * G.depth));

const stageOf = (unlock) => STAGES.findIndex((s) => s.unlock === unlock);
const constRng = (v) => { const f = () => v; f.get = () => 0; f.set = () => {}; return f; };
const secondsIn = (text) => Number(/(\d+) seconds/.exec(text)[1]);
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
const LADDER_TRAITS = LINKS.slice(0, 11).map((l) => l.trait); // every gene a link-11 unit has earned
// six mutations that may coexist, rarest first (the strongest distortions)
const SIX = (() => {
  const out = [];
  for (const m of MUTATIONS.slice().sort((a, b) => b.rarity - a.rarity)) if (out.length < MAX_MUTS && !out.some((id) => MUTATION[id].conflicts.includes(m.id))) out.push(m.id);
  return out;
})();
const late = (G, g, opts = {}) => { const u = addRaw(G, typeof g === 'string' ? leaf(g) : g, { link: 11, traits: LADDER_TRAITS, ...opts }); u.muts = SIX.slice(); return u; };
const bu = (G, u) => G.battle.units.find((c) => c.uid === u.id);

/** A battle with no beats left to spawn: the test places every stressor itself. */
function arena(G, { wave = 5, cycle = 3 } = {}) {
  G.wave = wave; G.cycle = cycle; startWave(G);
  const B = G.battle; B.beat = BEATS_PER_WAVE; B.enemies = []; G.events.length = 0;
  return B;
}
/** A stressor placed by hand: still (speed 0) and silent (cd huge) unless the test says otherwise. */
function foe(G, over = {}) {
  const B = G.battle;
  const e = { id: B.nextId++, side: 1, def: 'intrusion', affix: null, name: 'Intrusion', x: 0, z: 0, hp: 1e9, max: 1e9, sal: 0, lat: 1, reach: 1, speed: 0, opa: 0, cd: 1e9, alive: true, stun: 0, mark: 0, value: 1, form: null, flip: 0, ...over };
  B.enemies.push(e); return e;
}
/** Start a wave and spawn `beats` beats with no time passing (dt 0: nothing moves or strikes). */
function spawn(G, { wave, cycle = 3, arc = null, beats = 1 }) {
  G.wave = wave; G.cycle = cycle; startWave(G);
  const B = G.battle; if (arc) B.arc = arc;
  const out = [];
  for (let b = 0; b < beats; b++) {
    const n0 = B.enemies.length; B.beatT = 0; G.events.length = 0; stepBattle(G, 0);
    out.push({ beat: b, gate: G.events.find((e) => e.type === 'beat').gate, enemies: B.enemies.slice(n0) });
  }
  return out;
}
const PLAIN = { id: 'plain', name: 'Plain', text: '', mod: {} };
const affixOf = (e) => STRESSOR_AFFIXES.find((a) => a.id === e.affix);
// tolerance / salience with the stressor's own def and affix divided out: equal for every stressor of one beat
const normT = (e) => e.max / (ANY_STRESSOR[e.def].tol * (affixOf(e)?.mod.tol || 1));
const normS = (e) => e.sal / (ANY_STRESSOR[e.def].sal * (affixOf(e)?.mod.sal || 1));
const gateOf = (e) => { let best = 0, bd = Infinity; for (let d = 0; d < DIRECTIONS; d++) { const [x, z] = gatePos(d); const dd = Math.hypot(e.x - x, e.z - z); if (dd < bd) { bd = dd; best = d; } } return best; };
const hitsFrom = (G, c) => G.events.filter((e) => e.type === 'hit' && e.from === c.id && e.side === 1);

// ======================================================================================= STAGE GATES 5..17
describe('high stages: each system appears exactly at its stage', () => {
  const GATES = { insight: 5, split: 6, ring2: 7, subtract: 8, attendants: 9, verbs: 10, exchange: 11, echo: 12, stance: 13, seasons: 14, mirror: 15, wildcard: 16, nonmind: 17 };
  it('the unlock order of stages 5..17 is the documented one', () => {
    for (const [what, s] of Object.entries(GATES)) {
      expect(stageOf(what), what).toBe(s);
      expect(unlocked(gameAt(s - 1), what), `${what} at ${s - 1}`).toBe(false);
      expect(unlocked(gameAt(s), what), `${what} at ${s}`).toBe(true);
    }
  });
  it('every gated action refuses one stage early and works at its stage', () => {
    const tries = {
      insight: (G) => { G.insight = 100; return actions.cast(G, 'exhale'); },
      split: (G) => { G.insight = 100; const u = addLeaf(G, 'reappraisal', { link: 3 }); return actions.split(G, u.id); },
      ring2: (G) => { const u = addLeaf(G, 'reappraisal'); return actions.place(G, u.id, { ring: 1, dir: 0 }); },
      subtract: (G) => { G.insight = 100; const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'); return !!actions.subtract(G, a.id, b.id); },
      attendants: (G) => { G.affect = 1e6; return actions.buyAttendant(G); },
      verbs: (G) => { const u = addLeaf(G, 'reappraisal'); return actions.startVerb(G, 'dream', u.id); },
      exchange: (G) => { G.attention = 10; return actions.exchange(G, 'attention', 'insight'); },
      stance: (G) => actions.chooseStance(G, 'toward'),
      mirror: (G) => { G.affect = mirrorCost(G); return actions.mirror(G); },
    };
    for (const [what, f] of Object.entries(tries)) {
      expect(f(gameAt(GATES[what] - 1)), `${what} early`).toBe(false);
      expect(f(gameAt(GATES[what])), `${what} on time`).toBe(true);
    }
  });
});

// ======================================================================================= INSIGHT AND SPELLS
describe('insight and the three spells', () => {
  it('insight regenerates only from stage 5, faster with level, and never past its cap', () => {
    const G4 = gameAt(4); step(G4, 0.25); expect(G4.insight).toBe(0);
    for (const level of [1, 10]) {
      const G = gameAt(5); G.level = level; step(G, 0.25);
      expect(rel(G.insight, DOC_INSIGHT_REGEN(level) * 0.25)).toBeLessThan(1e-9);
    }
    const G = gameAt(17); G.level = 10; G.insight = G.insightMax - 0.01; step(G, 0.25);
    expect(G.insight).toBe(G.insightMax);
  });

  it('each spell costs its stated insight and refuses when short', () => {
    for (const s of SPELLS) {
      const G = gameAt(17); G.insight = s.cost - 1e-6;
      expect(actions.cast(G, s.id)).toBe(false);
      G.insight = s.cost;
      expect(actions.cast(G, s.id), s.id).toBe(true);
      expect(G.insight).toBe(0);
    }
  });

  it('Exhale: every living regulator mends a third of its tolerance (capped at full)', () => {
    const G = gameAt(17);
    const a = late(G, 'containment', { seat: { ring: 0, dir: 0 } }), b = late(G, 'reappraisal', { seat: { ring: 0, dir: 5 } });
    arena(G);
    const ca = bu(G, a), cb = bu(G, b);
    ca.hp = ca.max * 0.1; cb.hp = cb.max * 0.9;
    G.insight = 100; expect(actions.cast(G, 'exhale')).toBe(true);
    expect(rel(ca.hp, ca.max * (0.1 + 1 / 3))).toBeLessThan(1e-9);
    expect(cb.hp).toBe(cb.max);
  });

  it(`Name It: stressors take exactly double harm while it lasts (${secondsIn(SPELLS.find((s) => s.id === 'label').text)} s), then single`, () => {
    const dur = secondsIn(SPELLS.find((s) => s.id === 'label').text);
    const strike = (labelled) => {
      const G = gameAt(17); const u = late(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: [] });
      arena(G); G.rng = constRng(0.5); // no variance, no miss, no second strike
      const c = bu(G, u); c.cd = 0; c.reach = 100; c.rec = 0;
      const e = foe(G, { x: c.x + 0.5, z: c.z });
      G.labelT = labelled ? dur : 0;
      stepBattle(G, 0);
      return e.max - e.hp;
    };
    const one = strike(false), two = strike(true);
    expect(one).toBeGreaterThan(0);
    expect(rel(two, 2 * one)).toBeLessThan(1e-9);
    // the duration: a cast in prep lasts the stated seconds of play and no longer
    const G = gameAt(17); G.auto = false; G.insight = 100; actions.cast(G, 'label');
    for (let t = 0; t < dur - 0.5; t += 0.25) step(G, 0.25);
    expect(G.labelT).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 0.25) step(G, 0.25);
    expect(G.labelT).toBe(0);
  });

  it('Recollect: exactly the stated seconds of habit yield, at once', () => {
    const G = gameAt(17); G.auto = false;
    G.habits = { breath: 40, journal: 12, myth: 3 }; step(G, 0.1);
    expect(G.prod).toBeGreaterThan(0);
    const before = G.affect; G.insight = 100;
    expect(actions.cast(G, 'recollect')).toBe(true);
    expect(rel(G.affect - before, G.prod * secondsIn(SPELLS.find((s) => s.id === 'recollect').text))).toBeLessThan(1e-9);
  });
});

// ======================================================================================= SPLIT / SUBTRACT AT DEPTH
describe('split and subtract at depth', () => {
  const six = ['reappraisal', 'suppression', 'rumination', 'avoidance', 'attunement', 'projection'];
  const buildHybrid = (G, fams, link = 1) => { let h = addLeaf(G, fams[0], { link }); for (const f of fams.slice(1)) h = actions.integrate(G, h.id, addLeaf(G, f, { link }).id); return h; };

  it(`integrating two four-leaf hybrids keeps ${MAX_LEAVES} leaves; the two cut become ghosts that add complexity`, () => {
    const G = gameAt(17); G.insight = 1e9;
    const h1 = buildHybrid(G, six.slice(0, 4)), h2 = buildHybrid(G, ['dissociation', 'sublimation', 'containment', 'equanimity']);
    const h = actions.integrate(G, h1.id, h2.id);
    expect(leafCount(h.g)).toBe(MAX_LEAVES);
    expect(h.ghosts).toBe(8 - MAX_LEAVES);
    expect(complexityOf(h)).toBeGreaterThan(complexityOf({ ...h, ghosts: 0 }));
  });

  it('subtracting a three-leaf hybrid out of a six-leaf one carves, keeps the first link and prunes to six', () => {
    const G = gameAt(17); G.insight = 1e9;
    const big = buildHybrid(G, six, 6), small = buildHybrid(G, ['dissociation', 'sublimation', 'containment'], 2);
    const h = actions.subtract(G, big.id, small.id);
    expect(h.g.op).toBe('carve');
    expect(h.link).toBe(6);
    expect(leafCount(h.g)).toBe(MAX_LEAVES);
    expect(h.ghosts).toBe(9 - MAX_LEAVES);
    expect(h.traits.length).toBeLessThanOrEqual(10);
  });

  it('split gives back each parent at the link it brought, even at height and from a six-leaf tree', () => {
    for (const [la, lb] of [[7, 3], [11, 4], [5, 10]]) {
      const G = gameAt(17); G.insight = 1e9;
      const a = buildHybrid(G, six.slice(0, 3), la), b = buildHybrid(G, six.slice(3), lb);
      const ka = key(a.g), kb = key(b.g);
      const h = actions.integrate(G, a.id, b.id);
      expect(h.link).toBe(Math.max(la, lb));
      expect(actions.split(G, h.id)).toBe(true);
      const byKey = Object.fromEntries(G.units.map((u) => [key(u.g), u]));
      expect(byKey[ka].link, `${la}/${lb}`).toBe(la);
      expect(byKey[kb].link, `${la}/${lb}`).toBe(lb);
      expect(G.units.every((u) => u.muts.length <= MAX_MUTS)).toBe(true);
    }
  });

  it('a whole leaf at link 11 splits into its two poles one link lower; a pole leaf has no seam', () => {
    const G = gameAt(17); G.insight = 100;
    const u = late(G, 'equanimity');
    expect(actions.split(G, u.id)).toBe(true);
    expect(G.units.map((x) => [x.g.pole, x.link]).sort()).toEqual([[-1, 10], [1, 10]]);
    G.insight = 100;
    expect(actions.split(G, G.units[0].id)).toBe(false);
  });
});

// ======================================================================================= RINGS, CAP, SWAPS
describe('rings 2 and 3, unit cap, swaps', () => {
  it('ring 2 opens at stage 7, ring 3 only with a mirror', () => {
    expect(ringsOpen(gameAt(6))).toBe(1);
    expect(ringsOpen(gameAt(7))).toBe(2);
    const G = gameAt(15); expect(ringsOpen(G)).toBe(2);
    const u = addLeaf(G, 'reappraisal');
    expect(actions.place(G, u.id, { ring: 2, dir: 4 })).toBe(false);
    G.mirrors = 1; expect(ringsOpen(G)).toBe(ARENA.rings.length);
    expect(actions.place(G, u.id, { ring: 2, dir: 4 })).toBe(true);
    expect(u.seat).toEqual({ ring: 2, dir: 4 });
  });

  it('unit cap follows level and mirrors and is never more than the seats on the board', () => {
    for (const level of [1, 5, 10]) for (const mirrors of [0, 1, 3, 20]) {
      const G = gameAt(17); G.level = level; G.mirrors = mirrors;
      expect(unitCap(G)).toBe(DOC_UNIT_CAP(level, mirrors));
      expect(unitCap(G)).toBeLessThanOrEqual(ARENA.rings.length * DIRECTIONS);
    }
  });

  it('seating stops exactly at the cap; a bench unit can still swap onto a taken seat', () => {
    const G = gameAt(17); G.level = 10; G.mirrors = 1; // cap 13 over three rings
    const cap = unitCap(G);
    const seated = [];
    for (let i = 0; i < cap; i++) { const u = addLeaf(G, FAMILIES[i % 10].id, { link: 1 + Math.floor(i / 10) }); expect(actions.place(G, u.id, { ring: Math.floor(i / 10), dir: i % 10 })).toBe(true); seated.push(u); }
    const extra = addLeaf(G, 'equanimity', { link: 5 });
    expect(actions.place(G, extra.id, { ring: 2, dir: 9 })).toBe(false);
    expect(actions.place(G, extra.id, { ring: 0, dir: 3 })).toBe(true); // swap
    expect(extra.seat).toEqual({ ring: 0, dir: 3 });
    expect(seated[3].seat).toBeNull();
    expect(G.units.filter((u) => u.seat).length).toBe(cap);
    // two seated units swap places
    expect(actions.place(G, seated[0].id, { ring: 1, dir: 2 })).toBe(true);
    expect(seated[0].seat).toEqual({ ring: 1, dir: 2 });
    expect(seated[12].seat).toEqual({ ring: 0, dir: 0 });
  });
});

// ======================================================================================= ATTENDANTS
describe('attendants', () => {
  it('cost grows geometrically and is paid in affect', () => {
    const G = gameAt(9); G.affect = 1e6;
    for (let n = 0; n < 6; n++) {
      const cost = attendantCost(G);
      expect(rel(cost, DOC_ATTENDANT.base * Math.pow(DOC_ATTENDANT.growth, n))).toBeLessThan(1e-12);
      const before = G.affect; expect(actions.buyAttendant(G)).toBe(true);
      expect(rel(before - G.affect, cost)).toBeLessThan(1e-12);
    }
    G.affect = attendantCost(G) - 1; expect(actions.buyAttendant(G)).toBe(false);
  });

  it('each attends once a second, half as well as a click (twice as often with Lending)', () => {
    for (const lending of [false, true]) {
      const G = gameAt(9); G.auto = false; G.attendants = 4; if (lending) G.upgrades.lending = true;
      // one click's worth, measured against a real click on a twin game
      const T = gameAt(9); T.attendants = 4; if (lending) T.upgrades.lending = true;
      const click = actions.attend(T);
      const before = G.affect, cw = G.clicksThisWave;
      step(G, 0.25); // 4 attendants x 0.25 s = one attending (two with Lending)
      const times = lending ? 2 : 1;
      expect(rel(G.affect - before, times * 0.5 * click)).toBeLessThan(1e-9);
      expect(G.clicksThisWave - cw).toBe(times * 0.25);
    }
  });
});

// ======================================================================================= VERBS
describe('verbs: requirement, timer, result, the busy unit', () => {
  const play = (G, s) => { for (let t = 0; t < s - 1e-9; t += 0.25) step(G, 0.25); };
  const prep = () => { const G = gameAt(10); G.auto = false; addLeaf(G, 'avoidance', { link: 9 }); return G; }; // a free unit: no mercy

  it('aspect-gated verbs need their aspect (a fade gene counts as every aspect)', () => {
    for (const v of VERBS.filter((x) => x.needs)) {
      const G = prep();
      const without = FAMILIES.find((f) => !f.aspects.includes(v.needs)), withIt = FAMILIES.find((f) => f.aspects.includes(v.needs));
      const a = addLeaf(G, without.id, { link: 2 });
      expect(actions.startVerb(G, v.id, a.id), `${v.id} without`).toBe(false);
      const f = addLeaf(G, without.id, { link: 3, traits: ['fade'] });
      expect(actions.startVerb(G, v.id, f.id), `${v.id} fade`).toBe(true);
      const G2 = prep(); const b = addLeaf(G2, withIt.id, { link: 2 });
      expect(actions.startVerb(G2, v.id, b.id), `${v.id} with`).toBe(true);
    }
  });

  it('each verb runs for exactly its time, holds one unit, and one slot per verb', () => {
    for (const v of VERBS) {
      const G = prep(); const fam = FAMILIES.find((f) => !v.needs || f.aspects.includes(v.needs)).id;
      const u = addLeaf(G, fam, { link: 4, seat: { ring: 0, dir: 0 } }), w = addLeaf(G, fam, { link: 6 });
      expect(actions.startVerb(G, v.id, u.id)).toBe(true);
      expect(actions.startVerb(G, v.id, w.id)).toBe(false); // the slot is taken
      play(G, v.time - 0.5);
      expect(G.verbs[v.id], v.id).toBeTruthy();
      play(G, 0.75);
      expect(G.verbs[v.id], v.id).toBeNull();
      expect(G.stats.verbsDone).toBe(1);
    }
  });

  it('a busy unit cannot be seated, sold, split, combined, repurposed or sent again', () => {
    const G = prep(); G.insight = 100;
    const u = addLeaf(G, 'reappraisal', { link: 5, seat: { ring: 0, dir: 2 } }), o = addLeaf(G, 'suppression');
    expect(actions.startVerb(G, 'rest', u.id)).toBe(true);
    expect(u.seat).toBeNull();
    expect(actions.place(G, u.id, { ring: 0, dir: 2 })).toBe(false);
    expect(actions.sell(G, u.id)).toBe(false);
    expect(actions.split(G, u.id)).toBe(false);
    expect(actions.integrate(G, u.id, o.id)).toBe(false);
    expect(actions.integrate(G, o.id, u.id)).toBe(false);
    expect(actions.subtract(G, o.id, u.id)).toBe(false);
    expect(actions.repurpose(G, u.id)).toBe(false);
    expect(actions.startVerb(G, 'dream', u.id)).toBe(false);
    expect(G.units).toContain(u);
    // a busy twin does not fuse
    addRaw(G, leaf('reappraisal'), { link: 4 }); G.shop = ['reappraisal']; G.attention = 9; actions.buy(G, 0);
    expect(u.link).toBe(5);
  });

  it('the place a busy unit left stays reserved on the waiting row', () => {
    const G = prep(); // one free unit already waits
    const u = addLeaf(G, 'reappraisal', { seat: { ring: 0, dir: 0 } });
    expect(actions.startVerb(G, 'dream', u.id)).toBe(true);
    for (let i = 0; i < BENCH - 2; i++) addLeaf(G, 'projection', { link: 1 + i });
    expect(G.units.filter((x) => !x.seat).length).toBe(BENCH); // 7 waiting + the one away
    G.shop = ['containment']; G.attention = 9;
    expect(actions.buy(G, 0)).toBe(false);
  });

  it('dream: a related family wakes, keeping the link, the genes and every mutation', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const G = gameAt(10, seed); G.auto = false;
      const muts = SIX.slice(0, 3);
      const u = addRaw(G, leaf('attunement'), { link: 7, traits: ['ache', 'trust', 'glad', 'rapture', 'calm', 'ease', 'gather'] }); u.muts = muts.slice();
      const asp = aspectsOf(u.g), tier = tierOf(u.g);
      expect(actions.startVerb(G, 'dream', u.id)).toBe(true);
      play(G, VERBS.find((v) => v.id === 'dream').time + 0.25);
      expect(G.units).toHaveLength(1);
      const n = G.units[0];
      expect(n.g.f).not.toBe('attunement');
      expect(FAMILY[n.g.f].aspects.some((a) => asp.includes(a))).toBe(true);
      expect(FAMILY[n.g.f].tier).toBeLessThanOrEqual(tier + 1);
      expect(n.link).toBe(7);
      expect(n.traits).toEqual(u.traits);
      expect(n.muts.slice(0, muts.length)).toEqual(muts);
      expect(n.muts.length).toBeLessThanOrEqual(muts.length + 1);
      expect(n.busy).toBeFalsy();
    }
  });

  it('ruminate: insight and a Dread (or Fascination); rest: a Dread less and full composure; confide: a Contentment', () => {
    let G = prep(); const r = addLeaf(G, 'rumination', { link: 2 });
    actions.startVerb(G, 'ruminate', r.id); play(G, VERBS.find((v) => v.id === 'ruminate').time - 0.25);
    G.insight = 0; const regen = DOC_INSIGHT_REGEN(G.level) * 0.25; play(G, 0.5);
    expect(G.insight).toBeGreaterThan(10 * regen);
    expect(G.moods.length).toBe(1);
    expect(['dread', 'fascination']).toContain(G.moods[0].kind);

    G = prep(); const v = addLeaf(G, 'reappraisal', { link: 2 });
    G.moods = [{ kind: 'dread', t: MOODS.dread.life, id: 900 }, { kind: 'dread', t: MOODS.dread.life, id: 901 }]; G.composure = 5;
    actions.startVerb(G, 'rest', v.id); play(G, VERBS.find((x) => x.id === 'rest').time + 0.25);
    expect(G.moods.filter((m) => m.kind === 'dread').length).toBe(1);
    expect(G.composure).toBe(G.composureMax);

    G = prep(); const c = addLeaf(G, 'attunement', { link: 2 });
    actions.startVerb(G, 'confide', c.id); play(G, VERBS.find((x) => x.id === 'confide').time + 0.25);
    expect(G.moods.map((m) => m.kind)).toEqual(['contentment']);
  });
});

// ======================================================================================= MOODS
describe('moods', () => {
  it('each mood lives exactly its stated life', () => {
    for (const [kind, m] of Object.entries(MOODS)) {
      const G = gameAt(10); G.auto = false; addLeaf(G, 'avoidance');
      G.moods = [{ kind, t: m.life, id: 999 }];
      for (let t = 0; t < m.life - 0.5; t += 0.25) step(G, 0.25);
      expect(G.moods.length, kind).toBe(1);
      for (let t = 0; t < 1; t += 0.25) step(G, 0.25);
      expect(G.moods.length, kind).toBe(0);
    }
  });

  it('a Contentment cancels one Dread instead of arriving', () => {
    const G = gameAt(10); G.auto = false; addLeaf(G, 'avoidance');
    G.moods = [{ kind: 'dread', t: 100, id: 1 }, { kind: 'dread', t: 100, id: 2 }];
    const c = addLeaf(G, 'attunement', { link: 3 });
    actions.startVerb(G, 'confide', c.id);
    for (let t = 0; t < VERBS.find((v) => v.id === 'confide').time + 0.25; t += 0.25) step(G, 0.25);
    expect(G.moods.map((m) => m.kind)).toEqual(['dread']);
  });

  it('Fascination raises affect yield by half', () => {
    const G = gameAt(17); const base = affectMul(G);
    G.moods = [{ kind: 'fascination', t: 100, id: 1 }];
    expect(rel(affectMul(G), base * 1.5)).toBeLessThan(1e-12);
  });

  it('three Dreads widen the gates by the stated factor; two do not', () => {
    const count = (dreads) => { const G = gameAt(17); late(G, 'containment', { seat: { ring: 0, dir: 0 } }); G.moods = Array.from({ length: dreads }, (_, i) => ({ kind: 'dread', t: 100, id: 500 + i })); return spawn(G, { wave: 1, cycle: 3 })[0].enemies.length; };
    const two = count(2), three = count(3);
    expect(count(0)).toBe(two);
    expect(three).toBe(Math.min(14, Math.ceil(two * DOC_DREAD_GATES)));
    expect(three).toBeGreaterThan(two);
  });
});

// ======================================================================================= EXCHANGE
describe('exchange: four routes and their refusals', () => {
  const routes = [['affect', 'attention'], ['attention', 'insight'], ['insight', 'attention'], ['attention', 'affect']];
  it('every route takes from one currency and gives to the other', () => {
    for (const prod of [0, 1e6]) for (const [from, to] of routes) {
      const G = gameAt(11); G.prod = prod; G.affect = 1e12; G.attention = 50; G.insight = 50;
      const f0 = G[from], t0 = G[to];
      expect(actions.exchange(G, from, to), `${from}>${to}`).toBe(true);
      expect(G[from]).toBeLessThan(f0);
      expect(G[to]).toBeGreaterThan(t0);
      expect(G.stats.exchanges).toBe(1);
    }
  });
  it('refuses when short, when insight is full, for an unknown route and before stage 11', () => {
    for (const [from, to] of routes) {
      const G = gameAt(11); G.affect = 0; G.attention = 0; G.insight = 0;
      expect(actions.exchange(G, from, to)).toBe(false);
      expect([G.affect, G.attention, G.insight]).toEqual([0, 0, 0]);
    }
    const G = gameAt(11); G.attention = 10; G.insight = G.insightMax;
    expect(actions.exchange(G, 'attention', 'insight')).toBe(false);
    expect(G.attention).toBe(10);
    G.affect = 1e9;
    for (const [f, t] of [['affect', 'insight'], ['insight', 'affect'], ['attention', 'attention'], ['mu', 'affect']]) expect(actions.exchange(G, f, t)).toBe(false);
    const E = gameAt(10); E.attention = 10; expect(actions.exchange(E, 'attention', 'insight')).toBe(false);
    expect(G.stats.exchanges + E.stats.exchanges).toBe(0);
  });
  it('round trips lose: no route pair is a pump', () => {
    for (const prod of [0, 5e3, 1e9]) {
      const G = gameAt(11); G.prod = prod; G.attention = 100; G.insight = 0;
      for (let i = 0; i < 40; i++) { actions.exchange(G, 'attention', 'insight'); while (actions.exchange(G, 'insight', 'attention')); }
      expect(G.attention).toBeLessThanOrEqual(100);
      const H = gameAt(11); H.prod = prod; H.affect = 1e15; const a0 = H.affect;
      for (let i = 0; i < 20; i++) { actions.exchange(H, 'affect', 'attention'); actions.exchange(H, 'attention', 'affect'); }
      expect(H.affect).toBeLessThanOrEqual(a0);
    }
  });
});

// ======================================================================================= ECHO
describe('echo: the second family casts too, at half power', () => {
  const echoHeal = (g, stage) => {
    const G = gameAt(stage); const u = addRaw(G, g, { link: 11, traits: [], seat: { ring: 0, dir: 0 } }); const a = addLeaf(G, 'suppression', { seat: { ring: 0, dir: 5 }, traits: [] });
    arena(G);
    const c = bu(G, u), ca = bu(G, a); c.sal = 1000; c.cd = 1e9; c.charge = 100; ca.max = 1e12; ca.hp = 1;
    foe(G, { x: 9, z: 0 });
    const e0 = G.stats.echoes; stepBattle(G, 0);
    return { heal: ca.hp - 1, echoes: G.stats.echoes - e0, c, G };
  };
  const hybrid = node('carve', leaf('reappraisal'), leaf('attunement'));
  it('a two-family unit carries the second-heaviest family ability from stage 12 only', () => {
    expect(abilityOf(hybrid)).toBe('reframe');
    expect(echoAbilityOf(hybrid)).toBe('mend');
    expect(echoHeal(hybrid, 11).c.echo).toBeNull();
    expect(echoHeal(hybrid, 12).c.echo).toBe('mend');
    expect(echoAbilityOf(leaf('attunement'))).toBeNull();
  });
  it('the echo fires with the ability, counts in stats.echoes and mends exactly half of a full Mend', () => {
    const e = echoHeal(hybrid, 12);
    expect(e.echoes).toBe(1);
    expect(e.G.events.some((x) => x.type === 'cast' && x.echo === true && x.kind === ABILITIES.mend.kind)).toBe(true);
    const full = echoHeal(leaf('attunement'), 12);
    expect(full.echoes).toBe(0);
    expect(full.heal).toBeGreaterThan(0);
    expect(rel(e.heal, full.heal * 0.5)).toBeLessThan(1e-9);
  });
});

// ======================================================================================= STANCES
describe('stances: exact stat changes', () => {
  it('toward, away and against change unitStats exactly as their mods say', () => {
    for (const fam of ['reappraisal', 'containment', 'avoidance']) {
      const G = gameAt(17); const u = addLeaf(G, fam, { link: 8 }); u.muts = SIX.slice();
      const base = unitStats(G, u, {});
      for (const s of STANCES) {
        G.stance = s.id; const st = unitStats(G, u, {});
        expect(rel(st.tol, base.tol * (s.mod.tol || 1)), `${s.id} tol`).toBeLessThan(1e-12);
        expect(rel(st.sal, base.sal * (s.mod.sal || 1)), `${s.id} sal`).toBeLessThan(1e-12);
        expect(rel(st.reach, base.reach * (s.mod.reach || 1)), `${s.id} reach`).toBeLessThan(1e-12);
        expect(st.opa, `${s.id} opa`).toBe(Math.min(80, base.opa + (s.mod.opa || 0)));
        expect(st.lat).toBe(base.lat);
      }
      G.stance = null;
    }
  });
  it('away lowers affect yield by its factor; toward doubles Mend', () => {
    const G = gameAt(17); const m = affectMul(G); G.stance = 'away';
    expect(rel(affectMul(G), m * STANCES.find((s) => s.id === 'away').mod.affect)).toBeLessThan(1e-12);
    const heal = (stance) => {
      const H = gameAt(17); H.stance = stance;
      const u = late(H, 'attunement', { seat: { ring: 0, dir: 0 }, traits: [] }), a = addLeaf(H, 'suppression', { seat: { ring: 0, dir: 5 }, traits: [] });
      arena(H); const c = bu(H, u), ca = bu(H, a); c.cd = 1e9; c.charge = 100; ca.max = 1e15; ca.hp = 1; stepBattle(H, 0);
      return ca.hp - 1;
    };
    expect(rel(heal('toward'), heal(null) * STANCES.find((s) => s.id === 'toward').mod.heal)).toBeLessThan(1e-9);
  });
});

// ======================================================================================= SEASONS
describe('seasons', () => {
  it('every 60 s the season takes 3 attention, or adds a Dread when there is not enough', () => {
    const G = gameAt(14); G.auto = false; addLeaf(G, 'avoidance'); G.attention = 4;
    for (let t = 0; t < 59.5; t += 0.25) step(G, 0.25);
    expect(G.stats.seasons).toBe(0);
    for (let t = 0; t < 0.75; t += 0.25) step(G, 0.25);
    expect(G.stats.seasons).toBe(1);
    expect(G.attention).toBe(1);
    expect(G.moods.length).toBe(0);
    for (let t = 0; t < 60; t += 0.25) step(G, 0.25);
    expect(G.stats.seasons).toBe(2);
    expect(G.attention).toBe(1);
    expect(G.moods.map((m) => m.kind)).toEqual(['dread']);
    const E = gameAt(13); E.auto = false; for (let t = 0; t < 70; t += 0.25) step(E, 0.25);
    expect(E.stats.seasons).toBe(0);
  });
});

// ======================================================================================= MIRROR
describe('mirror', () => {
  it('costs mirrorCost in affect, the price rises geometrically, refuses when short', () => {
    const G = gameAt(15);
    const c0 = mirrorCost(G); G.affect = c0 - 1; expect(actions.mirror(G)).toBe(false);
    G.affect = c0; expect(actions.mirror(G)).toBe(true); expect(G.affect).toBe(0); expect(G.mirrors).toBe(1);
    const c1 = mirrorCost(G); G.mirrors = 2; const c2 = mirrorCost(G);
    expect(c1).toBeGreaterThan(c0);
    expect(rel(c2 / c1, c1 / c0)).toBeLessThan(1e-12);
  });
  it('each mirror doubles affect, lets more be held, opens the third ring, adds complexity and hardens the weather', () => {
    const G = gameAt(15); G.auto = false; G.level = 10; step(G, 0.1);
    const m0 = affectMul(G), cap0 = unitCap(G), C0 = G.complexity;
    G.affect = mirrorCost(G); actions.mirror(G);
    expect(rel(affectMul(G), 2 * m0)).toBeLessThan(1e-12);
    expect(unitCap(G)).toBeGreaterThan(cap0);
    expect(ringsOpen(G)).toBe(3);
    step(G, 0.1); expect(G.complexity).toBeGreaterThan(C0);
    const hp = (mirrors) => { const H = gameAt(15); H.mirrors = mirrors; return normT(spawn(H, { wave: 1, cycle: 3, arc: PLAIN })[0].enemies[0]); };
    expect(hp(1)).toBeGreaterThan(hp(0));
    expect(hp(2)).toBeGreaterThan(hp(1));
  });
});

// ======================================================================================= WILDCARD
describe('wildcard (stage 16): +1 count to every aspect', () => {
  it('aspectTiers counts one more of every aspect from stage 16', () => {
    for (const fams of [[], ['reappraisal'], ['reappraisal', 'attunement', 'equanimity']]) {
      const at = (stage) => { const G = gameAt(stage); fams.forEach((f, i) => addLeaf(G, f, { seat: { ring: 0, dir: i } })); return aspectTiers(G); };
      const a = at(15), b = at(16);
      for (const asp of ASPECT_IDS) {
        expect(b[asp + '_n'], asp).toBe(a[asp + '_n'] + 1);
        expect(b[asp]).toBe(ASPECT_THRESHOLDS.filter((t) => b[asp + '_n'] >= t).length);
      }
    }
    // one seated unit is now a bond: its aspects reach tier 1
    const G = gameAt(16); addLeaf(G, 'reappraisal', { seat: { ring: 0, dir: 0 } });
    for (const asp of FAMILY.reappraisal.aspects) expect(aspectTiers(G)[asp]).toBe(1);
  });
});

// ======================================================================================= OVERWHELM
describe('overwhelm', () => {
  it('rises linearly across its band above capacity and is clamped to 0..1', () => {
    const G = gameAt(17); G.auto = false;
    for (let m = 0; m <= 8; m++) {
      G.mirrors = m; step(G, 0.01);
      const expected = Math.max(0, Math.min(1, (G.complexity - G.capacity) / (G.capacity * DOC_OVERWHELM_BAND)));
      expect(Math.abs(G.overwhelm - expected)).toBeLessThan(1e-12);
    }
    expect(G.overwhelm).toBe(1);
  });
  it('at full overwhelm composure drains to exactly 0 and never below', () => {
    const G = gameAt(17); G.auto = false; G.mirrors = 10;
    for (let t = 0; t < 120; t += 0.25) { step(G, 0.25); expect(G.composure).toBeGreaterThanOrEqual(0); }
    expect(G.overwhelm).toBe(1);
    expect(G.composure).toBe(0);
  });
  it('overwhelm hardens stressors and, past half, quickens the beats', () => {
    const at = (ow) => { const G = gameAt(17); G.overwhelm = ow; const b = spawn(G, { wave: 1, cycle: 3, arc: PLAIN }); return { hp: normT(b[0].enemies[0]), beatT: G.battle.beatT }; };
    const a = at(0), h = at(0.5), f = at(1);
    expect(h.hp).toBeGreaterThan(a.hp); expect(f.hp).toBeGreaterThan(h.hp);
    expect(a.beatT).toBe(BEAT_TIME); expect(h.beatT).toBe(BEAT_TIME);
    expect(f.beatT).toBeLessThan(BEAT_TIME);
  });
});

// ======================================================================================= RESET
describe('the non-mind reset', () => {
  it('pays the residue formula and keeps exactly the meta', () => {
    for (const [peak, stage, ow, depth] of [[500, 17, 1, 0], [2400, 17, 0.6, 3], [90, 3, 1, 12], [1e5, 17, 1, 40]]) {
      const G = gameAt(stage); G.stats.peak = peak; G.overwhelm = ow; G.depth = depth; G.mu = 7; G.endings = 2; G.t = 333; G.totalT = 1000; G.bestStage = 9; G.cards = ['c0'];
      const gain = muGain(G);
      expect(gain).toBe(DOC_MU_GAIN(G));
      const N = actions.nonMind(G);
      expect(N.mu).toBe(7 + gain); expect(N.endings).toBe(2); expect(N.depth).toBe(depth + 1);
      expect(N.bestStage).toBe(Math.max(9, stage)); expect(N.totalT).toBe(1333); expect(N.cards).toEqual(['c0']);
      expect(N.attention).toBe(3 + Math.min(20, Math.floor(Math.sqrt(N.mu))));
      expect([N.stage, N.units.length, N.mirrors, N.insight, N.affect, N.wave, N.cycle]).toEqual([0, 0, 0, 0, 0, 1, 0]);
      expect(N.events.some((e) => e.type === 'reset' && e.gain === gain)).toBe(true);
    }
    const G0 = gameAt(0); expect(actions.nonMind(G0)).toBe(G0);
  });

  it('endlessly playable: a bot that lets go again and again keeps climbing, with nothing NaN, and saves mid-run replay', () => {
    let G = createGame(11), resets = 0, best = 0;
    for (let t = 0; t < 5000; t += 0.1) {
      const N = resettingBot(G, t, 1500); if (N !== G) { resets++; best = Math.max(best, G.stage); G = N; }
      step(G, 0.1); G.events.length = 0;
      if (Math.round(t * 10) % 5000 === 0) expect(badNumbers(G), `t=${t}`).toEqual([]);
    }
    expect(resets).toBeGreaterThanOrEqual(3);
    expect(best).toBe(STAGES.length - 1);
    expect(G.mu).toBeGreaterThan(0);
    expect(badNumbers(G)).toEqual([]);
    // restart from a save: the copy and the original continue identically
    const C = deserialize(serialize(G)); G.phase = 'prep'; G.phaseT = 0; G.battle = null;
    for (let t = 0; t < 200; t += 0.1) { resettingBot(G, t); resettingBot(C, t); step(G, 0.1); step(C, 0.1); G.events.length = 0; C.events.length = 0; }
    expect(serialize(C)).toBe(serialize(G));
  });
});

// ======================================================================================= LADDER AT HEIGHT
describe('the ladder at height: links 4..12', () => {
  // a hybrid arriving through integrate is the cleanest real arrival at a chosen link (addUnit -> fuse)
  const arrive = (G, link, muts = []) => { G.insight = 1e9; const a = addLeaf(G, 'avoidance', { link }), b = addLeaf(G, 'projection', { link: 1 }); a.muts = muts.slice(); return actions.integrate(G, a.id, b.id); };
  const HK = key(node('blend', leaf('avoidance'), leaf('projection')));
  const twin = (G, link, opts = {}) => addRaw(G, node('blend', leaf('avoidance'), leaf('projection')), { link, ...opts });

  it('two copies at the same link 4..11 fuse into the next link and gain its gene', () => {
    for (let L = 4; L <= 11; L++) {
      const G = gameAt(17); const t = twin(G, L, { seat: { ring: 0, dir: 1 } });
      arrive(G, L);
      const left = G.units.filter((u) => key(u.g) === HK);
      if (L === 11) { expect(left).toHaveLength(0); expect(G.endings).toBe(1); continue; }
      expect(left, `L${L}`).toHaveLength(1);
      expect(left[0]).toBe(t); // the seated one is kept
      expect(t.link).toBe(L + 1);
      expect(t.traits).toContain(traitForLink(L + 1));
    }
  });

  it('from link 4 a copy one link away fuses too (link 3 counts as a neighbour); two links away does not', () => {
    for (let L = 4; L <= 10; L++) {
      const G = gameAt(17); twin(G, L - 1); arrive(G, L);
      expect(G.units.filter((u) => key(u.g) === HK).map((u) => u.link), `L${L} with L${L - 1}`).toEqual([L + 1]);
      const H = gameAt(17); twin(H, L + 1); arrive(H, L);
      expect(H.units.filter((u) => key(u.g) === HK).map((u) => u.link), `L${L} with L${L + 1}`).toEqual([L + 2 >= 12 ? undefined : L + 2].filter(Boolean));
      const K = gameAt(17); twin(K, L + 2); arrive(K, L);
      expect(K.units.filter((u) => key(u.g) === HK).map((u) => u.link).sort((a, b) => a - b)).toEqual([L, L + 2]);
    }
    const G = gameAt(17); twin(G, 2); arrive(G, 3);
    expect(G.units.filter((u) => key(u.g) === HK).map((u) => u.link).sort()).toEqual([2, 3]);
  });

  // BUG fuse-near-order: src/game/game.js:117 tries the neighbour link only when the ARRIVING unit is at link >= 4
  // (`u.link >= FUSE_NEAR ? ...`). A link-3 copy arriving beside a link-4 copy therefore never fuses, while a link-4
  // arriving beside a link-3 does: the same pair fuses or not depending on which came last, and the 3 and the 4 can sit
  // side by side forever. Observed links [4, 3]; expected [5] (the pair {3, 4} is the neighbour rule's own example).
  // Minimal reproduction: gameAt(17); raw Avoidance leaves at links 4 and 2; buy Avoidance twice (1+1 -> 2, 2+2 -> 3).
  it.fails('BUG fuse-near-order: a link-3 copy arriving beside a link-4 copy fuses, as the reverse order does', () => {
    const G = gameAt(17); twin(G, 4); arrive(G, 3);
    expect(G.units.filter((u) => key(u.g) === HK).map((u) => u.link)).toEqual([5]);
  });

  it('mutations stay within the cap through every fusion, and genes within ten through combines', () => {
    const G = gameAt(17); const tw = twin(G, 6, { traits: LADDER_TRAITS.slice(0, 10) }); tw.muts = SIX.slice();
    arrive(G, 6, SIX.slice().reverse());
    const kept = G.units.filter((u) => key(u.g) === HK); expect(kept).toHaveLength(1);
    const t = kept[0];
    expect(t.link).toBe(7);
    expect(t.muts.length).toBe(MAX_MUTS);
    expect(new Set(t.muts).size).toBe(t.muts.length);
  });

  // BUG trait-cap: src/game/game.js:121 pushes the new link's gene after inheritTraits (genome.js:105) has already
  // cut the union to 10, so a fused unit carries 11 genes (combine and subtract keep 10: game.js:302).
  // Observed 11; expected <= 10. Minimal reproduction: a link-6 hybrid with 10 genes, the same hybrid arrives at link 6.
  it.fails('BUG trait-cap: a fused unit never carries more than ten genes', () => {
    const G = gameAt(17); const t = twin(G, 6, { traits: LADDER_TRAITS.slice(0, 10), seat: { ring: 0, dir: 0 } });
    const a = addLeaf(G, 'avoidance', { link: 6, traits: LADDER_TRAITS.slice(0, 10) }), b = addLeaf(G, 'projection', { link: 1, traits: LADDER_TRAITS.slice(0, 10) });
    G.insight = 1e9; actions.integrate(G, a.id, b.id);
    expect(t.link).toBe(7);
    expect(t.traits.length).toBeLessThanOrEqual(10);
  });

  // BUG mut-conflict: content/mutations.js:90 says the PAIRS "cannot coexist in one unit" and rollMutation honours
  // it, but fuse (game.js:122) and combine (game.js:305) take the plain union of both parents' mutations.
  // Observed muts ['object_constancy','splitting',...]; expected no conflicting pair in one unit.
  // Minimal reproduction: gameAt(17); integrate a Reappraisal with muts ['object_constancy'] and a Suppression with ['splitting'].
  it.fails('BUG mut-conflict: integrating or fusing never joins two conflicting mutations in one unit', () => {
    const [x, y] = ['object_constancy', 'splitting'];
    expect(MUTATION[x].conflicts).toContain(y);
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'); a.muts = [x]; b.muts = [y];
    const h = actions.integrate(G, a.id, b.id);
    const bad = (u) => u.muts.some((m) => MUTATION[m].conflicts.some((c) => u.muts.includes(c)));
    expect(bad(h)).toBe(false);
    const H = gameAt(17); const t = twin(H, 5); t.muts = [x]; arrive(H, 5, [y]);
    expect(bad(t)).toBe(false);
  });

  // BUG combine-gone: src/game/game.js:305-307 sets parentLinks and rolls the 80% mutation on the unit returned by
  // addUnit, but when the new hybrid fuses into a seated twin (game.js:119 keeps the seated one) that unit has just
  // been removed: integrate/subtract return a unit that is not on the board and its mutation roll is lost.
  // Observed G.units.includes(result) === false. Minimal reproduction: a seated (reappraisal b suppression) at link 1;
  // integrate a benched Reappraisal and Suppression.
  it.fails('BUG combine-gone: integrate returns the unit that is on the board after fusing', () => {
    const G = gameAt(17); G.insight = 100;
    addRaw(G, node('blend', leaf('reappraisal'), leaf('suppression')), { seat: { ring: 0, dir: 0 } });
    const h = actions.integrate(G, addLeaf(G, 'reappraisal').id, addLeaf(G, 'suppression').id);
    expect(G.units).toContain(h);
  });

  it('link 12 dissolves the unit into an ending: +affect and +salience that survive the reset', () => {
    const G = gameAt(17); const t = twin(G, 11, { seat: { ring: 0, dir: 0 } });
    const probe = addLeaf(G, 'containment', { link: 9 });
    const m0 = affectMul(G), s0 = unitStats(G, probe, {}).sal;
    arrive(G, 11);
    expect(G.units).not.toContain(t);
    expect(G.endings).toBe(1);
    expect(G.units.some((u) => u.traits.includes(traitForLink(12)))).toBe(false);
    expect(G.events.some((e) => e.type === 'ending' && e.id === t.id)).toBe(true);
    expect(rel(affectMul(G), m0 * (1 + DOC_ENDING_BONUS) / 1)).toBeLessThan(1e-12);
    expect(rel(unitStats(G, probe, {}).sal, s0 * (1 + DOC_ENDING_BONUS))).toBeLessThan(1e-12);
    const N = actions.nonMind(G);
    expect(N.endings).toBe(1);
    expect(rel(affectMul(N), (1 + 0.04 * N.mu) * (1 + DOC_ENDING_BONUS) * (1 + N.complexity / 25))).toBeLessThan(1e-12);
  });
});

// ======================================================================================= ABILITIES AT LINK 11
describe('all ten abilities at link 11 with six mutations, cycle 3', () => {
  // one caster, all its genes and six mutations; dt 0 so only the cast acts
  const setup = (fam, { stance = null, allies = [] } = {}) => {
    const G = gameAt(15); G.stance = stance;
    const u = late(G, fam, { seat: { ring: 0, dir: 0 } });
    const al = allies.map((f, i) => late(G, f, { seat: { ring: 0, dir: 3 + i }, traits: [] }));
    arena(G);
    const c = bu(G, u); c.cd = 1e9; c.charge = 100; c.opa = 0; // mutations make it hard to hit; the tests that strike it need it hit
    for (const a of al) { bu(G, a).cd = 1e9; bu(G, a).opa = 0; }
    return { G, c, al: al.map((a) => bu(G, a)) };
  };
  const fire = (G) => { G.events.length = 0; stepBattle(G, 0); expect(badNumbers(G.battle)).toEqual([]); };
  const famOf = (ab) => FAMILIES.find((f) => f.ability === ab).id;

  it('every family has its ability and every ability belongs to one family', () => {
    expect(new Set(FAMILIES.map((f) => f.ability))).toEqual(new Set(Object.keys(ABILITIES)));
  });

  it('Reframe: the strongest stressor is turned on its nearest kin, and stunned', () => {
    const { G, c } = setup(famOf('reframe'));
    const strong = foe(G, { x: 6, z: 0, sal: 1e4 }), kin = foe(G, { x: 6.5, z: 0, sal: 1 }), far = foe(G, { x: -9, z: 0, sal: 2 });
    fire(G);
    expect(strong.hp).toBe(strong.max);
    expect(strong.stun).toBeGreaterThan(0);
    expect(far.hp).toBe(far.max);
    expect(kin.max - kin.hp).toBeGreaterThan(c.sal * ABILITIES.reframe.power);
    expect(kin.max - kin.hp).toBeGreaterThan(strong.sal * ABILITIES.reframe.power);
    expect(c.charge).toBe(0);
  });

  it('Lid: hardens, keeps most of the harm it takes, returns it to those near when it falls', () => {
    const { G, c } = setup(famOf('lid'));
    const e = foe(G, { x: c.x + 0.5, z: c.z, sal: 5000, reach: 5 }), far = foe(G, { x: -9, z: 0 });
    c.charge = 0; c.veil = 0; e.cd = 0; fire(G);
    const d0 = c.max - c.hp, store0 = c.store;
    expect(d0).toBeGreaterThan(0);
    expect(rel(store0, d0 * ABILITIES.lid.power)).toBeLessThan(1e-9);
    expect(ABILITIES.lid.power).toBeGreaterThan(0.5); // "most"
    const v0 = c.veil; c.charge = 100; c.hp = c.max; fire(G);
    expect(c.hard).toBeGreaterThan(1);
    expect(c.veil).toBeGreaterThan(v0);
    c.veil = 0; c.hp = c.max; e.cd = 0; G.events.length = 0; stepBattle(G, 0);
    expect(rel(c.max - c.hp, d0 / c.hard)).toBeLessThan(1e-9);
    const stored = c.store, eHp = e.hp; c.hp = 1; c.veil = 0; e.cd = 0; stepBattle(G, 0);
    expect(c.alive).toBe(false);
    expect(eHp - e.hp).toBeGreaterThanOrEqual(stored);
    expect(far.hp).toBe(far.max);
  });

  it(`Loop: strikes ${Math.round(ABILITIES.loop.power)} times, and is worn thin`, () => {
    const { G, c } = setup(famOf('loop'));
    for (let i = 0; i < 3; i++) foe(G, { x: 5 + i, z: 1 });
    fire(G);
    expect(hitsFrom(G, c)).toHaveLength(Math.round(ABILITIES.loop.power));
    expect(c.hp).toBeLessThan(c.max);
  });

  it('Withdraw: leaps to the far rim, unseen a moment, and strikes thrice from there', () => {
    const { G, c } = setup(famOf('withdraw'));
    foe(G, { x: 5, z: 2 }); foe(G, { x: 6, z: -2 });
    fire(G);
    expect(Math.hypot(c.x, c.z)).toBeGreaterThan(ARENA.rings[ARENA.rings.length - 1]);
    expect(c.x * c.hx + c.z * c.hz).toBeLessThan(0); // the other side of the disc
    expect(c.hide).toBeGreaterThan(0);
    expect(hitsFrom(G, c)).toHaveLength(3);
  });

  it('Mend: mends the ally who needs it most', () => {
    const { G, c, al } = setup(famOf('mend'), { allies: ['containment', 'suppression'] });
    al[0].max = 1e15; al[0].hp = 1e14; al[1].max = 1e15; al[1].hp = 1e13;
    fire(G);
    expect(al[0].hp).toBe(1e14);
    expect(al[1].hp).toBeGreaterThan(1e13);
    expect(c.hp).toBe(c.max);
  });

  it('Cast Out: hands its own wounds to the nearest stressor, and is eased by it', () => {
    const { G, c } = setup(famOf('cast_out'));
    const near = foe(G, { x: c.x + 1, z: 0 }), far = foe(G, { x: -9, z: 0 });
    c.hp = c.max / 2; const lost = c.max - c.hp;
    fire(G);
    expect(near.max - near.hp).toBeGreaterThanOrEqual(lost * ABILITIES.cast_out.power);
    expect(far.hp).toBe(far.max);
    expect(c.hp).toBeGreaterThan(c.max / 2);
  });

  it('Vanish: is not here; returns beside the stressor with most tolerance, heavily', () => {
    const { G, c } = setup(famOf('vanish'));
    const big = foe(G, { x: -6, z: 0, hp: 5e9, max: 5e9 }), small = foe(G, { x: 4, z: 0 });
    fire(G);
    expect(Math.hypot(c.x - big.x, c.z - big.z)).toBeLessThan(1.5);
    expect(c.hide).toBeGreaterThan(0);
    expect(big.hp).toBeLessThan(big.max);
    expect(small.hp).toBe(small.max);
  });

  it('Transmute: burns everything near; the ashes are affect', () => {
    const { G, c } = setup(famOf('transmute'));
    const n1 = foe(G, { x: c.x + 1, z: 0 }), n2 = foe(G, { x: c.x, z: 1 }), far = foe(G, { x: -9, z: 0 });
    const a0 = G.affect; fire(G);
    expect(n1.hp).toBeLessThan(n1.max); expect(n2.hp).toBeLessThan(n2.max);
    expect(far.hp).toBe(far.max);
    expect(G.affect).toBeGreaterThan(a0);
  });

  it('Hold: everything nearby must attend to it; it hardens', () => {
    const { G, c, al } = setup(famOf('hold'), { allies: ['suppression'] });
    const e = foe(G, { x: al[0].x + 0.3, z: al[0].z, sal: 100, reach: 10 });
    c.charge = 0; e.cd = 0; fire(G);
    expect(G.events.filter((x) => x.type === 'hit' && x.side === 0).map((x) => x.id)).toEqual([al[0].id]);
    c.charge = 100; e.cd = 0; fire(G);
    expect(c.taunt).toBeGreaterThan(0);
    expect(c.hard).toBeGreaterThan(1);
    expect(G.events.filter((x) => x.type === 'hit' && x.side === 0).map((x) => x.id)).toEqual([c.id]);
  });

  it('Level: draws every stressor down toward the weakest; the greatest are drawn less', () => {
    const { G } = setup(famOf('level'));
    const hs = [1e6, 3e5, 1e3].map((hp, i) => foe(G, { x: 5, z: i, hp, max: 1e6 }));
    const boss = foe(G, { x: 6, z: 0, hp: 1e6, max: 1e6, boss: true });
    fire(G);
    const low = 1e3, P = ABILITIES.level.power;
    for (const [e, h] of [[hs[0], 1e6], [hs[1], 3e5], [hs[2], 1e3]]) expect(rel(e.hp, Math.max(low, h * (1 - P)))).toBeLessThan(1e-9);
    expect(boss.hp).toBeLessThan(1e6);
    expect(1 - boss.hp / 1e6).toBeLessThan(P);
  });
});

// ======================================================================================= TRAITS AT LINK 11
describe('every gene at link 11 with six mutations, measured', () => {
  // a link-11 Suppression with only the genes under test; constant rng 0.5 removes variance and misses
  const one = (traits, { stage = 15, fam = 'suppression' } = {}) => {
    const G = gameAt(stage); const u = late(G, fam, { seat: { ring: 0, dir: 0 }, traits });
    arena(G); G.rng = constRng(0.5);
    const c = bu(G, u); c.cd = 1e9; c.reach = 100; c.rec = 0; c.opa = 0; // so a stressor's strike lands under rng 0.5
    return { G, c, u };
  };
  const strikeOnce = (G, c, e) => { const h0 = e.hp; c.cd = 0; stepBattle(G, 0); c.cd = 1e9; return h0 - e.hp; };

  it('ache: the closer it is to falling, the more each strike carries (more genes, more)', () => {
    const dmg = (n, frac) => { const { G, c } = one(Array(n).fill('ache')); c.hp = c.max * frac; return strikeOnce(G, c, foe(G, { x: c.x + 0.5, z: 0 })); };
    expect(dmg(1, 0.2)).toBeGreaterThan(dmg(1, 1));
    expect(dmg(2, 0.2)).toBeGreaterThan(dmg(1, 0.2));
    expect(rel(dmg(1, 1), dmg(0, 1))).toBeLessThan(1e-12);
  });
  it('trust: starts each wave veiled by a share of its tolerance that takes harm first', () => {
    const a = one(['trust']).c, b = one(['trust', 'trust']).c, z = one([]).c;
    expect(z.veil).toBe(0);
    expect(a.veil).toBeGreaterThan(0); expect(a.veil).toBeLessThan(a.max);
    expect(rel(b.veil, 2 * a.veil)).toBeLessThan(1e-12);
    const { G, c } = one(['trust']); const e = foe(G, { x: c.x + 0.5, z: 0, sal: c.veil / 2, reach: 5, cd: 0 });
    stepBattle(G, 0); expect(c.hp).toBe(c.max); expect(e.cd).toBe(e.lat);
  });
  it('glad: each strike leaves a little affect', () => {
    const gain = (n) => { const { G, c } = one(Array(n).fill('glad')); const a0 = G.affect; strikeOnce(G, c, foe(G, { x: c.x + 0.5, z: 0 })); return G.affect - a0; };
    expect(gain(0)).toBe(0); expect(gain(1)).toBeGreaterThan(0); expect(rel(gain(2), 2 * gain(1))).toBeLessThan(1e-9);
  });
  it('rapture: the first strikes of a wave come much faster', () => {
    const tick = (traits, hits) => { const { G, c } = one(traits); c.cd = 100; c.hits = hits; foe(G, { x: 50, z: 50 }); stepBattle(G, 0.1); return 100 - c.cd; };
    expect(tick(['rapture'], 0)).toBeGreaterThan(tick([], 0) * 2);
    expect(rel(tick(['rapture'], 1000), tick([], 0))).toBeLessThan(1e-9);
  });
  it('calm: slows the latency of stressors nearby', () => {
    const cdLoss = (traits, dx) => { const { G, c } = one(traits); const e = foe(G, { x: c.x + dx, z: 0, cd: 10 }); stepBattle(G, 0.1); return 10 - e.cd; };
    expect(cdLoss(['calm'], 1)).toBeLessThan(cdLoss([], 1));
    expect(rel(cdLoss(['calm'], 30), cdLoss([], 30))).toBeLessThan(1e-9);
  });
  it('ease: mends itself, softly and without pause', () => {
    const regen = (n) => { const { G, c } = one(Array(n).fill('ease')); c.hp = c.max / 2; stepBattle(G, 1); return c.hp - c.max / 2; };
    expect(regen(0)).toBe(0); expect(regen(1)).toBeGreaterThan(0); expect(rel(regen(2), 2 * regen(1))).toBeLessThan(1e-9);
  });
  it('gather: repeated strikes on one target grow', () => {
    const { G, c } = one(['gather']); const e = foe(G, { x: c.x + 0.5, z: 0 });
    const d = [strikeOnce(G, c, e), strikeOnce(G, c, e), strikeOnce(G, c, e)];
    expect(d[1]).toBeGreaterThan(d[0]); expect(d[2]).toBeGreaterThan(d[1]);
    const { G: H, c: h } = one([]); const f = foe(H, { x: h.x + 0.5, z: 0 });
    expect(rel(strikeOnce(H, h, f), strikeOnce(H, h, f))).toBeLessThan(1e-12);
  });
  it('see: ignores opacity', () => {
    const hit = (traits) => { const { G, c } = one(traits); return strikeOnce(G, c, foe(G, { x: c.x + 0.5, z: 0, opa: 85 })); };
    expect(hit([])).toBe(0); expect(hit(['see'])).toBeGreaterThan(0);
  });
  it('tire: stressors nearby lose salience', () => {
    const taken = (traits) => { const { G, c } = one(traits); c.veil = 0; foe(G, { x: c.x + 0.5, z: 0, sal: 1000, reach: 5, cd: 0 }); stepBattle(G, 0); return c.max - c.hp; };
    expect(taken(['tire'])).toBeLessThan(taken([]));
    expect(taken(['tire'])).toBeGreaterThan(0);
  });
  it('fade: counts as every aspect (bonds, aspect bonuses, verb slots)', () => {
    const G = gameAt(15); const u = late(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: ['fade'] });
    const t = aspectTiers(G);
    for (const a of ASPECT_IDS) expect(t[a + '_n'], a).toBe(1);
    const tiers = Object.fromEntries(ASPECT_IDS.map((a) => [a, 1]));
    const plain = { ...u, traits: [] };
    expect(unitStats(G, u, tiers).sal).toBeGreaterThan(unitStats(G, plain, tiers).sal); // limbic, not a suppression aspect
    const bare = { ...u, muts: [] }; // six mutations push opacity to its cap; measure the void bonus below it
    expect(unitStats(G, bare, tiers).opa).toBe(unitStats(G, { ...bare, traits: [] }, tiers).opa + ASPECTS.void.v[0]);
  });

  // BUG fade-relational: src/game/battle.js:139 shares harm only when `tgt.aspects.includes('relational')`, the raw
  // aspects, ignoring the fade gene that counts as every aspect everywhere else (unitStats `has`, vagal regen at
  // battle.js:212, aspectTiers, startVerb). Observed: a fade unit under an active Relational bond takes the whole
  // strike (neighbour 0); expected: it passes ASPECTS.relational.v[tier-1]% to its neighbours as a Relational member.
  // Minimal reproduction: stage 15, Attunement + Projection seated (relational tier 1), a fade Suppression beside them, strike it.
  it.fails('BUG fade-relational: a fade unit shares harm with neighbours under a Relational bond', () => {
    const G = gameAt(15);
    late(G, 'attunement', { seat: { ring: 0, dir: 1 }, traits: [] }); late(G, 'projection', { seat: { ring: 0, dir: 9 }, traits: [] });
    const u = late(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: ['fade'] });
    const B = arena(G); expect(B.tiers.relational).toBeGreaterThan(0); G.rng = constRng(0.5);
    const c = bu(G, u); c.veil = 0; c.opa = 0;
    foe(G, { x: c.x + 0.4, z: 0, sal: 1e4, reach: 5, cd: 0 }); stepBattle(G, 0);
    expect(c.hp).toBeLessThan(c.max);
    const neighbours = B.units.filter((o) => o !== c).reduce((n, o) => n + (o.max - o.hp), 0);
    expect(neighbours).toBeGreaterThan(0);
  });

  it('release: on falling, mends every ally', () => {
    const G = gameAt(15); const u = late(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: ['release'] }), a = late(G, 'containment', { seat: { ring: 0, dir: 5 }, traits: [] });
    arena(G); G.rng = constRng(0.5);
    const c = bu(G, u), ca = bu(G, a); ca.cd = 1e9; c.cd = 1e9; ca.hp = ca.max * 0.1; c.hp = 1; c.veil = 0; c.opa = 0;
    foe(G, { x: c.x + 0.4, z: 0, sal: 1e4, reach: 5, cd: 0 }); stepBattle(G, 0);
    expect(c.alive).toBe(false);
    expect(ca.hp).toBeGreaterThan(ca.max * 0.1);
  });
  it('end: is never carried by a living unit (it dissolves into an ending)', () => {
    expect(TRAITS[traitForLink(12)]).toBeTruthy();
    const G = gameAt(17); for (let l = 1; l <= 11; l++) addLeaf(G, 'equanimity', { link: l });
    G.shop = ['equanimity']; G.attention = 9; actions.buy(G, 0);
    expect(G.endings).toBe(1); expect(G.units.some((u) => u.traits.includes('end'))).toBe(false);
  });

  it('a full late board (ten families, link 11, all genes, six mutations) fights cycle 4 waves: every ability casts, nothing is NaN', () => {
    const G = gameAt(17); G.level = 10;
    FAMILIES.forEach((f, i) => late(G, f.id, { seat: { ring: i % 2, dir: i } }));
    G.wave = 1; G.cycle = 4;
    const kinds = new Set(); let waves = 0;
    for (let t = 0; t < 240; t += 0.1) {
      step(G, 0.1);
      // a Lid falling also emits a cast of kind 'store', without an id: count only real casts
      for (const e of G.events) { if (e.type === 'cast' && e.id !== undefined) kinds.add(e.kind); if (e.type === 'waveWin' || e.type === 'waveLose') waves++; }
      G.events.length = 0;
    }
    expect(badNumbers(G)).toEqual([]);
    expect(waves).toBeGreaterThan(2);
    expect([...kinds].sort()).toEqual([...new Set(Object.values(ABILITIES).map((a) => a.kind))].sort());
  });
});

// ======================================================================================= WAVE ARCS AT CYCLE 3+
describe('the ten wave arcs at cycle 3', () => {
  const board = (G) => { late(G, 'suppression', { seat: { ring: 0, dir: 0 } }); late(G, 'projection', { seat: { ring: 0, dir: 5 } }); return G; };
  const arcN = (id) => WAVE_ARC.findIndex((a) => a.id === id) + 1;

  it('negation: stressors come half-seen (opacity from the arc, on top of their affix)', () => {
    for (const b of spawn(board(gameAt(15)), { wave: arcN('negation'), beats: 10 })) for (const e of b.enemies) expect(e.opa).toBe(WAVE_ARC[0].mod.opa + (affixOf(e)?.mod.opa || 0));
  });

  it('ineffable: charge from strikes fills at the stated fraction', () => {
    const gain = (wave) => { const G = gameAt(13); const u = addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: [] }); arena(G, { wave }); G.rng = constRng(0.5); const c = bu(G, u); c.reach = 100; c.cd = 0; foe(G, { x: c.x + 0.5, z: 0 }); stepBattle(G, 0); return c.charge; };
    expect(rel(gain(arcN('ineffable')), gain(arcN('negation')) * WAVE_ARC[1].mod.chargeMul)).toBeLessThan(1e-12);
  });

  // BUG ineffable-harm-charge: src/game/battle.js:145 adds charge for harm taken as `(d / tgt.max) * 45` without the
  // arc's chargeMul (applied only to strikes at battle.js:203/232), so on 'Beyond The Path Of Words' charge from harm
  // fills at full speed. The text says "Charge fills at half speed". Observed ratio 1; expected chargeMul (0.5).
  // Minimal reproduction: wave 2 vs wave 1, a seated unit struck once by a stressor; compare c.charge.
  it.fails('BUG ineffable-harm-charge: charge from harm taken also fills at half speed on the ineffable wave', () => {
    const gain = (wave) => { const G = gameAt(13); const u = addLeaf(G, 'containment', { seat: { ring: 0, dir: 0 }, traits: [] }); arena(G, { wave }); G.rng = constRng(0.5); const c = bu(G, u); c.cd = 1e9; c.veil = 0; foe(G, { x: c.x + 0.4, z: 0, sal: c.max / 4, reach: 5, cd: 0 }); stepBattle(G, 0); return c.charge; };
    expect(gain(arcN('negation'))).toBeGreaterThan(0);
    expect(rel(gain(arcN('ineffable')), gain(arcN('negation')) * WAVE_ARC[1].mod.chargeMul)).toBeLessThan(1e-9);
  });

  it('analogy: each stressor arrives with its likeness (count x2), each at the stated tolerance', () => {
    const G = board(gameAt(15)), H = board(gameAt(15));
    const a = spawn(G, { wave: arcN('analogy') })[0].enemies, p = spawn(H, { wave: arcN('analogy'), arc: PLAIN })[0].enemies;
    expect(a.length).toBe(Math.min(14, p.length * WAVE_ARC[2].mod.countMul));
    expect(rel(normT(a[0]), normT(p[0]) * WAVE_ARC[2].mod.tolMul)).toBeLessThan(1e-12);
    for (const e of a) expect(rel(normT(e), normT(a[0]))).toBeLessThan(1e-12);
  });

  it('onemany: one great stressor; when it falls it is many', () => {
    const G = gameAt(15); const u = late(G, 'equanimity', { seat: { ring: 0, dir: 0 }, traits: ['see'] });
    const beats = spawn(G, { wave: arcN('onemany'), beats: BEATS_PER_WAVE });
    expect(beats.map((b) => b.enemies.length)).toEqual([1, ...Array(BEATS_PER_WAVE - 1).fill(0)]);
    const big = beats[0].enemies[0];
    expect(big.def).toBe('shame'); expect(big.fuse).toBeGreaterThan(1);
    const c = bu(G, u); big.hp = 1; big.x = c.x + 0.5; big.z = c.z; c.reach = 100; c.cd = 0;
    stepBattle(G, 0);
    expect(big.alive).toBe(false);
    const many = G.battle.enemies.filter((e) => e.alive);
    expect(many).toHaveLength(big.fuse);
    for (const e of many) expect(rel(e.max, big.max / 12)).toBeLessThan(1e-12);
  });

  // BUG onemany-shadow: src/game/battle.js:124 overwrites the great stressor's hp/max with STRESSOR.shame.tol*scale*4
  // after mk() (battle.js:113) applied the Shadow bond; the arc's one great stressor therefore ignores "Stressors lose
  // %v% tolerance on arrival". Its name and value are also left from the random pool def (battle.js:115), so a
  // "Shame" is shown as e.g. "Clutter" and pays a Clutter's kill value. Observed shadow ratio 1 and name != Shame;
  // expected ratio 1 - ASPECTS.shadow.v[tier-1]/100 and the name of the def it became.
  // Minimal reproduction: stage 15, Suppression + Projection seated (shadow tier 1), wave 4 cycle 3, spawn beat 0.
  it.fails('BUG onemany-shadow: the one great stressor arrives weakened by Shadow and named as a Shame', () => {
    const shadowed = board(gameAt(15)); const plain = gameAt(15); late(plain, 'reappraisal', { seat: { ring: 0, dir: 0 } });
    const s = spawn(shadowed, { wave: arcN('onemany') })[0].enemies[0], p = spawn(plain, { wave: arcN('onemany') })[0].enemies[0];
    const tier = shadowed.battle.tiers.shadow; expect(tier).toBeGreaterThan(0); expect(plain.battle.tiers.shadow).toBe(0);
    expect(s.name.endsWith(STRESSOR.shame.name)).toBe(true);
    expect(s.value).toBe(STRESSOR.shame.value);
    expect(rel(s.max, p.max * (1 - ASPECTS.shadow.v[tier - 1] / 100))).toBeLessThan(1e-12);
  });

  it('counting: counts are unreliable (some beats differ from the plain count, always 1..14)', () => {
    const G = board(gameAt(15)), H = board(gameAt(15));
    const j = spawn(G, { wave: arcN('counting'), beats: 10 }).map((b) => b.enemies.length);
    const p = spawn(H, { wave: arcN('counting'), beats: 10, arc: PLAIN }).map((b) => b.enemies.length);
    expect(j.some((n, i) => n !== p[i])).toBe(true);
    for (const n of j) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(14); }
  });

  it('placeless: they arrive through every gate, not only the beat gate and its opposite', () => {
    const gates = (arc) => { const G = board(gameAt(15)); const bs = spawn(G, { wave: arcN('placeless'), beats: 10, arc }); return bs; };
    const plain = gates(PLAIN);
    for (const b of plain) for (const e of b.enemies) expect([b.gate, (b.gate + 5) % DIRECTIONS]).toContain(gateOf(e));
    const all = new Set(gates(null).flatMap((b) => b.enemies.map(gateOf)));
    expect(all.size).toBeGreaterThanOrEqual(8);
  });

  it('same: they wear the forms of your own, at the stated salience', () => {
    const G = board(gameAt(15)), H = board(gameAt(15));
    const s = spawn(G, { wave: arcN('same') })[0].enemies, p = spawn(H, { wave: arcN('same'), arc: PLAIN })[0].enemies;
    const uids = G.battle.units.map((c) => c.uid);
    for (const e of s) expect(uids).toContain(e.form.mirror);
    expect(rel(normS(s[0]), normS(p[0]) * WAVE_ARC[6].mod.salMul)).toBeLessThan(1e-12);
  });

  it('observer: their number follows your attention (clicks this wave)', () => {
    const n = (clicks) => { const G = board(gameAt(15)); G.clicksThisWave = clicks; return spawn(G, { wave: arcN('observer') })[0].enemies.length; };
    const counts = [0, 12, 48, 120, 1e4].map(n);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });

  it('cancel: aspect bonds are silent', () => {
    const G = board(gameAt(15)); G.wave = arcN('cancel'); G.cycle = 3; startWave(G);
    for (const a of ASPECT_IDS) expect(G.battle.tiers[a], a).toBe(0);
    const H = board(gameAt(15)); H.wave = arcN('negation'); H.cycle = 3; startWave(H);
    expect(H.battle.tiers.shadow).toBeGreaterThan(0);
  });

  it('return: a single strike may undo a great one (one-strike rule, stubbed rng)', () => {
    const P = WAVE_ARC[9].mod.oneShot;
    const tryStrike = (wave, r) => {
      const G = gameAt(15); const u = addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 }, traits: [] });
      arena(G, { wave }); G.rng = constRng(r);
      const c = bu(G, u); c.reach = 100; c.cd = 0; c.rec = 0; c.lab = 0; c.sal = 1;
      const boss = foe(G, { x: c.x + 0.5, z: 0, boss: true }); const a0 = G.attention;
      stepBattle(G, 0);
      return { dead: !boss.alive, paid: G.attention - a0 };
    };
    expect(tryStrike(10, P / 2)).toEqual({ dead: true, paid: 2 });
    expect(tryStrike(10, Math.min(0.99, P * 1.5)).dead).toBe(false);
    expect(tryStrike(9, P / 2).dead).toBe(false); // other arcs: never
  });
});

// ======================================================================================= BOSSES
describe('bosses on wave 10', () => {
  const BOSSES = ALL_STRESSORS.filter((s) => s.boss).map((s) => s.id);
  it('exactly one boss, on the last beat, unaffixed, harder than the wave, rotating across cycles', () => {
    const seen = new Set();
    for (const cycle of [3, 4, 5, 6, 7]) for (const seed of [1, 2]) {
      const G = gameAt(15, seed); late(G, 'containment', { seat: { ring: 0, dir: 0 } });
      const bs = spawn(G, { wave: 10, cycle, beats: BEATS_PER_WAVE });
      for (const b of bs.slice(0, -1)) expect(b.enemies.some((e) => e.boss)).toBe(false);
      const last = bs[BEATS_PER_WAVE - 1].enemies, bosses = last.filter((e) => e.boss);
      expect(bosses).toHaveLength(1);
      const boss = bosses[0]; seen.add(boss.def);
      expect(BOSSES).toContain(boss.def);
      expect(boss.affix).toBeNull();
      const others = last.filter((e) => !e.boss);
      expect(boss.max / ANY_STRESSOR[boss.def].tol).toBeGreaterThan(normT(others[0]));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ======================================================================================= AFFIXES
describe('stressor affixes', () => {
  it('every affix mod is applied to the stressor it names; none before its wave, none on bosses', () => {
    let affixed = 0;
    for (const [cycle, wave] of [[0, 3], [3, 9], [3, 10], [5, 1]]) for (const seed of [1, 2, 3]) {
      const G = gameAt(15, seed); late(G, 'containment', { seat: { ring: 0, dir: 0 } });
      const gw = cycle * 10 + wave;
      for (const b of spawn(G, { wave, cycle, beats: BEATS_PER_WAVE })) {
        const plain = b.enemies.filter((e) => !e.boss);
        for (const e of b.enemies) {
          const ax = affixOf(e), d = ANY_STRESSOR[e.def];
          if (gw <= 3 || e.boss) expect(e.affix).toBeNull();
          if (!ax) { expect(e.name).toBe(d.name); continue; }
          affixed++;
          expect(ax.minWave).toBeLessThanOrEqual(gw);
          expect(e.name).toBe(`${ax.name} ${d.name}`);
          expect(rel(e.lat, d.lat * (ax.mod.lat || 1))).toBeLessThan(1e-12);
          expect(rel(e.reach, d.reach * (ax.mod.reach || 1))).toBeLessThan(1e-12);
          expect(rel(e.speed, d.speed * (ax.mod.speed || 1))).toBeLessThan(1e-12);
          expect(e.opa).toBe((G.battle.arc.mod.opa || 0) + (ax.mod.opa || 0));
          expect(rel(normT(e), normT(plain[0]))).toBeLessThan(1e-12);
          expect(rel(normS(e), normS(plain[0]))).toBeLessThan(1e-12);
        }
      }
    }
    expect(affixed).toBeGreaterThan(50);
    expect(affixChance(3)).toBe(0);
  });

  // Behaviours: STRESSOR_AFFIXES[].behavior declares six behaviours, each described in the affix text. battle.js never
  // reads `behavior` (grep: it appears only in content/stressors.js and gfx/sculpt.js, which draws a rim), so
  // implemented = none; declared but doing nothing = returns, anchors, veils, hastens, echoes, splits.
  const BEHAVIOURS = [...new Set(STRESSOR_AFFIXES.map((a) => a.behavior).filter(Boolean))].sort();
  it('the declared behaviours are exactly these six', () => {
    expect(BEHAVIOURS).toEqual(['anchors', 'echoes', 'hastens', 'returns', 'splits', 'veils']);
  });

  // A battle where every affixed stressor carries one affix, run twice: once as declared, once with `behavior`
  // removed. A behaviour that does something must make the two battles differ.
  const fightWith = (ax) => {
    const saved = STRESSOR_AFFIXES.slice();
    STRESSOR_AFFIXES.splice(0, STRESSOR_AFFIXES.length, ax);
    try {
      const G = gameAt(15, 5); ['equanimity', 'sublimation', 'containment', 'projection'].forEach((f, i) => { const u = addRaw(G, leaf(f), { link: 6, traits: ['ache', 'see'], seat: { ring: 0, dir: i * 2 } }); u.muts = []; });
      G.wave = 9; G.cycle = 3; startWave(G);
      for (let t = 0; t < 40; t += 0.1) stepBattle(G, 0.1);
      expect(G.battle.enemies.some((e) => e.affix === ax.id)).toBe(true); // the affix really is in the fight
      return JSON.stringify({ k: G.stats.kills, c: G.composure, e: G.battle.enemies.map((e) => [e.def, e.affix, e.alive, +e.hp.toFixed(3), +e.x.toFixed(3), +e.z.toFixed(3), e.speed, e.opa]), u: G.battle.units.map((c) => [c.hp, c.alive]) });
    } finally { STRESSOR_AFFIXES.splice(0, STRESSOR_AFFIXES.length, ...saved); }
  };
  for (const beh of ['returns', 'anchors', 'veils', 'hastens', 'echoes', 'splits']) {
    const ax = STRESSOR_AFFIXES.find((a) => a.behavior === beh);
    // BUG affix-<beh>: src/game/battle.js:107-118 (mk) applies only `ax.mod`; `ax.behavior` is never read anywhere in
    // src/game. Observed: a battle with the behaviour is identical to one without it; expected: "<affix text>" changes it.
    // Minimal reproduction: STRESSOR_AFFIXES reduced to this one affix, stage 15, wave 9 cycle 3, 40 s of battle, with
    // and without `behavior`.
    it.fails(`BUG affix-${beh}: '${ax.id}' ("${ax.text}") behaves differently from the same affix with no behaviour`, () => {
      expect(fightWith(ax)).not.toBe(fightWith({ ...ax, behavior: null }));
    });
  }
});
