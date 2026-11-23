// The advisor: when the player has been still for a while, the game offers one quiet suggestion at a
// time. Pure functions over the game state: the UI decides how to show them (an arrow, a line of text)
// and for how long. Every suggestion names a `target` the HUD can anchor to and is TRUE to the rules:
// a thing is only suggested when it can actually be done right now.
import { FAMILY, HABITS, UPGRADES, SPELLS, VERBS, TIER_COST, COSTS, ASPECTS } from './data.js';
import { key, aspectsOf, nameOf } from './genome.js';
import { unlocked, unitCap, habitCost, attendantCost, mirrorCost, muGain, BENCH } from './game.js';

const bench = (G) => G.units.filter((u) => !u.seat && !u.busy);
const seated = (G) => G.units.filter((u) => u.seat);
// a shop slot the player can really buy right now (mirrors actions.buy)
const buyable = (G, id) => { const f = id && FAMILY[id]; return !!f && G.attention >= TIER_COST[f.tier - 1] && (G.units.filter((u) => !u.seat).length < BENCH || G.units.some((u) => !u.busy && u.link === 1 && key(u.g) === f.id)); };
const dread = (G) => G.moods.filter((m) => m.kind === 'dread').length;

// Each rule returns null or { id, target, weight, text (oblique), plain (what to do) }.
// Targets: attend | shop:<i> | reroll | xp | unit:<id> | seat | op:<integrate|subtract|split|repurpose>:<id>
//          habit:<id> | upgrade:<id> | spell:<id> | verb:<id>:<unitId> | stance | mirror | attendant | reset | lineage | codex
const RULES = [
  (G) => G.cardOffer && { id: `card-${G.cardOffer.id}`, target: 'card', weight: 85, text: 'Something has drifted in that was not sent.', plain: 'A card is floating over the sea. Click it before it leaves.' },
  (G) => G.overwhelm >= 1 && { id: 'reset-now', target: 'reset', weight: 100, text: 'It is too much. It was always this much.', plain: `Let go: NON-MIND returns you to simple and keeps ${muGain(G)} residue.` },
  (G) => G.overwhelm > 0.6 && G.overwhelm < 1 && { id: 'reset-soon', target: 'reset', weight: 40, text: 'The vessel is nearly full of what you made, and humming.', plain: 'Complexity is close to capacity. Resetting is a reward, not a loss.' },
  (G) => {
    if (!unlocked(G, 'shop')) return null;
    // a twin in the shop that would fuse with something you hold is the best buy there is
    for (let i = 0; i < G.shop.length; i++) {
      const f = FAMILY[G.shop[i]]; if (!f || G.attention < TIER_COST[f.tier - 1]) continue;
      if (G.units.some((u) => !u.busy && u.link === 1 && key(u.g) === f.id)) return { id: `twin-${f.id}`, target: `shop:${i}`, weight: 70, text: `Two of ${f.name} would not stay two.`, plain: `Buy ${f.name}: it fuses with the one you have and climbs a link.` };
    }
    return null;
  },
  (G) => {
    const b = bench(G);
    if (!b.length || seated(G).length >= unitCap(G)) return null;
    return { id: 'seat', target: `unit:${b[0].id}`, weight: 65, text: `${nameOf(b[0].g)} is waiting by the door to be somewhere.`, plain: 'Select it, then click an empty ring on the sea to seat it.' };
  },
  (G) => { const i = G.shop.findIndex((id) => buyable(G, id)); return !seated(G).length && unlocked(G, 'shop') && i >= 0 && { id: 'first-buy', target: `shop:${i}`, weight: 80, text: 'Nothing is seated. The gates will not wait for that.', plain: 'Buy an arrival: it takes a seat by itself.' }; },
  (G) => {
    if (!unlocked(G, 'shop')) return null;
    const room = true;
    const i = G.shop.findIndex((id) => buyable(G, id));
    return room && i >= 0 && G.attention >= 4 && { id: 'buy', target: `shop:${i}`, weight: 30, text: 'Attention unspent is attention unheld.', plain: `You can afford ${FAMILY[G.shop[i]].name}.` };
  },
  (G) => unlocked(G, 'shop') && G.level < 10 && G.attention >= COSTS.xp + 10 && seated(G).length >= unitCap(G) && { id: 'grow', target: 'xp', weight: 45, text: 'Every seat is taken. There could be more seats.', plain: 'GROW raises your level: one more regulator can be held, and rarer ones arrive.' },
  (G) => unlocked(G, 'shop') && G.attention >= COSTS.reroll + 6 && !G.shop.some((id) => id && G.units.some((u) => key(u.g) === id)) && { id: 'look', target: 'reroll', weight: 18, text: 'What arrives is not all that could arrive; others wait further down the shore.', plain: 'LOOK shows five other arrivals.' },
  (G) => {
    if (!unlocked(G, 'habits')) return null;
    const h = HABITS.filter((x) => G.affect >= habitCost(G, x)).sort((a, b) => b.prod / habitCost(G, b) - a.prod / habitCost(G, a))[0];
    return h && { id: `habit-${h.id}`, target: `habit:${h.id}`, weight: 35, text: 'What repeats, remains.', plain: `You can afford another ${h.name}: it yields affect while you do nothing.` };
  },
  (G) => { const u = UPGRADES.find((x) => !G.upgrades[x.id] && G.stage >= x.stage && G.affect >= x.cost); return u && { id: `up-${u.id}`, target: `upgrade:${u.id}`, weight: 50, text: u.text, plain: `The upgrade ${u.name} is within reach.` }; },
  (G) => {
    if (!unlocked(G, 'integrate')) return null;
    const b = bench(G);
    const ok = !unlocked(G, 'insight') || G.insight >= COSTS.integrate;
    return b.length >= 2 && ok && { id: 'integrate', target: `op:integrate:${b[0].id}`, weight: 42, text: 'Two that lean together are not two.', plain: `Select ${nameOf(b[0].g)}, choose Integrate, then pick ${nameOf(b[1].g)}: one new body, both natures.` };
  },
  (G) => { const h = G.units.find((u) => u.g.t === 'node' && !u.busy); return unlocked(G, 'split') && h && G.stats.splits < 1 && G.insight >= COSTS.split && G.units.filter((u) => !u.seat).length < BENCH && { id: 'split', target: `op:split:${h.id}`, weight: 28, text: 'What was joined remembers the warmth of its seam.', plain: `Select ${nameOf(h.g)} and Split it back into its two parts.` }; },
  (G) => { const b = bench(G); return unlocked(G, 'subtract') && b.length >= 2 && G.stats.subtractions < 1 && G.insight >= COSTS.subtract && { id: 'subtract', target: `op:subtract:${b[0].id}`, weight: 28, text: 'To take in is to be shaped, gently, by the taken.', plain: 'Select one, choose Subtract, pick another: the second is carved out of the first.' }; },
  (G) => { const b = bench(G); return unlocked(G, 'repurpose') && b.length >= BENCH - 2 && { id: 'repurpose', target: `op:repurpose:${b[b.length - 1].id}`, weight: 38, text: 'A function is a habit of a form.', plain: 'The waiting row is nearly full. Repurpose one: it becomes habits that yield forever.' }; },
  (G) => { const s = SPELLS.find((x) => G.insight >= x.cost); return unlocked(G, 'insight') && G.insight >= G.insightMax * 0.95 && s && G.phase === 'fight' && { id: 'spell', target: `spell:${s.id}`, weight: 33, text: 'Insight held is insight not had.', plain: `Insight is full. ${s.name}: ${s.text}` }; },
  (G) => {
    if (!unlocked(G, 'verbs')) return null;
    const free = bench(G);
    for (const v of VERBS) {
      if (G.verbs[v.id]) continue;
      if (v.id === 'rest' && !dread(G)) continue;
      const u = free.find((x) => !v.needs || aspectsOf(x.g).includes(v.needs) || x.traits.includes('fade'));
      if (u) return { id: `verb-${v.id}`, target: `verb:${v.id}:${u.id}`, weight: v.id === 'rest' ? 55 : 26, text: v.text, plain: `${nameOf(u.g)} could ${v.name}${v.needs ? ` (it is ${ASPECTS[v.needs].name})` : ''}.` };
    }
    return null;
  },
  (G) => unlocked(G, 'stance') && !G.stance && { id: 'stance', target: 'stance', weight: 60, text: 'A stance is a house worn close, like a coat in the cold.', plain: 'Choose Toward, Away or Against. Each bends every regulator.' },
  (G) => unlocked(G, 'mirror') && G.affect >= mirrorCost(G) && { id: 'mirror', target: 'mirror', weight: 48, text: 'The same assembly, in every direction.', plain: 'A mirror doubles yield and adds seats. Waves weigh more, too.' },
  (G) => unlocked(G, 'attendants') && G.affect >= attendantCost(G) && { id: 'attendant', target: 'attendant', weight: 32, text: 'Attention can be lent.', plain: 'An attendant attends for you, forever.' },
  (G) => { const canInt = unlocked(G, 'integrate') && bench(G).length >= 2 && (!unlocked(G, 'insight') || G.insight >= COSTS.integrate), canXp = G.attention >= COSTS.xp && G.level < 10; return (G.habituation || 0) >= 3 && (canInt || canXp) && { id: 'stuck', target: canInt ? `op:integrate:${bench(G)[0].id}` : 'xp', weight: 52, text: 'The same wave, again. It is softer each time. So could you be different.', plain: 'A wave not held softens by itself. Fusing, integrating or growing changes you.' }; },
  (G) => G.stats.links + G.stats.integrations >= 3 && { id: 'lineage', target: 'lineage', weight: 8, text: 'Everything here came from something here, and was once held.', plain: 'The Lineage map shows what you have grown and what it grew from.' },
  (G) => G.stage >= 2 && { id: 'codex', target: 'codex', weight: 6, text: 'Some of this is written down, for whoever comes later.', plain: 'The Codex opens a little more with every stage.' },
  (G) => ({ id: 'attend', target: 'attend', weight: 10, text: 'Something is here. Attend to it.', plain: 'Click the core or press Space: attention is where affect comes from.' }),
];

// All suggestions that are valid right now, strongest first.
export function suggestions(G) {
  const out = [];
  for (const r of RULES) { let s = null; try { s = r(G); } catch { s = null; } if (s) out.push(s); }
  return out.sort((a, b) => b.weight - a.weight);
}

// Rotation with memory: prefers strong suggestions but will not repeat one within `cooldown` seconds,
// so a patient player is walked through everything that is currently possible.
// `memory` is a plain object the caller keeps: { [id]: lastShownTime }. `now` is in seconds.
export function nextSuggestion(G, memory = {}, now = 0, cooldown = 90) {
  const list = suggestions(G);
  let best = null, bestScore = -Infinity;
  for (const s of list) {
    const since = now - (memory[s.id] ?? now - 600); // never shown counts as ten minutes unseen
    if (since < (s.weight >= 90 ? 40 : cooldown)) continue; // urgent ones return sooner, but still take turns
    // urgent first; otherwise weight plus staleness, which grows until even the quietest suggestion gets its turn
    const score = s.weight + Math.min(since, 7200) / 6 + (s.weight >= 90 ? 1000 : 0);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (best) memory[best.id] = now;
  return best;
}

export const IDLE_BEFORE_SUGGESTING = 25; // seconds without input before the first suggestion
export const SUGGESTION_LIFETIME = 15; // seconds a suggestion stays before it fades
export const SUGGESTION_GAP = 6; // quiet seconds between two suggestions
