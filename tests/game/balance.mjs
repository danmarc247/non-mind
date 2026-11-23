// Balance probe. Run: node tests/game/balance.mjs
// 1. default bot, 10 seeds x 5400 s, sampled every 300 s, median over seeds.
// 2. three consecutive runs with resets (nonMind at overwhelm >= 1 or at 3600 s).
// 3. an "extended" bot that also plays verbs / exchange / stance / mirror, to see whether late gates are reachable at all.
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

// Bot that also uses the late-game systems the default bot ignores.
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
console.log('== 1. Single run, default bot, median of 10 seeds ==');
const rows = {}, first1 = {};
for (const seed of SEEDS) {
  const G = createGame(seed), tally = { win: 0, lose: 0 }; let next = EVERY; first1[seed] = {};
  for (let t = 0; t < HORIZON; t += DT) { tick(G, t, defaultBot, tally, first1[seed]); if (G.t >= next) { (rows[next] ||= []).push(snap(G, tally)); next += EVERY; } }
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
stageTable(first1, SEEDS, 'default bot');

// ---------- 2 ----------
console.log('\n== 2. Three consecutive runs with resets (default bot; nonMind at overwhelm >= 1 or after 3600 s) ==');
const RUNS = 3, RESET_AT = 3600, S2 = SEEDS.slice(0, 5);
const perRun = Array.from({ length: RUNS }, () => []);
for (const seed of S2) {
  let G = createGame(seed);
  for (let r = 0; r < RUNS; r++) {
    const tally = { win: 0, lose: 0 }, first = {}; let reason = 'time';
    for (let t = 0; t < RESET_AT; t += DT) { tick(G, t, defaultBot, tally, first); if (G.overwhelm >= 1) { reason = 'overwhelm'; break; } }
    const N = actions.nonMind(G);
    perRun[r].push({ ...snap(G, tally), reason, t: G.t, gain: N.mu - G.mu, t10: first[10] ?? NaN, t6: first[6] ?? NaN });
    G = N;
  }
}
console.log(['run', 'ends@s', 'by', 'stage', 'wave', 'lvl', 'cplx/cap', 'maxLink', 'peakC', 'mu start', 'mu gain', 't@stage6', 't@stage10'].map((h, i) => pad(h, i === 6 ? 10 : 9)).join(' '));
perRun.forEach((rs, r) => {
  const m = (k) => median(rs.map((x) => x[k])), by = rs.filter((x) => x.reason === 'overwhelm').length;
  console.log([pad(r + 1, 9), pad(Math.round(m('t')), 9), pad(`${by}/${rs.length}ovw`, 9), pad(Math.round(m('stage')), 9), pad(waveStr(Math.round(m('gw'))), 9), pad(m('level'), 9),
    pad(`${fmt(m('C'), 0)}/${fmt(m('cap'), 0)}`, 10), pad(m('link'), 9), pad(fmt(m('peak'), 0), 9), pad(m('mu'), 9), pad(m('gain'), 9), pad(fmt(m('t6'), 0), 9), pad(fmt(m('t10'), 0), 9)].join(' '));
});

// ---------- 3 ----------
console.log('\n== 3. Extended bot (default + verbs, exchange, stance, mirror), 5 seeds x 5400 s ==');
const first3 = {}, rows3 = {}, S3 = SEEDS.slice(0, 5);
for (const seed of S3) {
  const G = createGame(seed), tally = { win: 0, lose: 0 }; let next = 900; first3[seed] = {};
  for (let t = 0; t < HORIZON; t += DT) { tick(G, t, extendedBot, tally, first3[seed]); if (G.t >= next) { (rows3[next] ||= []).push(snap(G, tally)); next += 900; } }
}
console.log(['t(s)', 'stage', 'wave', 'lvl', 'cplx/cap', 'overwhelm', 'mirrors', 'maxLink', 'units', 'W/L'].map((h, i) => pad(h, i === 4 ? 10 : i === 1 ? 11 : 9)).join(' '));
for (const t of Object.keys(rows3).map(Number)) {
  const r = rows3[t], m = (k) => median(r.map((x) => x[k])), st = Math.round(m('stage'));
  console.log([pad(t, 9), pad(`${st}:${STAGES[st].id}`, 11), pad(waveStr(Math.round(m('gw'))), 9), pad(m('level'), 9), pad(`${fmt(m('C'), 0)}/${fmt(m('cap'), 0)}`, 10),
    pad(m('over').toFixed(2), 9), pad(m('mirrors'), 9), pad(m('link'), 9), pad(m('units'), 9), pad(`${m('win')}/${m('lose')}`, 9)].join(' '));
}
stageTable(first3, S3, 'extended bot');

// ---------- findings ----------
const last1 = Math.max(...SEEDS.map((k) => Math.max(...Object.keys(first1[k]).map(Number))));
const last3 = Math.max(...S3.map((k) => Math.max(...Object.keys(first3[k]).map(Number))));
console.log(`\n== Findings ==
(live: default bot best stage ${last1} (${STAGES[last1].id}); extended bot best stage ${last3} (${STAGES[last3].id}).)
1. Combat is the wall, and it arrives early. The default bot has only ~7 wave wins in the first 600 s and ~12 wins in 5400 s against ~184 losses
   (W/L column). Stressor tolerance scales 1.24^gw and salience 1.17^gw while the bot's level (3 -> 9), seat cap (level + 1) and max link (3 -> 5)
   barely move, so the wave counter sits at global wave 8-13. Progress after ~600 s comes almost entirely from habits, not from winning.
2. Default bot stalls at stage 10 'evoke' (from ~1650 s on): stage 11 needs stats.verbsDone >= 2 and the bot never calls startVerb. Stages 11-17 are
   therefore unreachable for it (never: exchange, echo, stance, seasons, mirror, wildcard, nonmind). A bot gap, not an engine bug: the extended bot
   walks stages 10 -> 16 between 1530 s and 2100 s with a few lines (verbs, 5 exchanges, a stance, mirror when affordable).
3. Even the extended bot never reaches stage 17: it needs overwhelm >= 1, i.e. complexity >= 1.6 x capacity. At 5400 s it has complexity ~260 vs capacity 232
   (overwhelm 0.2) and climbs only ~0.1 per 900 s, so stage 17 sits well beyond a 90 minute session. The final gate looks too far from the bot's growth curve.
4. Affect explodes (about 2e13 by 5400 s, ~1600 habits) and has no sink for the default bot: every upgrade is bought by ~stage 10 and mirrors are never bought.
   For the extended bot, 8 mirrors are bought (cost 1e6 * 40^n) which multiplies affect by 2^8 but also scales stressors by 1 + 0.5 per mirror, so combat gets worse.
5. Complexity is nearly flat for the default bot (about 120 vs capacity 160, overwhelm 0.00 for the whole run). Flat numbers: level, max link (twin genomes
   are rare once the bot starts integrating), wave. Exploding numbers: affect, habit counts, stressor scale beyond gw 13.
6. Meta loop is inverted: capacityOf grows with mu (160 -> 384 -> 507 over three runs) so each reset makes overwhelm harder, while peak complexity (~120)
   and mu gain (13-14) stay identical every run. Runs 2 and 3 hit stage 6 / stage 10 at about the same time as run 1 (t@stage columns): the (1 + 0.04 mu)
   multiplier is too weak to be felt, so prestige gives no visible acceleration, and the bot never resets by overwhelm (all three runs end by timeout).
7. Engine note: actions.nonMind is not stage-gated (logged in docs/team-log.md).`);
