import { describe, it, expect } from 'vitest';
import {
  actions, key, leaf, node, leaves, STAGES, COSTS, HABITS, FAMILY, tierOf, leafCount, unlocked, unitCap, ringsOpen,
} from '../../src/game/index.js';
import { gameAt, addLeaf, addRaw } from './helpers.js';

const stageOf = (unlock) => STAGES.findIndex((s) => s.unlock === unlock);
const unit = (G, id) => G.units.find((u) => u.id === id);

describe('operations: integrate and split', () => {
  it('integrate then split returns two units whose genome keys equal the parents', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression');
    const ka = key(a.g), kb = key(b.g);
    const h = actions.integrate(G, a.id, b.id);
    expect(h).toBeTruthy();
    expect(G.units).toHaveLength(1);
    expect(key(h.g)).toBe(`(${ka}b${kb})`);
    expect(G.insight).toBe(100 - COSTS.integrate);
    expect(G.stats.integrations).toBe(1);

    expect(actions.split(G, h.id)).toBe(true);
    expect(G.units).toHaveLength(2);
    expect(G.units.map((u) => key(u.g)).sort()).toEqual([ka, kb].sort());
    expect(G.insight).toBe(100 - COSTS.integrate - COSTS.split);
    expect(G.stats.splits).toBe(1);
  });

  it('integrate keeps the higher link and the seat, and merges ghosts', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal', { link: 3, seat: { ring: 0, dir: 2 } }), b = addLeaf(G, 'avoidance', { link: 1, ghosts: 2 });
    const h = actions.integrate(G, a.id, b.id);
    expect(h.link).toBe(3);
    expect(h.seat).toEqual({ ring: 0, dir: 2 });
    expect(h.ghosts).toBe(2);
    expect(h.traits.length).toBeGreaterThan(0);
  });

  it('integrating beyond six leaves prunes and records ghosts', () => {
    const G = gameAt(17); G.insight = 1e4;
    const fams = ['reappraisal', 'suppression', 'rumination', 'avoidance'];
    let h = addLeaf(G, fams[0]);
    for (const f of [...fams.slice(1), 'attunement', 'projection', 'dissociation', 'sublimation']) {
      const b = addLeaf(G, f);
      h = actions.integrate(G, h.id, b.id);
    }
    expect(leafCount(h.g)).toBe(6);
    expect(h.ghosts).toBe(2);
  });

  it('refuses without enough insight once insight exists, and on self or missing ids', () => {
    const G = gameAt(17); G.insight = 5;
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression');
    expect(actions.integrate(G, a.id, b.id)).toBe(false);
    G.insight = 100;
    expect(actions.integrate(G, a.id, a.id)).toBe(false);
    expect(actions.integrate(G, a.id, 9999)).toBe(false);
    expect(G.units).toHaveLength(2);
  });

  it('busy units cannot be combined, split or repurposed', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'); a.busy = 'dream';
    expect(actions.integrate(G, a.id, b.id)).toBe(false);
    expect(actions.repurpose(G, a.id)).toBe(false);
    expect(actions.split(G, a.id)).toBe(false);
  });
});

describe('operations: subtract', () => {
  it('produces a carve node that keeps the first operand link', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal', { link: 4 }), b = addLeaf(G, 'suppression', { link: 2 });
    const h = actions.subtract(G, a.id, b.id);
    expect(h.g.t).toBe('node');
    expect(h.g.op).toBe('carve');
    expect(key(h.g)).toBe('(reappraisalcsuppression)');
    expect(h.link).toBe(4);
    expect(G.insight).toBe(100 - COSTS.subtract);
    expect(G.stats.subtractions).toBe(1);
  });
});

describe('operations: split of a whole leaf', () => {
  it('above link 1 yields idealized and devalued poles one link lower', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal', { link: 3, traits: ['ache', 'trust', 'glad'], seat: { ring: 0, dir: 1 } });
    expect(actions.split(G, a.id)).toBe(true);
    expect(G.units).toHaveLength(2);
    expect(G.units.map((u) => key(u.g)).sort()).toEqual(['reappraisal+', 'reappraisal-']);
    for (const u of G.units) expect(u.link).toBe(2);
    expect(G.units.find((u) => u.seat)?.seat).toEqual({ ring: 0, dir: 1 });
    for (const u of G.units) expect(u.traits.length).toBeGreaterThan(0);
  });

  it('a link-1 whole leaf has no seam and costs nothing', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'reappraisal');
    expect(actions.split(G, a.id)).toBe(false);
    expect(G.insight).toBe(100);
    expect(G.units).toHaveLength(1);
  });

  it('a pole leaf cannot be split again', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addRaw(G, leaf('reappraisal', 1), { link: 3 });
    expect(actions.split(G, a.id)).toBe(false);
  });

  it('the seam of a carve hybrid returns both operands', () => {
    const G = gameAt(17); G.insight = 100;
    const a = addLeaf(G, 'rumination', { link: 2 }), b = addLeaf(G, 'avoidance', { link: 2 });
    const h = actions.subtract(G, a.id, b.id);
    actions.split(G, h.id);
    expect(G.units.map((u) => key(u.g)).sort()).toEqual(['avoidance', 'rumination']);
  });
});

describe('operations: repurpose', () => {
  it('turns a unit into habit counts on its gate habit', () => {
    const G = gameAt(17);
    const u = addLeaf(G, 'suppression', { link: 1 }); // dir 1 -> pause; tier 1 * link 1 * (1 + 1 leaf) = 2
    expect(actions.repurpose(G, u.id)).toBe(true);
    expect(G.habits.pause).toBe(2);
    expect(G.units).toHaveLength(0);
    expect(G.stats.repurposes).toBe(1);
  });

  it('count scales with tier, link and leaves; habit follows the gate', () => {
    const G = gameAt(17);
    const g = node('blend', leaf('equanimity'), leaf('rumination')); // first family: equanimity dir 9 -> identity
    const u = addRaw(G, g, { link: 3 });
    const n = Math.round(tierOf(g) * 3 * (1 + 2));
    actions.repurpose(G, u.id);
    expect(G.habits[HABITS[9].id]).toBe(n);
    expect(n).toBe(45);
  });

  it('accumulates onto existing habits', () => {
    const G = gameAt(17); G.habits.breath = 5;
    const u = addLeaf(G, 'reappraisal');
    actions.repurpose(G, u.id);
    expect(G.habits.breath).toBe(7);
  });
});

describe('operations: sell and place', () => {
  it('sell removes the unit and refunds attention', () => {
    const G = gameAt(1); G.attention = 0;
    const u = addLeaf(G, 'suppression');
    expect(actions.sell(G, u.id)).toBe(true);
    expect(G.units).toHaveLength(0);
    expect(G.attention).toBeGreaterThanOrEqual(1);
  });

  it('place seats, swaps, and respects the unit cap and ring unlocks', () => {
    const G = gameAt(1);
    const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'), c = addLeaf(G, 'rumination');
    expect(unitCap(G)).toBe(2);
    expect(actions.place(G, a.id, { ring: 0, dir: 0 })).toBe(true);
    expect(actions.place(G, b.id, { ring: 0, dir: 1 })).toBe(true);
    expect(actions.place(G, c.id, { ring: 0, dir: 2 })).toBe(false); // cap
    expect(actions.place(G, c.id, { ring: 0, dir: 0 })).toBe(true); // swap with a: a goes to bench
    expect(unit(G, a.id).seat).toBe(null);
    expect(unit(G, c.id).seat).toEqual({ ring: 0, dir: 0 });
    expect(ringsOpen(G)).toBe(1);
    expect(actions.place(G, a.id, { ring: 1, dir: 0 })).toBe(false); // ring 2 locked
    G.stage = stageOf('ring2'); G.level = 5; // ring 2 open, cap 6
    expect(actions.place(G, a.id, { ring: 1, dir: 0 })).toBe(true);
    expect(unit(G, a.id).seat).toEqual({ ring: 1, dir: 0 });
  });
});

describe('operations: stage gating (actions refuse before unlock)', () => {
  const gated = [
    ['shop', 'buy', (G) => { G.attention = 10; return actions.buy(G, 0); }],
    ['habits', 'buyHabit', (G) => { G.affect = 1e9; return actions.buyHabit(G, 'breath'); }],
    ['integrate', 'integrate', (G) => { const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'); return actions.integrate(G, a.id, b.id); }],
    ['repurpose', 'repurpose', (G) => actions.repurpose(G, addLeaf(G, 'reappraisal').id)],
    ['insight', 'cast', (G) => { G.insight = 100; return actions.cast(G, 'exhale'); }],
    ['split', 'split', (G) => { G.insight = 100; return actions.split(G, addLeaf(G, 'reappraisal', { link: 2 }).id); }],
    ['subtract', 'subtract', (G) => { G.insight = 100; const a = addLeaf(G, 'reappraisal'), b = addLeaf(G, 'suppression'); return actions.subtract(G, a.id, b.id); }],
    ['attendants', 'buyAttendant', (G) => { G.affect = 1e9; return actions.buyAttendant(G); }],
    ['verbs', 'startVerb', (G) => actions.startVerb(G, 'dream', addLeaf(G, 'reappraisal').id)],
    ['exchange', 'exchange', (G) => { G.attention = 100; return actions.exchange(G, 'attention', 'insight'); }],
    ['stance', 'chooseStance', (G) => actions.chooseStance(G, 'toward')],
    ['mirror', 'mirror', (G) => { G.affect = 1e12; return actions.mirror(G); }],
  ];

  for (const [unlock, name, run] of gated) {
    it(`${name} refuses one stage before "${unlock}" and works at it`, () => {
      const at = stageOf(unlock);
      expect(at).toBeGreaterThan(0);
      const before = gameAt(at - 1), after = gameAt(at);
      before.shop = ['reappraisal', null, null, null, null]; after.shop = ['reappraisal', null, null, null, null];
      expect(unlocked(before, unlock)).toBe(false);
      expect(run(before)).toBeFalsy();
      expect(unlocked(after, unlock)).toBe(true);
      expect(run(after)).toBeTruthy();
    });
  }

  it('everything is refused at stage 0 except attend', () => {
    const G = gameAt(0); G.attention = 100; G.affect = 1e12; G.insight = 100;
    G.shop = ['reappraisal', null, null, null, null];
    expect(actions.buy(G, 0)).toBe(false);
    expect(actions.buyHabit(G, 'breath')).toBe(false);
    expect(actions.cast(G, 'label')).toBe(false);
    expect(G.units).toHaveLength(0);
    expect(actions.attend(G)).toBeGreaterThan(0);
  });

  it('repurposing and splitting leave state untouched when refused', () => {
    const G = gameAt(3);
    const u = addLeaf(G, 'reappraisal', { link: 2 });
    G.insight = 50;
    expect(actions.repurpose(G, u.id)).toBe(false);
    expect(actions.split(G, u.id)).toBe(false);
    expect(G.units).toHaveLength(1); expect(G.insight).toBe(50); expect(G.habits).toEqual({});
  });
});

describe('operations: spells, verbs, exchange, stance, mirror', () => {
  it('cast spends insight; exhale restores composure, recollect pays out', () => {
    const G = gameAt(17); G.insight = 200; G.composure = 30; G.prod = 100;
    expect(actions.cast(G, 'exhale')).toBe(true);
    expect(G.composure).toBe(50);
    expect(G.insight).toBe(170);
    const a = G.affect; expect(actions.cast(G, 'recollect')).toBe(true);
    expect(G.affect).toBeGreaterThan(a);
    expect(actions.cast(G, 'label')).toBe(true); expect(G.labelT).toBe(8);
    expect(actions.cast(G, 'nope')).toBe(false);
  });

  it('verbs need the right aspect and busy the unit', () => {
    const G = gameAt(17);
    const a = addLeaf(G, 'suppression'), b = addLeaf(G, 'reappraisal');
    expect(actions.startVerb(G, 'ruminate', a.id)).toBe(false); // wants cortical
    expect(actions.startVerb(G, 'ruminate', b.id)).toBe(true);
    expect(b.busy).toBe('ruminate'); expect(b.seat).toBe(null);
    expect(actions.startVerb(G, 'ruminate', a.id)).toBe(false); // slot taken
  });

  it('exchange converts resources both ways', () => {
    const G = gameAt(17); G.attention = 5; G.insight = 0;
    expect(actions.exchange(G, 'attention', 'insight')).toBe(true);
    expect(G.attention).toBe(4); expect(G.insight).toBe(12);
    expect(actions.exchange(G, 'attention', 'nope')).toBe(false);
  });

  it('mirror costs 1e6 * 40^n and raises seat cap and rings', () => {
    const G = gameAt(17); G.affect = 1e6;
    expect(actions.mirror(G)).toBe(true);
    expect(G.mirrors).toBe(1); expect(G.affect).toBeCloseTo(0);
    expect(actions.mirror(G)).toBe(false);
    expect(ringsOpen(G)).toBe(3);
  });

  it('chooseStance only accepts known stances', () => {
    const G = gameAt(17);
    expect(actions.chooseStance(G, 'bogus')).toBe(false);
    expect(actions.chooseStance(G, 'against')).toBe(true);
    expect(G.stance).toBe('against');
    expect(leaves(leaf('reappraisal'))).toHaveLength(1);
    expect(FAMILY.reappraisal.tier).toBe(1);
  });
});
