// Shared bots for functional tests. `extendedBot` is the balance probe's bot: the default bot plus the
// late-game systems (verbs, exchange, stance, mirror, seated hybrids for echoes). Keep in step with
// tests/game/balance.mjs, which carries its own copy.
import { defaultBot, actions, VERBS, unlocked, mirrorCost } from '../../src/game/index.js';

export function extendedBot(G, t) {
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

// A bot that also lets go: resets when overwhelmed (or after `maxRun` seconds), returning the new game.
export function resettingBot(G, t, maxRun = 3600) {
  extendedBot(G, t);
  if (G.overwhelm >= 1 || G.t > maxRun) return actions.nonMind(G);
  return G;
}
