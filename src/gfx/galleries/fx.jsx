// fx gallery: fire every paint-fx event by hand or at random, and preview each ArcVeil.
// window.__fire(type, payload), window.__freeze(secondsAfterNow), window.__unfreeze(), window.__arc(idOrNull), window.__fxStats()
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { mixStagePalette, linearToSrgb } from '../palettes/stages.js';
import { ASPECT_TONES } from '../palettes/families.js';
import { game } from '../../game/store.js';
import { createGame, leaf, node, seatPos, gatePos, WAVE_ARC, aspectsOf } from '../../game/index.js';
import { PaintFx, ArcVeil, dispatchFx, fxClock, fxStats, ARC_IDS, FX_ARENA } from '../fx/index.js';
import seaFrag from '../glsl/sea.frag.glsl';
import seaVert from '../glsl/sea.vert.glsl';

const q = new URLSearchParams(location.search);
mood.stage = +(q.get('stage') ?? 6); mood.complexity = 0.45;
window.__mood = mood;

// ---- a static fake world: seated units, a fight with stressors ----
const G = createGame(5);
const FAMS = ['reappraisal', 'rumination', 'attunement', 'projection', 'sublimation', 'containment', 'equanimity', 'suppression'];
G.units = FAMS.map((f, i) => ({ id: i + 1, g: i === 3 ? node('blend', leaf(f), leaf('dissociation')) : leaf(f), link: 1 + i, traits: [], muts: [], seat: { ring: i % 2, dir: (i * 3) % 10 } }));
G.nextUid = 20;
const ENEMIES = [[6.5, 6.0, false], [-7.2, 4.0, false], [2.0, -8.5, false], [-4.5, -7.0, true], [8.8, -2.5, false]];
const fakeBattle = (arcId) => ({
  arc: WAVE_ARC.find((a) => a.id === arcId) || WAVE_ARC[0],
  units: G.units.map((u, i) => { const [x, z] = seatPos(u.seat.ring, u.seat.dir); return { id: 100 + i, uid: u.id, x, z, alive: true, aspects: aspectsOf(u.g) }; }),
  enemies: ENEMIES.map(([x, z, boss], i) => ({ id: 200 + i, x, z, alive: true, boss, side: 1 })),
});
G.battle = null; G.phase = 'prep';
game.G = G;
const arc = (id) => { if (!id) { G.battle = null; G.phase = 'prep'; return; } G.battle = fakeBattle(id); G.phase = 'fight'; };
if (q.get('arc')) arc(q.get('arc'));

const R = Math.random, pick = (a) => a[Math.floor(R() * a.length)];
const seat = (id) => { const u = G.units.find((x) => x.id === id); return seatPos(u.seat.ring, u.seat.dir); };
const ASP = Object.keys(ASPECT_TONES);
const KINDS = ['invert', 'store', 'flurry', 'retreat', 'heal', 'transfer', 'blink', 'burst_affect', 'taunt', 'equalize'];

// plausible payloads for every event the engine emits
const PAY = {
  strike: () => { const u = pick(G.units), [x, z] = seat(u.id), e = pick(ENEMIES); return { x, z, tx: e[0], tz: e[1], aspect: aspectsOf(u.g)[0], id: 100 }; },
  hit: () => { const e = pick(ENEMIES); return { x: e[0], z: e[1], side: 1, aspect: pick(ASP), amt: 0.05 + R() * 0.4, id: 200 }; },
  hitUs: () => { const [x, z] = seat(pick(G.units).id); return { type: 'hit', x, z, side: 0, amt: 0.1 + R() * 0.3, id: 100 }; },
  miss: () => { const e = pick(ENEMIES); return { x: e[0], z: e[1] }; },
  death: () => { const i = Math.floor(R() * G.units.length), [x, z] = seat(G.units[i].id); return { x, z, id: 100 + i, boss: false }; },
  enemyDeath: () => { const e = pick(ENEMIES); return { x: e[0], z: e[1], id: 200, boss: false }; },
  bossDeath: () => ({ type: 'enemyDeath', x: -4.5, z: -7.0, id: 203, boss: true }),
  link: () => ({ id: 2, gone: 3, link: 5 }),
  integrate: () => ({ id: 4, a: 4, b: 5 }),
  subtract: () => ({ id: 6, a: 6, b: 7 }),
  split: () => ({ id: 4, a: 4, b: 99 }),
  repurpose: () => ({ id: 5, habit: 'breath', n: 12 }),
  mutation: () => ({ id: pick(G.units).id, mut: 'x' }),
  ending: () => ({ id: 8 }),
  waveStart: () => ({ wave: 3, arc: 'analogy' }),
  waveWin: () => ({ pay: 10, interest: 2 }),
  waveLose: () => ({}),
  stage: () => ({ stage: 1 + Math.floor(R() * 16), id: 'x' }),
  reset: () => ({ gain: 3, depth: 1 }),
  attend: () => ({ amt: 1 }),
  coreHit: () => ({ amt: 0.04 + R() * 0.05 }),
  beat: () => ({ beat: 0, gate: Math.floor(R() * 10) }),
};
for (const k of KINDS) PAY['cast:' + k] = () => { const u = pick(G.units), [x, z] = seat(u.id); return { type: 'cast', kind: k, x, z, aspect: aspectsOf(u.g)[0], id: 100, echo: false }; };
for (const k of KINDS) PAY['echo:' + k] = () => ({ ...PAY['cast:' + k](), echo: true });

const fire = (type, payload) => {
  const p = payload || (PAY[type] ? PAY[type]() : {});
  const t = p.type || (type.includes(':') ? 'cast' : type);
  dispatchFx({ ...p, type: t });
};
window.__fire = fire;
window.__freeze = (dt = 0.12) => { window.__fxTime = fxClock.t + dt; };
window.__unfreeze = () => { window.__fxTime = undefined; };
window.__arc = arc;
window.__fxStats = () => fxStats() && fxStats()();
let auto = null;
const AUTO = ['strike', 'strike', 'strike', 'hit', 'hit', 'hit', 'hitUs', 'miss', 'attend', 'attend', 'enemyDeath', 'death', 'coreHit', 'beat', ...KINDS.map((k) => 'cast:' + k), 'echo:heal', 'link', 'integrate', 'subtract', 'split', 'mutation', 'repurpose'];
const setAuto = (on) => { clearInterval(auto); auto = on ? setInterval(() => { for (let i = 0; i < 2; i++) fire(pick(AUTO)); if (R() < 0.04) fire(pick(['waveStart', 'waveWin', 'stage', 'bossDeath'])); }, 110) : null; };
window.__auto = setAuto;
if (q.get('auto')) setAuto(true);

// ---- scene pieces ----
function Ticker() { useFrame(() => { window.__frames = (window.__frames || 0) + 1; mood.time = fxClock.t; mood.flash *= 0.94; }); return null; }
function Sea() {
  const u = useMemo(() => {
    const p = mixStagePalette(mood.stage), s = (c) => new THREE.Vector3(...c.map(linearToSrgb));
    return { uTime: { value: 0 }, uA: { value: s(p.primary) }, uB: { value: s(p.secondary) }, uC: { value: s(p.accent) }, uPaper: { value: new THREE.Vector3(...PALETTE.paper) }, uInk: { value: new THREE.Vector3(...PALETTE.ink) },
      uComplexity: { value: 0.45 }, uOverwhelm: { value: 0 }, uTension: { value: 0.3 }, uR: { value: FX_ARENA.SEA_R }, uSide: { value: 0 }, uPulse: { value: 0 } };
  }, []);
  useFrame(() => { u.uTime.value = fxClock.t; u.uPulse.value = mood.flash; });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={FX_ARENA.SEA_Y}><circleGeometry args={[FX_ARENA.SEA_R, 96]} /><shaderMaterial vertexShader={seaVert} fragmentShader={seaFrag} uniforms={u} /></mesh>
      <mesh position-y={FX_ARENA.SEA_Y + 0.55} rotation-x={Math.PI / 2}><torusGeometry args={[FX_ARENA.SEA_R + 0.12, 0.09, 10, 96]} /><meshBasicMaterial color={new THREE.Color().setRGB(...PALETTE.paper)} /></mesh>
    </group>
  );
}
function Placeholders() {
  const col = (c) => new THREE.Color().setRGB(...c);
  return (
    <group>
      {G.units.map((u) => { const [x, z] = seat(u.id); return <mesh key={u.id} position={[x, FX_ARENA.UNIT_Y, z]}><sphereGeometry args={[0.8, 20, 14]} /><meshBasicMaterial color={new THREE.Color(ASPECT_TONES[aspectsOf(u.g)[0]])} /></mesh>; })}
      {ENEMIES.map(([x, z, boss], i) => <mesh key={i} position={[x, FX_ARENA.UNIT_Y, z]}><sphereGeometry args={[boss ? 1.4 : 0.6, 16, 12]} /><meshBasicMaterial color={col(PALETTE.ink)} /></mesh>)}
      <mesh position={[0, FX_ARENA.CORE_Y, 0]}><sphereGeometry args={[1.5, 24, 16]} /><meshBasicMaterial color={col(PALETTE.yolk)} /></mesh>
      {Array.from({ length: 10 }, (_, d) => { const [x, z] = gatePos(d); return <mesh key={d} position={[x * 1.08, FX_ARENA.SEA_Y + 0.5, z * 1.08]} rotation-y={Math.atan2(x, z)}><torusGeometry args={[0.9, 0.09, 8, 24, Math.PI]} /><meshBasicMaterial color={col(PALETTE.ink)} /></mesh>; })}
    </group>
  );
}

const btn = 'font-head text-[13px] px-2 py-0.5 border-2 border-ink rounded-md bg-paper text-ink shadow-[1px_2px_0_0_var(--color-ink)] active:translate-y-px';
function Panel() {
  const [a, setA] = useState(q.get('arc') || '');
  const [au, setAu] = useState(!!q.get('auto'));
  const groups = [
    ['battle', ['strike', 'hit', 'hitUs', 'miss', 'death', 'enemyDeath', 'bossDeath', 'coreHit', 'beat']],
    ['cast', KINDS.map((k) => 'cast:' + k)],
    ['echo', KINDS.map((k) => 'echo:' + k)],
    ['genetic', ['link', 'integrate', 'subtract', 'split', 'repurpose', 'mutation', 'ending']],
    ['run', ['waveStart', 'waveWin', 'waveLose', 'stage', 'attend', 'reset']],
  ];
  return (
    <div id="ui" className="fixed left-2 top-2 max-w-[560px] p-2 bg-paper border-[3px] border-ink rounded-lg text-ink" style={{ display: q.get('ui') === '0' ? 'none' : undefined }}>
      {groups.map(([g, list]) => (
        <div key={g} className="flex flex-wrap gap-1 items-center mb-1"><span className="font-stat text-[11px] w-12">{g}</span>
          {list.map((t) => <button key={t} className={btn} onClick={() => fire(t)}>{t.replace(/^(cast|echo):/, '')}</button>)}
        </div>
      ))}
      <div className="flex flex-wrap gap-1 items-center"><span className="font-stat text-[11px] w-12">arc</span>
        {['', ...ARC_IDS].map((id) => <button key={id || 'off'} className={btn + (a === id ? ' bg-yolk' : '')} onClick={() => { arc(id || null); setA(id); }}>{id || 'off'}</button>)}
        <button className={btn + (au ? ' bg-magenta text-paper' : '')} onClick={() => { setAuto(!au); setAu(!au); }}>auto</button>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="fixed inset-0 bg-paper">
      <Canvas linear legacy flat camera={{ position: [0, 21, 29], fov: 44, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: false }}
        onCreated={({ scene }) => { scene.background = new THREE.Color().setRGB(...PALETTE.paper); }}>
        <Ticker />
        <Sea />
        <Placeholders />
        <ArcVeil />
        <PaintFx />
        <OrbitControls enablePan={false} target={[0, -3.2, 0]} />
      </Canvas>
      <Panel />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
