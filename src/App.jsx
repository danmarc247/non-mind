import { useEffect, useRef } from 'react';
import Scene from './gfx/Scene.jsx';
const hudMod = Object.values(import.meta.glob('./ui/Hud.jsx', { eager: true }))[0];
import { start, useVersion, game } from './game/store.js';
function Fallback() { useVersion(); return game.started ? null : <button className="fixed inset-0 m-auto h-24 w-72 rounded-full border-4 border-ink bg-yolk font-title text-4xl text-ink" onClick={() => { try { getAudio().unlock(); } catch { /* optional */ } start(); }}>NON-MIND</button>; }
const Hud = hudMod?.default || Fallback;
import { onEvent } from './game/store.js';
import Manual from './ui/Manual.jsx';
import { getAudio } from './audio/engine.js';

// game event -> spatial sound. y is fixed at unit height; x/z come from the sim.
const SFX = { attend: 'attend', waveStart: 'waveStart', waveWin: 'waveWin', waveLose: 'waveLose', link: 'merge', integrate: 'integrate', subtract: 'subtract', split: 'split', repurpose: 'repurpose', death: 'death', enemyDeath: 'enemyDeath', cast: 'cast', stage: 'unlock', level: 'upgrade', verbStart: 'verbStart', verbDone: 'verbDone', mood: 'decay', stance: 'stanceChoose', ending: 'unlock', mirror: 'unlock', spell: 'cast', mutation: 'mutation', miss: 'miss', coreHit: 'coreHit' };

export default function App() {
  const audioRef = useRef(null);
  useEffect(() => {
    let last = 0;
    return onEvent((e) => {
      let a = audioRef.current;
      if (!a) { try { a = audioRef.current = getAudio(); } catch { return; } }
      try {
        const pos = e.x !== undefined ? [e.x, 0.75, e.z] : undefined;
        if (e.type === 'reset') return a.reset();
        if (e.type === 'sfx') return a.sfx(e.name, {});
        if (e.type === 'beat') return a.sfx('gate', { gate: e.gate });
        if (e.type === 'hit') { const now = performance.now(); if (now - last < 45) return; last = now; return a.sfx('hit', { position: pos, intensity: Math.min(1, 0.3 + e.amt * 2), aspect: e.aspect }); }
        if (SFX[e.type]) a.sfx(SFX[e.type], { position: pos, aspect: e.aspect });
      } catch { /* sound must never break the game */ }
    });
  }, []);
  return (
    <div className="fixed inset-0 bg-paper">
      <Scene audioRef={audioRef} />
      <Hud />
      <Manual />
    </div>
  );
}
