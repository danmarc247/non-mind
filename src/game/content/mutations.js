// NON-MIND heritable mutations. Each is a real affective-science / clinical concept turned oblique.
// mod: multipliers for tol/sal/lat/reach/lab, additive for opa/rec. Every one pays a cost for its gift.
// form: how it deforms the unit's sculpture { twist, noise, hollow, spikes, rings, stretch } (0..1).

const F = (o = {}) => ({ twist: 0, noise: 0, hollow: 0, spikes: 0, rings: 0, stretch: 0, ...o });

// [id, name, basis, text, epithet, rarity, aspect, mod, form]
const RAW = [
  // ---- rarity 1
  ['window_of_tolerance', 'Wide Window', 'window of tolerance', 'The edges of the room moved outward. Nothing in it did.', 'of the Wide Window', 1, 'vagal', { tol: 1.2, lat: 1.1 }, F({ rings: 0.3 })],
  ['alexithymia', 'Unlabelled', 'alexithymia', 'It feels the weight and has no word for the scale.', 'of the Unnamed Weight', 1, 'void', { opa: 8, sal: 0.9, lab: 0.8 }, F({ hollow: 0.3 })],
  ['rebound_effect', 'Rebound', 'rebound effect', 'Pushed down, it returns with the push still in it.', 'of the Returning Thing', 1, 'shadow', { sal: 1.2, tol: 0.9 }, F({ spikes: 0.3 })],
  ['reaction_formation', 'Sweet Armor', 'reaction formation', 'It is very kind to what it cannot bear.', 'of the Sweet Wall', 1, 'shadow', { tol: 1.15, lab: 1.3 }, F({ twist: 0.3 })],
  ['object_constancy', 'Held in Absence', 'object constancy', 'What left is still, somehow, in the room.', 'of the Kept Room', 1, 'relational', { tol: 1.2, lat: 1.1 }, F({ rings: 0.3 })],
  ['interoceptive_accuracy', 'Fine Pulse', 'interoceptive accuracy', 'It counts its own heartbeat and is rarely wrong.', 'of the Counted Pulse', 1, 'somatic', { reach: 1.2, tol: 0.9 }, F({ stretch: 0.2, rings: 0.1 })],
  ['experiential_avoidance', 'Side Door', 'experiential avoidance', 'It has not felt it yet. It is working very hard on that.', 'of the Side Door', 1, 'void', { opa: 10, sal: 0.85 }, F({ hollow: 0.3 })],
  ['co_rumination', 'Shared Wheel', 'co-rumination', 'Two voices, one loop, each feeding the other.', 'of the Shared Wheel', 1, 'relational', { rec: 10, lat: 1.15 }, F({ twist: 0.3, rings: 0.2 })],
  ['emotional_granularity', 'Fine Grain', 'emotional granularity', 'Ten words for one grey. The grey loosens.', 'of the Fine Grain', 1, 'cortical', { lab: 0.7, tol: 0.95, sal: 1.1 }, F({ noise: 0.3 })],
  ['learned_safety', 'Slow Yes', 'learned safety', 'Nothing came, again. The body begins to believe the again.', 'of the Slow Yes', 1, 'vagal', { tol: 1.15, reach: 0.9 }, F({ hollow: 0.2, rings: 0.2 })],
  ['repetition_compulsion', 'Old Groove', 'repetition compulsion', 'It keeps arranging the same scene, hoping for a different last line.', 'of the Old Groove', 1, 'shadow', { rec: 12, tol: 0.9 }, F({ twist: 0.4 })],
  ['affect_labeling', 'Said Aloud', 'affect labeling', 'Named, the storm lowers by a small amount.', 'of the Spoken Storm', 1, 'cortical', { lat: 0.9, tol: 0.92 }, F({ stretch: 0.3 })],
  ['emotional_contagion', 'Caught It', 'emotional contagion', 'It was fine until the room was not.', 'of the Caught Room', 1, 'relational', { reach: 1.2, tol: 0.9 }, F({ spikes: 0.2, noise: 0.2 })],
  ['habituation', 'Worn Smooth', 'habituation', 'The hundredth knock is only wood.', 'of the Hundredth Knock', 1, 'somatic', { tol: 1.15, sal: 0.92 }, F({ rings: 0.3 })],
  ['ironic_process', 'Do Not Think', 'ironic process theory', 'The monitor watches for the very thing it forbids.', 'of the Watched Door', 1, 'shadow', { sal: 1.15, tol: 0.9 }, F({ noise: 0.3 })],
  ['splitting', 'All or None', 'splitting', 'One face is all light. The other is the same face, later.', 'of the Two Faces', 1, 'limbic', { sal: 1.25, lab: 1.4 }, F({ twist: 0.2, spikes: 0.3 })],
  ['hypervigilance', 'Held Breath', 'hypervigilance', 'Every shadow is a verdict not yet read.', 'of the Held Breath', 1, 'limbic', { lat: 0.85, tol: 0.9 }, F({ spikes: 0.4 })],
  ['emotional_numbing', 'Gone Quiet', 'emotional numbing', 'The volume was not lowered. The wire was cut.', 'of the Cut Wire', 1, 'void', { opa: 10, sal: 0.92 }, F({ hollow: 0.4 })],
  ['secure_base', 'Safe Harbour', 'secure base', 'It leaves because it knows it may return.', 'of the Open Harbour', 1, 'vagal', { tol: 1.2, reach: 0.9 }, F({ rings: 0.3 })],
  ['mentalization', 'Other Minds', 'mentalization', 'It guesses the weather inside the other and guesses kindly.', 'of the Guessed Weather', 1, 'cortical', { reach: 1.2, sal: 0.95, lat: 1.05 }, F({ stretch: 0.2, rings: 0.2 })],
  ['projective_identification', 'Thrown Feeling', 'projective identification', 'It hands over the feeling, then watches the other begin to hold it.', 'of the Handed Fire', 1, 'shadow', { reach: 1.25, tol: 0.9 }, F({ spikes: 0.3 })],
  ['grounding', 'Feet Found', 'grounding', 'Five things seen. The floor, remembered.', 'of the Five Things', 1, 'somatic', { tol: 1.2, lat: 1.1 }, F({ stretch: 0.2 })],
  ['intellectualization', 'Cold Diagram', 'intellectualization', 'It draws the wound to scale and stands behind the scale.', 'of the Cold Diagram', 1, 'cortical', { sal: 1.15, tol: 0.9 }, F({ hollow: 0.3 })],
  ['humor_defense', 'Small Laugh', 'humor as defense', 'The joke lands on the wound and the wound is briefly light.', 'of the Small Laugh', 1, 'mythic', { sal: 1.1, opa: 5, tol: 0.9 }, F({ noise: 0.2, twist: 0.2 })],

  // ---- rarity 2
  ['vagal_brake', 'Soft Brake', 'vagal brake', 'A hand on the wheel that the wheel does not notice.', 'of the Soft Brake', 2, 'vagal', { lat: 0.75, sal: 0.95, tol: 0.9 }, F({ rings: 0.5 })],
  ['neuroception', 'Below Noticing', 'neuroception', 'It knew before it knew. It was right more often than it can say.', 'of the Early Knowing', 2, 'limbic', { reach: 1.35, opa: 10, tol: 0.85 }, F({ stretch: 0.4, spikes: 0.2 })],
  ['dialectical_thinking', 'Both, Truly', 'dialectical thinking', 'Two true things, held at once, neither dropped.', 'of the Held Pair', 2, 'cortical', { tol: 1.2, sal: 1.2, lat: 1.3 }, F({ twist: 0.5 })],
  ['emotional_flooding', 'Flood', 'emotional flooding (Gottman)', 'The pulse says one hundred. The mind says nothing.', 'of the Rising Water', 2, 'limbic', { sal: 1.5, tol: 0.75, lat: 0.9 }, F({ noise: 0.5, spikes: 0.3 })],
  ['dissociative_buffer', 'Glass Between', 'peritraumatic dissociation', 'It was not there. Only the body was, and it held.', 'of the Glass Between', 2, 'void', { opa: 20, sal: 0.8 }, F({ hollow: 0.5 })],
  ['rupture_and_repair', 'Torn, Mended', 'rupture and repair', 'The seam holds better than the cloth did.', 'of the Mended Seam', 2, 'relational', { tol: 1.3, lat: 1.2 }, F({ rings: 0.4, twist: 0.2 })],
  ['attachment_anxiety', 'Reaching Hand', 'anxious attachment', 'It checks that the door is still a door. Again.', 'of the Checked Door', 2, 'relational', { reach: 1.4, tol: 0.85, lab: 1.4 }, F({ stretch: 0.4, noise: 0.2 })],
  ['avoidant_attachment', 'Arm Length', 'avoidant attachment', 'Close enough to be seen. Not close enough to be reached.', 'of the Arm\'s Length', 2, 'void', { opa: 15, reach: 0.8, sal: 1.2 }, F({ hollow: 0.4, stretch: 0.2 })],
  ['disorganized_attachment', 'Frightened Haven', 'disorganized attachment', 'The one it runs toward is the one it runs from.', 'of the Two Directions', 2, 'shadow', { lab: 1.8, sal: 1.4, tol: 0.85 }, F({ twist: 0.5, noise: 0.4 })],
  ['containing_function', 'Vessel', 'containing function (Bion)', 'It takes the unthinkable in and gives it back thinkable.', 'of the Quiet Vessel', 2, 'somatic', { tol: 1.5, sal: 0.8 }, F({ hollow: 0.5 })],
  ['transitional_object', 'Worn Blanket', 'transitional object', 'Neither self nor other. It is held when no one is.', 'of the Worn Cloth', 2, 'relational', { tol: 1.25, reach: 0.85, rec: 8 }, F({ rings: 0.5 })],
  ['cognitive_defusion', 'Leaf on Stream', 'cognitive defusion', 'The thought is a thought. It floats on and is not asked to stay.', 'of the Passing Leaf', 2, 'cortical', { lat: 0.8, tol: 0.9 }, F({ stretch: 0.3, hollow: 0.2 })],
  ['acceptance', 'Open Palm', 'acceptance (ACT)', 'It stops pushing. The wall turns out to be a door that opens inward.', 'of the Open Palm', 2, 'vagal', { tol: 1.35, sal: 0.85, lat: 1.1 }, F({ hollow: 0.3, rings: 0.3 })],
  ['behavioral_activation', 'Act First', 'behavioral activation', 'Motion first. Meaning is a late guest.', 'of the First Step', 2, 'somatic', { lat: 0.75, tol: 0.9 }, F({ stretch: 0.5 })],
  ['opposite_action', 'Against the Pull', 'opposite action (DBT)', 'The feeling says retreat. It steps forward and the feeling updates.', 'of the Other Foot', 2, 'limbic', { sal: 1.3, tol: 0.85, rec: 5 }, F({ twist: 0.4, spikes: 0.2 })],
  ['distress_tolerance', 'Ride It Out', 'distress tolerance', 'It does not fix the hour. It simply outlasts it.', 'of the Long Hour', 2, 'somatic', { tol: 1.4, lat: 1.2 }, F({ rings: 0.3, hollow: 0.2 })],
  ['kindling', 'Kindled', 'kindling hypothesis', 'Each episode needs less to begin.', 'of the Lowered Spark', 2, 'limbic', { rec: 15, tol: 0.85 }, F({ spikes: 0.5, twist: 0.2 })],
  ['safety_behaviors', 'Small Charms', 'safety behaviors', 'The ritual works, and so the fear is never tested.', 'of the Small Charm', 2, 'void', { opa: 12, sal: 0.85, tol: 1.1 }, F({ rings: 0.3, hollow: 0.3 })],
  ['attentional_bias', 'Narrow Beam', 'attentional bias', 'Of all the room, it sees only the one thing that confirms.', 'of the Narrow Beam', 2, 'limbic', { reach: 1.4, lab: 0.6, sal: 1.1, tol: 0.85 }, F({ stretch: 0.4 })],
  ['sensitization', 'Raw Nerve', 'sensitization', 'Each touch teaches it to hurt sooner.', 'of the Raw Nerve', 2, 'limbic', { sal: 1.35, lat: 0.9, tol: 0.75 }, F({ spikes: 0.5 })],
  ['self_soothing', 'Own Lullaby', 'self-soothing', 'It hums the thing its first holder hummed.', 'of the Borrowed Hum', 2, 'vagal', { tol: 1.3, sal: 0.85, rec: 5 }, F({ rings: 0.4 })],
  ['emotional_inertia', 'Slow Weather', 'emotional inertia', 'Yesterday\'s mood is the climate of today.', 'of the Slow Weather', 2, 'somatic', { lat: 1.3, tol: 1.4, sal: 1.1 }, F({ twist: 0.2, rings: 0.3 })],

  // ---- rarity 3
  ['posttraumatic_growth', 'Scar Tissue', 'posttraumatic growth', 'It broke along a line. The line is where it is strongest now.', 'of the Strong Seam', 3, 'mythic', { tol: 1.5, sal: 1.3, lat: 1.3 }, F({ spikes: 0.3, rings: 0.4 })],
  ['vagal_tone', 'High Tone', 'vagal tone', 'It recovers faster than it falls.', 'of the Quick Return', 3, 'vagal', { tol: 1.4, lat: 0.8, sal: 0.8 }, F({ rings: 0.6 })],
  ['flow_state', 'Lost Hour', 'flow state', 'The doer is gone. The doing goes on perfectly.', 'of the Lost Hour', 3, 'mythic', { lat: 0.65, sal: 1.2, reach: 0.8, tol: 0.8 }, F({ stretch: 0.6, twist: 0.2 })],
  ['embodied_simulation', 'Felt From Within', 'embodied simulation', 'It flinches when you flinch and does not know whose it was.', 'of the Borrowed Flinch', 3, 'relational', { reach: 1.5, rec: 15, tol: 0.8 }, F({ twist: 0.4, rings: 0.3 })],
  ['freeze_response', 'Stillness', 'tonic immobility', 'Even the breath waits to be told.', 'of the Held Still', 3, 'void', { opa: 25, lat: 1.5, sal: 1.2 }, F({ hollow: 0.6 })],
  ['hyperarousal', 'Ready Wire', 'hyperarousal', 'The alarm is the only thing awake in the house.', 'of the Ready Wire', 3, 'limbic', { lat: 0.6, sal: 1.2, tol: 0.65 }, F({ spikes: 0.6, noise: 0.4 })],
  ['shadow_integration', 'The Rejected Guest', 'shadow integration (Jung)', 'It sets a place for what it refused. The meal is awkward and complete.', 'of the Rejected Guest', 3, 'shadow', { sal: 1.5, tol: 1.2, lab: 1.5, opa: -5 }, F({ hollow: 0.4, twist: 0.4 })],
  ['self_compassion', 'Own Friend', 'self-compassion', 'It speaks to itself as it would to the one it loves.', 'of the Kind Voice', 3, 'vagal', { tol: 1.6, sal: 0.85, lat: 1.1 }, F({ rings: 0.5, hollow: 0.3 })],
  ['return_of_the_repressed', 'Return', 'return of the repressed', 'It was buried upright. It climbed out the same way.', 'of the Climbing Dead', 3, 'shadow', { sal: 1.6, rec: 15, tol: 0.7 }, F({ twist: 0.5, spikes: 0.4 })],
  ['metacognition', 'Watcher Above', 'metacognitive awareness', 'The thought and the one who has it, in separate chairs.', 'of the Second Chair', 3, 'cortical', { lat: 0.8, reach: 1.3, tol: 0.8 }, F({ stretch: 0.5, hollow: 0.3 })],
  ['secure_attachment', 'First Trust', 'secure attachment', 'It was held early. It stands as if held still.', 'of the Early Hold', 3, 'relational', { tol: 1.5, reach: 1.2, sal: 0.9, lat: 1.15 }, F({ rings: 0.5 })],
  ['somatic_marker', 'Gut Ledger', 'somatic marker hypothesis', 'The body already signed. The mind reads the receipt.', 'of the Gut Ledger', 3, 'somatic', { sal: 1.4, reach: 1.2, lat: 1.2 }, F({ stretch: 0.3, noise: 0.4 })],
  ['trauma_bond', 'Tight Knot', 'trauma bonding', 'The harm and the holding arrive in the same hand.', 'of the Tight Knot', 3, 'relational', { tol: 1.7, sal: 1.2, reach: 0.7, lat: 1.3 }, F({ twist: 0.5, rings: 0.3 })],
  ['depersonalization', 'Behind Glass', 'depersonalization', 'It moves its own hand and watches it, politely.', 'of the Far Window', 3, 'void', { opa: 30, tol: 0.8, lat: 1.2 }, F({ hollow: 0.7 })],
  ['trigger_generalization', 'Everything Rhymes', 'stimulus generalization', 'One song. Now every song is that song.', 'of the Wide Echo', 3, 'limbic', { reach: 1.6, lab: 1.6, tol: 0.8 }, F({ spikes: 0.5, noise: 0.3 })],
  ['working_through', 'Slow Digestion', 'working through (Freud)', 'Again, but this time it stays until the end of the sentence.', 'of the Finished Sentence', 3, 'mythic', { tol: 1.4, rec: 12, lat: 1.4 }, F({ twist: 0.4, rings: 0.3 })],

  // ---- rarity 4
  ['corrective_experience', 'Different Ending', 'corrective emotional experience', 'The old scene, replayed with a different hand on the door.', 'of the Other Ending', 4, 'mythic', { tol: 1.8, sal: 1.4, lat: 1.3 }, F({ rings: 0.6, hollow: 0.3 })],
  ['radical_acceptance', 'Total Yes', 'radical acceptance', 'It has stopped arguing with the weather. The weather, unobserved, thins.', 'of the Total Yes', 4, 'vagal', { tol: 1.5, sal: 1.2, opa: 15, lat: 1.2 }, F({ hollow: 0.5, rings: 0.4 })],
  ['reconsolidation', 'Reopened', 'memory reconsolidation', 'To change a memory, first it must be allowed to hurt again.', 'of the Opened Wound', 4, 'cortical', { sal: 1.8, lat: 0.8, tol: 0.7 }, F({ twist: 0.6, noise: 0.3 })],
  ['dorsal_shutdown', 'Dorsal Dark', 'dorsal vagal shutdown', 'The oldest brake. It does not slow the car. It removes the road.', 'of the Old Brake', 4, 'void', { opa: 40, tol: 1.5, sal: 0.6, lat: 1.6 }, F({ hollow: 0.8 })],
  ['ego_dissolution', 'No Edge', 'ego dissolution', 'The one who suffers cannot be found. The suffering is not told.', 'of the Missing Edge', 4, 'void', { opa: 25, sal: 2.0, tol: 0.6, reach: 1.4 }, F({ hollow: 0.6, noise: 0.5 })],
  ['oceanic_feeling', 'Oceanic', 'oceanic feeling', 'No boundary, no shore, and no one drowning.', 'of the Shoreless Sea', 4, 'mythic', { tol: 2.0, reach: 1.6, sal: 0.8, lat: 1.5 }, F({ rings: 0.8, stretch: 0.3 })],
  ['dark_night', 'Long Dark', 'dark night of the soul', 'Every comfort removed, and something under the comforts is still standing.', 'of the Long Dark', 4, 'shadow', { sal: 1.9, tol: 1.3, lat: 1.5, opa: -10 }, F({ hollow: 0.5, spikes: 0.4 })],
  ['fragmentation', 'Many Selves', 'structural dissociation', 'Each part holds one memory. None holds the whole.', 'of the Many Rooms', 4, 'shadow', { rec: 30, lab: 2.0, tol: 0.6 }, F({ twist: 0.6, spikes: 0.6, noise: 0.4 })],
  ['earned_security', 'Earned Ground', 'earned secure attachment', 'It was not given this. It built the floor from what was thrown.', 'of the Built Floor', 4, 'relational', { tol: 1.7, sal: 1.3, lat: 1.1, reach: 0.9, rec: 10 }, F({ rings: 0.6, stretch: 0.2 })],
  ['flashback_intrusion', 'Then, Now', 'flashback / intrusive reexperiencing', 'The past does not recall itself. It simply happens again, in the present tense.', 'of the Present Tense', 4, 'limbic', { rec: 30, sal: 1.5, tol: 0.6, lat: 0.8 }, F({ spikes: 0.7, noise: 0.6, twist: 0.3 })],
];

// Pairs that cannot coexist in one unit.
const PAIRS = [
  ['object_constancy', 'splitting'], ['secure_base', 'disorganized_attachment'], ['experiential_avoidance', 'acceptance'],
  ['ironic_process', 'cognitive_defusion'], ['hyperarousal', 'vagal_tone'], ['emotional_numbing', 'emotional_granularity'],
  ['alexithymia', 'affect_labeling'], ['alexithymia', 'emotional_granularity'], ['avoidant_attachment', 'attachment_anxiety'],
  ['secure_attachment', 'disorganized_attachment'], ['dissociative_buffer', 'grounding'], ['hypervigilance', 'learned_safety'],
  ['sensitization', 'habituation'], ['dorsal_shutdown', 'flow_state'], ['safety_behaviors', 'behavioral_activation'],
  ['radical_acceptance', 'experiential_avoidance'], ['emotional_flooding', 'distress_tolerance'], ['ego_dissolution', 'metacognition'],
  ['secure_attachment', 'avoidant_attachment'], ['earned_security', 'disorganized_attachment'], ['kindling', 'habituation'],
  ['depersonalization', 'grounding'], ['freeze_response', 'behavioral_activation'], ['self_compassion', 'shadow_integration'],
];

export const MUTATIONS = RAW.map(([id, name, basis, text, epithet, rarity, aspect, mod, form]) => ({
  id, name, basis, text, epithet, rarity, aspect, mod, form, conflicts: [],
}));
export const MUTATION = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]));
for (const [a, b] of PAIRS) {
  if (MUTATION[a] && !MUTATION[a].conflicts.includes(b)) MUTATION[a].conflicts.push(b);
  if (MUTATION[b] && !MUTATION[b].conflicts.includes(a)) MUTATION[b].conflicts.push(a);
}

// Weighted pick, weight 1/rarity^2, skipping owned and conflicting mutations. rng: () => [0,1).
export function rollMutation(rng, unit) {
  const have = new Set((unit && unit.muts) || []);
  const banned = new Set(have);
  for (const id of have) for (const c of (MUTATION[id]?.conflicts || [])) banned.add(c);
  const pool = MUTATIONS.filter((m) => !banned.has(m.id));
  if (!pool.length) return null;
  const w = pool.map((m) => 1 / (m.rarity * m.rarity));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

const MULT = ['tol', 'sal', 'lat', 'reach', 'lab'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function applyMutations(stats, mutIds = []) {
  const s = { ...stats };
  for (const id of mutIds) {
    const m = MUTATION[id];
    if (!m) continue;
    for (const k of MULT) if (m.mod[k] != null) s[k] = (s[k] ?? 0) * m.mod[k];
    if (m.mod.opa != null) s.opa = (s.opa || 0) + m.mod.opa;
    if (m.mod.rec != null) s.rec = (s.rec || 0) + m.mod.rec;
  }
  s.lat = Math.max(0.15, s.lat);
  s.opa = clamp(s.opa || 0, 0, 85);
  s.rec = clamp(s.rec || 0, 0, 90);
  return s;
}

export function formOf(mutIds = []) {
  const f = F();
  for (const id of mutIds) {
    const m = MUTATION[id];
    if (m) for (const k in f) f[k] += m.form[k] || 0;
  }
  for (const k in f) f[k] = clamp(f[k], 0, 1);
  return f;
}

// Suffix for a unit name from its rarest mutation (earliest wins ties).
export function epithet(mutIds = []) {
  let best = null;
  for (const id of mutIds) {
    const m = MUTATION[id];
    if (m && (!best || m.rarity > best.rarity)) best = m;
  }
  return best ? best.epithet : '';
}
