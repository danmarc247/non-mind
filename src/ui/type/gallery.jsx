import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import '../../index.css';
import { GlyphTicker, KoanFlash, PretextFlow, Type3D, preloadType3D } from './index.js';

const KOANS = [
  'The feeling arrives before its name. Let it sit. Nothing here needs fixing!',
  'You are not the weather — you are the sky that keeps it.',
  'Complexity accumulates; attention prunes. What remains was never yours to hold.',
];

const PARAGRAPH =
  'Every unit you field is a habit of attention. Some flare and burn out before the second wave; others ' +
  'idle for an age and then, without warning, hold the whole line. Regulation is not suppression: it is ' +
  'the slow art of letting a surge pass through the board without letting it choose your next move. ' +
  'Stack too many reflexes and the mind grows loud, brittle, expensive to run. Prune, and the quiet ' +
  'starts paying compound interest. Nobody tells you which is which. The board only shows what you kept.';

// A custom PretextFlow shape: rows that cross the sun stop short of it.
const SUN = { column: 310, x: 236, y: 92, r: 64, gap: 12 };
function aroundSun(y, lineHeight) {
  const nearest = Math.max(y, Math.min(SUN.y, y + lineHeight));
  const dy = nearest - SUN.y;
  const reach = SUN.r + SUN.gap;
  if (Math.abs(dy) >= reach) return { left: 0, width: SUN.column };
  return { left: 0, width: SUN.x - Math.sqrt(reach * reach - dy * dy) };
}

const TICKERS = ['affect +3 / arousal 0.42 / valence -0.1', 'breathe in (4) hold (7) out (8)'];

function Panel({ title, note, children, className = '' }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-xl border-2 border-ink bg-paper p-4 ${className}`}>
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-head text-2xl leading-none text-ink">{title}</h2>
        <span className="font-body text-xs italic text-ink-2">{note}</span>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Gallery() {
  const [koan, setKoan] = useState(0);
  const [chaos, setChaos] = useState(0);
  const [ticker, setTicker] = useState(0);
  const [type3d, setType3d] = useState(null);

  useEffect(() => {
    preloadType3D();
    const pulse = setInterval(() => setChaos((c) => (c > 0.5 ? 0 : 1)), 3800);
    const swap = setInterval(() => setTicker((t) => (t + 1) % TICKERS.length), 7000);
    return () => {
      clearInterval(pulse);
      clearInterval(swap);
    };
  }, []);

  return (
    <div className="grid h-screen grid-cols-2 grid-rows-[1fr_1fr_auto] gap-3 overflow-auto bg-paper-2 p-3 select-text">
      <Panel title="KoanFlash" note="kinetic-type-engine · ORP pinned · click to change">
        <div className="grid h-full grid-rows-3 gap-1" onClick={() => setKoan((k) => (k + 1) % KOANS.length)}>
          <KoanFlash text={KOANS[koan]} trail="blur" tone="magenta" wpm={230} loop />
          <KoanFlash text={KOANS[(koan + 1) % KOANS.length]} trail="echo" tone="ultra" wpm={260} loop className="font-head text-5xl" />
          <KoanFlash text={KOANS[(koan + 2) % KOANS.length]} trail="rgb_split" tone="tangerine" wpm={200} density={2} loop className="text-4xl" />
        </div>
      </Panel>

      <Panel title="PretextFlow" note="@chenglou/pretext · per-row width from a shape">
        <div className="grid h-full grid-cols-2 gap-5">
          <div className="relative">
            <div
              className="absolute rounded-full bg-yolk ring-2 ring-ink"
              style={{ left: SUN.x - SUN.r, top: SUN.y - SUN.r, width: SUN.r * 2, height: SUN.r * 2 }}
            />
            <PretextFlow text={PARAGRAPH} font="15px Fraunces" lineHeight={21} width={SUN.column} shape={aroundSun} />
          </div>
          <PretextFlow text={PARAGRAPH} font="italic 14px Fraunces" lineHeight={19} shape="hourglass" className="text-ultra" />
        </div>
      </Panel>

      <Panel
        title="Type3D"
        note={type3d ? `three-text · ${type3d.glyphCount} glyphs · ${type3d.triangles} tris · chaos ${chaos}` : 'three-text · loading…'}
      >
        <Canvas camera={{ position: [0, 0, 8], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <Type3D
            text={'NON-MIND'}
            font="kablammo"
            size={1.5}
            depth={0.35}
            chaos={chaos}
            position={[0, 1.15, 0]}
            rotation={[0.08, -0.22, 0]}
            onReady={setType3d}
          />
          <Type3D
            text={'what you resist\nlearns your name'}
            font="londrina"
            size={0.62}
            depth={0.14}
            lineHeight={0.95}
            color="#ffd21f"
            colorB="#ff7a1a"
            chaos={chaos * 0.35}
            position={[0, -0.55, 0]}
            rotation={[0, 0.2, 0]}
          />
          <Type3D
            text="Regulate / Accumulate / Release"
            font="hyper"
            size={0.36}
            depth={0.05}
            color="#17b5a6"
            colorB="#8a3ffc"
            position={[0, -1.95, 0]}
          />
        </Canvas>
      </Panel>

      <Panel title="GlyphTicker" note="@pmndrs/glyph · own WebGL2 canvas · DOM fallback">
        <div className="flex h-full flex-col justify-center gap-6">
          <GlyphTicker text={TICKERS[ticker]} tone="ink" className="h-14" />
          <GlyphTicker text="the board only shows what you kept" tone="magenta" className="h-9" />
          <GlyphTicker text="non-mind" tone="ultra" className="h-24" />
        </div>
      </Panel>

      <footer className="col-span-2 font-stat text-sm text-ink-2">
        src/ui/type · kinetic flash / pretextflow / type3d / glyphticker
      </footer>
    </div>
  );
}

// type-gallery.html?strict exercises the double-mount paths (canvas/context/worker cleanup).
const strict = new URLSearchParams(window.location.search).has('strict');
createRoot(document.getElementById('root')).render(strict ? <StrictMode><Gallery /></StrictMode> : <Gallery />);
