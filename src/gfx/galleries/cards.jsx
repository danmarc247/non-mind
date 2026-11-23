// Cards gallery: PainterSky, a flat sea disc (clickable, to prove the card wins the raycast), the
// DriftingCard, the Book and the CardToast. Buttons spawn each of the 22 cards, collect, run the clock
// down, let it go, and fill the book. Query: ?spawn=<n> ?yaw=<rad> (hold the turn) ?t=<s> (offer time)
// ?dist= ?pol= ?az= (camera) ?fill=<count> ?open=1 (book) ?sel=<n> (enlarge) ?toast=<n> ?ui=0 ?post=1 ?stage= ?cx=
// ?sheet=1 (all 22 shader fronts, ?back=1 for backs) ?marks=1 (all 22 SVG marks)
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { PainterSky } from '../PainterSky.jsx';
import { PainterPost } from '../PainterPost.jsx';
import { DriftingCard, cardView, cardMaterial, slabGeometry, symbolIndex } from '../cards/index.js';
import { game, act, tick, notify } from '../../game/store.js';
import { CARDS } from '../../game/content/cards.js';
import Book, { CardToast } from '../../ui/Book.jsx';
import CardMark from '../../ui/book/CardMark.jsx';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.get(k) !== null ? +q.get(k) : d);
mood.stage = num('stage', 2); mood.complexity = num('cx', 0.3);
const ORDER = [...CARDS].sort((a, b) => a.n - b.n);
const TARGET = new THREE.Vector3(0, -1, 0);
window.__mood = mood; window.__seaClicks = 0;

// the gallery owns the clock: no sim, events flushed by a near-zero tick after each action
game.started = true;
const flush = () => { game.paused = false; tick(0.0001); notify(); };
const G = () => game.G;
let autoClock = q.get('clock') !== '0';
function spawn(n, t = 35) {
  const c = ORDER[n]; if (!c) return;
  G().cards = (G().cards || []).filter((id) => id !== c.id);
  const a = 0.6 + n * 0.37, r = num('r', 4.5);
  G().cardOffer = { id: c.id, t, x: Math.sin(a) * r * 0.4, z: Math.cos(a) * r * 0.35 + 2 };
  notify();
}
function fill(k) {
  // a scattered partial set, so the 9-card book shows held and empty places side by side
  const order = [0, 2, 3, 7, 10, 12, 15, 18, 21, 5, 11, 14, 19, 1, 4, 6, 8, 9, 13, 16, 17, 20];
  G().cards = order.slice(0, k).map((i) => ORDER[i].id); notify();
}
window.__spawn = spawn; window.__fill = fill; window.__card = cardView;
window.__collect = () => { act('collectCard'); flush(); };
window.__let = () => { const o = G().cardOffer; if (o) { G().cardOffer = null; G().events.push({ type: 'cardGone', id: o.id }); flush(); } };
window.__urgent = () => { const o = G().cardOffer; if (o) o.t = 7; };
window.__clock = (on) => { autoClock = on; };
window.__book = () => window.dispatchEvent(new Event('nonmind:book'));
window.__toast = (n) => window.dispatchEvent(new CustomEvent('nonmind:cardtoast', { detail: { id: ORDER[n].id } }));

function Rig({ sheet = false }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (sheet) return;
    const az = num('az', 0) * Math.PI / 180, pol = num('pol', 0.92), dist = num('dist', 37.8);
    const tgt = q.get('near') ? new THREE.Vector3(0, 2.6, 2) : TARGET;
    camera.position.set(tgt.x + Math.sin(az) * Math.sin(pol) * dist, tgt.y + Math.cos(pol) * dist, tgt.z + Math.cos(az) * Math.sin(pol) * dist);
    camera.lookAt(tgt);
  }, [camera]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    mood.time += dt; mood.flash += (0 - mood.flash) * (1 - Math.exp(-4 * dt));
    window.__frames = (window.__frames || 0) + 1;
    if (G().events.length) flush();   // a click on the card acts directly: hand its events to onEvent (toast)
    const o = G().cardOffer;
    if (o && autoClock) { o.t -= dt; if (o.t <= 0) window.__let(); }
    // screen position of the card, for pointer tests
    const v = cardView.pos.clone().project(camera);
    window.__cardScreen = { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, phase: cardView.phase, hover: cardView.hover };
  });
  return null;
}

function Sea() {
  const c = new THREE.Color().setRGB(...PALETTE.teal);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.35} onClick={(e) => { e.stopPropagation(); window.__seaClicks++; }}>
        <circleGeometry args={[12.5, 96]} />
        <meshBasicMaterial color={c.lerp(new THREE.Color().setRGB(...PALETTE.paper), 0.45)} />
      </mesh>
      <mesh position-y={-0.2} rotation-x={Math.PI / 2}><torusGeometry args={[12.6, 0.15, 10, 160]} /><meshBasicMaterial color={new THREE.Color().setRGB(...PALETTE.paper)} /></mesh>
    </group>
  );
}

// every front (or back) at once, facing the camera, for checking all 22 painted marks
function Sheet() {
  const items = useMemo(() => {
    const geo = slabGeometry();
    return ORDER.map((c, i) => {
      const mat = cardMaterial(), u = mat.uniforms;
      u.uSymbol.value = symbolIndex(c.symbol); u.uSeed.value = (c.n * 0.618 + 0.13) % 1; u.uTone.value.fromArray(PALETTE[c.tone]); u.uFade.value = 1; u.uGlint.value = 0;
      return { c, geo, mat, x: (i % 11 - 5) * 1.15, y: i < 11 ? 0.85 : -0.85 };
    });
  }, []);
  useFrame(() => { for (const it of items) it.mat.uniforms.uTime.value = mood.time; });
  const back = q.get('back') === '1';
  return <group>{items.map((it) => <mesh key={it.c.id} geometry={it.geo} material={it.mat} position={[it.x, it.y, 0]} rotation-y={back ? Math.PI : 0} />)}</group>;
}
function Marks() {
  return (
    <div className="fixed inset-0 overflow-auto bg-paper p-6">
      <div className="grid grid-cols-6 gap-4 sm:grid-cols-8 lg:grid-cols-11">
        {ORDER.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1"><CardMark card={c} size={104} /><span className="font-stat text-[11px] text-ink-2">{c.n} {c.symbol}</span></div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-6">{ORDER.slice(0, 6).map((c) => <CardMark key={c.id} card={c} size={36} />)}</div>
    </div>
  );
}

function Panel() {
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((x) => x + 1), 400); return () => clearInterval(id); }, []);
  const o = G().cardOffer;
  const btn = 'rounded-full border-[2.5px] border-ink bg-paper px-2.5 py-0.5 font-head text-[13px] text-ink shadow-[2px_2px_0_var(--color-ink)] hover:-translate-y-0.5';
  return (
    <div className="fixed top-2 left-2 z-40 w-[min(360px,94vw)] rounded-[16px] border-[3px] border-ink bg-paper p-2.5 shadow-[3px_4px_0_var(--color-ink)]">
      <div className="mb-1.5 flex items-baseline justify-between font-head text-[15px]">cards gallery <span className="font-stat text-[11px] text-ink-2">{o ? `${o.id} t ${o.t.toFixed(1)}` : 'no offer'} · {cardView.phase}</span></div>
      <div className="grid grid-cols-11 gap-1">
        {ORDER.map((c) => (
          <button key={c.id} title={c.symbol} onClick={() => spawn(c.n)} className="flex items-center justify-center rounded-lg border-2 border-ink/30 bg-paper hover:border-ink">
            <CardMark card={c} size={24} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={btn} onClick={window.__collect}>collect</button>
        <button className={btn} onClick={window.__urgent}>last 8 s</button>
        <button className={btn} onClick={window.__let}>let it go</button>
        <button className={btn} onClick={() => fill(0)}>book 0</button>
        <button className={btn} onClick={() => fill(9)}>book 9</button>
        <button className={btn} onClick={() => fill(22)}>book 22</button>
        <button className={`${btn} bg-yolk`} onClick={window.__book}>open book</button>
        <button className={btn} onClick={() => window.__toast(Math.floor(Math.random() * 22))}>toast</button>
      </div>
      <div className="mt-1.5 font-stat text-[11px] text-ink-2">sea clicks {window.__seaClicks}</div>
    </div>
  );
}

function App() {
  useEffect(() => {
    if (q.get('fill') !== null) fill(num('fill', 0));
    if (q.get('spawn') !== null) spawn(num('spawn', 0), num('t', 35));
    if (q.get('open') === '1') setTimeout(window.__book, 300);
    if (q.get('sel') !== null) setTimeout(() => document.querySelector(`[data-place="${num('sel', 0)}"]`)?.click(), 1200);
    if (q.get('toast') !== null) setTimeout(() => window.__toast(num('toast', 0)), 400);
  }, []);
  const yaw = q.get('yaw') !== null ? num('yaw', 0) : null;
  if (q.get('marks') === '1') return <Marks />;
  if (q.get('sheet') === '1') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--color-paper)' }}>
        <Canvas linear legacy flat orthographic camera={{ position: [0, 0, 20], zoom: num('zoom', 110) }} dpr={1} gl={{ antialias: false }}>
          <Rig sheet /><Sheet />
        </Canvas>
      </div>
    );
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-paper)' }}>
      <Canvas linear legacy flat camera={{ position: [0, 21, 29], fov: 44, near: 0.5, far: 900 }} dpr={q.get('dpr') ? +q.get('dpr') : [1, 1.5]} gl={{ antialias: false }}>
        <Rig />
        <PainterSky />
        <Sea />
        <DriftingCard fixedYaw={yaw} timeScale={num('slow', 1)} />
        <OrbitControls makeDefault enablePan={false} target={q.get('near') ? [0, 2.6, 2] : [0, -1, 0]} enableDamping={false} />
        {q.get('post') === '1' && <PainterPost quality="med" />}
      </Canvas>
      {q.get('ui') !== '0' && <Panel />}
      <Book />
      <CardToast life={num('life', 4000)} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
