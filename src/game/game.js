// NON-MIND engine: state, economy, operations, progression. Pure JS, no DOM. Deterministic given seed.
import {
  STAGES, LINKS, FAMILIES, FAMILY, HABITS, HABIT_GROWTH, UPGRADES, SPELLS, VERBS, MOODS, STANCES, SHOP_ODDS, XP_TO_LEVEL,
  TIER_COST, COSTS, ASPECTS, WAVES_PER_CYCLE,
} from './data.js';
import { leaf, node, key, prune, complexityOf, inheritTraits, traitForLink, aspectsOf, tierOf, nameOf, leafCount } from './genome.js';
import { startWave, stepBattle, aspectTiers } from './battle.js';
import { rollMutation, epithet } from './content/mutations.js';
import { KOANS, pickKoan } from './content/koans.js';

// A line from the pools, never the same twice in a row per pool.
function koan(G, pool, kind = 'koan') { const lastKoan = (G.lastKoan ||= {}); const list = pool.includes('.') ? KOANS.byStage[pool.split('.')[1]] : KOANS[pool]; if (!list || !list.length) return; const line = pickKoan(G.rng, list, lastKoan[pool]); lastKoan[pool] = line; say(G, line, kind); }

export const MAX_MUTS = 6;
// A unit's full name: genome name plus the epithet of its rarest mutation.
export const displayName = (u) => `${nameOf(u.g)} ${epithet(u.muts || [])}`.trim();
function mutate(G, u, chance = 1) { if ((u.muts ||= []).length < MAX_MUTS && G.rng() < chance) { const m = rollMutation(G.rng, u); if (m) { u.muts.push(m.id); G.events.push({ type: 'mutation', id: u.id, mut: m.id }); } } }

export const SAVE_KEY = 'non-mind-save-v1';
export const BENCH = 8;
const SHOP_FOCUS = 0.3;
const FUSE_NEAR = 4; // from this link up, a unit also fuses with its neighbour link (the climb turns from doubling to Fibonacci)

function mulberry(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.get = () => a; f.set = (v) => { a = v >>> 0; };
  return f;
}

// meta survives resets; everything else is the run.
export function createGame(seed = 1, meta = {}) {
  const G = {
    v: 1, seed, t: 0,
    mu: 0, endings: 0, depth: 0, bestStage: 0, totalT: 0, ...meta,
    affect: 0, attention: 3 + Math.min(20, Math.floor(Math.sqrt(meta.mu || 0))), insight: 0, insightMax: 100,
    level: 1, xp: 0, composure: 100, composureMax: 100,
    units: [], nextUid: 1, shop: [], habits: {}, upgrades: {}, attendants: 0, attendT: 0, mirrors: 0,
    stance: null, moods: [], verbs: {}, seasonT: 60, labelT: 0,
    habituation: 0, wave: 1, cycle: 0, phase: 'prep', phaseT: 0, streak: 0, clicksThisWave: 0, auto: true,
    stats: { clicks: 0, kills: 0, links: 0, integrations: 0, splits: 0, subtractions: 0, repurposes: 0, verbsDone: 0, exchanges: 0, echoes: 0, seasons: 0, peak: 0, earned: 0 },
    stage: 0, complexity: 0, capacity: 40, overwhelm: 0, habitsOwned: 0, prod: 0, battle: null,
    events: [], log: [],
  };
  G.rng = mulberry(seed + 7919 * G.depth);
  G.gain = (amt, why) => { const a = amt * affectMul(G); G.affect += a; G.stats.earned += a; return a; };
  G.capacity = capacityOf(G);
  rollShop(G, true);
  say(G, STAGES[0].hint);
  return G;
}

const say = (G, text, kind = 'koan') => { G.log.push({ t: G.t, text, kind }); if (G.log.length > 40) G.log.shift(); G.events.push({ type: 'say', text, kind }); };
export const unlocked = (G, what) => STAGES.findIndex((s) => s.unlock === what) <= G.stage;
export const capacityOf = (G) => 40 * (1 + 0.3 * G.stage);
export const unitCap = (G) => Math.min(30, G.level + 1 + 2 * G.mirrors);
export const ringsOpen = (G) => 1 + (unlocked(G, 'ring2') ? 1 : 0) + (G.mirrors > 0 ? 1 : 0);
const moodN = (G, k) => G.moods.filter((m) => m.kind === k).length;

export function affectMul(G) {
  const tiers = G.battle?.tiers || aspectTiers(G);
  let m = (1 + 0.04 * G.mu) * (1 + G.complexity / 25) * (1 + 0.1 * G.endings) * Math.pow(2, G.mirrors);
  if (tiers.mythic) m *= 1 + ASPECTS.mythic.v[tiers.mythic - 1] / 100;
  if (G.upgrades.old_wound) m *= 1 + 1.5 * Math.min(1, Math.max(0, 1 - G.composure / G.composureMax));
  if (G.upgrades.long_view) m *= 1 + Math.pow(G.t, 0.45) / 40;
  if (moodN(G, 'fascination')) m *= 1.5;
  if (G.stance === 'away') m *= 0.8;
  return m;
}
export const habitCost = (G, h) => h.base * Math.pow(HABIT_GROWTH, G.habits[h.id] || 0);
export function habitYield(G) {
  let p = 0;
  for (const h of HABITS) p += (G.habits[h.id] || 0) * h.prod;
  if (G.upgrades.counting_breaths) p *= 1 + 0.02 * (G.habits.breath || 0);
  return p;
}
export const clickValue = (G) => (1 + (G.upgrades.noticing ? 0.01 * G.prod : 0) + G.level * 0.5) * (1 + G.wave * 0.1 + G.cycle);

// ---------- shop / bench / board ----------
function rollShop(G, free = false) {
  const odds = SHOP_ODDS[Math.min(9, G.level - 1)];
  G.shop = Array.from({ length: 5 }, () => {
    let r = G.rng() * 100, tier = 0;
    while (tier < 4 && r >= odds[tier]) { r -= odds[tier]; tier++; }
    const pool = FAMILIES.filter((f) => f.tier === tier + 1);
    return pool[Math.floor(G.rng() * pool.length)].id;
  });
  // the shop leans toward the family you are already climbing, so the ladder is a path and not a lottery
  const lead = G.units.filter((u) => u.g.t === 'leaf').sort((a, b) => b.link - a.link)[0];
  if (lead && G.stage >= 3) for (let i = 0; i < 5; i++) if (G.rng() < SHOP_FOCUS) G.shop[i] = lead.g.f;
  if (!free) G.events.push({ type: 'sfx', name: 'reroll' });
}
const bench = (G) => G.units.filter((u) => !u.seat && !u.busy);
const seated = (G) => G.units.filter((u) => u.seat);
const unitById = (G, id) => G.units.find((u) => u.id === id);

function addUnit(G, g, link = 1, traits = ['ache'], seat = null, ghosts = 0, muts = []) {
  const u = { id: G.nextUid++, g, link, traits: traits.slice(), seat, ghosts, born: G.t, muts: muts.slice(0, MAX_MUTS) };
  G.units.push(u);
  G.events.push({ type: 'unitNew', id: u.id });
  fuse(G, u);
  return u;
}
// Two of the same genome at the same link fuse into the next link: the ladder.
function fuse(G, u) {
  for (;;) {
    const k = key(u.g);
    const twin = G.units.find((o) => o !== u && !o.busy && o.link === u.link && key(o.g) === k) || (u.link >= FUSE_NEAR ? G.units.find((o) => o !== u && !o.busy && Math.abs(o.link - u.link) === 1 && o.link >= FUSE_NEAR - 1 && key(o.g) === k) : null);
    if (!twin) return;
    const keep = u.seat ? u : twin.seat ? twin : u, gone = keep === u ? twin : u;
    G.units.splice(G.units.indexOf(gone), 1);
    keep.link = Math.max(u.link, twin.link) + 1; keep.traits = inheritTraits(keep, gone, G.rng); keep.traits.push(traitForLink(keep.link));
    keep.muts = [...new Set([...(keep.muts || []), ...(gone.muts || [])])].slice(0, MAX_MUTS); mutate(G, keep, 0.6);
    G.stats.links++;
    G.events.push({ type: 'link', id: keep.id, gone: gone.id, link: keep.link });
    say(G, `${nameOf(keep.g)}: ${LINKS[keep.link - 1].name}. ${LINKS[keep.link - 1].text}`, 'link');
    if (keep.link >= 12) {
      G.units.splice(G.units.indexOf(keep), 1); G.endings++;
      G.events.push({ type: 'ending', id: keep.id }); say(G, 'An ending is known. It stays known.', 'ending'); koan(G, 'ending', 'ending');
      return;
    }
    u = keep;
  }
}

// A new arrival takes the first free seat while there is room; the player can always move it.
function autoSeat(G, u) {
  if (!G.units.includes(u) || u.seat || seated(G).length >= unitCap(G)) return;
  const taken = new Set(seated(G).map((o) => o.seat.ring * 10 + o.seat.dir));
  const order = [0, 5, 2, 7, 4, 9, 1, 6, 3, 8];
  for (let r = 0; r < ringsOpen(G); r++) for (const d of order) if (!taken.has(r * 10 + d)) { u.seat = { ring: r, dir: d }; return; }
}

export const actions = {
  attend(G) {
    G.stats.clicks++; G.clicksThisWave++;
    const a = G.gain(clickValue(G), 'click');
    G.events.push({ type: 'attend', amt: a });
    if (G.stats.clicks % 25 === 0) koan(G, 'attend');
    return a;
  },
  buy(G, i) {
    const f = FAMILY[G.shop[i]]; if (!f || !unlocked(G, 'shop')) return false;
    const cost = TIER_COST[f.tier - 1];
    if (G.attention < cost) return fail(G);
    const twinExists = G.units.some((o) => o.link === 1 && key(o.g) === f.id);
    if (bench(G).length >= BENCH && !twinExists) return fail(G, 'The bench is full.');
    G.attention -= cost; G.shop[i] = null;
    const nu = addUnit(G, leaf(f.id));
    autoSeat(G, nu);
    G.events.push({ type: 'sfx', name: 'buy' });
    return true;
  },
  reroll(G) { if (G.attention < COSTS.reroll) return fail(G); G.attention -= COSTS.reroll; rollShop(G); return true; },
  buyXp(G) { if (G.attention < COSTS.xp || G.level >= 10) return fail(G); G.attention -= COSTS.xp; addXp(G, COSTS.xpGain); return true; },
  sell(G, id) {
    const u = unitById(G, id); if (!u || u.busy) return false;
    G.units.splice(G.units.indexOf(u), 1); G.attention += Math.max(1, Math.round(tierOf(u.g) * u.link * 0.75 * Math.sqrt(leafCount(u.g))));
    G.events.push({ type: 'unitGone', id, why: 'sell' }); G.events.push({ type: 'sfx', name: 'sell' }); return true;
  },
  // seat = {ring, dir} or null for bench. Swaps if occupied. Allowed any time; applies next wave if fighting.
  place(G, id, seat) {
    const u = unitById(G, id); if (!u || u.busy) return false;
    if (seat) {
      if (seat.ring >= ringsOpen(G)) return fail(G);
      const other = G.units.find((o) => o.seat && o.seat.ring === seat.ring && o.seat.dir === seat.dir);
      if (!other && !u.seat && seated(G).length >= unitCap(G)) return fail(G, 'No more can be held at once.');
      if (other) other.seat = u.seat;
    } else if (bench(G).length >= BENCH) return fail(G);
    u.seat = seat; G.events.push({ type: 'sfx', name: 'place' }); return true;
  },
  buyHabit(G, id, n = 1) {
    if (!unlocked(G, 'habits')) return false;
    const h = HABITS.find((x) => x.id === id); let bought = 0;
    while (bought < n && G.affect >= habitCost(G, h)) { G.affect -= habitCost(G, h); G.habits[id] = (G.habits[id] || 0) + 1; bought++; }
    if (bought) G.events.push({ type: 'sfx', name: 'upgrade' });
    return bought > 0 || fail(G);
  },
  buyUpgrade(G, id) {
    const up = UPGRADES.find((x) => x.id === id);
    if (!up || G.upgrades[id] || G.stage < up.stage || G.affect < up.cost) return fail(G);
    G.affect -= up.cost; G.upgrades[id] = true; G.events.push({ type: 'sfx', name: 'upgrade' }); return true;
  },
  buyAttendant(G) {
    const cost = 300 * Math.pow(2.2, G.attendants);
    if (!unlocked(G, 'attendants') || G.affect < cost) return fail(G);
    G.affect -= cost; G.attendants++; return true;
  },
  // ---- genetic operations ----
  integrate(G, aId, bId) { return combine(G, aId, bId, 'blend'); },
  subtract(G, aId, bId) { return combine(G, aId, bId, 'carve'); },
  split(G, id) {
    const u = unitById(G, id);
    if (!u || u.busy || !unlocked(G, 'split') || G.insight < COSTS.split) return fail(G);
    let parts;
    if (u.g.t === 'node') parts = [u.g.a, u.g.b];
    else if (u.g.pole === 0 && u.link > 1) parts = [leaf(u.g.f, 1), leaf(u.g.f, -1)];
    else return fail(G, 'It has no seam.');
    if (bench(G).length >= BENCH) return fail(G, 'There is nowhere for the second part to wait.');
    G.insight -= COSTS.split;
    G.units.splice(G.units.indexOf(u), 1);
    // a hybrid gives back what its parents brought (no link is minted by joining then parting);
    // older saves without the record fall back to one link less for the first part and link 1 for the second
    const pl = u.g.t === 'node' ? (u.parentLinks || [Math.max(1, u.link - 1), 1]) : [u.link - 1, u.link - 1];
    const half = Math.ceil(u.traits.length / 2);
    const a = addUnit(G, parts[0], pl[0], u.traits.slice(0, half).concat('ache').slice(0, half || 1), u.seat, 0, (u.muts || []).filter((_, i) => i % 2 === 0));
    const b = addUnit(G, parts[1], pl[1], u.traits.slice(half).length ? u.traits.slice(half) : ['ache'], null, 0, (u.muts || []).filter((_, i) => i % 2 === 1));
    mutate(G, a, 0.5); mutate(G, b, 0.5);
    G.stats.splits++; G.events.push({ type: 'split', id, a: a.id, b: b.id }); koan(G, 'split', 'op');
    return true;
  },
  repurpose(G, id) {
    const u = unitById(G, id); if (!u || u.busy || !unlocked(G, 'repurpose')) return fail(G);
    // worth decides the habit: tier picks it, links and parts decide how many (a cheap unit cannot become a late habit)
    const idx = Math.min(HABITS.length - 1, tierOf(u.g) - 1 + Math.floor((u.link - 1) / 3)), h = HABITS[idx];
    const n = Math.max(1, Math.round(u.link * (1 + leafCount(u.g)) / 2));
    G.habits[h.id] = (G.habits[h.id] || 0) + n;
    G.units.splice(G.units.indexOf(u), 1); G.stats.repurposes++;
    G.events.push({ type: 'repurpose', id, habit: h.id, n }); say(G, `${nameOf(u.g)} is now ${n} of ${h.name}.`, 'op'); koan(G, 'repurpose', 'op');
    return true;
  },
  cast(G, id) {
    const s = SPELLS.find((x) => x.id === id); if (!s || !unlocked(G, 'insight') || G.insight < s.cost) return fail(G);
    G.insight -= s.cost;
    if (id === 'exhale') { if (G.battle) for (const c of G.battle.units) if (c.alive) c.hp = Math.min(c.max, c.hp + c.max / 3); G.composure = Math.min(G.composureMax, G.composure + 20); }
    if (id === 'label') G.labelT = 8;
    if (id === 'recollect') G.gain(G.prod * 30 / affectMul(G), 'spell');
    G.events.push({ type: 'spell', id }); return true;
  },
  startVerb(G, verbId, unitId) {
    const v = VERBS.find((x) => x.id === verbId), u = unitById(G, unitId);
    if (!v || !u || u.busy || G.verbs[verbId] || !unlocked(G, 'verbs')) return fail(G);
    if (v.needs && !aspectsOf(u.g).includes(v.needs) && !u.traits.includes('fade')) return fail(G, `It wants something ${ASPECTS[v.needs].name}.`);
    u.busy = verbId; u.seat = null; G.verbs[verbId] = { t: v.time, unit: u.id };
    G.events.push({ type: 'verbStart', id: verbId }); return true;
  },
  exchange(G, from, to) {
    if (!unlocked(G, 'exchange')) return fail(G);
    const rate = { 'affect>attention': [Math.max(50, G.prod * 20), 1], 'attention>insight': [1, 12], 'insight>attention': [25, 1], 'attention>affect': [1, Math.max(20, G.prod * 8)] }[`${from}>${to}`];
    if (!rate || G[from] < rate[0]) return fail(G);
    if (to === 'insight' && G.insight >= G.insightMax) return fail(G, 'Insight is already full.');
    G[from] -= rate[0]; G[to] += rate[1]; if (to === 'insight') G.insight = Math.min(G.insightMax, G.insight);
    G.stats.exchanges++; G.events.push({ type: 'sfx', name: 'buy' }); return true;
  },
  chooseStance(G, id) { if (!unlocked(G, 'stance') || !STANCES.some((s) => s.id === id)) return fail(G); G.stance = id; G.events.push({ type: 'stance', id }); return true; },
  mirror(G) {
    const cost = mirrorCost(G);
    if (!unlocked(G, 'mirror') || G.affect < cost) return fail(G);
    G.affect -= cost; G.mirrors++; G.events.push({ type: 'mirror', n: G.mirrors }); say(G, 'The same assembly, in every direction, under the same names.', 'op'); return true;
  },
  ready(G) { if (G.phase === 'prep') G.phaseT = 99; },
  setAuto(G, on) { G.auto = !!on; },
  // The reset. Returns the new game.
  nonMind(G) {
    if (G.stage < 1) return G;
    const gain = muGain(G);
    const meta = { mu: G.mu + gain, endings: G.endings, depth: G.depth + 1, bestStage: Math.max(G.bestStage, G.stage), totalT: G.totalT + G.t };
    const N = createGame(G.seed, meta);
    N.events.push({ type: 'reset', gain, depth: N.depth });
    say(N, 'Simple again.', 'reset'); koan(N, 'reset', 'reset');
    return N;
  },
};
export const muGain = (G) => Math.floor(Math.pow(G.stats.peak / 8, 0.8) * (1 + G.stage / 17) * (G.overwhelm >= 1 ? 2 : 1) * (1 + 0.15 * G.depth));
export const mirrorCost = (G) => 4e11 * Math.pow(25, G.mirrors);
export const attendantCost = (G) => 300 * Math.pow(2.2, G.attendants);

const firstFamily = (u) => { let g = u.g; while (g.t === 'node') g = g.a; return g.f; };
function fail(G, text) { G.events.push({ type: 'sfx', name: 'error' }); if (text) say(G, text, 'warn'); return false; }
function addXp(G, n) { G.xp += n; while (G.level < 10 && G.xp >= XP_TO_LEVEL[G.level - 1]) { G.xp -= XP_TO_LEVEL[G.level - 1]; G.level++; G.events.push({ type: 'level', level: G.level }); } }

function combine(G, aId, bId, op) {
  const a = unitById(G, aId), b = unitById(G, bId), what = op === 'blend' ? 'integrate' : 'subtract';
  const cost = op === 'blend' ? COSTS.integrate : COSTS.subtract;
  if (!a || !b || a === b || a.busy || b.busy || !unlocked(G, what)) return fail(G);
  if (G.insight < cost && unlocked(G, 'insight')) return fail(G, 'Not enough insight.');
  if (unlocked(G, 'insight')) G.insight -= cost;
  const { g, ghosts } = prune(node(op, a.g, b.g, 0.2 + G.rng() * 0.3));
  const link = op === 'blend' ? Math.max(a.link, b.link) : a.link;
  const traits = op === 'blend' ? inheritTraits(a, b, G.rng) : a.traits.concat(b.traits[Math.floor(G.rng() * b.traits.length)]).slice(0, 10);
  const seat = a.seat || b.seat;
  G.units.splice(G.units.indexOf(a), 1); G.units.splice(G.units.indexOf(b), 1);
  const u = addUnit(G, g, link, traits, seat, (a.ghosts || 0) + (b.ghosts || 0) + ghosts, [...new Set([...(a.muts || []), ...(b.muts || [])])]);
  u.parentLinks = [a.link, b.link];
  mutate(G, u, 0.8);
  G.stats[op === 'blend' ? 'integrations' : 'subtractions']++;
  G.events.push({ type: what, a: aId, b: bId, id: u.id });
  say(G, op === 'blend' ? `${nameOf(g)}. It was two.` : `${nameOf(g)}. Something is missing from it, usefully.`, 'op');
  koan(G, what, 'op');
  return u;
}

// ---------- step ----------
export function step(G, dt) {
  dt = Math.min(dt, 0.25);
  G.t += dt;
  // economy
  G.habitsOwned = HABITS.reduce((n, h) => n + (G.habits[h.id] || 0), 0);
  G.prod = habitYield(G) * affectMul(G);
  G.affect += G.prod * dt; G.stats.earned += G.prod * dt;
  if (unlocked(G, 'insight')) G.insight = Math.min(G.insightMax, G.insight + (1 + 0.15 * G.level) * dt);
  if (G.attendants) { G.attendT += dt * G.attendants * (G.upgrades.lending ? 2 : 1); while (G.attendT >= 1) { G.attendT -= 1; G.gain(clickValue(G) * 0.5, 'attendant'); G.clicksThisWave += 0.25; } }
  G.labelT = Math.max(0, G.labelT - dt);
  // moods decay; verbs tick
  for (const m of G.moods) m.t -= dt;
  if (G.moods.some((m) => m.t <= 0)) { G.moods = G.moods.filter((m) => m.t > 0); G.events.push({ type: 'sfx', name: 'decay' }); }
  for (const id of Object.keys(G.verbs)) { const v = G.verbs[id]; if (!v) continue; v.t -= dt; if (v.t <= 0) finishVerb(G, id); }
  // seasons: something is always asked for
  if (unlocked(G, 'seasons')) { G.seasonT -= dt; if (G.seasonT <= 0) { G.seasonT = 60; G.stats.seasons++; if (G.attention >= 3) { G.attention -= 3; say(G, 'The season takes its three.', 'season'); } else addMood(G, 'dread'); } }
  // complexity and overwhelm
  let C = 0; for (const u of G.units) C += complexityOf(u);
  C += Math.sqrt(G.habitsOwned) * 1.2 + Object.keys(G.upgrades).length * 1.5 + G.moods.length + G.mirrors * 70 + G.attendants * 0.6 + (G.stance ? 3 : 0) + Math.log10(1 + G.stats.earned) * 2.5 + (G.cycle * 10 + G.wave) * 1.5;
  G.complexity = C; G.stats.peak = Math.max(G.stats.peak, C);
  G.capacity = capacityOf(G);
  G.overwhelm = Math.max(0, Math.min(1, (C - G.capacity) / (G.capacity * 0.12)));
  if (G.overwhelm >= 1) G.composure = Math.max(0, G.composure - G.composureMax * 0.02 * dt);
  // the log is never quite silent: an idle line now and then, an overwhelm line when it is too much
  G.koanT = (G.koanT || 45) - dt;
  if (G.koanT <= 0) { G.koanT = G.overwhelm > 0.5 ? 14 : 45; koan(G, G.overwhelm > 0.5 ? 'overwhelm' : 'idle', G.overwhelm > 0.5 ? 'warn' : 'koan'); }
  // stages
  while (G.stage < STAGES.length - 1 && STAGES[G.stage + 1].need(G)) {
    G.stage++; const s = STAGES[G.stage];
    G.events.push({ type: 'stage', stage: G.stage, id: s.id }); say(G, `${s.id.toUpperCase()}. ${s.hint}`, 'stage'); koan(G, `byStage.${s.id}`, 'stage');
  }
  // phases
  G.phaseT += dt;
  if (G.phase === 'prep') {
    // never a dead end: with no one to seat and too little attention to buy or look, something simple arrives
    if (unlocked(G, 'shop') && !G.units.some((u) => !u.busy)) {
      const prices = G.shop.filter(Boolean).map((id) => TIER_COST[FAMILY[id].tier - 1]);
      if (G.attention < Math.min(COSTS.reroll, ...(prices.length ? prices : [Infinity]))) {
        const t1 = FAMILIES.filter((f) => f.tier === 1); G.shop[0] = t1[Math.floor(G.rng() * t1.length)].id; G.attention = Math.max(G.attention, TIER_COST[0]);
        say(G, 'Nothing was held, so something came.', 'koan');
      }
    }
    if (seated(G).length && (G.phaseT > (G.auto ? 5 : 1e9) || G.phaseT >= 99)) { G.clicksThisWave = 0; startWave(G); }
  } else if (G.phase === 'fight') {
    const r = stepBattle(G, dt);
    if (r === 'won') endWave(G, true); else if (r === 'lost') endWave(G, false);
  } else if (G.phaseT > 2.2) { G.phase = 'prep'; G.phaseT = 0; G.battle = null; }
  if (G.events.length > 400) G.events.splice(0, G.events.length - 400);
}

function endWave(G, won) {
  G.phase = won ? 'won' : 'lost'; G.phaseT = 0;
  if (won) {
    G.streak = Math.max(1, G.streak + 1); G.habituation = 0;
    const cap = G.upgrades.thrift ? 10 : 5;
    const interest = Math.min(cap, Math.floor(G.attention / 10));
    const pay = 7 + interest + Math.min(3, Math.floor(G.streak / 3));
    G.attention += pay; addXp(G, 2);
    G.gain(20 * Math.pow(1.35, G.cycle * 10 + G.wave - 1), 'wave');
    G.composure = Math.min(G.composureMax, G.composure + G.composureMax * 0.25);
    G.events.push({ type: 'waveWin', pay, interest }); koan(G, 'waveWin');
    G.wave++; if (G.wave > WAVES_PER_CYCLE) { G.wave = 1; G.cycle++; say(G, 'The ten have spoken. The ten begin.', 'stage'); }
    rollShop(G, true);
  } else {
    G.streak = 0; G.composure = G.composureMax; G.habituation = Math.min(12, (G.habituation || 0) + 1); G.attention += 3; addXp(G, 1);
    addMood(G, 'dread'); G.events.push({ type: 'waveLose' }); koan(G, 'waveLose', 'warn'); rollShop(G, true);
  }
}

function addMood(G, kind) {
  if (kind === 'contentment') { const i = G.moods.findIndex((m) => m.kind === 'dread'); if (i >= 0) { G.moods.splice(i, 1); return; } }
  G.moods.push({ kind, t: MOODS[kind].life, id: G.nextUid++ }); G.events.push({ type: 'mood', kind });
}

function finishVerb(G, id) {
  const v = G.verbs[id], u = unitById(G, v.unit); G.verbs[id] = null; G.stats.verbsDone++;
  if (u) u.busy = null;
  if (id === 'dream' && u) {
    const asp = aspectsOf(u.g), t = tierOf(u.g);
    const pool = FAMILIES.filter((f) => f.tier <= t + 1 && f.aspects.some((a) => asp.includes(a)) && f.id !== firstFamily(u));
    const f = pool[Math.floor(G.rng() * pool.length)] || FAMILIES[0];
    G.units.splice(G.units.indexOf(u), 1);
    const n = addUnit(G, leaf(f.id), u.link, u.traits, null, 0, u.muts || []); mutate(G, n, 1);
    say(G, `It slept as ${nameOf(u.g)}. ${nameOf(n.g)} woke.`, 'verb');
  }
  if (id === 'ruminate') { G.insight = Math.min(G.insightMax, G.insight + 45); addMood(G, G.rng() < 0.3 ? 'fascination' : 'dread'); }
  if (id === 'rest') { const i = G.moods.findIndex((m) => m.kind === 'dread'); if (i >= 0) G.moods.splice(i, 1); G.composure = G.composureMax; }
  if (id === 'confide') addMood(G, 'contentment');
  G.events.push({ type: 'verbDone', id });
}

// ---------- persistence ----------
export function serialize(G) {
  const { rng, gain, battle, events, ...rest } = G;
  return JSON.stringify({ ...rest, rs: rng.get(), phase: 'prep', phaseT: 0 });
}
export function deserialize(str) {
  const d = JSON.parse(str);
  const G = createGame(d.seed, {});
  const { rs, ...rest } = d;
  Object.assign(G, rest, { battle: null, events: [] });
  for (const u of G.units) if (u.busy && !G.verbs[u.busy]) u.busy = null;
  G.rng.set(rs);
  return G;
}

// Headless helper: a simple bot plays for `seconds`. Used by tests and `npm run sim`.
export function simulate(seconds, seed = 1, dt = 0.1, bot = defaultBot) {
  let G = createGame(seed);
  for (let t = 0; t < seconds; t += dt) { G = bot(G, t) || G; step(G, dt); G.events.length = 0; }
  return G;
}
export function defaultBot(G, t) {
  if (Math.floor(t * 5) !== Math.floor((t - 0.1) * 5)) actions.attend(G);
  if (G.phase !== 'fight') {
    for (let i = 0; i < 5; i++) if (G.shop[i] && G.attention >= TIER_COST[FAMILY[G.shop[i]].tier - 1] + (G.attention > 30 ? 0 : 0)) actions.buy(G, i);
    if (G.attention >= 14 && G.level < 10) actions.buyXp(G);
    for (const u of G.units) if (!u.seat && !u.busy) {
      const taken = new Set(G.units.filter((o) => o.seat).map((o) => o.seat.ring * 10 + o.seat.dir));
      for (let s = 0; s < ringsOpen(G) * 10; s++) if (!taken.has(s)) { if (actions.place(G, u.id, { ring: Math.floor(s / 10), dir: s % 10 })) break; }
    }
  }
  for (const h of HABITS.slice().reverse()) if (G.affect >= habitCost(G, h) * 1.5) actions.buyHabit(G, h.id);
  for (const up of UPGRADES) if (!G.upgrades[up.id] && G.stage >= up.stage && G.affect >= up.cost * 2) actions.buyUpgrade(G, up.id);
  const b = G.units.filter((u) => !u.seat && !u.busy);
  if (b.length >= 2 && unlocked(G, 'integrate') && G.stats.integrations < 3 + G.wave) actions.integrate(G, b[0].id, b[1].id);
  if (unlocked(G, 'split') && G.stats.splits < 1) { const h = G.units.find((u) => u.g.t === 'node' && !u.busy); if (h) actions.split(G, h.id); }
  if (unlocked(G, 'subtract') && G.stats.subtractions < 1 && b.length >= 2) actions.subtract(G, b[0].id, b[1].id);
  if (unlocked(G, 'repurpose') && b.length > 5) actions.repurpose(G, b[b.length - 1].id);
  return null;
}
