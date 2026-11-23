// NON-MIND stressor variety: affixes, extra base stressors, and the roller.
// Pure data plus one small roller. Depends on nothing.

const A = (id, name, text, mod, minWave, weight, behavior = null) => ({ id, name, text, mod, minWave, weight, behavior });

export const STRESSOR_AFFIXES = [
  A('unread', 'Unread', 'It waits to be opened. Waiting is its weight.', { tol: 1.1, opa: 10 }, 1, 10),
  A('inherited', 'Inherited', 'It was handed down before you had hands.', { tol: 1.4, speed: 0.85 }, 2, 8),
  A('three_am', '3 A.M.', 'The hour makes it larger than the room.', { sal: 1.5, opa: 15 }, 4, 7),
  A('anticipated', 'Anticipated', 'It arrives twice: once as fear, once as itself.', { lat: 0.7, sal: 1.15 }, 3, 9),
  A('rehearsed', 'Rehearsed', 'Said so often in the mind, it is word-perfect.', { lat: 0.8, reach: 1.15 }, 3, 8),
  A('recurring', 'Recurring', 'It fell once. It was not finished.', { tol: 0.9 }, 5, 7, 'returns'),
  A('unspoken', 'Unspoken', 'What is not said keeps its shape.', { opa: 25, sal: 1.2 }, 4, 8),
  A('borrowed', 'Borrowed', 'Not yours. Carried anyway.', { tol: 0.8, speed: 1.1 }, 1, 9),
  A('imagined', 'Imagined', 'Nothing there, yet it strikes.', { tol: 0.5, sal: 1.4, opa: 20 }, 2, 8),
  A('sunk', 'Sunk', 'Already paid for. Still collecting.', { tol: 1.5, speed: 0.7 }, 6, 6, 'anchors'),
  A('quiet', 'Quiet', 'It makes no sound. You hear it anyway.', { opa: 30, speed: 0.9 }, 3, 8),
  A('ambient', 'Ambient', 'Everywhere a little. Nowhere enough to name.', { reach: 1.4, sal: 0.8 }, 5, 7),
  A('forgotten', 'Forgotten', 'Remembered only by the way you flinch.', { opa: 35, lat: 0.9 }, 8, 6),
  A('half_heard', 'Half-Heard', 'The missing half is the louder.', { opa: 20, sal: 1.25 }, 4, 8, 'veils'),
  A('swelling', 'Swelling', 'Each look adds a little to it.', { tol: 1.25, sal: 1.15 }, 7, 7),
  A('hurried', 'Hurried', 'It does not care that you are not ready.', { speed: 1.5, tol: 0.85 }, 2, 9),
  A('contagious', 'Contagious', 'It carries its hurry to its neighbours.', { speed: 1.15 }, 9, 6, 'hastens'),
  A('doubled', 'Doubled', 'It arrives as itself and as its echo.', { tol: 0.85, lat: 1.1 }, 10, 6, 'echoes'),
  A('fractured', 'Fractured', 'Struck, it becomes several smaller ones.', { tol: 0.9, sal: 0.9 }, 8, 6, 'splits'),
  A('unfinished', 'Unfinished', 'A sentence that will not end.', { tol: 1.15, lat: 1.2 }, 5, 7),
  A('overdue', 'Overdue', 'It has been late for so long it is early again.', { speed: 1.35, sal: 1.2 }, 6, 7),
  A('ordinary', 'Ordinary', 'Too common to notice, too common to leave.', { tol: 1.3, sal: 0.7 }, 1, 10),
  A('first', 'First', 'Nothing yet to compare it with.', { sal: 1.6, tol: 0.7 }, 2, 6),
  A('last', 'Last', 'After it, you expect nothing. That is the cost.', { tol: 1.6, speed: 0.75 }, 20, 4),
  A('weathered', 'Weathered', 'Rain has made it smoother, not softer.', { tol: 1.35, reach: 0.9 }, 9, 7),
  A('hollow', 'Hollow', 'Empty, and it still takes up the room.', { tol: 0.6, opa: 15, reach: 1.3 }, 6, 7),
  A('tender', 'Tender', 'It hurts to be near because it hurts to be it.', { sal: 1.7, tol: 0.6 }, 12, 5),
  A('guarded', 'Guarded', 'It keeps its footing. Nothing moves it.', { tol: 1.2, opa: 5 }, 14, 6, 'anchors'),
  A('wordless', 'Wordless', 'No name to call it by, so it keeps coming.', { opa: 40, lat: 0.85 }, 15, 5, 'veils'),
  A('slow_burning', 'Slow-Burning', 'Late, and then all at once.', { speed: 0.6, sal: 2.0 }, 11, 6),
  A('shared', 'Shared', 'Many carry it. It is not lighter.', { tol: 1.1, reach: 1.2 }, 7, 6, 'hastens'),
  A('ancestral', 'Ancestral', 'Older than the one it finds.', { tol: 1.8, speed: 0.7, lat: 1.3 }, 22, 4),
  A('mirrored', 'Mirrored', 'It wears your own face, slightly wrong.', { sal: 1.35, lat: 0.9 }, 13, 6, 'echoes'),
  A('veiled', 'Veiled', 'What it is stays behind what it seems.', { opa: 40, tol: 1.1 }, 10, 6, 'veils'),
  A('threadbare', 'Threadbare', 'Worn almost through. Still holds.', { tol: 0.55, speed: 1.2 }, 3, 8),
  A('bright', 'Bright', 'Pleasant at the front. The back is later.', { sal: 1.3, opa: 0 }, 16, 5),
  A('postponed', 'Postponed', 'Set aside. It kept growing on the shelf.', { tol: 1.5, sal: 1.3, speed: 0.8 }, 18, 5, 'returns'),
  A('reflexive', 'Reflexive', 'It lands before the thought of it.', { lat: 0.55, tol: 0.8 }, 12, 6),
  A('cumulative', 'Cumulative', 'No single one. Only the sum.', { tol: 1.4, sal: 1.4, lat: 1.2 }, 30, 4),
  A('unmarked', 'Unmarked', 'No date, no name, no grave. It still walks.', { opa: 40, tol: 1.6, sal: 1.5 }, 38, 3, 'returns'),
];

const E = (id, name, tol, sal, lat, speed, reach, form, color, value, boss) => {
  const o = { id, name, tol, sal, lat, speed, reach, form, color, value };
  if (boss) o.boss = true;
  return o;
};

export const STRESSOR_EXTRA = [
  E('clutter', 'Clutter', 140, 8, 1.1, 0.8, 1.4, 'blob', 'yolk', 1),
  E('silence', 'Silence', 220, 22, 1.7, 0.7, 1.2, 'blob', 'sky', 2),
  E('comparison', 'Comparison', 130, 20, 1.3, 1.2, 2.8, 'needle', 'teal', 2),
  E('obligation', 'Obligation', 380, 18, 1.5, 0.8, 1.1, 'weight', 'ink', 2),
  E('boredom', 'Boredom', 260, 6, 2.2, 0.5, 1.0, 'blob', 'rose', 1),
  E('hurry', 'Hurry', 70, 8, 0.6, 2.7, 1.0, 'dart', 'yolk', 1),
  E('noise', 'Noise', 110, 10, 0.8, 1.6, 1.8, 'burr', 'tangerine', 1),
  E('doubt', 'Doubt', 190, 26, 1.6, 0.9, 2.2, 'needle', 'violet', 2),
  E('loss', 'Loss', 900, 48, 2.1, 0.5, 1.2, 'weight', 'ultra', 5),
  E('lateness', 'Lateness', 90, 12, 0.7, 2.1, 1.1, 'dart', 'blood', 1),
  E('envy', 'Envy', 240, 28, 1.4, 1.0, 2.0, 'burr', 'leaf', 3),
  E('expectation', 'Expectation', 3200, 70, 1.8, 0.5, 1.5, 'weight', 'ink', 14, true),
  E('transition', 'Transition', 3600, 85, 1.5, 0.6, 1.8, 'blob', 'violet', 16, true),
  E('inadequacy', 'Inadequacy', 4200, 100, 1.9, 0.5, 1.4, 'maw', 'blood', 20, true),
];

// Affix chance: 0 at wave 3, rising linearly to 0.7 at wave 40, flat after.
export function affixChance(wave) {
  if (wave <= 3) return 0;
  return Math.min(0.7, ((wave - 3) / 37) * 0.7);
}

// rng: () => [0,1). pool: array of stressor defs (defaults to STRESSOR_EXTRA).
// Returns { def, affix|null }.
export function rollStressor(rng, globalWave, pool = STRESSOR_EXTRA) {
  const defs = pool && pool.length ? pool : STRESSOR_EXTRA;
  const def = defs[Math.floor(rng() * defs.length) % defs.length];
  let affix = null;
  if (rng() < affixChance(globalWave)) {
    const ok = STRESSOR_AFFIXES.filter((a) => a.minWave <= globalWave);
    const total = ok.reduce((s, a) => s + a.weight, 0);
    if (total > 0) {
      let r = rng() * total;
      for (const a of ok) {
        r -= a.weight;
        if (r < 0) { affix = a; break; }
      }
      if (!affix) affix = ok[ok.length - 1];
    }
  }
  return { def, affix };
}

export function stressorName(def, affix) {
  return affix ? `${affix.name} ${def.name}` : def.name;
}
