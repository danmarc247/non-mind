// Balance probe. Run: node tests/game/balance.mjs
// 1. extended bot (default bot + verbs, exchange, stance, mirror), 10 seeds x 5400 s, sampled every 300 s, median over seeds.
// 2. three consecutive runs with resets (nonMind at overwhelm >= 1 or at 3600 s).
import { createGame, step, defaultBot, actions, STAGES, VERBS, unlocked, mirrorCost } from '../../src/game/index.js';

const DT = 0.1, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], HORIZON = 5400, EVERY = 300;
const median = (a) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const maxLink = (G) => G.units.reduce((m, u) => Math.max(m, u.link), 0);
const fmt = (n, d = 1) => (!Number.isFinite(n) ? '-' : Math.abs(n) >= 1e6 ? n.toExponential(1) : n.toFixed(d));
const pad = (s, n) => String(s).padStart(n);
const waveStr = (gw) => `${Math.floor((gw - 1) / 10)}.${((gw - 1) % 10) + 1}`;
const snap = (G, tally) => ({
  stage: G.stage, gw: G.cycle * 10 + G.wave, level: G.level, C: G.complexity, cap: G.capacity, over: G.overwhelm, link: maxLink(G),
  units: G.units.length, seated: G.units.filter((u) => u.seat).length, affect: G.affect, habits: G.habitsOwned,
  win: tally.win, lose: tally.lose, mu: G.mu, peak: G.stats.peak, mirrors: G.mirrors,
});

// Advance one tick: bot, step, tally wave results and stage arrivals (several stages can unlock in a single tick).
function tick(G, t, bot, tally, first) {
  bot(G, t);
  const before = G.stage;
  step(G, DT);
  for (const e of G.events) { if (e.type === 'waveWin') tally.win++; else if (e.type === 'waveLose') tally.lose++; }
  G.events.length = 0;
  if (first) for (let s = before + 1; s <= G.stage; s++) first[s] ??= G.t;
}

// Bot that also uses the late-game systems the extended bot ignores.
function extendedBot(G, t) {
  defaultBot(G, t);
  if (unlocked(G, 'verbs')) for (const v of VERBS) {
    if (G.verbs[v.id]) continue;
    const u = G.units.find((x) => !x.seat && !x.busy);
    if (u && (G.units.length > 6 || v.id !== 'dream')) actions.startVerb(G, v.id, u.id);
  }
  if (unlocked(G, 'exchange') && G.stats.exchanges < 3 + 2) actions.exchange(G, 'attention', 'insight');
  if (unlocked(G, 'stance') && !G.stance) actions.chooseStance(G, 'toward');
  if (unlocked(G, 'mirror') && G.affect >= mirrorCost(G)) actions.mirror(G);
}

// ---------- 1 ----------
console.log('== 1. Single run, extended bot, median of 10 seeds ==');
const rows = {}, first1 = {};
for (const seed of SEEDS) {
  const G = createGame(seed), tally = { win: 0, lose: 0 }; let next = EVERY; first1[seed] = {};
  for (let t = 0; t < HORIZON; t += DT) { tick(G, t, extendedBot, tally, first1[seed]); if (G.t >= next) { (rows[next] ||= []).push(snap(G, tally)); next += EVERY; } }
}
console.log(['t(s)', 'stage', 'wave', 'lvl', 'cplx/cap', 'overwhelm', 'maxLink', 'units', 'seated', 'habits', 'affect', 'W/L'].map((h, i) => pad(h, i === 4 ? 10 : i === 1 ? 11 : 8)).join(' '));
for (const t of Object.keys(rows).map(Number)) {
  const r = rows[t], m = (k) => median(r.map((x) => x[k])), st = Math.round(m('stage'));
  console.log([pad(t, 8), pad(`${st}:${STAGES[st].id}`, 11), pad(waveStr(Math.round(m('gw'))), 8), pad(m('level'), 8), pad(`${fmt(m('C'), 0)}/${fmt(m('cap'), 0)}`, 10),
    pad(m('over').toFixed(2), 8), pad(m('link'), 8), pad(m('units'), 8), pad(m('seated'), 8), pad(fmt(m('habits'), 0), 8), pad(fmt(m('affect')), 8), pad(`${m('win')}/${m('lose')}`, 8)].join(' '));
}
function stageTable(first, seeds, label) {
  console.log(`\nFirst time each stage is reached (${label}; median seconds among seeds that got there):`);
  for (let s = 1; s < STAGES.length; s++) {
    const ts = seeds.map((k) => first[k][s]).filter((x) => x !== undefined);
    console.log(`  stage ${pad(s, 2)} ${STAGES[s].id.padEnd(12)} unlock:${STAGES[s].unlock.padEnd(10)} ${ts.length ? `${pad(Math.round(median(ts)), 6)} s` : '  never'}  (${ts.length}/${seeds.length})`);
  }
}
stageTable(first1, SEEDS, 'extended bot');

// ---------- 2 ----------
console.log('\n== 2. Three consecutive runs with resets (extended bot; nonMind at overwhelm >= 1 or after 3600 s) ==');
const RUNS = 3, RESET_AT = 3600, S2 = SEEDS.slice(0, 5);
const perRun = Array.from({ length: RUNS }, () => []);
for (const seed of S2) {
  let G = createGame(seed);
  for (let r = 0; r < RUNS; r++) {
    const tally = { win: 0, lose: 0 }, first = {}; let reason = 'time';
    for (let t = 0; t < RESET_AT; t += DT) { tick(G, t, extendedBot, tally, first); if (G.overwhelm >= 1) { reason = 'overwhelm'; break; } }
    const N = actions.nonMind(G);
    perRun[r].push({ ...snap(G, tally), reason, t: G.t, gain: N.mu - G.mu, t10: first[10] ?? NaN, t17: first[17] ?? NaN, t6: first[6] ?? NaN });
    G = N;
  }
}
console.log(['run', 'ends@s', 'by', 'stage', 'wave', 'lvl', 'cplx/cap', 'maxLink', 'peakC', 'mu start', 'mu gain', 't@stage6', 't@stage10', 't@stage17'].map((h, i) => pad(h, i === 6 ? 10 : 9)).join(' '));
perRun.forEach((rs, r) => {
  const m = (k) => median(rs.map((x) => x[k])), by = rs.filter((x) => x.reason === 'overwhelm').length;
  console.log([pad(r + 1, 9), pad(Math.round(m('t')), 9), pad(`${by}/${rs.length}ovw`, 9), pad(Math.round(m('stage')), 9), pad(waveStr(Math.round(m('gw'))), 9), pad(m('level'), 9),
    pad(`${fmt(m('C'), 0)}/${fmt(m('cap'), 0)}`, 10), pad(m('link'), 9), pad(fmt(m('peak'), 0), 9), pad(m('mu'), 9), pad(m('gain'), 9), pad(fmt(m('t6'), 0), 9), pad(fmt(m('t10'), 0), 9), pad(fmt(m('t17'), 0), 9)].join(' '));
});


// ---------- findings ----------
const reached17 = SEEDS.map((k) => first1[k][17]).filter((x) => x !== undefined);
console.log(`\n== Findings (live numbers) ==
* Run 1: stage 17 reached by ${reached17.length}/${SEEDS.length} seeds, median ${reached17.length ? Math.round(median(reached17)) + ' s' : 'never'}.
* Runs 1-3 (section 2): compare the t@stage columns and the "ends@s" / "by" columns; "ovw" means the run ended by overwhelm before 3600 s.
* Check W/L in section 1 for whether combat still walls the bot out of progression.`);
