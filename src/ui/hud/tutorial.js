// Guided tutorial: steps, persistence. Every step has a voice line (true, oblique) and a plain line
// (exactly what to press). Core steps run in order; intros appear the first time a system unlocks.
import { unlocked } from '../../game/index.js';

export const TUT_KEY = 'non-mind-tutorial-v1';

const seatedN = (G) => G.units.filter((u) => u.seat).length;
const isSfx = (name) => (e) => e.type === 'sfx' && e.name === name;

export const CORE = [
  {
    id: 'attend', anchor: 'attend', also: 'core', side: 'left',
    voice: 'Something is here. It wants to be looked at.',
    plain: (G) => `Click ATTEND, click the glowing core, or press SPACE.${G.stats.clicks > 0 ? ` ${Math.max(0, 5 - G.stats.clicks)} more.` : ''}`,
    touch: (G) => `Tap ATTEND or the glowing core.${G.stats.clicks > 0 ? ` ${Math.max(0, 5 - G.stats.clicks)} more.` : ''}`,
    done: (G) => unlocked(G, 'shop'),
  },
  {
    id: 'buy', anchor: 'shop',
    voice: 'What arrives can be brought in.',
    plain: 'Click a card, or press 1 to 5. The yellow coin is its price in attention.',
    touch: 'Tap a card in ARRIVALS. The yellow coin is its price in attention.',
    when: (G) => unlocked(G, 'shop'),
    on: (e) => e.type === 'unitNew',
    done: (G) => G.units.length > 0,
  },
  {
    id: 'seat', anchor: 'core',
    voice: 'It has taken a place in the circle by itself.',
    plain: 'To move one: click it in the circle, then click an empty seat on the ring.',
    touch: 'To move one: tap it in the circle, then tap an empty seat on the ring.',
    when: (G) => seatedN(G) > 0,
    on: isSfx('place'), ack: true,
  },
  {
    id: 'wave', anchor: 'wave',
    voice: 'Nothing needs pressing. The weather comes through the gates.',
    plain: 'Waves start on their own. The ten dots are its beats; the line above is this wave\'s rule.',
    when: (G) => seatedN(G) > 0,
    on: (e) => e.type === 'waveWin' || e.type === 'waveLose', ack: true,
  },
  {
    id: 'fuse', anchor: 'shop',
    voice: 'Two alike are one, further along.',
    plain: 'Buy a second copy of a unit you already own (same name): the two merge into one stronger unit.',
    on: (e) => e.type === 'link', ack: true,
    done: (G) => G.stats.links > 0,
  },
  {
    id: 'attention', anchor: 'lookgrow',
    voice: 'Attention is paid for holding. Unspent, it gathers more.',
    plain: 'Yellow is attention. Every 10 you keep adds 1 after a held wave. LOOK (R) brings new arrivals; GROW (X) raises your level.',
    touch: 'Yellow is attention. Every 10 you keep adds 1 after a held wave. LOOK brings new arrivals; GROW raises your level.',
    on: (e) => isSfx('reroll')(e) || e.type === 'level', ack: true,
  },
  {
    id: 'habits', anchor: 'tab-habits', tab: 'habits',
    voice: 'What repeats, remains.',
    plain: 'In HABITS, press +1 on Breath. Habits make affect every second without clicking.',
    when: (G) => unlocked(G, 'habits'),
    done: (G) => G.habitsOwned > 0, ack: true,
  },
];

// One callout per later system, the first time it appears. `key` is the STAGES unlock it waits for.
export const INTROS = [
  { id: 'integrate', key: 'integrate', anchor: 'bench', voice: 'Two shapes can be pressed into one.', plain: 'Select a unit, press INTEGRATE in the panel on the right, then click a second unit.', done: (G) => G.stats.integrations > 0 },
  { id: 'repurpose', key: 'repurpose', anchor: 'bench', voice: 'A thing can become a habit instead.', plain: 'Select a unit you do not need and press REPURPOSE: it turns into habits.', done: (G) => G.stats.repurposes > 0 },
  { id: 'insight', key: 'insight', anchor: 'chip-insight', tab: 'insight', voice: 'Insight seeps in on its own.', plain: 'Insight (blue) pays for joining, splitting, and the spells in the INSIGHT tab.' },
  { id: 'split', key: 'split', anchor: 'bench', voice: 'What was joined still has its seam.', plain: 'Select a merged unit and press SPLIT to get its parts back. It costs 10 insight.', done: (G) => G.stats.splits > 0 },
  { id: 'ring2', key: 'ring2', anchor: 'core', voice: 'The circle has a second ring.', plain: 'Select a unit, then click an empty seat on the outer ring to place it there.', touch: 'Tap a unit, then tap an empty seat on the outer ring to place it there.' },
  { id: 'subtract', key: 'subtract', anchor: 'bench', voice: 'One can be carved out of another.', plain: 'Select a unit, press SUBTRACT, then click the unit to carve away. The first keeps one of its traits.', done: (G) => G.stats.subtractions > 0 },
  { id: 'attendants', key: 'attendants', anchor: 'tab-attendants', tab: 'attendants', voice: 'Attention can be lent out.', plain: 'In OTHERS, press LEND: each helper attends once a second for you.', done: (G) => G.attendants > 0 },
  { id: 'verbs', key: 'verbs', anchor: 'tab-verbs', tab: 'verbs', voice: 'Some things take time and come back changed.', plain: 'Select a unit, then press GIVE on a verb. The ring counts down; the moods it leaves fade on their own.', done: (G) => G.stats.verbsDone > 0 || Object.values(G.verbs).some(Boolean) },
  { id: 'exchange', key: 'exchange', anchor: 'tab-exchange', tab: 'exchange', voice: 'Each thing kept can buy the others, poorly.', plain: 'In TRADE, swap affect, attention and insight at the listed rates.' },
  { id: 'echo', key: 'echo', anchor: null, voice: 'Joined shapes now use both of their gifts.', plain: 'Nothing to press: a merged unit also casts its second family\'s ability, at half strength.' },
  { id: 'stance', key: 'stance', anchor: 'tab-stance', tab: 'stance', voice: 'How it stands changes what holds.', plain: 'In STANCE, pick one of three. Each makes one thing stronger and another weaker.', done: (G) => !!G.stance },
  { id: 'seasons', key: 'seasons', anchor: 'chip-attention', voice: 'Every minute, something asks for three.', plain: 'Every 60 seconds a season takes 3 attention. With fewer than 3, you get a Dread instead.' },
  { id: 'mirror', key: 'mirror', anchor: 'tab-mirror', tab: 'mirror', voice: 'The whole of it can be reflected.', plain: 'In MIRROR, REFLECT doubles affect and opens a third ring. Stressors grow too.' },
  { id: 'wildcard', key: 'wildcard', anchor: 'tab-bonds', tab: 'bonds', voice: 'Every aspect counts one more than is there.', plain: 'Nothing to press: each bond counts one extra member, so its tiers come sooner.' },
  { id: 'overwhelm', when: (G) => G.overwhelm > 0, anchor: 'complexity', voice: 'It is getting to be too much.', plain: 'Complexity is past capacity: waves hit harder. Merge, release or repurpose units to bring it down.' },
  { id: 'nonmind', key: 'nonmind', anchor: 'reset', voice: 'It is too much. It can be let go.', plain: 'Press NON-MIND to start over with mu, which speeds up the next run. Right now it keeps double.' },
].map((s) => ({ ...s, ack: true, intro: true, when: s.when || ((G) => unlocked(G, s.key)) }));

export const STEPS = [...CORE, ...INTROS];

// which mobile sheet holds a step's anchor
export const SHEET_OF = { shop: 'shop', lookgrow: 'shop', bench: 'bench' };

export function loadTut() {
  try {
    const d = JSON.parse(localStorage.getItem(TUT_KEY) || '{}');
    return { done: d.done || [], off: !!d.off };
  } catch { return { done: [], off: false }; }
}
export function saveTut(t) {
  try { localStorage.setItem(TUT_KEY, JSON.stringify(t)); } catch { /* storage blocked: tutorial just won't persist */ }
}

/** The step to show now, or null. Core steps go strictly in order; intros wait until no core step is waiting. */
export function activeStep(G, t) {
  if (t.off) return null;
  const done = new Set(t.done);
  for (const s of CORE) {
    if (done.has(s.id)) continue;
    return !s.when || s.when(G) ? s : null;
  }
  for (const s of INTROS) if (!done.has(s.id) && s.when(G)) return s;
  return null;
}
