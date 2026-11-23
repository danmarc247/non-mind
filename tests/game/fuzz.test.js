// Random-action fuzzing of the public engine API.
// A seeded fuzzer draws operations (every entry of `actions`, with valid, boundary and invalid arguments), interleaves
// them with step(G, dt), random resets (actions.nonMind, adopting the returned game), serialize -> deserialize swaps
// (also through the save code) and collectCard, and checks the structural invariants after EVERY operation.
// On a violation the operation list is shrunk (chunked delta debugging) and the minimal sequence is printed in the
// assertion message, so it can be pasted into a guiding test. Known engine bugs are listed in KNOWN below: the main
// fuzzers steer around them (so they stay green and keep hunting for new ones) and each has its own it.fails test.
import { describe, it, expect, beforeAll } from 'vitest';
import {
  createGame, step, actions, serialize, deserialize, unitCap, ringsOpen, BENCH, MAX_LEAVES, MAX_MUTS, FAMILY, FAMILIES,
  HABITS, UPGRADES, SPELLS, VERBS, STANCES, TRAITS, MUTATION, CARDS, LINKS, leaves, leaf, node,
} from '../../src/game/index.js';
import { encodeSave, decodeSave } from '../../src/game/savecode.js';
import { gameAt, addLeaf, addRaw, badNumbers } from './helpers.js';
import { extendedBot } from './bots.js';

// ---------------------------------------------------------------- fuzzer core
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const BAD = [undefined, null, NaN, -1, 1e308, -Infinity, 'x', {}, [], 3.5, true];
const BAD_IDS = ['nope', undefined, 3, {}, '__proto__', 'constructor'];
// Seats the fuzzer may use while the place-seat bugs exist: ring 3 is never open, so it must be refused.
const SAFE_BAD_SEATS = [{ ring: 3, dir: 0 }, { ring: 3, dir: 9 }];
const ALL_BAD_SEATS = [...SAFE_BAD_SEATS, { ring: -1, dir: 2 }, { ring: 0, dir: 12 }, { ring: 0, dir: -3 }, {}, { ring: 0.5, dir: 1 }, { ring: '0', dir: '0' }, 'seat', 7];
// KNOWN engine bugs the main fuzzers avoid (each has an it.fails test below):
//   badSeats: place() accepts seats outside the board; badHabit: buyHabit() throws on an unknown id;
//   benchSlack: a unit coming back from a verb (and a buy whose twin is busy) can overfill the bench.
const KNOWN = { badSeats: false, badHabit: false, benchSlack: VERBS.length };

// Operations are plain data. Unit references are symbolic ({u: k} = k-th unit modulo count, {gone: 1} = the last
// removed id) and are resolved at replay time, so a shrunk list still points at real units.
function genOp(r, o = {}) {
  const x = r();
  const resetP = o.resetP ?? 0.01;
  if (x < 0.30) return { a: 'step', dt: pick(r, [0.1, 0.1, 0.25, 0.05, 1]), n: pick(r, [1, 1, 5, 20, 60]) };
  if (x < 0.30 + resetP) return { a: 'reset' };
  if (x < 0.32 + resetP) return { a: 'swap', code: r() < 0.3 };
  if (x < 0.34 + resetP) return { a: 'collect' };
  const name = pick(r, Object.keys(actions).filter((n) => n !== 'nonMind' && n !== 'collectCard'));
  const unitArg = () => { const y = r(); return y < 0.75 ? { u: Math.floor(r() * 40) } : y < 0.85 ? { gone: 1 } : { raw: pick(r, BAD) }; };
  const seatArg = () => { const y = r(); if (y < 0.15) return { raw: null }; if (y < 0.8) return { raw: { ring: Math.floor(r() * 3), dir: Math.floor(r() * 10) } }; return { raw: pick(r, o.badSeats ? ALL_BAD_SEATS : SAFE_BAD_SEATS) }; };
  const idArg = (list, bad = true) => (!bad || r() < 0.8 ? { raw: pick(r, list).id } : { raw: pick(r, BAD_IDS) });
  let args;
  switch (name) {
    case 'buy': args = [{ raw: r() < 0.8 ? Math.floor(r() * 5) : pick(r, [5, -1, NaN, 'x', undefined, 1e9]) }]; break;
    case 'sell': case 'split': case 'repurpose': args = [unitArg()]; break;
    case 'place': args = [unitArg(), seatArg()]; break;
    case 'integrate': case 'subtract': { const a = unitArg(); args = [a, r() < 0.1 ? a : unitArg()]; break; }
    case 'buyHabit': args = [idArg(HABITS, !!o.badHabit), { raw: r() < 0.7 ? pick(r, [1, 1, 5, 25]) : pick(r, [0, -2, NaN, undefined, 1e6, 'x']) }]; break;
    case 'buyUpgrade': args = [idArg(UPGRADES)]; break;
    case 'cast': args = [idArg(SPELLS)]; break;
    case 'startVerb': args = [idArg(VERBS), unitArg()]; break;
    case 'exchange': { const c = ['affect', 'attention', 'insight', 'composure', 'mu', 'x']; args = [{ raw: pick(r, c) }, { raw: pick(r, c) }]; break; }
    case 'chooseStance': args = [idArg(STANCES)]; break;
    case 'setAuto': args = [{ raw: pick(r, [true, false, 0, 1, 'x', undefined]) }]; break;
    default: args = [];
  }
  return { a: name, args };
}
const genOps = (seed, n, o) => { const r = prng(seed); return Array.from({ length: n }, () => genOp(r, o)); };

function resolve(G, arg, ctx) {
  if ('raw' in arg) return arg.raw;
  if ('gone' in arg) return ctx.goneIds.length ? ctx.goneIds[ctx.goneIds.length - 1] : 987654;
  return G.units.length ? G.units[arg.u % G.units.length].id : 987654;
}
// what matters: the whole saved state minus the log (fail() writes a warning line there)
const snapshot = (G) => { const o = JSON.parse(serialize(G)); delete o.log; delete o.lastKoan; return JSON.stringify(o); };
const ROUTES = ['affect>attention', 'attention>insight', 'insight>attention', 'attention>affect'];
// calls that are invalid by construction: they must return a falsy value and change nothing that matters
function invalidCall(G, a, vals) {
  const has = (id) => G.units.some((u) => u.id === id);
  switch (a) {
    case 'sell': case 'split': case 'repurpose': case 'place': return !has(vals[0]);
    case 'integrate': case 'subtract': return !has(vals[0]) || !has(vals[1]) || vals[0] === vals[1];
    case 'buyUpgrade': return !UPGRADES.some((u) => u.id === vals[0]);
    case 'cast': return !SPELLS.some((u) => u.id === vals[0]);
    case 'startVerb': return !VERBS.some((u) => u.id === vals[0]) || !has(vals[1]);
    case 'chooseStance': return !STANCES.some((u) => u.id === vals[0]);
    case 'buy': return !(Number.isInteger(vals[0]) && vals[0] >= 0 && vals[0] < 5);
    case 'buyHabit': return !HABITS.some((h) => h.id === vals[0]) || !(vals[1] === undefined || vals[1] >= 1);
    case 'exchange': return !ROUTES.includes(`${vals[0]}>${vals[1]}`);
    default: return false;
  }
}

function checkInvariants(G, ctx) {
  const bad = badNumbers(G); if (bad.length) return `non-finite: ${bad.slice(0, 3).join(', ')}`;
  if (!(G.affect >= 0)) return `affect < 0: ${G.affect}`;
  if (!(G.attention >= 0)) return `attention < 0: ${G.attention}`;
  if (!(G.insight >= 0) || G.insight > G.insightMax + 1e-9) return `insight ${G.insight} outside [0, ${G.insightMax}]`;
  if (!(G.composure >= 0) || G.composure > G.composureMax + 1e-9) return `composure ${G.composure} outside [0, ${G.composureMax}]`;
  const ids = G.units.map((u) => u.id); if (new Set(ids).size !== ids.length) return 'duplicate unit ids';
  const seated = G.units.filter((u) => u.seat), taken = new Set();
  for (const u of seated) {
    const s = u.seat;
    if (typeof s !== 'object' || !Number.isInteger(s.ring) || !Number.isInteger(s.dir) || s.ring < 0 || s.ring >= ringsOpen(G) || s.dir < 0 || s.dir > 9) return `bad seat ${JSON.stringify(s)} (rings open ${ringsOpen(G)})`;
    if (taken.has(s.ring * 10 + s.dir)) return `shared seat ${s.ring}:${s.dir}`; taken.add(s.ring * 10 + s.dir);
    if (u.busy) return `unit ${u.id} is seated and busy`;
  }
  if (seated.length > unitCap(G)) return `seated ${seated.length} > unitCap ${unitCap(G)}`;
  const benchN = G.units.filter((u) => !u.seat && !u.busy).length;
  if (benchN > BENCH + (ctx.benchSlack || 0)) return `bench ${benchN} > BENCH ${BENCH}`;
  for (const u of G.units) {
    const ls = leaves(u.g);
    if (ls.some((l) => !FAMILY[l.f] || ![-1, 0, 1].includes(l.pole))) return `unit ${u.id}: bad leaf`;
    if (ls.length > MAX_LEAVES) return `unit ${u.id}: ${ls.length} leaves > ${MAX_LEAVES}`;
    if (!Number.isInteger(u.link) || u.link < 1 || u.link >= LINKS.length) return `unit ${u.id}: link ${u.link}`;
    // inheritTraits caps the union at 10 and a link-up then appends the new link's gene: 11 at most
    if (!Array.isArray(u.traits) || !u.traits.length || u.traits.some((t) => !TRAITS[t]) || u.traits.length > 11) return `unit ${u.id}: traits ${u.traits}`;
    if ((u.muts || []).some((m) => !MUTATION[m]) || (u.muts || []).length > MAX_MUTS) return `unit ${u.id}: mutations ${u.muts}`;
    if (u.busy && !(G.verbs[u.busy] && G.verbs[u.busy].unit === u.id)) return `unit ${u.id} busy with ${u.busy} but the verb does not hold it`;
  }
  for (const [id, v] of Object.entries(G.verbs)) { if (!v) continue; const u = G.units.find((x) => x.id === v.unit); if (!u || u.busy !== id) return `verb ${id} holds unit ${v.unit}, which is missing or not busy`; }
  if (new Set(G.cards).size !== G.cards.length || G.cards.some((c) => !CARDS.some((x) => x.id === c))) return `bad cards ${G.cards}`;
  if (G.stage < ctx.stage) return `stage decreased ${ctx.stage} -> ${G.stage}`;
  for (const k of ['mu', 'endings', 'depth']) if (G[k] < ctx[k]) return `${k} decreased ${ctx[k]} -> ${G[k]}`;
  if (G.cards.length < ctx.cards) return 'cards lost';
  return null;
}

// Replay `ops` on mk(). Returns { fail, i } at the first violation, else { fail: null, G, steps, resets }.
function run(mk, ops, o = {}) {
  let G = mk();
  const ctx = { goneIds: [], stage: G.stage, mu: G.mu, endings: G.endings, depth: G.depth, cards: G.cards.length, benchSlack: o.benchSlack || 0 };
  let steps = 0, resets = 0;
  const first = checkInvariants(G, ctx); if (first) return { fail: `start state: ${first}`, i: -1 };
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    try {
      if (op.a === 'step') { for (let k = 0; k < op.n; k++) { step(G, op.dt); G.events.length = 0; } steps += op.n; }
      else if (op.a === 'reset') {
        const N = actions.nonMind(G);
        if (N !== G) { G = N; ctx.stage = 0; resets++; } else if (G.stage >= 1) return { fail: 'nonMind refused at stage >= 1', i };
      } else if (op.a === 'swap') {
        const s = serialize(G);
        if (op.code) { const d = decodeSave(encodeSave(s)); if (!d.ok) return { fail: `own save code rejected: ${d.error}`, i }; G = deserialize(d.json); } else G = deserialize(s);
        if (serialize(G) !== s) return { fail: 'serialize(deserialize(s)) !== s', i };
      } else if (op.a === 'collect') actions.collectCard(G);
      else {
        const vals = op.args.map((x) => resolve(G, x, ctx));
        const inv = invalidCall(G, op.a, vals), snap = inv ? snapshot(G) : null, before = G.units.map((u) => u.id);
        const r = actions[op.a](G, ...vals);
        const call = `${op.a}(${vals.map((v) => (v === undefined ? 'undefined' : Number.isNaN(v) ? 'NaN' : JSON.stringify(v))).join(', ')})`;
        if (inv && r) return { fail: `invalid ${call} returned ${JSON.stringify(r)}`, i };
        if (inv && snapshot(G) !== snap) return { fail: `invalid ${call} changed the state`, i };
        for (const id of before) if (!G.units.some((u) => u.id === id)) ctx.goneIds.push(id);
      }
      G.events.length = 0;
    } catch (e) { return { fail: `throw in ${op.a}: ${e.message}`, i }; }
    const v = checkInvariants(G, ctx); if (v) return { fail: v, i };
    ctx.stage = Math.max(ctx.stage, G.stage); ctx.mu = G.mu; ctx.endings = G.endings; ctx.depth = G.depth; ctx.cards = G.cards.length;
  }
  return { fail: null, G, steps, resets };
}

// Chunked delta debugging: drop chunks while a failure of the same kind still reproduces.
const kindOf = (f) => f && f.replace(/[-\d.e+]+/g, '#').slice(0, 30);
function shrink(mk, ops, o) {
  const r0 = run(mk, ops, o); if (!r0.fail) return ops;
  let cur = ops.slice(0, r0.i + 1); const want = kindOf(r0.fail);
  for (let chunk = Math.ceil(cur.length / 2); chunk >= 1;) {
    let changed = false;
    for (let s = 0; s < cur.length; s += chunk) {
      const r = run(mk, cur.slice(0, s).concat(cur.slice(s + chunk)), o);
      if (r.fail && kindOf(r.fail) === want) { cur = cur.slice(0, s).concat(cur.slice(s + chunk)).slice(0, r.i + 1); changed = true; s -= chunk; }
    }
    if (!changed) chunk = Math.floor(chunk / 2);
  }
  return cur;
}
const show = (ops) => JSON.stringify(ops, (k, v) => (v === undefined ? '__undefined' : Number.isNaN(v) ? '__NaN' : v));

// Run one fuzz case; on failure report the minimal reproduction in the assertion message.
let TOTAL_OPS = 0;
function fuzz(mk, seed, n, o = KNOWN) {
  const ops = genOps(seed, n, o);
  const res = run(mk, ops, o);
  TOTAL_OPS += ops.length;
  if (res.fail) { const min = shrink(mk, ops, o); expect.fail(`seed ${seed}: ${res.fail} at op ${res.i}\nminimal: ${show(min)}\n-> ${run(mk, min, o).fail}`); }
  return res;
}

// ---------------------------------------------------------------- start states
const fresh = (seed) => () => { const G = createGame(seed); for (let i = 0; i < 6; i++) actions.attend(G); return G; };
function crowded(seed = 5) {
  return () => {
    const G = gameAt(17, seed);
    G.level = 10; G.mirrors = 1; G.insight = G.insightMax; G.affect = 1e15; G.attention = 500; G.stance = 'toward';
    let k = 0;
    for (let r = 0; r < ringsOpen(G); r++) for (let d = 0; d < 10 && k < unitCap(G); d++, k++) {
      const f = FAMILIES[k % 10].id, link = 1 + (k % (LINKS.length - 1));
      if (k % 3 === 0) addRaw(G, node('blend', leaf(f), leaf(FAMILIES[(k + 3) % 10].id)), { link, seat: { ring: r, dir: d } });
      else addLeaf(G, f, { link, seat: { ring: r, dir: d } });
    }
    for (let i = 0; i < 6; i++) addLeaf(G, FAMILIES[i].id, { link: 3 + i });
    return G;
  };
}
const LATE = {};
beforeAll(() => {
  const G = createGame(3); let t = 0;
  for (const T of [600, 1500, 3000]) { for (; t < T; t += 0.1) { extendedBot(G, t); step(G, 0.1); G.events.length = 0; } LATE[T] = serialize(G); }
}, 60000);

// ---------------------------------------------------------------- tests
describe('fuzz: the start states are what they claim', () => {
  it('late snapshots reach deep stages and the crowded board is legal', () => {
    const s3000 = deserialize(LATE[3000]);
    expect(deserialize(LATE[600]).stage).toBeGreaterThanOrEqual(5);
    expect(s3000.stage).toBe(17);
    expect(s3000.mirrors).toBeGreaterThanOrEqual(1);
    const C = crowded()();
    expect(C.units.filter((u) => u.seat).length).toBe(unitCap(C));
    expect(new Set(C.units.map((u) => u.link)).size).toBeGreaterThan(8);
    for (const mk of [() => deserialize(LATE[600]), () => deserialize(LATE[1500]), () => s3000, crowded()]) expect(checkInvariants(mk(), { stage: 0, mu: 0, endings: 0, depth: 0, cards: 0, benchSlack: KNOWN.benchSlack })).toBeNull();
  });
  it('the fuzzer is deterministic: the same seed and ops give the same final save', () => {
    const ops = genOps(77, 1200, KNOWN);
    const a = run(fresh(77), ops, KNOWN), b = run(fresh(77), ops, KNOWN);
    expect(a.fail).toBeNull();
    expect(serialize(b.G)).toBe(serialize(a.G));
    TOTAL_OPS += 2 * ops.length;
  });
  it('the shrinker reduces a planted failure to the few operations that cause it', () => {
    // planted: a seat outside the board (KNOWN bug place-seat), buried in 800 random operations
    const o = { ...KNOWN, badSeats: true };
    const ops = [...genOps(5, 400, KNOWN), { a: 'step', dt: 0.1, n: 60 }, { a: 'buy', args: [{ raw: 0 }] }, { a: 'place', args: [{ u: 0 }, { raw: { ring: 0, dir: -3 } }] }, ...genOps(6, 400, KNOWN)];
    const r = run(fresh(5), ops, o);
    if (!r.fail) return; // the planted op happened to be refused (e.g. place fixed); nothing to shrink
    const min = shrink(fresh(5), ops, o);
    expect(min.length).toBeLessThanOrEqual(6);
    expect(run(fresh(5), min, o).fail).toMatch(/bad seat/);
  });
});

describe('fuzz: fresh games', () => {
  for (let seed = 1; seed <= 24; seed++) it(`seed ${seed}: 1500 random operations keep every invariant`, () => { fuzz(fresh(seed), seed, 1500); });
});

describe('fuzz: late states (extendedBot after 600 s, 1500 s, 3000 s; gameAt(17) crowded)', () => {
  for (const T of [600, 1500, 3000]) it(`after ${T} s of play: 12 seeds x 1500 operations`, () => {
    for (let seed = 1; seed <= 12; seed++) fuzz(() => deserialize(LATE[T]), 1000 * T + seed, 1500);
  });
  it('gameAt(17) with a full board of links 1..11: 12 seeds x 1500 operations', () => {
    for (let seed = 1; seed <= 12; seed++) fuzz(crowded(seed), 9000 + seed, 1500);
  });
});

describe('fuzz: resets and restarts', () => {
  it('frequent resets from late states: meta never decreases, every new run starts legal and playable', () => {
    const o = { ...KNOWN, resetP: 0.04 };
    let resets = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const res = fuzz(seed % 2 ? () => deserialize(LATE[3000]) : crowded(seed), 500 + seed, 2000, o);
      resets += res.resets;
      // after all of that the game still plays: one more bot minute moves it
      const G = res.G, t0 = G.stats.clicks;
      for (let t = 0; t < 60; t += 0.1) { extendedBot(G, t); step(G, 0.1); G.events.length = 0; }
      expect(G.stats.clicks).toBeGreaterThan(t0);
      expect(checkInvariants(G, { stage: 0, mu: 0, endings: 0, depth: 0, cards: 0, benchSlack: KNOWN.benchSlack })).toBeNull();
    }
    expect(resets).toBeGreaterThan(20);
  });
  it('a reset keeps residue, endings, depth and cards exactly and starts simple', () => {
    const G = deserialize(LATE[3000]);
    G.endings = 3; G.cards = CARDS.slice(0, 4).map((c) => c.id);
    const N = actions.nonMind(G);
    expect(N).not.toBe(G);
    expect(N.depth).toBe(G.depth + 1);
    expect(N.endings).toBe(3);
    expect(N.cards).toEqual(G.cards);
    expect(N.mu).toBeGreaterThanOrEqual(G.mu);
    expect([N.stage, N.units.length, N.mirrors, N.wave, N.cycle]).toEqual([0, 0, 0, 1, 0]);
    expect(checkInvariants(N, { stage: 0, mu: G.mu, endings: 3, depth: G.depth, cards: 4 })).toBeNull();
  });
});

describe('fuzz: every invalid call at a late stage is a quiet no', () => {
  it('garbage arguments to every action on the crowded board return falsy and change nothing', () => {
    const G = crowded()();
    const ghost = 987654, a = G.units[0].id;
    const calls = [
      ['buy', 5], ['buy', -1], ['buy', NaN], ['buy', 'x'], ['buy', undefined], ['buy', 1e9],
      ['sell', ghost], ['sell', undefined], ['sell', {}], ['split', ghost], ['split', 'x'], ['repurpose', ghost], ['repurpose', null],
      ['place', ghost, { ring: 0, dir: 0 }], ['place', a, { ring: 3, dir: 0 }], ['place', NaN, null],
      ['integrate', a, a], ['integrate', a, ghost], ['integrate', ghost, a], ['subtract', a, a], ['subtract', undefined, undefined],
      ['buyHabit', 'breath', 0], ['buyHabit', 'breath', -2], ['buyHabit', 'breath', NaN], ['buyHabit', 'breath', 'x'],
      ['buyUpgrade', 'nope'], ['buyUpgrade', undefined], ['buyUpgrade', '__proto__'], ['cast', 'nope'], ['cast', {}],
      ['startVerb', 'nope', a], ['startVerb', 'dream', ghost], ['startVerb', undefined, a],
      ['exchange', 'affect', 'mu'], ['exchange', 'composure', 'affect'], ['exchange', 'x', 'y'], ['exchange', undefined, undefined],
      ['chooseStance', 'sideways'], ['chooseStance', undefined], ['chooseStance', {}],
    ];
    for (const [name, ...args] of calls) {
      const before = snapshot(G);
      let r; expect(() => { r = actions[name](G, ...args); }, `${name}(${String(args)}) throws`).not.toThrow();
      expect(r, `${name}(${String(args)}) result`).toBeFalsy();
      expect(snapshot(G), `${name}(${String(args)}) changed the state`).toBe(before);
    }
  });
  it('the tally of fuzzed operations is large enough to mean something', () => {
    // runs last in file order: fresh 24x1500 + late 4x12x1500 + resets 8x2000 + determinism 2x1200
    expect(TOTAL_OPS).toBeGreaterThanOrEqual(24 * 1500 + 48 * 1500 + 8 * 2000);
  });
});

// ---------------------------------------------------------------- guiding tests for engine bugs
describe('fuzz: known engine bugs (it.fails until fixed)', () => {
  // src/game/game.js:169-172 (actions.place) only checks `seat.ring >= ringsOpen(G)`. A negative ring, a dir
  // outside 0..9, a fractional ring, string coordinates, a seat with no fields or a non-object seat are all accepted
  // and stored as u.seat. Observed: u.seat = {ring:-1,dir:2} / {ring:0,dir:12} / {} / 7 ...; seatPos(undefined) then
  // yields NaN positions in battle, and {ring:'0',dir:'0'} slips past the occupancy check (=== against 0) so two units
  // share seat 0:0. Expected: place returns false and leaves the unit where it was.
  // Minimal reproduction (fuzzer, seed 4): createGame(4); attend x6; step 0.1 x60; buy(1); place(unit, {ring:0,dir:-3}).
  it.fails('BUG place-seat: place refuses any seat that is not an open ring 0..rings-1 and a dir 0..9', () => {
    for (const seat of [{ ring: -1, dir: 2 }, { ring: 0, dir: 12 }, { ring: 0, dir: -3 }, {}, { ring: 0.5, dir: 1 }, { ring: '0', dir: '0' }, 'seat', 7]) {
      const G = gameAt(1, 4);
      const u = addLeaf(G, 'reappraisal');
      addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 } });
      expect(actions.place(G, u.id, seat), JSON.stringify(seat)).toBe(false);
      expect(u.seat).toBeNull();
    }
  });
  it.fails('BUG place-seat-share: a string-coordinate seat cannot double-book an occupied seat', () => {
    const G = gameAt(1, 4);
    addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 } });
    const u = addLeaf(G, 'reappraisal');
    actions.place(G, u.id, { ring: '0', dir: '0' });
    const at00 = G.units.filter((x) => x.seat && Number(x.seat.ring) === 0 && Number(x.seat.dir) === 0);
    expect(at00.length).toBe(1);
  });

  // src/game/game.js:179-181 (actions.buyHabit): `HABITS.find` returns undefined for an unknown id and
  // habitCost(G, undefined) reads h.base -> TypeError. Every other action answers an unknown id with false.
  // Observed: throws "Cannot read properties of undefined (reading 'base')". Expected: returns false, no change.
  // Minimal reproduction: gameAt(2); actions.buyHabit(G, 'nope').
  it.fails('BUG buyHabit-unknown: buyHabit with an unknown habit id returns false instead of throwing', () => {
    const G = gameAt(2, 1); G.affect = 1e6;
    const before = snapshot(G);
    for (const id of ['nope', undefined, {}, '__proto__']) expect(actions.buyHabit(G, id)).toBe(false);
    expect(snapshot(G)).toBe(before);
  });

  // src/game/game.js:241 (startVerb sets u.seat = null) and :399/:405 (finishVerb sets u.busy = null, or dream adds a
  // new unit with seat null) never check BENCH. A unit away on a verb does not hold a bench slot, so the bench is
  // refilled meanwhile and the returning unit overfills it. Observed: bench 9 (> BENCH 8) after the verb ends;
  // with all four verbs running, up to BENCH + 4. Expected: the bench never holds more than BENCH (e.g. count busy
  // units toward the bench limit in buy/split/place, or seat/hold the returning unit).
  // Minimal reproduction (fuzzer, from the 1500 s snapshot): step 140 s; startVerb('dream', u); split(benched leaf) -> bench 8; step until the dream ends -> bench 9.
  it.fails('BUG verb-return-bench: a unit back from a verb never overfills the bench', () => {
    for (const verb of ['rest', 'dream']) {
      const G = gameAt(10, 2); G.level = 1; // unitCap 2
      addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 } }); addLeaf(G, 'containment', { seat: { ring: 0, dir: 5 } });
      const away = addLeaf(G, 'reappraisal'); // vagal, so it may rest
      expect(actions.startVerb(G, verb, away.id)).toBe(true);
      for (let i = 0; i < BENCH; i++) addLeaf(G, 'avoidance', { link: 1 + i }); // distinct links: nothing fuses
      expect(G.units.filter((u) => !u.seat && !u.busy).length).toBe(BENCH);
      for (let t = 0; t < VERBS.find((v) => v.id === verb).time + 1; t += 0.25) { G.phase = 'prep'; G.phaseT = 0; step(G, 0.25); }
      expect(G.verbs[verb]).toBeNull();
      expect(G.units.filter((u) => !u.seat && !u.busy).length, verb).toBeLessThanOrEqual(BENCH);
    }
  });

  // src/game/game.js:153-154 (actions.buy): `twinExists` lets a buy past a full bench when a link-1 twin exists, on
  // the promise that it fuses at once, but it does not check `!o.busy` while fuse() (game.js:115) skips busy units.
  // Observed: bench 8 -> buy(i) returns true -> bench 9. Expected: buy is refused ('The bench is full.').
  // Minimal reproduction: full seats and bench, a link-1 Reappraisal resting, shop[0] = 'reappraisal', buy(0).
  it.fails('BUG buy-busy-twin: a busy twin does not let a buy past a full bench', () => {
    const G = gameAt(10, 2); G.level = 1; G.attention = 100;
    addLeaf(G, 'suppression', { seat: { ring: 0, dir: 0 } }); addLeaf(G, 'containment', { seat: { ring: 0, dir: 5 } });
    const twin = addLeaf(G, 'reappraisal');
    expect(actions.startVerb(G, 'rest', twin.id)).toBe(true);
    for (let i = 0; i < BENCH; i++) addLeaf(G, 'avoidance', { link: 1 + i });
    G.shop[0] = 'reappraisal';
    expect(actions.buy(G, 0)).toBe(false);
    expect(G.units.filter((u) => !u.seat && !u.busy).length).toBe(BENCH);
  });

  // The unrestricted fuzzer (all bad seats, unknown habit ids, exact bench limit) must find nothing once the four
  // bugs above are fixed. While they exist it fails on one of them; this keeps the full-strength fuzzer in the suite.
  it.fails('BUG fuzz-unrestricted: the fuzzer with every invalid input and the exact bench limit finds nothing', () => {
    const o = { badSeats: true, badHabit: true, benchSlack: 0 };
    for (let seed = 1; seed <= 6; seed++) {
      expect(run(fresh(seed), genOps(seed, 1500, o), o).fail).toBeNull();
      expect(run(() => deserialize(LATE[1500]), genOps(1500000 + seed, 1500, o), o).fail).toBeNull();
    }
  });
});

