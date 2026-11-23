// NON-MIND static data. Pure data, no logic.
// Structure: one center, 10 gates, 10 families, 12 links, 18 stages, 10 waves x 10 beats.

export const DIRECTIONS = 10;
export const BEATS_PER_WAVE = 10;
export const WAVES_PER_CYCLE = 10;

// The 18-stage loop. Each stage unlocks one system; `need` is checked against the run.
export const STAGES = [
  { id: 'appear', unlock: 'attend', hint: 'Something is here. Attend to it.' },
  { id: 'explore', unlock: 'shop', hint: 'What arrives can be seated.', need: (g) => g.stats.clicks >= 5 },
  { id: 'grow', unlock: 'habits', hint: 'What repeats, remains.', need: (g) => g.wave >= 2 || g.stats.kills >= 6 },
  { id: 'combine', unlock: 'integrate', hint: 'Two that agree are not two.', need: (g) => g.stats.links >= 1 },
  { id: 'repurpose', unlock: 'repurpose', hint: 'A function is a habit of a form.', need: (g) => g.stats.integrations >= 1 },
  { id: 'increase', unlock: 'insight', hint: 'More is a direction, not a place.', need: (g) => g.habitsOwned >= 8 },
  { id: 'regroup', unlock: 'split', hint: 'What was joined remembers its seam.', need: (g) => g.wave >= 5 },
  { id: 'expand', unlock: 'ring2', hint: 'The edge was never the edge.', need: (g) => g.level >= 5 },
  { id: 'ingest', unlock: 'subtract', hint: 'To take in is to be shaped by the taken.', need: (g) => g.stats.splits >= 1 },
  { id: 'support', unlock: 'attendants', hint: 'Attention can be lent.', need: (g) => g.stats.subtractions >= 1 },
  { id: 'evoke', unlock: 'verbs', hint: 'Call, and something calls back.', need: (g) => g.cycle >= 1 || g.wave >= 9 },
  { id: 'interchange', unlock: 'exchange', hint: 'Each is the price of each.', need: (g) => g.stats.verbsDone >= 2 },
  { id: 'evoke', unlock: 'echo', hint: 'The called now call.', need: (g) => g.stats.exchanges >= 3 },
  { id: 'inhabit', unlock: 'stance', hint: 'A stance is a house you wear.', need: (g) => g.stats.echoes >= 20 },
  { id: 'sustain', unlock: 'seasons', hint: 'Everything kept is kept against something.', need: (g) => !!g.stance },
  { id: 'penetrate', unlock: 'mirror', hint: 'Small enters great. Great enters small.', need: (g) => g.stats.seasons >= 6 },
  { id: 'embrace', unlock: 'wildcard', hint: 'No aspect is absent from any aspect.', need: (g) => g.mirrors >= 1 },
  { id: 'overwhelm', unlock: 'nonmind', hint: 'It is too much. It was always this much.', need: (g) => g.overwhelm >= 1 },
];

// 12-link ladder: the genetic upgrade track. Two units of one family at the same link fuse into the next.
// `mult` scales core stats; `trait` is the heritable gene gained on reaching the link.
export const LINKS = [
  { n: 1, pali: 'Dukkha', gloss: 'unsatisfactoriness', mult: 1, trait: 'ache', text: 'It does not fit. This is where it starts.' },
  { n: 2, pali: 'Saddhā', gloss: 'confidence', mult: 1.7, trait: 'trust', text: 'It leans on something it has not yet seen.' },
  { n: 3, pali: 'Pāmojja', gloss: 'gladness', mult: 2.8, trait: 'glad', text: 'A small yes, repeated.' },
  { n: 4, pali: 'Pīti', gloss: 'rapture', mult: 4.5, trait: 'rapture', text: 'The body hears the news before the mind.' },
  { n: 5, pali: 'Passaddhi', gloss: 'tranquillity', mult: 7, trait: 'calm', text: 'The shaking stops shaking.' },
  { n: 6, pali: 'Sukha', gloss: 'ease', mult: 11, trait: 'ease', text: 'Nothing is asked of it.' },
  { n: 7, pali: 'Samādhi', gloss: 'collectedness', mult: 17, trait: 'gather', text: 'Many, facing one way.' },
  { n: 8, pali: 'Yathābhūta', gloss: 'seeing as it is', mult: 26, trait: 'see', text: 'It stops adding.' },
  { n: 9, pali: 'Nibbidā', gloss: 'disenchantment', mult: 40, trait: 'tire', text: 'The trick is seen and still performed, more quietly.' },
  { n: 10, pali: 'Virāga', gloss: 'dispassion', mult: 62, trait: 'fade', text: 'The colour stays. The wanting of the colour goes.' },
  { n: 11, pali: 'Vimutti', gloss: 'release', mult: 95, trait: 'release', text: 'Held by nothing, it holds nothing.' },
  { n: 12, pali: 'Khaye ñāṇa', gloss: 'knowing the ending', mult: 150, trait: 'end', text: 'It knows it is done, and is.' },
];

// What each heritable trait does in battle (read by battle.js). Values scale with copies of the gene.
export const TRAITS = {
  ache: { text: 'Deals more the less tolerance it has left.' },
  trust: { text: 'Starts each wave with a veil equal to a share of its tolerance.' },
  glad: { text: 'Each strike yields a little affect.' },
  rapture: { text: 'First strikes of a wave come much faster.' },
  calm: { text: 'Slows the latency of stressors nearby.' },
  ease: { text: 'Mends itself continuously.' },
  gather: { text: 'Repeated strikes on one target grow.' },
  see: { text: 'Ignores opacity and veils.' },
  tire: { text: 'Stressors nearby lose salience.' },
  fade: { text: 'Counts as every aspect. Cannot be dysregulated.' },
  release: { text: 'On falling, mends every ally.' },
  end: { text: 'Dissolves into a permanent ending.' },
};

export const ASPECTS = {
  vagal: { name: 'Vagal', tone: 'teal', text: 'Members mend %v% of tolerance each second.', v: [2, 5, 10] },
  limbic: { name: 'Limbic', tone: 'blood', text: 'Members gain %v% salience.', v: [25, 60, 130] },
  cortical: { name: 'Cortical', tone: 'ultra', text: 'Charge fills %v% faster for all.', v: [20, 45, 90] },
  somatic: { name: 'Somatic', tone: 'tangerine', text: 'Members gain %v% tolerance.', v: [30, 70, 150] },
  shadow: { name: 'Shadow', tone: 'violet', text: 'Stressors lose %v% tolerance on arrival.', v: [8, 16, 30] },
  relational: { name: 'Relational', tone: 'rose', text: 'Members share %v% of harm with neighbours.', v: [25, 40, 60] },
  void: { name: 'Void', tone: 'ink', text: 'Members gain %v opacity.', v: [12, 25, 45] },
  mythic: { name: 'Mythic', tone: 'yolk', text: 'Affect from all sources +%v%.', v: [15, 40, 100] },
};
export const ASPECT_IDS = Object.keys(ASPECTS);
export const ASPECT_THRESHOLDS = [2, 4, 6];

// 10 families, one per gate. Naming pattern: every family is a "-tion/-al/-ance" regulation term;
// every home field shares prefix/suffix; every witness shares a suffix.
// Stats: tol(erance)=hp, sal(ience)=damage, lat(ency)=seconds between strikes, reach=range,
// opa(city)=% to be missed, lab(ility)=damage variance, rec(ursion)=% to strike twice.
export const FAMILIES = [
  { id: 'reappraisal', name: 'Reappraisal', dir: 0, tier: 1, aspects: ['cortical', 'vagal'], field: 'Field of Glass Weather', witness: 'Clear Witness',
    stats: { tol: 520, sal: 44, lat: 1.0, reach: 2.2, opa: 5, lab: 0.2, rec: 0 }, ability: 'reframe', form: 'lens', colors: ['teal', 'sky'],
    text: 'It turns the thing over until the thing has another side.' },
  { id: 'suppression', name: 'Suppression', dir: 1, tier: 1, aspects: ['somatic', 'shadow'], field: 'Field of Lead Weather', witness: 'Heavy Witness',
    stats: { tol: 900, sal: 30, lat: 1.3, reach: 1.2, opa: 0, lab: 0.1, rec: 0 }, ability: 'lid', form: 'slab', colors: ['ink', 'violet'],
    text: 'Nothing is happening. It will keep not happening, louder.' },
  { id: 'rumination', name: 'Rumination', dir: 2, tier: 1, aspects: ['cortical', 'limbic'], field: 'Field of Wheel Weather', witness: 'Turning Witness',
    stats: { tol: 430, sal: 26, lat: 0.45, reach: 1.4, opa: 0, lab: 0.5, rec: 25 }, ability: 'loop', form: 'knot', colors: ['blood', 'tangerine'],
    text: 'Again. And the again of again.' },
  { id: 'avoidance', name: 'Avoidance', dir: 3, tier: 2, aspects: ['void', 'somatic'], field: 'Field of Door Weather', witness: 'Leaving Witness',
    stats: { tol: 480, sal: 70, lat: 1.5, reach: 5.5, opa: 30, lab: 0.3, rec: 0 }, ability: 'withdraw', form: 'shard', colors: ['sky', 'paper'],
    text: 'It is excellent at being elsewhere.' },
  { id: 'attunement', name: 'Attunement', dir: 4, tier: 2, aspects: ['relational', 'vagal'], field: 'Field of String Weather', witness: 'Listening Witness',
    stats: { tol: 600, sal: 24, lat: 1.1, reach: 3.5, opa: 0, lab: 0.1, rec: 0 }, ability: 'mend', form: 'rings', colors: ['rose', 'yolk'],
    text: 'It becomes the shape of what is near it, and that helps.' },
  { id: 'projection', name: 'Projection', dir: 5, tier: 3, aspects: ['shadow', 'relational'], field: 'Field of Mirror Weather', witness: 'Pointing Witness',
    stats: { tol: 650, sal: 95, lat: 1.4, reach: 4.2, opa: 10, lab: 0.6, rec: 0 }, ability: 'cast_out', form: 'spike', colors: ['violet', 'magenta'],
    text: 'It is certain the feeling belongs to someone over there.' },
  { id: 'dissociation', name: 'Dissociation', dir: 6, tier: 3, aspects: ['void', 'shadow'], field: 'Field of Fog Weather', witness: 'Absent Witness',
    stats: { tol: 560, sal: 120, lat: 1.8, reach: 3.0, opa: 55, lab: 0.8, rec: 0 }, ability: 'vanish', form: 'shell', colors: ['paper', 'ultra'],
    text: 'It watches itself from the ceiling. The view is fine.' },
  { id: 'sublimation', name: 'Sublimation', dir: 7, tier: 4, aspects: ['mythic', 'limbic'], field: 'Field of Kiln Weather', witness: 'Burning Witness',
    stats: { tol: 1100, sal: 150, lat: 1.2, reach: 2.0, opa: 0, lab: 0.3, rec: 10 }, ability: 'transmute', form: 'flame', colors: ['yolk', 'magenta'],
    text: 'It sets fire to the thing and calls the light a career.' },
  { id: 'containment', name: 'Containment', dir: 8, tier: 4, aspects: ['somatic', 'relational'], field: 'Field of Bowl Weather', witness: 'Holding Witness',
    stats: { tol: 2100, sal: 60, lat: 1.6, reach: 1.5, opa: 0, lab: 0.05, rec: 0 }, ability: 'hold', form: 'bowl', colors: ['tangerine', 'teal'],
    text: 'It does not fix. It is a place where unfixed things may be.' },
  { id: 'equanimity', name: 'Equanimity', dir: 9, tier: 5, aspects: ['mythic', 'void'], field: 'Field of Sky Weather', witness: 'Even Witness',
    stats: { tol: 1800, sal: 260, lat: 1.0, reach: 6.0, opa: 20, lab: 0, rec: 20 }, ability: 'level', form: 'orbit', colors: ['ultra', 'yolk'],
    text: 'Praise and blame arrive. It offers them both the same chair.' },
];
export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

// Abilities fire when charge is full. Kept as data; battle.js implements `kind`.
export const ABILITIES = {
  reframe: { name: 'Reframe', kind: 'invert', power: 1.5, text: 'The target strikes its own kind once.' },
  lid: { name: 'Lid', kind: 'store', power: 0.6, text: 'Stores harm taken. Returns all of it when it falls.' },
  loop: { name: 'Loop', kind: 'flurry', power: 5, text: 'Strikes five times. Feels each one.' },
  withdraw: { name: 'Withdraw', kind: 'retreat', power: 3, text: 'Leaps to the far rim and strikes thrice from there.' },
  mend: { name: 'Mend', kind: 'heal', power: 2.5, text: 'Mends the ally who needs it most.' },
  cast_out: { name: 'Cast Out', kind: 'transfer', power: 2, text: 'Hands its own wounds to the nearest stressor.' },
  vanish: { name: 'Vanish', kind: 'blink', power: 4, text: 'Is not here. Returns behind the strongest, heavily.' },
  transmute: { name: 'Transmute', kind: 'burst_affect', power: 2.2, text: 'Burns everything near. The ashes are affect.' },
  hold: { name: 'Hold', kind: 'taunt', power: 4, text: 'Everything nearby must attend to it. It hardens.' },
  level: { name: 'Level', kind: 'equalize', power: 0.35, text: 'All stressors are set to the tolerance of the weakest among them, roughly.' },
};

// Stressors arrive through the gates. `arc` waves add a modifier following the 10-step rhetorical arc.
export const STRESSORS = [
  { id: 'intrusion', name: 'Intrusion', tol: 120, sal: 12, lat: 1.2, speed: 1.3, reach: 1.0, form: 'burr', color: 'blood', value: 1 },
  { id: 'deadline', name: 'Deadline', tol: 80, sal: 9, lat: 0.7, speed: 2.4, reach: 1.0, form: 'dart', color: 'tangerine', value: 1 },
  { id: 'criticism', name: 'Criticism', tol: 160, sal: 30, lat: 1.8, speed: 1.0, reach: 3.5, form: 'needle', color: 'ultra', value: 2 },
  { id: 'ambiguity', name: 'Ambiguity', tol: 320, sal: 14, lat: 1.4, speed: 0.9, reach: 1.2, form: 'blob', color: 'violet', value: 2 },
  { id: 'shame', name: 'Shame', tol: 700, sal: 40, lat: 2.0, speed: 0.6, reach: 1.3, form: 'weight', color: 'ink', value: 4 },
  { id: 'abandonment', name: 'Abandonment', tol: 2600, sal: 90, lat: 1.6, speed: 0.55, reach: 1.6, form: 'maw', color: 'magenta', value: 12, boss: true },
];
export const STRESSOR = Object.fromEntries(STRESSORS.map((s) => [s.id, s]));

// Wave modifiers follow a ten-step arc: negation -> ... -> return to action.
export const WAVE_ARC = [
  { id: 'negation', name: 'It Does Not Appear', text: 'Stressors are half-unseen.', mod: { opa: 35 } },
  { id: 'ineffable', name: 'Beyond The Path Of Words', text: 'Charge fills at half speed.', mod: { chargeMul: 0.5 } },
  { id: 'analogy', name: 'Just As', text: 'Each stressor arrives with its likeness.', mod: { countMul: 2, tolMul: 0.55 } },
  { id: 'onemany', name: 'One, Therefore Many', text: 'One great stressor; when it falls it is many.', mod: { fuse: true } },
  { id: 'counting', name: 'Neither One Nor Two', text: 'Counts are unreliable.', mod: { jitter: true } },
  { id: 'placeless', name: 'No Place, Every Place', text: 'They arrive through every gate at once.', mod: { allGates: true } },
  { id: 'same', name: 'Same, Different', text: 'They wear the forms of your own.', mod: { mirrorForms: true, salMul: 1.3 } },
  { id: 'observer', name: 'Equal In Number To Thoughts', text: 'Their number follows your attention.', mod: { byClicks: true } },
  { id: 'cancel', name: 'Who Is Able', text: 'Aspect bonds are silent.', mod: { noAspects: true } },
  { id: 'return', name: 'Light Appears', text: 'A single strike may undo a great one.', mod: { boss: true, oneShot: 0.03 } },
];

// Habits: passive producers (10, one per gate). cost = base * 1.15^owned.
export const HABITS = [
  { id: 'breath', name: 'Breath', base: 10, prod: 0.2 },
  { id: 'pause', name: 'Pause', base: 120, prod: 1.5 },
  { id: 'naming', name: 'Naming', base: 900, prod: 9 },
  { id: 'routine', name: 'Routine', base: 7e3, prod: 55 },
  { id: 'journal', name: 'Journal', base: 6e4, prod: 380 },
  { id: 'ritual', name: 'Ritual', base: 5.5e5, prod: 2.8e3 },
  { id: 'narrative', name: 'Narrative', base: 6e6, prod: 2.2e4 },
  { id: 'schema', name: 'Schema', base: 8e7, prod: 2e5 },
  { id: 'myth', name: 'Myth', base: 1.2e9, prod: 2.1e6 },
  { id: 'identity', name: 'Identity', base: 2.5e10, prod: 2.6e7 },
];
export const HABIT_GROWTH = 1.15;

// Upgrades with odd scalers (pure functions of the run).
export const UPGRADES = [
  { id: 'noticing', name: 'Noticing', cost: 60, text: 'Attending yields +1% of affect per second.', stage: 2 },
  { id: 'counting_breaths', name: 'Counting Breaths', cost: 400, text: 'Habits yield more per Breath owned.', stage: 2 },
  { id: 'old_wound', name: 'Old Wound', cost: 2500, text: 'Affect scales with composure you are missing.', stage: 5 },
  { id: 'long_view', name: 'Long View', cost: 2e4, text: 'Affect scales with seconds spent in this run, slowly.', stage: 5 },
  { id: 'crowd', name: 'Inner Crowd', cost: 2.5e5, text: 'Salience of all regulators scales with complexity.', stage: 6 },
  { id: 'thrift', name: 'Thrift Of Attention', cost: 3e6, text: 'Interest cap doubles.', stage: 7 },
  { id: 'second_arrow', name: 'Second Arrow', cost: 5e7, text: 'Recursion +10 for everyone. So is harm taken, by 10%.', stage: 9 },
  { id: 'lending', name: 'Lending', cost: 8e8, text: 'Attendants attend twice as often.', stage: 10 },
];

// Insight spells.
export const SPELLS = [
  { id: 'exhale', name: 'Exhale', cost: 30, text: 'All regulators mend a third.', stage: 5 },
  { id: 'label', name: 'Name It', cost: 50, text: 'Stressors take double harm for 8 seconds.', stage: 5 },
  { id: 'recollect', name: 'Recollect', cost: 80, text: '30 seconds of habit yield, at once.', stage: 5 },
];

// Timed verbs with aspect-gated slots; they produce or consume decaying moods.
export const VERBS = [
  { id: 'dream', name: 'Dream', time: 40, needs: null, text: 'Give a regulator to sleep. Something related wakes.', stage: 10 },
  { id: 'ruminate', name: 'Ruminate', time: 25, needs: 'cortical', text: 'Insight, and a Dread.', stage: 10 },
  { id: 'rest', name: 'Rest', time: 30, needs: 'vagal', text: 'A Dread is taken away. Composure returns.', stage: 10 },
  { id: 'confide', name: 'Confide', time: 35, needs: 'relational', text: 'A Contentment. Witnessed things weigh less.', stage: 10 },
];
export const MOODS = {
  dread: { name: 'Dread', life: 180, text: 'Three of these and the gates open wider.' },
  contentment: { name: 'Contentment', life: 90, text: 'Cancels one Dread. Does not last.' },
  fascination: { name: 'Fascination', life: 180, text: 'Yield rises. So does everything else.' },
};

export const STANCES = [
  { id: 'toward', name: 'Toward', text: 'Mending doubled. Reach shortened.', mod: { heal: 2, reach: 0.8 } },
  { id: 'away', name: 'Away', text: 'Opacity +20, reach lengthened. Yield reduced.', mod: { opa: 20, reach: 1.3, affect: 0.8 } },
  { id: 'against', name: 'Against', text: 'Salience +60%. Tolerance reduced.', mod: { sal: 1.6, tol: 0.8 } },
];

// Shop odds by level: [t1..t5] percent.
export const SHOP_ODDS = [
  [100, 0, 0, 0, 0], [80, 20, 0, 0, 0], [65, 30, 5, 0, 0], [50, 35, 15, 0, 0], [38, 35, 24, 3, 0],
  [28, 33, 30, 8, 1], [20, 28, 34, 15, 3], [15, 22, 33, 24, 6], [12, 18, 28, 30, 12], [8, 14, 24, 34, 20],
];
export const XP_TO_LEVEL = [2, 3, 6, 10, 16, 26, 40, 60, 90, Infinity];
export const TIER_COST = [1, 2, 3, 4, 5];
export const COSTS = { reroll: 2, xp: 5, xpGain: 4, integrate: 20, subtract: 35, split: 10 };
