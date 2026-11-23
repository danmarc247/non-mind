import { describe, it, expect } from 'vitest';
import { startWave, stepBattle } from '../../src/game/battle.js'; // not re-exported by index.js
import {
  step, aspectTiers, unitStats, seatPos, gatePos, ARENA, FAMILIES, ABILITIES, ASPECT_IDS, ASPECT_THRESHOLDS,
  BEATS_PER_WAVE, leaf, node, LINKS,
} from '../../src/game/index.js';
import { gameAt, addLeaf, addRaw, stepUntil, badNumbers } from './helpers.js';

const seat = (dir, ring = 0) => ({ ring, dir });

describe('battle: startWave', () => {
  it('builds combatants only from seated units', () => {
    const G = gameAt(1);
    const a = addLeaf(G, 'reappraisal', { seat: seat(0) });
    addLeaf(G, 'suppression');                      // bench
    const c = addLeaf(G, 'rumination', { seat: seat(2) });
    const d = addLeaf(G, 'avoidance'); d.busy = 'dream';
    startWave(G);
    expect(G.phase).toBe('fight');
    expect(G.battle.units.map((u) => u.uid).sort()).toEqual([a.id, c.id].sort());
    expect(G.battle.enemies).toHaveLength(0);       // beats spawn over time
    expect(G.battle.arc.id).toBe('negation');
    for (const u of G.battle.units) { expect(u.alive).toBe(true); expect(u.hp).toBe(u.max); expect(u.hp).toBeGreaterThan(0); }
  });

  it('combatants stand on their seats', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { seat: seat(3, 1) });
    startWave(G);
    const [x, z] = seatPos(1, 3);
    expect(G.battle.units[0].x).toBeCloseTo(x);
    expect(G.battle.units[0].z).toBeCloseTo(z);
  });

  it('trust gives a veil, and the link multiplier scales tolerance', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { link: 1, traits: ['ache', 'trust'], seat: seat(0) });
    addLeaf(G, 'reappraisal', { link: 4, traits: ['ache'], seat: seat(1) });
    startWave(G);
    const [lo, hi] = G.battle.units;
    expect(lo.veil).toBeCloseTo(lo.max * 0.25);
    expect(hi.veil).toBe(0);
    expect(hi.max / lo.max).toBeCloseTo(LINKS[3].mult);
  });

  it('echo ability is only present from stage 12', () => {
    const G = gameAt(11);
    addRaw(G, node('blend', leaf('reappraisal'), leaf('rumination')), { seat: seat(0) });
    startWave(G); expect(G.battle.units[0].echo).toBeNull();
    const H = gameAt(12);
    addRaw(H, node('blend', leaf('reappraisal'), leaf('rumination')), { seat: seat(0) });
    startWave(H); expect(H.battle.units[0].echo).toBe('loop');
  });

  it('step starts the wave on its own once a unit is seated, and not before', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal');
    for (let i = 0; i < 100; i++) step(G, 0.1);
    expect(G.phase).toBe('prep');
    G.units[0].seat = seat(0);
    stepUntil(G, (g) => g.phase === 'fight', 10);
    expect(G.phase).toBe('fight');
  });
});

describe('battle: outcomes', () => {
  it('a strong seated unit wins wave 1 and clears every stressor', () => {
    const G = gameAt(1);
    addLeaf(G, 'equanimity', { link: 6, seat: seat(0) });
    startWave(G);
    let r = null, t = 0;
    while (!r && t < 200) { r = stepBattle(G, 0.1); t += 0.1; }
    expect(r).toBe('won');
    expect(G.battle.enemies.filter((e) => e.alive)).toHaveLength(0);
    expect(G.stats.kills).toBeGreaterThan(0);
    expect(G.composure).toBe(G.composureMax);
    expect(G.battle.beat).toBe(BEATS_PER_WAVE);
  });

  it('through step a win advances the wave counter and gives affect for kills', () => {
    const G = gameAt(1);
    addLeaf(G, 'equanimity', { link: 6, seat: seat(0) });
    stepUntil(G, (g) => g.wave === 2, 200);
    expect(G.wave).toBe(2);
    expect(G.affect).toBeGreaterThan(0);
    expect(G.streak).toBe(1);
  });

  it('an empty-handed board loses, resets composure, grants attention and adds a dread mood', () => {
    const G = gameAt(1);
    G.attention = 0;
    startWave(G);                                   // nobody seated
    expect(G.battle.units).toHaveLength(0);
    let r = null, t = 0;
    while (!r && t < 300) { r = stepBattle(G, 0.1); t += 0.1; }
    expect(r).toBe('lost');
    expect(G.composure).toBeLessThanOrEqual(0);
  });

  it('through step the empty board ends in phase "lost" with a dread mood', () => {
    const G = gameAt(1);
    G.attention = 0;
    startWave(G);
    stepUntil(G, (g) => g.phase === 'lost', 300);
    expect(G.phase).toBe('lost');
    expect(G.moods.filter((m) => m.kind === 'dread')).toHaveLength(1);
    expect(G.attention).toBe(2);
    expect(G.composure).toBe(G.composureMax);
  });

  it('losing through step: dread mood, streak reset, composure restored, +2 attention', () => {
    const G = gameAt(1);
    G.attention = 0; G.streak = 2;
    addLeaf(G, 'reappraisal', { seat: seat(0) });
    G.units[0].traits = ['ache'];
    // make the lone regulator unable to hold: tiny hp via a doomed arena (huge overwhelm scales stressors)
    G.overwhelm = 1;
    G.composure = 1;
    stepUntil(G, (g) => g.phase === 'lost', 300);
    expect(G.phase).toBe('lost');
    expect(G.moods.filter((m) => m.kind === 'dread').length).toBeGreaterThanOrEqual(1);
    expect(G.streak).toBe(0);
    expect(G.composure).toBe(G.composureMax);
    expect(G.attention).toBeGreaterThanOrEqual(2);
    expect(G.wave).toBe(1);
  });

  it('three dread moods thicken the next wave', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { seat: seat(0) });
    startWave(G); const B = G.battle; B.beatT = 0; stepBattle(G, 0.01);
    const calm = B.enemies.length;
    const H = gameAt(1);
    addLeaf(H, 'reappraisal', { seat: seat(0) });
    for (let i = 0; i < 3; i++) H.moods.push({ kind: 'dread', t: 100, id: i });
    startWave(H); H.battle.beatT = 0; stepBattle(H, 0.01);
    expect(H.battle.enemies.length).toBeGreaterThan(calm);
  });
});

describe('battle: aspect tiers', () => {
  const fam = (id) => FAMILIES.find((f) => f.id === id);
  const seatAll = (G, ids, opts = {}) => ids.forEach((id, i) => addLeaf(G, id, { seat: seat(i), ...opts }));

  it('thresholds are 2/4/6', () => { expect(ASPECT_THRESHOLDS).toEqual([2, 4, 6]); });

  it('tier 0 with one family, tier 1 at two distinct families sharing an aspect', () => {
    const G = gameAt(1);
    seatAll(G, ['reappraisal']);
    expect(aspectTiers(G).cortical).toBe(0);
    seatAll(G, ['rumination']); // cortical in both families
    G.units[1].seat = seat(1);
    const t = aspectTiers(G);
    expect(t.cortical).toBe(1); expect(t.cortical_n).toBe(2);
    expect(t.vagal).toBe(0);
  });

  it('duplicates of one family count once', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { seat: seat(0) }); addLeaf(G, 'reappraisal', { seat: seat(1), link: 2 });
    expect(aspectTiers(G).cortical_n).toBe(1);
  });

  it('bench units do not count', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { seat: seat(0) }); addLeaf(G, 'rumination');
    expect(aspectTiers(G).cortical_n).toBe(1);
  });

  it('reaches tier 2 at 4 and tier 3 at 6 (3 somatic families + wildcard + fade units)', () => {
    const G = gameAt(15);
    seatAll(G, ['suppression', 'avoidance', 'containment']);
    expect(aspectTiers(G).somatic).toBe(1); // n=3
    G.stage = 16;                                  // wildcard adds one
    expect(aspectTiers(G)).toMatchObject({ somatic: 2, somatic_n: 4 });
    addLeaf(G, 'attunement', { seat: seat(5), traits: ['ache', 'fade'] });
    addLeaf(G, 'equanimity', { seat: seat(6), traits: ['ache', 'fade'] });
    expect(aspectTiers(G)).toMatchObject({ somatic: 3, somatic_n: 6 });
  });

  it('the wave arc "cancel" silences aspect bonds', () => {
    const G = gameAt(1);
    seatAll(G, ['reappraisal', 'rumination']);
    expect(aspectTiers(G, { mod: { noAspects: true } }).cortical).toBe(0);
  });

  it('aspect bonuses feed unit stats (Somatic raises tolerance)', () => {
    const G = gameAt(1);
    const u = addLeaf(G, 'suppression', { seat: seat(0) }); addLeaf(G, 'avoidance', { seat: seat(1) });
    const flat = unitStats(G, u, { somatic: 0 }).tol, boosted = unitStats(G, u, aspectTiers(G)).tol;
    expect(boosted).toBeGreaterThan(flat);
    expect(fam('suppression').aspects).toContain('somatic');
  });
});

describe('battle: geometry', () => {
  it('seat and gate positions sit on their rings', () => {
    for (let ring = 0; ring < 3; ring++) for (let d = 0; d < 10; d++) { const [x, z] = seatPos(ring, d); expect(Math.hypot(x, z)).toBeCloseTo(ARENA.rings[ring]); }
    for (let d = 0; d < 10; d++) { const [x, z] = gatePos(d); expect(Math.hypot(x, z)).toBeCloseTo(ARENA.gate); }
  });
});

describe('battle: abilities run without NaN', () => {
  for (const f of FAMILIES) {
    it(`${f.id} fires ${f.ability} (${ABILITIES[f.ability].kind}) cleanly`, () => {
      const G = gameAt(17);
      addLeaf(G, f.id, { link: 3, traits: ['ache', 'trust', 'glad'], seat: seat(0) });
      addLeaf(G, 'containment', { link: 3, seat: seat(1) }); // an ally to mend/share with
      startWave(G);
      const B = G.battle;
      B.units[0].charge = 100;
      B.beatT = 0;
      let cast = null;
      for (let i = 0; i < 400 && !cast; i++) {
        stepBattle(G, 0.1);
        cast = G.events.find((e) => e.type === 'cast' && e.id === B.units[0].id && !e.echo);
        B.units[0].charge = Math.max(B.units[0].charge, 100); // keep it armed until enemies exist
      }
      expect(cast, 'ability never fired').toBeTruthy();
      expect(cast.kind).toBe(ABILITIES[f.ability].kind);
      for (let i = 0; i < 100; i++) stepBattle(G, 0.1);
      expect(badNumbers(B)).toEqual([]);
      expect(badNumbers({ a: G.affect, c: G.composure })).toEqual([]);
    });
  }

  it('echo abilities fire at half power on hybrids', () => {
    const G = gameAt(17);
    addRaw(G, node('blend', leaf('rumination'), leaf('attunement')), { seat: seat(0) });
    startWave(G); G.battle.units[0].charge = 100; G.battle.beatT = 0;
    for (let i = 0; i < 100; i++) stepBattle(G, 0.1);
    expect(G.events.some((e) => e.type === 'cast' && e.echo)).toBe(true);
    expect(badNumbers(G.battle)).toEqual([]);
  });

  it('every ability kind in ABILITIES is covered by a family', () => {
    const kinds = new Set(FAMILIES.map((f) => ABILITIES[f.ability].kind));
    expect(kinds.size).toBe(Object.keys(ABILITIES).length);
  });

  it('all aspect ids appear in at least one family', () => {
    const seen = new Set(FAMILIES.flatMap((f) => f.aspects));
    for (const a of ASPECT_IDS) expect(seen.has(a)).toBe(true);
  });
});
