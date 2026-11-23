// Balance probe. Run: node tests/game/balance.mjs
// 1. extended bot (default bot + verbs, exchange, stance, mirror), 10 seeds x 5400 s, sampled every 300 s, median over seeds.
// 2. three consecutive runs with resets (nonMind at overwhelm >= 1 or at 3600 s).
import { createGame, step, defaultBot, actions, STAGES, VERBS, unlocked, mirrorCost, attendantCost, habitCost, HABITS, UPGRADES } from '../../src/game/index.js';
import { aspectTiers } from '../../src/game/battle.js';

const DT = 0.1, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].slice(0, +process.env.NM_SEEDS || 10), HORIZON = +process.env.NM_HORIZON || 5400, EVERY = 300; // env NM_SEEDS / NM_HORIZON shorten iteration runs
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

const WAVEW = {}; // per global wave [wins, losses] in section 1
// Advance one tick: bot, step, tally wave results and stage arrivals (several stages can unlock in a single tick).
function tick(G, t, bot, tally, first) {
  bot(G, t);
  const before = G.stage, gw0 = G.battle?.gw;
  step(G, DT);
  for (const e of G.events) { if (e.type === 'waveWin') { tally.win++; if (G.stage < 17) { (WAVEW[gw0] ||= [0, 0])[0]++; } } else if (e.type === 'waveLose') { tally.lose++; if (G.stage < 17) { (WAVEW[gw0] ||= [0, 0])[1]++; } } }
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
  if (unlocked(G, 'exchange') && G.stats.exchanges < 3 + 2) { if (G.insight < G.insightMax - 12 && G.attention >= 1) actions.exchange(G, 'attention', 'insight'); else if (G.insight >= 25) actions.exchange(G, 'insight', 'attention'); }
  if (unlocked(G, 'stance') && !G.stance) actions.chooseStance(G, 'toward');
  if (unlocked(G, 'mirror') && G.affect >= mirrorCost(G)) actions.mirror(G);
  // echo needs a seated hybrid: swap the weakest seated pure leaf for a benched hybrid between waves
  if (G.stage >= 12 && G.phase !== 'fight' && G.units.filter((u) => u.seat && u.g.t === 'node').length < 2) {
    if (G.units.filter((u) => u.g.t === 'node' && !u.busy).length < 2 || (G.stats.echoes < 5 && G.units.filter((u) => u.seat && u.g.t === 'node').length === 0)) { const b = G.units.filter((u) => !u.seat && !u.busy); if (b.length >= 2) actions.integrate(G, b[0].id, b[1].id); }
    const h = G.units.find((u) => !u.seat && !u.busy && u.g.t === 'node'), l = G.units.filter((u) => u.seat && u.g.t !== 'node').sort((a, b) => a.link - b.link)[0];
    if (h && l) actions.place(G, h.id, l.seat);
  }
}

// ---------- 1 ----------
console.log('== 1. Single run, extended bot, median of 10 seeds ==');
const rows = {}, first1 = {}, M = {};
// most expensive purchase the player could currently see (habits, upgrades, attendant, mirror)
function topPrice(G) {
  let p = 0;
  if (unlocked(G, 'habits')) for (const h of HABITS) p = Math.max(p, habitCost(G, h));
  for (const u of UPGRADES) if (!G.upgrades[u.id] && G.stage >= u.stage) p = Math.max(p, u.cost);
  if (unlocked(G, 'attendants')) p = Math.max(p, attendantCost(G));
  if (unlocked(G, 'mirror')) p = Math.max(p, mirrorCost(G));
  return p;
}
for (const seed of SEEDS) {
  const G = createGame(seed), tally = { win: 0, lose: 0 }; let next = EVERY; first1[seed] = {};
  const m = (M[seed] = { win: [], lose: [], ratio: [], maxLink: 0, mirrorsAt17: null, tiersBefore: [], tiersAfter: [], wildW: 0, wildL: 0, preW: 0, preL: 0 });
  for (let t = 0; t < HORIZON; t += DT) {
    const live = G.stage < 17, w = Math.floor(G.t / EVERY), w0 = tally.win, l0 = tally.lose;
    tick(G, t, extendedBot, tally, first1[seed]);
    if (live) {
      m.win[w] = (m.win[w] || 0) + tally.win - w0; m.lose[w] = (m.lose[w] || 0) + tally.lose - l0;
      if (Math.round(G.t * 10) % 100 === 0) { const tp = topPrice(G); if (tp > 0) m.ratio[w] = Math.max(m.ratio[w] || 0, G.affect / tp); }
      m.maxLink = Math.max(m.maxLink, maxLink(G));
      if (G.stage < 16 && G.stage >= 14) { m.preW += tally.win - w0; m.preL += tally.lose - l0; }
    } else if (m.mirrorsAt17 === null) m.mirrorsAt17 = G.mirrors;
    // wildcard probe samples every stage >= 16 (16 and 17 can arrive in one tick, so it must not depend on `live`); first 10 min of it
    if (G.stage >= 16 && G.t < (m.t16 ??= G.t) + 600) {
      m.wildW += tally.win - w0; m.wildL += tally.lose - l0;
      if (Math.round(G.t * 10) % 100 === 0) { const a = aspectTiers(G), b = aspectTiers({ ...G, stage: 15 }); const sum = (x) => Object.keys(x).filter((k) => !k.endsWith('_n')).reduce((n, k) => n + (+x[k] || 0), 0); m.tiersAfter.push(sum(a)); m.tiersBefore.push(sum(b)); }
    }
    if (G.t >= next) { (rows[next] ||= []).push(snap(G, tally)); next += EVERY; }
  }
  if (m.mirrorsAt17 === null) m.mirrorsAt17 = G.mirrors;
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
if (process.env.NM_SEEDLINES) console.log('  win% per global wave:', Object.keys(WAVEW).slice(0, 25).map((g) => `${g}:${Math.round(100 * WAVEW[g][0] / (WAVEW[g][0] + WAVEW[g][1]))}`).join(' '));
{ // which gate stalls: per stage, the longest wait after minute 5 across seeds
  const w = []; for (let s = 2; s <= 17; s++) { const d = SEEDS.map((k) => (first1[k][s] ?? Infinity) - Math.max(300, first1[k][s - 1] ?? 0)).filter((x) => Number.isFinite(x) && x > 0); if (d.length) w.push(`${s}:${Math.round(Math.max(...d))}s`); }
  console.log('  longest wait per stage after min 5 (s):', w.join(' '));
  if (process.env.NM_SEEDLINES) for (const s of [6, 7, 10, 13, 15, 16, 17]) console.log(`  stage ${s} per seed:`, SEEDS.map((k) => Math.round(first1[k][s])).join(' '));
}

// ---------- 2 ----------
console.log('\n== 2. Three consecutive runs with resets (extended bot; nonMind on reaching stage 17 or after 5400 s) ==');
const RUNS = 3, RESET_AT = 5400, S2 = SEEDS.slice(0, 5);
const perRun = Array.from({ length: RUNS }, () => []);

for (const seed of S2) {
  let G = createGame(seed);
  for (let r = 0; r < RUNS; r++) {
    const tally = { win: 0, lose: 0 }, first = {}; let reason = 'time';
    for (let t = 0; t < RESET_AT; t += DT) { tick(G, t, extendedBot, tally, first); if (G.stage >= 17) { reason = "overwhelm"; break; } }
    const N = actions.nonMind(G);
    perRun[r].push({ ...snap(G, tally), reason, t: G.t, endings: G.endings, gain: N.mu - G.mu, t10: first[10] ?? NaN, t17: first[17] ?? NaN, t6: first[6] ?? NaN });
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
* Runs 1-3 (section 2): compare the t@stage columns and the "ends@s" / "by" columns; "ovw" means the run ended by overwhelm before 5400 s.
* Check W/L in section 1 for whether combat still walls the bot out of progression.`);


// ---------- goals ----------
console.log('\n== Goals ==');
const P = (ok) => (ok ? 'PASS' : 'FAIL');
const goals = [];
const goal = (n, ok, msg) => { goals.push(ok); console.log(`G${n} ${P(ok)}  ${msg}`); };
{
  const allReached = SEEDS.every((k) => first1[k][17] !== undefined);
  const gaps = SEEDS.map((k) => { let g = 0, prev = 0; for (let s = 1; s <= 17; s++) { const t = first1[k][s]; if (t === undefined) { g = Infinity; break; } if (t > 300) g = Math.max(g, t - Math.max(prev, 300)); prev = t; } return g; });
  const t17 = median(reached17) / 60, mg = median(gaps) / 60;
  goal(1, allReached && t17 >= 25 && t17 <= 45 && Math.max(...gaps) <= 360, `stage17 in ${reached17.length}/${SEEDS.length} seeds, median ${fmt(t17)} min (want 25-45); largest stage gap after min 5: median ${fmt(mg)}, worst ${fmt(Math.max(...gaps) / 60)} min (want <= 6)`);
  const mir = SEEDS.map((k) => M[k].mirrorsAt17);
  goal(2, mir.every((x) => x >= 1 && x <= 3), `mirrors bought by stage 17 per seed: [${mir}] (want each 1-3)`);
  const dT = median(SEEDS.flatMap((k) => M[k].tiersAfter.map((x, i) => x - M[k].tiersBefore[i])));
  const wt = median(SEEDS.flatMap((k) => M[k].tiersAfter));
  const wW = SEEDS.reduce((n, k) => n + M[k].wildW, 0), wL = SEEDS.reduce((n, k) => n + M[k].wildL, 0), pW = SEEDS.reduce((n, k) => n + M[k].preW, 0), pL = SEEDS.reduce((n, k) => n + M[k].preL, 0);
  goal(3, dT >= 1 && wt < 16, `wildcard adds median ${dT} aspect tiers (sum of tiers ${wt}/24 after); win rate stage14-15 ${fmt(100 * pW / Math.max(1, pW + pL), 0)}% -> stage16+ ${fmt(100 * wW / Math.max(1, wW + wL), 0)}%`);
  const wins = []; let badWin = 0, rt = [];
  for (let w = 0; w < HORIZON / EVERY; w++) {
    const W = SEEDS.reduce((n, k) => n + (M[k].win[w] || 0), 0), L = SEEDS.reduce((n, k) => n + (M[k].lose[w] || 0), 0);
    if (W + L < 20) continue; const r = W / (W + L); wins.push(`${w * 5}m:${fmt(100 * r, 0)}%`); if (r < 0.55 || r > 0.9) badWin++;
    const rr = Math.max(...SEEDS.map((k) => M[k].ratio[w] || 0)); rt.push(`${w * 5}m:${fmt(rr, 0)}x`);
  }
  goal(4, badWin === 0, `win rate per 5-min window (pooled, pre-stage17): ${wins.join(' ')} (want all 55-90)`);
  goal(5, rt.every((x) => parseFloat(x.split(':')[1]) <= 1000), `max affect / top available price per window: ${rt.join(' ')} (want <= 1000x)`);
  const ml = SEEDS.map((k) => M[k].maxLink), mlm = median(ml);
  const end3 = perRun[2].filter((x) => x.endings >= 1).length + 0;
  const everEnd = S2.filter((_, i) => perRun.some((r) => r[i].endings >= 1)).length;
  goal(6, mlm >= 6 && mlm <= 9 && ml.every((x) => x <= 9 && x >= 6) && everEnd >= Math.ceil(S2.length / 2), `max link run1 per seed [${ml}] (want 6-9); seeds with an ending by run 3: ${everEnd}/${S2.length}`);
  const tt = [0, 1, 2].map((r) => median(perRun[r].map((x) => (Number.isFinite(x.t17) ? x.t17 : RESET_AT))));
  const gains = [0, 1, 2].map((r) => median(perRun[r].map((x) => x.gain)));
  const f2 = 1 - tt[1] / tt[0], f3 = 1 - tt[2] / tt[0];
  goal(7, f2 >= 0.25 && f2 <= 0.6 && f3 >= 0.25 && f3 <= 0.6 && gains[0] < gains[1] && gains[1] < gains[2], `time to stage17 by run [${tt.map((x) => Math.round(x))}] s, faster by ${fmt(100 * f2, 0)}% / ${fmt(100 * f3, 0)}% (want 25-60); mu gain [${gains}] (want rising)`);
}
console.log(`\n${goals.filter(Boolean).length}/7 goals pass`);
