import { describe, it, expect } from 'vitest';
import { createGame, step, serialize, deserialize, simulate } from '../../src/game/index.js';
import { encodeSave, decodeSave, SAVE_PREFIX } from '../../src/game/savecode.js';

const roundTrip = (G) => { const r = decodeSave(encodeSave(serialize(G))); expect(r.ok).toBe(true); return deserialize(r.json); };

describe('save code', () => {
  it('round-trips a played game exactly', () => {
    const G = simulate(300, 7);
    const code = encodeSave(serialize(G));
    expect(code.startsWith(SAVE_PREFIX)).toBe(true);
    expect(code).toMatch(/^NM1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    const r = decodeSave(code);
    expect(r.ok).toBe(true);
    expect(r.json).toBe(serialize(G));
    expect(serialize(deserialize(r.json))).toBe(serialize(G));
  });
  it('tolerates whitespace from pasting', () => {
    const code = encodeSave(serialize(createGame(3)));
    expect(decodeSave(`  ${code.slice(0, 40)}\n${code.slice(40)}  `).ok).toBe(true);
  });
  it('rejects garbage without throwing', () => {
    for (const bad of ['', '   ', 'hello', 'NM1.', 'NM1.abc', 'NM1.!!!.00000000', null, undefined, 42, {}, 'NM2.abc.00000000', '{"seed":1}'])
      expect(decodeSave(bad).ok).toBe(false);
  });
  it('rejects a corrupted string', () => {
    const code = encodeSave(serialize(simulate(60, 2)));
    const i = Math.floor(code.length / 2);
    const bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeSave(bad).error).toBe('checksum mismatch');
    expect(decodeSave(code.slice(0, -20)).ok).toBe(false);
  });
  it('rejects the wrong version', () => {
    const code = encodeSave(serialize(createGame(1)), 2);
    const r = decodeSave(code);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/version/);
  });
  it('rejects a well-formed envelope with the wrong shape', () => {
    expect(decodeSave(encodeSave('{"seed":1}')).ok).toBe(false);
    expect(decodeSave(encodeSave('not json')).ok).toBe(false);
    expect(decodeSave(encodeSave('[1,2]')).ok).toBe(false);
  });
  it('a round-tripped game steps identically for 100 steps', () => {
    // serialize() deliberately resets the battle phase to prep, so compare from a loaded game, as a player would have.
    const A = deserialize(serialize(simulate(240, 11)));
    const B = roundTrip(A);
    for (let i = 0; i < 100; i++) { step(A, 0.1); step(B, 0.1); A.events.length = 0; B.events.length = 0; }
    expect(serialize(B)).toBe(serialize(A));
  });
});

describe('store import/export', () => {
  it('importSave swaps the game, clears selection, and never throws', async () => {
    const store = await import('../../src/game/store.js');
    const code = store.exportSave();
    store.game.selected = 5;
    const seed = store.game.G.seed;
    expect(store.importSave(code)).toEqual({ ok: true });
    expect(store.game.selected).toBe(null);
    expect(store.game.G.seed).toBe(seed);
    expect(store.importSave('NM1.garbage.00000000').ok).toBe(false);
    expect(store.importSave(undefined).ok).toBe(false);
  });
});
