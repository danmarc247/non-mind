import { describe, it, expect } from 'vitest';
import { actions, key, LINKS, traitForLink } from '../../src/game/index.js';
import { gameAt, addLeaf } from './helpers.js';

function buyFamily(G, family) {
  G.shop = [family, null, null, null, null];
  G.attention = Math.max(G.attention, 10);
  return actions.buy(G, 0);
}

describe('ladder: fusing', () => {
  it('two same-family purchases fuse into link 2 with the link-2 trait', () => {
    const G = gameAt(1);
    expect(buyFamily(G, 'reappraisal')).toBe(true);
    expect(G.units).toHaveLength(1);
    expect(G.units[0].link).toBe(1);
    expect(buyFamily(G, 'reappraisal')).toBe(true);
    expect(G.units).toHaveLength(1);
    const u = G.units[0];
    expect(u.link).toBe(2);
    expect(u.traits).toContain(traitForLink(2));
    expect(u.traits).toContain('trust');
    expect(G.stats.links).toBe(1);
    expect(G.events.some((e) => e.type === 'link' && e.link === 2)).toBe(true);
  });

  it('different families do not fuse', () => {
    const G = gameAt(1);
    buyFamily(G, 'reappraisal'); buyFamily(G, 'suppression');
    expect(G.units).toHaveLength(2);
    expect(G.stats.links).toBe(0);
  });

  it('fusion needs equal links', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { link: 2 });
    buyFamily(G, 'reappraisal');
    expect(G.units).toHaveLength(2);
  });

  it('the survivor keeps a seat if either twin was seated', () => {
    const G = gameAt(1);
    const seated = addLeaf(G, 'reappraisal', { seat: { ring: 0, dir: 3 } });
    buyFamily(G, 'reappraisal');
    expect(G.units).toHaveLength(1);
    expect(G.units[0].id).toBe(seated.id);
    expect(G.units[0].seat).toEqual({ ring: 0, dir: 3 });
    expect(G.units[0].link).toBe(2);
  });

  it('chain fusing: a link-2 twin turns the fresh link-2 into link 3 in one buy', () => {
    const G = gameAt(1);
    addLeaf(G, 'reappraisal', { link: 1 });
    addLeaf(G, 'reappraisal', { link: 2 });
    buyFamily(G, 'reappraisal');
    expect(G.units).toHaveLength(1);
    expect(G.units[0].link).toBe(3);
    expect(G.stats.links).toBe(2);
    expect(G.units[0].traits).toEqual(expect.arrayContaining(['trust', 'glad']));
  });

  it('hybrids fuse on identical keys only', () => {
    const G = gameAt(5);
    G.insight = 100;
    const [a, b, c, d] = ['reappraisal', 'suppression', 'reappraisal', 'suppression'].map((f) => addLeaf(G, f));
    const h1 = actions.integrate(G, a.id, b.id);
    expect(h1.g.t).toBe('node');
    const h2 = actions.integrate(G, c.id, d.id);
    // same family pair, same order: keys equal, same link -> fused into one link-2 hybrid
    expect(key(h1.g)).toBe('(reappraisalbsuppression)');
    expect(G.units).toHaveLength(1);
    expect(G.units[0].link).toBe(2);
    expect(h2).toBeTruthy();
  });

  it('every link has a distinct trait and rising multiplier', () => {
    expect(LINKS).toHaveLength(12);
    expect(new Set(LINKS.map((l) => l.trait)).size).toBe(12);
    for (let i = 1; i < 12; i++) expect(LINKS[i].mult).toBeGreaterThan(LINKS[i - 1].mult);
  });
});

describe('ladder: reaching link 12', () => {
  it('removes the unit and increments endings', () => {
    const G = gameAt(1);
    for (let l = 1; l <= 11; l++) addLeaf(G, 'equanimity', { link: l });
    expect(G.units).toHaveLength(11);
    buyFamily(G, 'equanimity'); // a second link-1 twin cascades 1 -> 12
    expect(G.endings).toBe(1);
    expect(G.units).toHaveLength(0);
    expect(G.stats.links).toBe(11);
    expect(G.events.some((e) => e.type === 'ending')).toBe(true);
    expect(G.log.some((l) => l.kind === 'ending')).toBe(true);
  });

  it('an ending boosts the affect multiplier', async () => {
    const { affectMul } = await import('../../src/game/index.js');
    const G = gameAt(1); const before = affectMul(G); G.endings = 1;
    expect(affectMul(G)).toBeGreaterThan(before);
  });
});

describe('ladder: bench limits', () => {
  it('a full bench refuses new families but still lets a twin buy (it fuses)', () => {
    const G = gameAt(1);
    const fams = ['reappraisal', 'suppression', 'rumination', 'avoidance', 'attunement', 'projection', 'dissociation', 'sublimation'];
    for (const f of fams) addLeaf(G, f);
    expect(buyFamily(G, 'containment')).toBe(false);
    expect(buyFamily(G, 'reappraisal')).toBe(true);
    expect(G.units.find((u) => key(u.g) === 'reappraisal').link).toBe(2);
  });
});
