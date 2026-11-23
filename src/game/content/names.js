// Names for fields, witnesses and notable hybrid lineages. Pattern-based; nothing here is a real name.

const pick = (rng, a) => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];

export const FIELD_MATERIALS = [
  'Salt', 'Wax', 'Ash', 'Tin', 'Silk', 'Slate', 'Bone', 'Rust', 'Moss', 'Chalk',
  'Amber', 'Felt', 'Copper', 'Linen', 'Pitch', 'Clay', 'Smoke', 'Pearl', 'Reed', 'Flint',
  'Tallow', 'Velvet', 'Quartz', 'Dust', 'Brine', 'Thread', 'Horn', 'Lace', 'Cinder', 'Milk',
];

export const WITNESS_QUALITIES = [
  'Patient', 'Quiet', 'Unhurried', 'Plain', 'Steady', 'Wakeful', 'Gentle', 'Level', 'Spare', 'Open',
  'Slow', 'Candid', 'Dry', 'Still', 'Warm', 'Distant', 'Careful', 'Faithful', 'Humble', 'Soft',
  'Sleepless', 'Narrow', 'Tender', 'Grave', 'Kindred', 'Lucid', 'Mild', 'Austere', 'Near', 'Unmoved',
];

export const fieldName = (rng) => `Field of ${pick(rng, FIELD_MATERIALS)} Weather`;
export const witnessName = (rng) => `${pick(rng, WITNESS_QUALITIES)} Witness`;

// Syllable roots lean on the family so a lineage sounds like what it is made of.
const ROOT = {
  reappraisal: ['Ve', 'Lu', 'Ari'], suppression: ['Gro', 'Du', 'Mor'], rumination: ['Ru', 'Ona', 'Wen'],
  avoidance: ['Sei', 'Ka', 'Ila'], attunement: ['Mi', 'Ana', 'Lio'], projection: ['Tha', 'Zel', 'Ori'],
  dissociation: ['Ny', 'Isa', 'Fey'], sublimation: ['Ky', 'Sol', 'Ema'], containment: ['Bo', 'Hes', 'Umi'],
  equanimity: ['Ae', 'Ohn', 'Sa'],
};
const MID = ['ra', 'len', 'mo', 'vi', 'dar', 'sen', 'thi', 'lo', 'ne', 'kar', 'sil', 'an'];
const END = ['a', 'is', 'on', 'e', 'ar', 'eth', 'ine', 'um', 'el', 'o'];
const NOUN = ['Lantern', 'Tithe', 'Threshold', 'Ember', 'Orchard', 'Vessel', 'Hinge', 'Tide', 'Cairn', 'Sill', 'Ledger', 'Bell', 'Ferry', 'Wick', 'Mantle'];
const TAIL = ['of Salt', 'of Hours', 'the Second', 'the Unmoored', 'of Low Light', 'the Lesser', 'of the Fold', 'Reborn'];

function familiesOf(unit) {
  const out = [];
  const walk = (g) => { if (!g) return; if (g.t === 'leaf') out.push(g.f); else { walk(g.a); walk(g.b); } };
  walk(unit && unit.genome);
  if (!out.length && unit) { if (unit.family) out.push(unit.family); if (Array.isArray(unit.families)) out.push(...unit.families); }
  return out;
}

export function lineageName(unit, rng) {
  const fams = familiesOf(unit);
  const roots = fams.length ? ROOT[fams[0]] || ROOT.equanimity : ROOT.equanimity;
  let first = pick(rng, roots);
  if (fams.length > 1 && rng() < 0.6) first += pick(rng, ROOT[fams[fams.length - 1]] || ROOT.equanimity).toLowerCase();
  first += pick(rng, MID) + pick(rng, END);
  const second = pick(rng, NOUN);
  const n = (unit && unit.muts ? unit.muts.length : 0) + fams.length;
  return n >= 4 && rng() < 0.5 ? `${first} ${second} ${pick(rng, TAIL)}` : `${first} ${second}`;
}
