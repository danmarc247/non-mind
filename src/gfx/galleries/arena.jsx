// Arena gallery: PainterSky + a minimal copy of the Scene sea + the core sculpture + the five
// arena shader components, driven by the real store and the bot.
// Query: ?ff=<s> fast-forward, ?post=0, ?q=low|med|high, ?cx= ?ow= ?tension= ?stage= (pin mood), ?sel=1 (select a bench unit)
import { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { mixStagePalette, linearToSrgb } from '../palettes/stages.js';
import { coreMaterial } from '../sculpt.js';
import { PainterSky } from '../PainterSky.jsx';
import { PainterPost } from '../PainterPost.jsx';
import { game, act, tick, notify, onEvent } from '../../game/store.js';
import { createGame, defaultBot, step } from '../../game/index.js';
import { GatePortals, SeatRings, GlassVessel, CoreAura, SeaCaustics } from '../arena/index.js';
import seaFrag from '../glsl/sea.frag.glsl';
import seaVert from '../glsl/sea.vert.glsl';

const q = new URLSearchParams(location.search);
const pin = {};
for (const k of ['complexity', 'overwhelm', 'tension', 'stage']) { const v = q.get(k === 'complexity' ? 'cx' : k === 'overwhelm' ? 'ow' : k); if (v !== null) pin[k] = +v; }
window.__pin = pin;
window.__mood = mood;

game.G = createGame(5); game.started = true;
window.__ff = (sec) => { const G = game.G; for (let t = 0; t < sec; t += 0.1) { defaultBot(G, t); step(G, 0.1); G.events.length = 0; } };
window.__bot = q.get('bot') !== '0';
setInterval(() => { if (window.__bot) defaultBot(game.G, performance.now() / 1000); }, 200);
window.__act = act; window.__tick = tick;
window.__beat = (gate) => game.G.events.push({ type: 'beat', beat: 0, gate });
window.__attend = () => game.G.events.push({ type: 'attend', amt: 1 });
window.__select = () => { const u = game.G.units.find((x) => !x.seat) || game.G.units[0]; game.selected = u ? u.id : null; notify(); return game.selected; };
if (q.get('ff')) window.__ff(+q.get('ff'));
if (q.get('sel')) window.__select();

const SEA_R = 12.5, SEA_Y = -0.35;
const ease = (c, t, dt, r = 10) => c + (t - c) * (1 - Math.exp(-r * dt));

// minimal copy of Scene.jsx Sea (top + cut face + floor), without its plain glass
function Sea() {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
    uPaper: { value: new THREE.Vector3(...PALETTE.paper) }, uInk: { value: new THREE.Vector3(...PALETTE.ink) },
    uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uTension: { value: 0 }, uR: { value: SEA_R }, uSide: { value: 0 }, uPulse: { value: 0 },
  }), []);
  const sideU = useMemo(() => ({ ...uniforms, uSide: { value: 1 } }), [uniforms]);
  useFrame(() => {
    const p = mixStagePalette(Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0)));
    const s = (c) => c.map(linearToSrgb);
    for (const u of [uniforms, sideU]) {
      u.uTime.value = mood.time; u.uA.value.set(...s(p.primary)); u.uB.value.set(...s(p.secondary)); u.uC.value.set(...s(p.accent));
      u.uComplexity.value = mood.complexity; u.uOverwhelm.value = mood.overwhelm; u.uTension.value = mood.tension; u.uPulse.value = mood.flash;
    }
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={SEA_Y}><circleGeometry args={[SEA_R, 128]} /><shaderMaterial vertexShader={seaVert} fragmentShader={seaFrag} uniforms={uniforms} /></mesh>
      <mesh position-y={SEA_Y - 2.5}><cylinderGeometry args={[SEA_R, SEA_R * 0.96, 5, 128, 1, true]} /><shaderMaterial vertexShader={seaVert} fragmentShader={seaFrag} uniforms={sideU} /></mesh>
    </group>
  );
}

function Core() {
  const mesh = useRef(), st = useRef({ stage: -1, pop: 0 });
  const geo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  useEffect(() => onEvent((e) => { if (e.type === 'attend') st.current.pop = 1; }), []);
  useFrame((_, dt) => {
    const s = st.current, G = game.G;
    if (s.stage !== G.stage) { s.stage = G.stage; const old = mesh.current.material; mesh.current.material = coreMaterial(G.stage); old?.dispose?.(); s.pop = 1.5; }
    s.pop = ease(s.pop, 0, dt, 9);
    const sc = 3.2 + 0.06 * G.stage + 0.45 * s.pop + 0.06 * Math.sin(mood.time * 2);
    mesh.current.scale.setScalar(sc);
    const u = mesh.current.material.uniforms;
    if (u) { u.time.value = mood.time; u._scale.value = sc; u.uFlash.value = Math.max(0, s.pop * 0.35) + mood.flash * 0.5; }
  });
  return <mesh ref={mesh} geometry={geo} position={[0, 1.7, 0]} frustumCulled={false} onClick={(e) => { e.stopPropagation(); act('attend'); }} />;
}

function Loop() {
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), G = game.G;
    tick(dt);
    mood.time += dt * (1 + mood.overwhelm * 0.8);
    mood.complexity = ease(mood.complexity, Math.min(1, G.complexity / Math.max(1, G.capacity)), dt, 1.5);
    mood.overwhelm = ease(mood.overwhelm, G.overwhelm, dt, 1.2);
    mood.tension = ease(mood.tension, G.phase === 'fight' ? Math.min(1, 0.3 + (G.battle?.enemies.length || 0) / 20) : 0, dt, 2);
    mood.stage = ease(mood.stage, G.stage, dt, 0.8); mood.depth = G.depth; mood.flash = ease(mood.flash, 0, dt, 4);
    Object.assign(mood, window.__pin);
    window.__frames = (window.__frames || 0) + 1;
  });
  return null;
}

function App() {
  const cam = (q.get('cam') || '0,21,29').split(',').map(Number);
  return (
    <div className="fixed inset-0">
      <Canvas linear legacy flat camera={{ position: cam, fov: 44, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: false }}
        onPointerMissed={() => { if (game.selected || game.pending) { game.selected = null; game.pending = null; notify(); } }}>
        <Loop />
        <PainterSky />
        <Sea />
        <SeaCaustics />
        <GatePortals />
        <SeatRings />
        <Core />
        <CoreAura />
        <GlassVessel />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={46} target={[0, -3.2, 0]} enableDamping />
        {q.get('post') !== '0' && <PainterPost quality={q.get('q') || 'low'} />}
      </Canvas>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
