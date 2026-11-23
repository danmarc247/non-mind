import { describe, it, expect } from 'vitest';
import {
  leaf, node, key, leaves, leafCount, depth, nameOf, aspectsOf, baseStats, prune, complexityOf, inheritTraits,
  traitForLink, tierOf, abilityOf, echoAbilityOf, MAX_LEAVES, FAMILY, LINKS,
} from '../../src/game/index.js';

const L = (f, p = 0) => leaf(f, p);
const chain = (ids) => ids.slice(1).reduce((acc, id) => node('blend', acc, L(id)), L(ids[0]));
const ALL = ['reappraisal', 'suppression', 'rumination', 'avoidance', 'attunement', 'projection', 'dissociation', 'sublimation'];

describe('genome: structure and keys', () => {
  it('leaf and node constructors carry their fields', () => {
    expect(leaf('avoidance')).toEqual({ t: 'leaf', f: 'avoidance', pole: 0 });
    const n = node('carve', L('avoidance'), L('rumination'), 0.4);
    expect(n).toMatchObject({ t: 'node', op: 'carve', k: 0.4 });
  });

  it('keys are stable and encode op and pole', () => {
    expect(key(L('reappraisal'))).toBe('reappraisal');
    expect(key(L('reappraisal', 1))).toBe('reappraisal+');
    expect(key(L('reappraisal', -1))).toBe('reappraisal-');
    expect(key(node('blend', L('reappraisal'), L('suppression')))).toBe('(reappraisalbsuppression)');
    expect(key(node('carve', L('reappraisal'), L('suppression')))).toBe('(reappraisalcsuppression)');
  });

  it('key ignores the node blend weight k but not operand order', () => {
    const a = node('blend', L('avoidance'), L('rumination'), 0.2), b = node('blend', L('avoidance'), L('rumination'), 0.5);
    expect(key(a)).toBe(key(b));
    expect(key(node('blend', L('rumination'), L('avoidance')))).not.toBe(key(a));
  });

  it('key is deterministic across calls', () => {
    const g = chain(ALL.slice(0, 4));
    expect(key(g)).toBe(key(g));
  });

  it('leaves, leafCount and depth agree with the tree', () => {
    const g = chain(['reappraisal', 'suppression', 'rumination']);
    expect(leaves(g).map((l) => l.f)).toEqual(['reappraisal', 'suppression', 'rumination']);
    expect(leafCount(g)).toBe(3);
    expect(depth(L('reappraisal'))).toBe(0);
    expect(depth(g)).toBe(2);
  });

  it('tierOf takes the highest-tier leaf, abilityOf the heaviest', () => {
    const g = node('blend', L('reappraisal'), L('equanimity'));
    expect(tierOf(g)).toBe(5);
    expect(abilityOf(L('rumination'))).toBe('loop');
    expect(abilityOf(g)).toBe(FAMILY.reappraisal.ability); // ties go to the first operand
    expect(echoAbilityOf(g)).toBe(FAMILY.equanimity.ability);
    expect(echoAbilityOf(L('reappraisal'))).toBeNull();
    expect(echoAbilityOf(node('blend', L('reappraisal'), L('reappraisal')))).toBeNull();
  });
});

describe('genome: nameOf', () => {
  it('names whole leaves and poles', () => {
    expect(nameOf(L('reappraisal'))).toBe('Reappraisal');
    expect(nameOf(L('reappraisal', 1))).toBe('Idealized Reappraisal');
    expect(nameOf(L('reappraisal', -1))).toBe('Devalued Reappraisal');
  });

  it('hybrid: adjective of the lighter parent modifies the heavier head', () => {
    expect(nameOf(node('blend', L('reappraisal'), L('suppression')))).toBe('Suppressed Reappraisal');
  });

  it('carve adds the Hollowed joiner and the carved-in leaf is the modifier', () => {
    expect(nameOf(node('carve', L('reappraisal'), L('suppression')))).toBe('Suppressed Hollowed Reappraisal');
  });

  it('same-family hybrid collapses to the plain family name', () => {
    expect(nameOf(node('blend', L('reappraisal'), L('reappraisal')))).toBe('Reappraisal');
  });

  it('shows at most two modifiers, never undefined', () => {
    const name = nameOf(chain(ALL.slice(0, 6)));
    expect(name).not.toMatch(/undefined/);
    const words = name.split(' ');
    expect(words.length).toBeLessThanOrEqual(4); // 2 mods + (joiner) + head
  });
});

describe('genome: aspectsOf', () => {
  it('a leaf has its two family aspects', () => {
    expect(aspectsOf(L('reappraisal')).slice().sort()).toEqual(['cortical', 'vagal']);
  });
  it('hybrids under 4 leaves keep 2 aspects, 4+ leaves keep 3', () => {
    expect(aspectsOf(chain(ALL.slice(0, 2)))).toHaveLength(2);
    expect(aspectsOf(chain(ALL.slice(0, 3)))).toHaveLength(2);
    expect(aspectsOf(chain(ALL.slice(0, 4)))).toHaveLength(3);
    expect(aspectsOf(chain(ALL.slice(0, 6)))).toHaveLength(3);
  });
  it('aspects are unique and come from the contributing families', () => {
    const g = chain(ALL.slice(0, 5));
    const asp = aspectsOf(g);
    expect(new Set(asp).size).toBe(asp.length);
    const pool = new Set(leaves(g).flatMap((l) => FAMILY[l.f].aspects));
    for (const a of asp) expect(pool.has(a)).toBe(true);
  });
  it('heavier leaf contributes its aspects first', () => {
    const asp = aspectsOf(node('carve', L('reappraisal'), L('suppression')));
    expect(asp.slice().sort()).toEqual(['cortical', 'vagal']);
  });
});

describe('genome: baseStats', () => {
  it('a plain leaf returns the family stats', () => {
    const s = baseStats(L('reappraisal')), f = FAMILY.reappraisal.stats;
    expect(s.tol).toBeCloseTo(f.tol);
    expect(s.sal).toBeCloseTo(f.sal);
    expect(s.lat).toBeCloseTo(f.lat);
    expect(s.reach).toBeCloseTo(f.reach);
  });

  it('a carved-in leaf weighs less than a blended-in leaf', () => {
    const weak = 'suppression', strong = 'equanimity'; // sal 30 vs 260
    const blend = baseStats(node('blend', L(weak), L(strong)));
    const carve = baseStats(node('carve', L(weak), L(strong)));
    expect(carve.sal).toBeLessThan(blend.sal);
  });

  it('poles trade tolerance for salience', () => {
    const w = baseStats(L('reappraisal')), up = baseStats(L('reappraisal', 1)), dn = baseStats(L('reappraisal', -1));
    expect(up.sal).toBeGreaterThan(w.sal); expect(up.tol).toBeLessThan(w.tol);
    expect(dn.sal).toBeLessThan(w.sal); expect(dn.tol).toBeGreaterThan(w.tol);
    expect(up.lat).toBeLessThan(w.lat);
    expect(up.lab).toBeGreaterThan(w.lab);
  });

  it('hybrids get a per-leaf synergy bonus', () => {
    const solo = baseStats(L('reappraisal'));
    const dbl = baseStats(node('blend', L('reappraisal'), L('reappraisal')));
    expect(dbl.tol).toBeCloseTo(solo.tol * 1.15 * 1.12); // weights sum to 1.15, synergy 1 + 0.12 per extra leaf
  });

  it('every stat is finite for deep trees', () => {
    const s = baseStats(chain(ALL));
    for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('genome: prune', () => {
  it('leaves a small tree alone', () => {
    const g = chain(ALL.slice(0, MAX_LEAVES));
    const r = prune(g);
    expect(r.ghosts).toBe(0);
    expect(r.g).toBe(g);
  });

  it('caps at MAX_LEAVES and reports one ghost per dropped leaf', () => {
    expect(MAX_LEAVES).toBe(6);
    const r = prune(chain(ALL)); // 8 leaves
    expect(leafCount(r.g)).toBe(MAX_LEAVES);
    expect(r.ghosts).toBe(2);
  });

  it('works for carve trees and a single over-cap leaf', () => {
    const g = node('carve', chain(ALL.slice(0, 6)), L('equanimity'));
    const r = prune(g);
    expect(leafCount(r.g)).toBe(MAX_LEAVES);
    expect(r.ghosts).toBe(1);
  });

  it('drops the lightest leaf (the deepest one, i.e. leftmost of a left-leaning chain)', () => {
    const r = prune(chain([...ALL.slice(0, 6), 'equanimity']));
    const left = leaves(r.g).map((l) => l.f);
    expect(left).not.toContain('reappraisal');
    expect(left).toContain('equanimity');
  });
});

describe('genome: complexityOf', () => {
  const unit = (g, link = 1, traits = [], ghosts = 0) => ({ g, link, traits, ghosts });

  it('grows with ladder link', () => {
    const g = L('reappraisal');
    let prev = 0;
    for (let n = 1; n <= 12; n++) { const c = complexityOf(unit(g, n)); expect(c).toBeGreaterThan(prev); prev = c; }
  });
  it('grows with leaves, ghosts and traits', () => {
    const one = complexityOf(unit(L('reappraisal')));
    const three = complexityOf(unit(chain(ALL.slice(0, 3))));
    expect(three).toBeGreaterThan(one);
    expect(complexityOf(unit(L('reappraisal'), 1, [], 4))).toBeGreaterThan(one);
    expect(complexityOf(unit(L('reappraisal'), 1, ['ache', 'trust']))).toBeGreaterThan(one);
  });
  it('a lone link-1 leaf is exactly 1 (+ trait share)', () => {
    expect(complexityOf(unit(L('reappraisal')))).toBeCloseTo(1);
    expect(complexityOf(unit(L('reappraisal'), 1, ['ache']))).toBeCloseTo(1.25);
  });
});

describe('genome: traits', () => {
  const t = (traits) => ({ traits });
  it('caps inherited traits at 10', () => {
    const a = t(['ache', 'trust', 'glad', 'rapture', 'calm', 'ease', 'gather', 'see']);
    const b = t(['tire', 'fade', 'release', 'end', 'ache', 'trust', 'glad', 'rapture']);
    expect(inheritTraits(a, b, () => 0.1).length).toBeLessThanOrEqual(10);
    expect(inheritTraits(a, b, () => 0.9).length).toBeLessThanOrEqual(10);
  });
  it('unions parents; duplicates only double up when the rng says so', () => {
    const a = t(['ache', 'trust']), b = t(['ache', 'glad']);
    const strict = inheritTraits(a, b, () => 0.9);
    expect(strict.slice().sort()).toEqual(['ache', 'glad', 'trust']);
    const loose = inheritTraits(a, b, () => 0.1);
    expect(loose.filter((x) => x === 'ache')).toHaveLength(2);
  });
  it('each link has a trait in order', () => {
    for (let n = 1; n <= 12; n++) expect(traitForLink(n)).toBe(LINKS[n - 1].trait);
    expect(traitForLink(2)).toBe('trust');
    expect(traitForLink(12)).toBe('end');
  });
});
