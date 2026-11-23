// Sea gallery: PainterSky + ContainedSea + GlassVessel + hovering units. Sliders write into `mood`.
// Query: ?stage= &ow= &cx= &tension= &low= &cam=x,y,z &rot=0 (no autoRotate) &ui=0 &post=1
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { PainterSky } from '../PainterSky.jsx';
import { PainterPost } from '../PainterPost.jsx';
import { GlassVessel } from '../arena/index.js';
import ContainedSea, { MOVEMENTS, movementWeights } from '../sea/index.js';
import { game, tick } from '../../game/store.js';
import { createGame, seatPos } from '../../game/index.js';

const q = new URLSearchParams(location.search);
const ctl = {
  stage: +(q.get('stage') ?? 0), complexity: +(q.get('cx') ?? 0.4), overwhelm: +(q.get('ow') ?? 0),
  tension: +(q.get('tension') ?? 0), low: +(q.get('low') ?? -1), flash: 0,
};
window.__mood = mood; window.__ctl = ctl;

game.G = createGame(5); game.started = true;
const push = (e) => game.G.events.push(e);
window.__fire = (kind, a = 0) => {
  if (kind === 'attend') push({ type: 'attend', amt: 1 });
  if (kind === 'hit') { const an = Math.random() * 6.28, r = 3 + Math.random() * 6; push({ type: 'hit', x: Math.cos(an) * r, z: Math.sin(an) * r, amt: 0.3 }); }
  if (kind === 'death') { const an = Math.random() * 6.28, r = 3 + Math.random() * 6; push({ type: 'enemyDeath', x: Math.cos(an) * r, z: Math.sin(an) * r }); }
  if (kind === 'beat') push({ type: 'beat', beat: 0, gate: a || Math.floor(Math.random() * 10) });
  if (kind === 'flash') ctl.flash = 1;
};

function Loop() {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    tick(dt);
    mood.time += dt * (1 + mood.overwhelm * 0.8);
    mood.stage = ctl.stage; mood.complexity = ctl.complexity; mood.overwhelm = ctl.overwhelm; mood.tension = ctl.tension;
    if (ctl.flash > 0) { mood.flash = ctl.flash; ctl.flash = 0; } else mood.flash *= Math.exp(-4 * dt);
    mood.audio.low = ctl.low >= 0 ? ctl.low : 0.5 + 0.5 * Math.sin(mood.time * 2.1) ** 8;
    window.__frames = (window.__frames || 0) + 1;
  });
  return null;
}

const UNIT_TONES = ['magenta', 'teal', 'yolk', 'ultra', 'violet', 'tangerine', 'rose'];
function Units() {
  const g = useRef();
  const items = useMemo(() => [[0, 0], [0, 3], [0, 6], [1, 1], [1, 5], [1, 8], [2, 2], [2, 7]].map(([r, d], i) => {
    const [x, z] = seatPos(r, d);
    return { x, z, c: new THREE.Color().setRGB(...PALETTE[UNIT_TONES[i % UNIT_TONES.length]], THREE.SRGBColorSpace) };
  }), []);
  useFrame(() => { g.current.children.forEach((m, i) => { m.position.y = 1.0 + 0.08 * Math.sin(mood.time * 1.7 + i); }); });
  return (
    <group ref={g}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, 1, it.z]}><sphereGeometry args={[0.55, 32, 16]} /><meshBasicMaterial color={it.c} /></mesh>
      ))}
      <mesh position={[0, 1.7, 0]}><sphereGeometry args={[1.1, 40, 20]} /><meshBasicMaterial color={new THREE.Color().setRGB(...PALETTE.yolk, THREE.SRGBColorSpace)} /></mesh>
    </group>
  );
}

function Slider({ k, label, min = 0, max = 1, step = 0.01 }) {
  const [v, setV] = useState(ctl[k]);
  return (
    <label className="flex items-center gap-2 font-stat text-[12px]">
      <span className="w-16">{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => { ctl[k] = +e.target.value; setV(+e.target.value); }} />
      <span className="w-10 text-right">{(+v).toFixed(2)}</span>
    </label>
  );
}
function Readout() {
  const [txt, setTxt] = useState('');
  useEffect(() => { const id = setInterval(() => { const w = movementWeights(ctl.stage, ctl.overwhelm); setTxt(MOVEMENTS.map((m, i) => (w[i] > 0.01 ? `${m} ${w[i].toFixed(2)}` : '')).filter(Boolean).join(' · ')); }, 250); return () => clearInterval(id); }, []);
  return <div className="font-stat text-[11px] text-ink-2">{txt}</div>;
}
function Ui() {
  return (
    <div className="fixed left-3 top-3 z-10 flex flex-col gap-1 rounded-lg border-[3px] border-ink bg-paper p-3 shadow-[2px_3px_0_0_var(--color-ink)]">
      <div className="font-head text-[15px] uppercase">contained sea</div>
      <Slider k="stage" label="stage" max={17} step={0.05} />
      <Slider k="complexity" label="cx" />
      <Slider k="overwhelm" label="overwhelm" />
      <Slider k="tension" label="tension" />
      <Slider k="low" label="low" min={-1} />
      <div className="mt-1 flex flex-wrap gap-1">
        {['attend', 'hit', 'death', 'beat', 'flash'].map((k) => (
          <button key={k} className="rounded-md border-2 border-ink bg-yolk px-2 py-0.5 font-head text-[13px] uppercase" onClick={() => window.__fire(k)}>{k}</button>
        ))}
      </div>
      <Readout />
    </div>
  );
}

function App() {
  const cam = (q.get('cam') || '0,17,25').split(',').map(Number);
  return (
    <div className="fixed inset-0">
      <Canvas linear legacy flat camera={{ position: cam, fov: 44, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
        <Loop />
        <PainterSky />
        <ContainedSea />
        <Units />
        <GlassVessel />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={50} target={[0, -1.6, 0]} autoRotate={q.get('rot') !== '0'} autoRotateSpeed={0.4} enableDamping />
        {q.get('post') === '1' && <PainterPost quality={q.get('q') || 'low'} />}
      </Canvas>
      {q.get('ui') !== '0' && <Ui />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
