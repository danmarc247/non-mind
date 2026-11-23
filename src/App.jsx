import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { lazyOnOpen } from './lib/lazyOnOpen.jsx';
// The 3D scene (three, R3F, postprocessing, shader-park) loads behind the title: fetching starts at boot, not on Begin.
const sceneModule = import('./gfx/Scene.jsx');
const Scene = lazy(() => sceneModule);
// The GSAP ceremony overlay: its own chunk (with gsap), fetched right after boot so it is ready before Begin; renders nothing until loaded.
const ceremonyModule = import('./ui/Ceremony.jsx').catch(() => ({ default: () => null }));
const Ceremony = lazy(() => ceremonyModule);
const hudMod = Object.values(import.meta.glob('./ui/Hud.jsx', { eager: true }))[0];
import { start, useVersion, game } from './game/store.js';
function Fallback() { useVersion(); return game.started ? null : <button className="fixed inset-0 m-auto h-24 w-72 rounded-full border-4 border-ink bg-yolk font-title text-4xl text-ink" onClick={() => { try { getAudio().unlock(); } catch { /* optional */ } start(); }}>NON-MIND</button>; }
const Hud = hudMod?.default || Fallback;
import { onEvent, wipe, useGame } from './game/store.js';
// Modals load on first open; the stubs keep their events and hotkeys working before that.
const Manual = lazyOnOpen(() => import('./ui/Manual.jsx'), 'nonmind:manual', (e) => e.target?.tagName !== 'INPUT' && (e.key === 'm' || e.key === 'M'));
const SaveMenu = lazyOnOpen(() => import('./ui/SaveMenu.jsx'), 'nonmind:save');
const Lineage = lazyOnOpen(() => import('./ui/Lineage.jsx'), 'nonmind:lineage', (e) => {
  const tag = e.target?.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) && (e.key === 'l' || e.key === 'L');
});
const Book = lazyOnOpen(() => import('./ui/Book.jsx'), 'nonmind:book', (e) => {
  const tag = e.target?.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) && (e.key === 'b' || e.key === 'B') && !document.querySelector('[aria-modal="true"]');
});
import CardToast from './ui/book/CardToast.jsx';
import { getAudio } from './lib/audio.js';
import { startTitleAmbience, stopTitleAmbience } from './lib/titleAmbience.js';

// game event -> spatial sound. y is fixed at unit height; x/z come from the sim.
const SFX = { attend: 'attend', waveStart: 'waveStart', waveWin: 'waveWin', waveLose: 'waveLose', link: 'merge', integrate: 'integrate', subtract: 'subtract', split: 'split', repurpose: 'repurpose', death: 'death', enemyDeath: 'enemyDeath', cast: 'cast', stage: 'unlock', level: 'upgrade', verbStart: 'verbStart', verbDone: 'verbDone', mood: 'decay', stance: 'stanceChoose', ending: 'unlock', mirror: 'unlock', spell: 'cast', mutation: 'mutation', miss: 'miss', coreHit: 'coreHit' };

// A slow breath of filtered noise when the game begins.
function whoosh() {
  try {
    const ctx = getAudio().ctx; if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 3.6), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + 0.05;
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(140, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 2.2); bp.frequency.exponentialRampToValueAtTime(500, t + 3.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t); src.stop(t + 3.6);
  } catch { /* sound is optional */ }
}

// White veil over everything until the fonts are ready, then a slow fade: the title never appears in a fallback face.
function Veil() {
  const [ready, setReady] = useState(false), [gone, setGone] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => { if (live) { setReady(true); setTimeout(() => live && setGone(true), 2400); } };
    const fonts = document.fonts ? Promise.all([document.fonts.load('64px Kablammo'), document.fonts.load('20px "Londrina Solid"'), document.fonts.load('italic 18px Fraunces'), document.fonts.ready]) : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 4000))]).then(() => setTimeout(done, 250));
    return () => { live = false; };
  }, []);
  if (gone) return null;
  return <div className="pointer-events-none fixed inset-0 z-[100] bg-white" style={{ opacity: ready ? 0 : 1, transition: 'opacity 2.2s ease-in-out' }} />;
}

// Start again from inside the game: a confirmed wipe.
function Restart() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = () => setOpen(true); window.addEventListener('nonmind:restart', t); return () => window.removeEventListener('nonmind:restart', t); }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [open]);
  if (!open) return null;
  return (
    <div aria-modal="true" role="dialog" data-modal="restart" className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[3px]" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-full w-[min(440px,100%)] overflow-y-auto rounded-[28px] border-4 border-ink bg-paper p-6 text-center shadow-[10px_12px_0_var(--color-ink)]">
        <div className="font-title text-4xl text-ink">again?</div>
        <p className="mt-2 font-body italic text-ink-2">Everything here goes, including what the resets kept.</p>
        <p className="font-body text-sm text-ink-2">This erases the whole save and starts a new game.</p>
        <div className="mt-4 flex justify-center gap-3 font-head">
          <button className="rounded-full border-[3px] border-ink bg-paper px-5 py-1.5 hover:-translate-y-0.5" onClick={() => setOpen(false)}>keep it</button>
          <button className="rounded-full border-[3px] border-ink bg-tangerine px-5 py-1.5 shadow-[3px_4px_0_var(--color-ink)] hover:-translate-y-0.5" onClick={() => { wipe(); setOpen(false); }}>start again</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const audioRef = useRef(null);
  // Input hygiene, in the capture phase so it runs before every hotkey handler:
  // typing in a field never triggers hotkeys; while a modal is open the game's hotkeys are silent;
  // Space attends and must not also press whichever button happens to have focus.
  useEffect(() => {
    const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (e) => {
      if (e.key === 'Escape') return;
      if (typing(e.target)) { e.stopPropagation(); return; }
      if (document.querySelector('[aria-modal="true"]') && /^[ 1-5rRxXcClLmMhHbB?]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        const own = { m: 'manual', M: 'manual', l: 'lineage', L: 'lineage', b: 'book', B: 'book' }[e.key];
        if (!own || !document.querySelector(`[data-modal="${own}"]`)) { e.stopPropagation(); if (e.key === ' ') e.preventDefault(); }
      }
    };
    const up = (e) => { if (e.key === ' ' && e.target && e.target.closest && e.target.closest('button,[role="button"]') && !typing(e.target)) e.preventDefault(); };
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }, []);
  // sound on / off from the tool ring
  useEffect(() => {
    let muted = false; try { muted = localStorage.getItem('non-mind-muted') === '1'; } catch { /* ignore */ }
    const apply = () => { try { getAudio().setMuted(muted); } catch { /* optional */ } window.dispatchEvent(new CustomEvent('nonmind:muted', { detail: muted })); };
    const t = () => { muted = !muted; try { localStorage.setItem('non-mind-muted', muted ? '1' : '0'); } catch { /* ignore */ } apply(); };
    window.addEventListener('nonmind:mute', t); if (muted) apply();
    return () => window.removeEventListener('nonmind:mute', t);
  }, []);
  const started = useGame(() => game.started);
  useEffect(() => { if (started) { stopTitleAmbience(); whoosh(); } else startTitleAmbience(); }, [started]);
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
      <Suspense fallback={null}><Scene audioRef={audioRef} /></Suspense>
      <Hud />
      <Suspense fallback={null}><Ceremony /></Suspense>
      <Manual />
      <Restart />
      <Veil />
      <SaveMenu />
      <Lineage />
      <Book />
      <CardToast />
    </div>
  );
}
