// Endless play: functional tests of what happens far past stage 17.
// (1) a long unbroken bot run, (2) extreme progress (cycle 5 .. 50000) on a strong seated board, (3) an extreme
// economy, (4) odd time steps, (5) a wall-clock bound for late fights, (6) many resets inside endless play.
// Numbers are derived from exported constants where the engine exports them. Real engine bugs are kept as
// it.fails('BUG <id>: <what should hold>') with the cause (file:line), observed vs expected and a minimal repro.
import { describe, it, expect } from 'vitest';
import {
  createGame, step, actions, serialize, deserialize, startWave, stepBattle, leaf, unitCap, BENCH, STAGES, LINKS, HABITS,
  HABIT_GROWTH, BEATS_PER_WAVE, VERBS, habitCost, mirrorCost, attendantCost, clickValue, affectMul, muGain,
  GIFTS,
} from '../../src/game/index.js';
import { badNumbers } from './helpers.js';
import { extendedBot, resettingBot } from './bots.js';

const DT = 0.25;              // step() clamps every dt to 0.25 (src/game/game.js step), so this is the coarsest real step
const BEAT_CAP = 14;          // per-beat spawn cap: `n = Math.min(n, 14)` in spawnBeat (src/game/battle.js:104)
const CROWD_CAP = BEATS_PER_WAVE * BEAT_CAP; // every beat of a wave at the cap
const LOG_CAP = 40, EVENT_CAP = 400; // say() keeps 40 log lines; step() keeps the last 400 events
const MOOD_CAP = 60;          // a mood lives at most 180 s and each source adds at most one per wave or season

// What must hold at every checkpoint of endless play. Returns a list of violations (empty = fine).
function violations(G) {
  const out = badNumbers(G);
  if (!(G.composure >= 0 && G.composure <= G.composureMax)) out.push(`composure ${G.composure} not in [0, ${G.composureMax}]`);
  for (const k of ['affect', 'attention', 'insight']) if (!(G[k] >= 0)) out.push(`${k}=${G[k]} < 0`);
  if (!(G.insight <= G.insightMax)) out.push(`insight ${G.insight} > ${G.insightMax}`);
  if (G.log.length > LOG_CAP) out.push(`log ${G.log.length}`);
  if (G.events.length > EVENT_CAP) out.push(`events ${G.events.length}`);
  if (G.moods.length > MOOD_CAP) out.push(`moods ${G.moods.length}`);
  const seated = G.units.filter((u) => u.seat).length;
  if (seated > unitCap(G)) out.push(`seated ${seated} > cap ${unitCap(G)}`);
  if (G.units.length > unitCap(G) + BENCH) out.push(`units ${G.units.length} > ${unitCap(G) + BENCH}`);
  if (G.battle) {
    const burst = 6 + Math.floor(G.battle.gw / 2); // the one-many wave's shame bursts into this many (battle.js:124)
    if (G.battle.enemies.length > CROWD_CAP + 1 + burst) out.push(`enemies ${G.battle.enemies.length}`);
  }
  return out;
}
const snapshot = (G) => { const o = JSON.parse(serialize(G)); delete o.log; delete o.lastKoan; return JSON.stringify(o); };

// A late state: every stage open, level 10, 20 mirrors (30 seats in 3 rings), all seats filled with link-11 leaves
// carrying every trait up to link 11, residue, endings and lifetime yield set directly.
function lateGame(cycle, { wave = 1, seed = 3, mu = 1e4, endings = 30, earned = 1e30 } = {}) {
  const G = createGame(seed, { mu, endings, depth: 20 });
  G.stage = STAGES.length - 1; G.level = 10; G.mirrors = 20; G.cycle = cycle; G.wave = wave;
  G.stats.earned = earned; G.affect = 0; G.attention = 50; G.stance = 'toward';
  const fams = ['equanimity', 'sublimation', 'containment', 'dissociation', 'projection', 'reappraisal', 'attunement', 'avoidance', 'rumination', 'suppression'];
  for (let r = 0; r < 3; r++) for (let d = 0; d < 10; d++) {
    G.units.push({ id: G.nextUid++, g: leaf(fams[(d + r) % 10]), link: 11, traits: LINKS.slice(0, 11).map((l) => l.trait), seat: { ring: r, dir: d }, ghosts: 0, born: 0, muts: [] });
  }
  expect(G.units.length).toBe(unitCap(G));
  return G;
}

// Run until `waves` waves have resolved (or a step budget runs out); collects what endless play must keep true.
function playWaves(G, waves, maxSteps = 4000) {
  const r = { won: 0, lost: 0, steps: 0, firstBad: null, maxPerBeat: 0, maxBoss: 0, maxEnemies: 0, habituation: [] };
  let seen = new Set(), battle = null;
  for (; r.steps < maxSteps && r.won + r.lost < waves; r.steps++) {
    step(G, DT);
    if (G.battle !== battle) { battle = G.battle; seen = new Set(); }
    if (G.battle) {
      // stressors that arrived on a beat carry a name and no fuse parent; count each beat's arrivals by id
      const fresh = G.battle.enemies.filter((e) => e.name && !seen.has(e.id));
      for (const e of fresh) seen.add(e.id);
      r.maxPerBeat = Math.max(r.maxPerBeat, fresh.filter((e) => !e.boss).length);
      r.maxBoss = Math.max(r.maxBoss, fresh.filter((e) => e.boss).length);
      r.maxEnemies = Math.max(r.maxEnemies, G.battle.enemies.length);
    }
    for (const e of G.events) {
      if (e.type === 'waveWin') r.won++;
      if (e.type === 'waveLose') { r.lost++; r.habituation.push(G.habituation); }
    }
    G.events.length = 0;
    if (!r.firstBad) { const b = badNumbers(G); if (b.length) r.firstBad = `step ${r.steps}: ${b.slice(0, 3).join(', ')}`; }
  }
  return r;
}

// A player who also takes every gift and collects every card (the bot itself ignores both).
const fullBot = (G, t) => { extendedBot(G, t); if (G.gift) actions.takeGift(G); if (G.cardOffer) actions.collectCard(G); };

// ------------------------------------------------------------------------------------------------ (1)
describe('endless (1): a long unbroken run far past stage 17', () => {
  it('two game-hours at dt 0.25 with the extended bot: finite, bounded, waves keep starting and resolving', () => {
    const HOURS = 2, G = createGame(1);
    let t = 0, waves = 0, starts = 0, phase = G.phase, phaseSince = 0, longestPhase = 0, gifts = 0, reachedFinal = null;
    const problems = [];
    for (let i = 0; t < HOURS * 3600; i++, t += DT) {
      fullBot(G, t);
      try { step(G, DT); } catch (err) { problems.push(`t=${t}: step threw ${err.message}`); break; }
      if (G.events.length > EVENT_CAP) problems.push(`t=${t}: events ${G.events.length}`);
      for (const e of G.events) { if (e.type === 'waveStart') starts++; if (e.type === 'waveWin' || e.type === 'waveLose') waves++; if (e.type === 'giftTake') gifts++; }
      G.events.length = 0;
      if (G.phase !== phase) { longestPhase = Math.max(longestPhase, G.t - phaseSince); phase = G.phase; phaseSince = G.t; }
      if (reachedFinal === null && G.stage === STAGES.length - 1) reachedFinal = G.t;
      if (i % 240 === 0) for (const v of violations(G)) problems.push(`t=${t}: ${v}`); // every game-minute
    }
    expect(problems).toEqual([]);
    expect(reachedFinal).not.toBeNull();                        // stage 17 is reached ...
    expect(HOURS * 3600 - reachedFinal).toBeGreaterThan(3600);  // ... and played on for well over an hour
    expect(G.stage).toBe(STAGES.length - 1);
    expect(G.cycle).toBeGreaterThanOrEqual(10);                 // the cycles keep turning (10 waves each)
    expect(starts).toBeGreaterThan(HOURS * 60);                 // more than a wave a minute on average
    expect(waves).toBeGreaterThanOrEqual(starts - 1);           // every started wave resolves (the last may be running)
    expect(Math.max(longestPhase, G.t - phaseSince)).toBeLessThan(300); // no phase is ever frozen
    expect(gifts).toBeGreaterThan(0);                           // gifts arrive and can be taken in endless play
    expect(G.units.length).toBeLessThanOrEqual(unitCap(G) + BENCH);
  });

  it('a restart in the middle of endless play changes nothing: a save round trip continues identically', () => {
    const G = createGame(2);
    let t = 0;
    for (; t < 3000; t += DT) { extendedBot(G, t); step(G, DT); G.events.length = 0; }
    // saves restore at the start of prep (serialize writes phaseT 0), so save exactly there, not part-way through a prep
    while (G.phase !== 'prep' || G.battle || G.phaseT !== 0) { extendedBot(G, t); step(G, DT); G.events.length = 0; t += DT; }
    expect(G.stage).toBe(STAGES.length - 1);
    const H = deserialize(serialize(G));
    expect(snapshot(H)).toBe(snapshot(G));
    for (let i = 0; i < 1200; i++, t += DT) { // five more minutes, both copies
      extendedBot(G, t); step(G, DT); G.events.length = 0;
      extendedBot(H, t); step(H, DT); H.events.length = 0;
    }
    expect(snapshot(H)).toBe(snapshot(G));
    expect(violations(H)).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ (2)
describe('endless (2): extreme progress set directly', () => {
  for (const cycle of [5, 50, 300]) {
    it(`cycle ${cycle}: six full waves on a strong board stay finite and keep resolving`, () => {
      const G = lateGame(cycle);
      const r = playWaves(G, 6);
      expect(r.firstBad).toBeNull();
      expect(r.won + r.lost).toBe(6);
      expect(violations(G)).toEqual([]);
      expect(r.maxPerBeat).toBeLessThanOrEqual(BEAT_CAP);
      expect(r.maxBoss).toBeLessThanOrEqual(1);
      expect(affectMul(G)).toBeGreaterThan(0);
      expect(Number.isFinite(G.affect) && G.affect > 0).toBe(true); // kill rewards arrived and are finite
    });
  }

  it('cycle 5: the strong board wins there (late scaling is beatable)', () => {
    const r = playWaves(lateGame(5), 6);
    expect(r.won).toBeGreaterThan(0);
  });

  it('cycle 50, a wall: every loss adds habituation up to its cap of 12 and the loop never stops', () => {
    const G = lateGame(50);
    const r = playWaves(G, 16, 8000);
    expect(r.won + r.lost).toBe(16);
    expect(r.firstBad).toBeNull();
    // habituation is 0 after a win and +1 (capped at 12) after a loss
    for (let i = 1; i < r.habituation.length; i++) expect(r.habituation[i]).toBeLessThanOrEqual(12);
    if (r.lost >= 12 && r.won === 0) expect(r.habituation.at(-1)).toBe(12);
    expect(r.maxPerBeat).toBeLessThanOrEqual(BEAT_CAP);
    expect(G.composure).toBeGreaterThan(0);
    expect(violations(G)).toEqual([]);
  });

  // BUG reward-overflow. Rewards grow exponentially in the global wave gw = cycle*10 + wave with no ceiling:
  //   src/game/battle.js:161 kill  G.gain(value * 3 * 1.18^(gw-1))   (1.18^n is Infinity from n = 4289)
  //   src/game/battle.js:229 glad  G.gain(0.4 * glad * 1.18^(gw-1))
  //   src/game/battle.js:193 burst G.gain(sum * 0.02 * 1.1^gw)        (Infinity from gw = 7448)
  //   src/game/game.js:387   wave  G.gain(20 * 1.35^(gw-1))           (Infinity from gw-1 = 2366)
  // each multiplied by affectMul (~1e12 on this board). On this board the first kill at cycle 409 (cycle 408 is fine)
  // makes G.affect = Infinity; then complexity = log10(earned) = Infinity, affectMul = Infinity, and
  // src/game/game.js:321 `G.prod = habitYield(G) * affectMul(G)` is 0 * Infinity = NaN, so affect, prod, complexity,
  // overwhelm and later stressor hp are NaN for good (a save writes them as null). Observed: NaN at cycle 409+;
  // expected: a graceful ceiling (finite affect). Repro: lateGame(409), step(G, 0.25) ~25 times -> G.affect Infinity, then NaN.
  // Fix: clamp the exponent or the gain (e.g. G.gain caps at Number.MAX_VALUE / guards non-finite amounts).
  for (const cycle of [500, 5000, 50000]) {
    it.fails(`BUG reward-overflow: at cycle ${cycle} a wave's kill and wave rewards and affect stay finite`, () => {
      const G = lateGame(cycle);
      const r = playWaves(G, 1, 400);
      expect(r.firstBad).toBeNull();
      expect(Number.isFinite(G.affect)).toBe(true);
    });
  }

  // BUG stressor-overflow. src/game/battle.js:115 `sal: def.sal * 1.04^(gw-1)` is Infinity from gw = 18099
  // (cycle 1810) and src/game/battle.js:97 `scale = ... * 1.015^(gw-29)` makes tol Infinity from gw ~ 47700
  // (cycle 4770). An Infinity-tolerance stressor can never fall (a 'Light Appears' one-shot gives Inf - Inf = NaN hp,
  // still alive), so every wave from there on is lost forever; habituation (0.88^12) cannot reach it.
  // Observed: Infinity hp/max/sal on arrival; expected: finite stressor stats at any cycle.
  // Repro: lateGame(5000); startWave(G); G.battle.beatT = 0; stepBattle(G, 1e-6) -> enemies[0].hp === Infinity.
  // Fix: cap the exponents (or scale additively/logarithmically past some gw).
  for (const cycle of [1810, 5000, 50000]) {
    it.fails(`BUG stressor-overflow: stressors arriving at cycle ${cycle} have finite tolerance and salience`, () => {
      const G = lateGame(cycle);
      startWave(G); G.battle.beatT = 0; stepBattle(G, 1e-6); // one beat arrives; no regulator strikes yet
      expect(G.battle.enemies.length).toBeGreaterThan(0);
      for (const e of G.battle.enemies) { expect(Number.isFinite(e.hp)).toBe(true); expect(Number.isFinite(e.max)).toBe(true); expect(Number.isFinite(e.sal)).toBe(true); }
    });
  }

  it('below those ceilings stressor stats are finite (cycle 1000)', () => {
    const G = lateGame(1000);
    startWave(G); G.battle.beatT = 0; stepBattle(G, 1e-6);
    expect(G.battle.enemies.length).toBeGreaterThan(0);
    expect(G.battle.enemies.length).toBeLessThanOrEqual(BEAT_CAP + 1);
    for (const e of G.battle.enemies) expect(badNumbers(e)).toEqual([]);
  });

  // BUG burst-uncapped. src/game/battle.js:124 gives the one-many wave's shame `fuse: 6 + floor(gw / 2)` and
  // src/game/battle.js:163 spawns that many intrusions when it falls, with no cap, while every beat is capped at 14
  // (battle.js:104). The O(n^2) separation pass (battle.js:254) then makes steps slow: cycle 50 -> 258 stressors,
  // cycle 500 -> 2508 stressors and ~100 ms per step. Observed 258 alive; expected at most BEATS_PER_WAVE * 14 = 140
  // (a whole wave of capped beats). Repro: lateGame(50, {wave: 4}); startWave; beatT = 0; stepBattle(G, 0.01);
  // set the shame's hp to 1; step until it falls. Fix: cap the burst (e.g. Math.min(BEAT_CAP, ...)) or scale its children.
  it.fails('BUG burst-uncapped: when the one-many shame falls at cycle 50 the crowd stays within a wave of capped beats (140)', () => {
    const G = lateGame(50, { wave: 4 });
    startWave(G); G.battle.beatT = 0; stepBattle(G, 0.01);
    const shame = G.battle.enemies.find((e) => e.fuse);
    expect(shame).toBeTruthy();
    shame.hp = 1;
    let most = 0;
    for (let i = 0; i < 400 && G.phase === 'fight'; i++) { step(G, DT); G.events.length = 0; if (G.battle) most = Math.max(most, G.battle.enemies.filter((e) => e.alive).length); }
    expect(most).toBeLessThanOrEqual(CROWD_CAP);
  });
});

// ------------------------------------------------------------------------------------------------ (3)
describe('endless (3): an extreme economy', () => {
  const rich = () => {
    const G = lateGame(50, { mu: 1e6 });
    G.affect = 1e300; G.attention = 5e6; G.stats.peak = 1e6;
    Object.assign(G.upgrades, { noticing: true, lending: true, long_view: true, counting_breaths: true, old_wound: true, crowd: true });
    return G;
  };
  const first = (f) => { let n = 0; while (Number.isFinite(f(n))) n++; return n; };

  it('habit costs have an exact graceful ceiling: finite up to the last affordable count, then Infinity and refused, never NaN', () => {
    const G = rich();
    for (const h of HABITS) {
      const lim = first((n) => h.base * Math.pow(HABIT_GROWTH, n));
      G.habits[h.id] = lim - 1; expect(Number.isFinite(habitCost(G, h))).toBe(true);
      G.habits[h.id] = lim; expect(habitCost(G, h)).toBe(Infinity);
      G.affect = Number.MAX_VALUE;
      expect(actions.buyHabit(G, h.id, 1e9)).toBe(false);
      expect(G.affect).toBe(Number.MAX_VALUE);
      G.habits[h.id] = 30000; // tens of thousands
      expect(actions.buyHabit(G, h.id)).toBe(false);
    }
    step(G, DT);
    expect(violations(G)).toEqual([]);
    expect(G.prod).toBeGreaterThan(0);
  });

  it('buyHabit with a huge n terminates fast and never overspends (the price grows x1.15 per habit)', () => {
    for (const n of [1e12, Infinity]) for (const h of [HABITS[0], HABITS.at(-1)]) {
      const G = rich(); G.habits = {};
      const t0 = performance.now();
      expect(actions.buyHabit(G, h.id, n)).toBe(true);
      expect(performance.now() - t0).toBeLessThan(500);
      expect(G.habits[h.id]).toBeLessThan(first((k) => h.base * Math.pow(HABIT_GROWTH, k)));
      expect(G.affect).toBeGreaterThanOrEqual(0);
      expect(G.affect).toBeLessThan(habitCost(G, h)); // it stopped exactly when the next one was unaffordable
    }
  });

  it('mirrors and attendants: costs stay finite while affordable, the ceiling refuses, nothing hangs', () => {
    const G = rich();
    expect(Number.isFinite(mirrorCost(G))).toBe(true);
    let n = 0; const t0 = performance.now();
    while (actions.mirror(G) && n < 1e4) n++;
    expect(n).toBeLessThan(1e4);
    expect(Number.isFinite(mirrorCost(G))).toBe(true);
    expect(G.affect).toBeLessThan(mirrorCost(G));
    G.affect = Number.MAX_VALUE; G.mirrors = first((m) => { G.mirrors = m; return mirrorCost(G); });
    expect(mirrorCost(G)).toBe(Infinity); expect(actions.mirror(G)).toBe(false); expect(G.affect).toBe(Number.MAX_VALUE);
    G.mirrors = 20;
    G.affect = 1e300; n = 0;
    while (actions.buyAttendant(G) && n < 1e4) n++;
    expect(Number.isFinite(attendantCost(G))).toBe(true);
    expect(performance.now() - t0).toBeLessThan(2000);
    // ~870 attendants attend twice as often (lending): 100 steps stay fast and finite
    const t1 = performance.now();
    for (let i = 0; i < 100; i++) { step(G, DT); G.events.length = 0; }
    expect(performance.now() - t1).toBeLessThan(5000);
    expect(violations(G)).toEqual([]);
  });

  it('exchange, clickValue, affectMul and muGain stay finite with 1e300 affect, millions of attention, 20 mirrors, level 10', () => {
    const G = rich();
    for (const h of HABITS) G.habits[h.id] = 20000;
    step(G, DT);
    expect(G.mirrors).toBe(20); expect(G.level).toBe(10);
    for (const v of [clickValue(G), affectMul(G), muGain(G), G.prod]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThan(0); }
    G.prod = 1e300; // exchange prices read the yield
    for (const [from, to] of [['affect', 'attention'], ['attention', 'insight'], ['insight', 'attention'], ['attention', 'affect']]) {
      G.insight = from === 'insight' ? 50 : 0; G.affect = 1e302;
      actions.exchange(G, from, to);
      expect(violations(G)).toEqual([]);
    }
    const N = actions.nonMind(G);
    expect(Number.isFinite(N.mu)).toBe(true);
    expect(N.mu).toBeGreaterThan(G.mu);
    step(N, DT);
    expect(violations(N)).toEqual([]);
  });

  it('a purchase below the precision of affect is free but never corrupts (graceful ceiling of doubles)', () => {
    const G = rich(); G.habits = {};
    const before = G.affect;
    expect(actions.buyHabit(G, 'breath')).toBe(true);
    expect(G.affect).toBe(before); // 1e300 - 10 === 1e300
    expect(G.habits.breath).toBe(1);
  });

  it('every gift kind is generous and finite in a late, rich state', () => {
    for (const kind of Object.keys(GIFTS)) {
      const G = rich(); G.units[0].link = 3;
      G.gift = { kind, t: 15 };
      const a0 = G.affect, att0 = G.attention;
      expect(actions.takeGift(G)).toBe(kind);
      expect(G.affect).toBeGreaterThanOrEqual(a0); expect(G.attention).toBeGreaterThanOrEqual(att0);
      step(G, DT);
      expect(violations(G)).toEqual([]);
    }
  });
});

// ------------------------------------------------------------------------------------------------ (4)
describe('endless (4): odd time steps', () => {
  let cached = null;
  const midGame = () => { // a late run, stopped between waves so a save round trip is exact
    if (!cached) {
      const G = createGame(5); let t = 0;
      for (; t < 1800; t += DT) { extendedBot(G, t); step(G, DT); G.events.length = 0; }
      while (G.phase !== 'prep' || G.battle) { step(G, DT); G.events.length = 0; }
      cached = serialize(G);
    }
    return deserialize(cached);
  };

  it('dt = 0 changes nothing once the derived numbers are current', () => {
    const G = midGame();
    step(G, 0); G.events.length = 0;
    const s = snapshot(G);
    for (let i = 0; i < 100; i++) step(G, 0);
    expect(snapshot(G)).toBe(s);
  });

  it('a tiny dt advances time by exactly that and stays valid', () => {
    const G = midGame(), t0 = G.t;
    for (let i = 0; i < 2000; i++) step(G, 1e-9);
    expect(G.t - t0).toBeCloseTo(2e-6, 10);
    expect(violations(G)).toEqual([]);
  });

  it('a huge dt (60 s, 3600 s, Infinity) is the same as 0.25 s: no catch-up burst, no corruption', () => {
    const A = midGame(), B = midGame(), C = midGame(), D = midGame();
    for (let i = 0; i < 400; i++) {
      step(A, DT); step(B, 60); step(C, 3600); step(D, Infinity);
      for (const X of [A, B, C, D]) X.events.length = 0;
    }
    expect(snapshot(B)).toBe(snapshot(A)); expect(snapshot(C)).toBe(snapshot(A)); expect(snapshot(D)).toBe(snapshot(A));
    expect(violations(A)).toEqual([]);
  });

  // BUG negative-dt. src/game/game.js:317 `dt = Math.min(dt, 0.25)` clamps only from above. A negative dt runs time
  // backwards: G.t falls, affect drops by prod*|dt| (negative after one step of -1 s in a late run), the overwhelm drain
  // at game.js:351 adds composure above composureMax, moods/verbs/seasons count up, and with Long View
  // Math.pow(negative t, 0.45) makes affect NaN (-60 s steps). Observed: affect -2.6e13, composure 180 / 100;
  // expected: a negative dt is ignored (state unchanged, time never runs backwards). The live loop's dt is never
  // negative (R3F clock), so this is minor. Repro: G = createGame(1); step(G, -1) -> G.t === -1.
  // Fix: `dt = Math.max(0, Math.min(dt, 0.25))` (also treat NaN as 0).
  it.fails('BUG negative-dt: a negative dt never runs time backwards nor corrupts state', () => {
    for (const dt of [-0.25, -1, -60, -3600]) {
      const G = midGame(), t0 = G.t;
      for (let i = 0; i < 40; i++) step(G, dt);
      expect(G.t).toBeGreaterThanOrEqual(t0);
      expect(violations(G)).toEqual([]);
    }
  });
});

// ------------------------------------------------------------------------------------------------ (5)
describe('endless (5): late fights finish in bounded wall-clock time', () => {
  for (const cycle of [5, 50]) {
    it(`2000 steps of cycle-${cycle} fighting with a full board take under 15 s`, () => {
      const G = lateGame(cycle);
      const t0 = performance.now();
      let fights = 0;
      for (let i = 0; i < 2000; i++) { step(G, DT); if (G.phase === 'fight') fights++; G.events.length = 0; }
      expect(performance.now() - t0).toBeLessThan(15000);
      expect(fights).toBeGreaterThan(1000); // mostly fighting, not idling
      expect(violations(G)).toEqual([]);
    });
  }
});

// ------------------------------------------------------------------------------------------------ (6)
describe('endless (6): resets inside endless play', () => {
  it('30 resets with the resetting bot: residue never falls, meta is kept, state size stays bounded, every run is valid', () => {
    let G = createGame(11), t = 0, resets = 0, maxSize = 0;
    const problems = [], mus = [G.mu];
    while (resets < 30 && t < 200000) {
      const N = resettingBot(G, t);
      if (N !== G) {
        resets++;
        expect(N.depth).toBe(G.depth + 1);
        expect(N.mu).toBe(G.mu + muGain(G));
        expect(N.endings).toBe(G.endings);
        expect(N.bestStage).toBe(Math.max(G.bestStage, G.stage));
        expect(N.cards).toEqual(G.cards);
        expect(N.stage).toBe(0); expect(N.cycle).toBe(0); expect(N.units).toEqual([]);
        mus.push(N.mu);
        maxSize = Math.max(maxSize, serialize(G).length, serialize(N).length);
        // and a restart right after the reset is harmless
        const R = deserialize(serialize(N));
        expect(snapshot(R)).toBe(snapshot(N));
        G = N;
      }
      step(G, DT); G.events.length = 0; t += DT;
      if (Math.round(t / DT) % 240 === 0) for (const v of violations(G)) problems.push(`reset ${resets} t=${t}: ${v}`);
    }
    expect(resets).toBe(30);
    expect(problems).toEqual([]);
    for (let i = 1; i < mus.length; i++) expect(mus[i]).toBeGreaterThanOrEqual(mus[i - 1]);
    expect(mus.at(-1)).toBeGreaterThan(mus[0]);
    expect(maxSize).toBeLessThan(64 * 1024);
    // the deep game is still a game: attention starts higher, and it still plays
    expect(G.attention).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 2400; i++) { extendedBot(G, t); step(G, DT); G.events.length = 0; t += DT; }
    expect(violations(G)).toEqual([]);
    expect(G.stats.kills).toBeGreaterThan(0);
  });

  it('VERBS and BENCH stay consistent after resets: no unit is left busy without a verb', () => {
    let G = createGame(12), t = 0, resets = 0;
    while (resets < 5 && t < 60000) { const N = resettingBot(G, t, 900); if (N !== G) { resets++; G = N; } step(G, DT); G.events.length = 0; t += DT;
      for (const u of G.units) if (u.busy) expect(VERBS.some((v) => v.id === u.busy) && G.verbs[u.busy]?.unit === u.id).toBe(true);
    }
    expect(resets).toBe(5);
  });
});
