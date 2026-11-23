// Drift gallery: PainterSky, a stand-in vessel (cylinder r 12.5 + sea disc), a few unit spheres and a
// core, and the four drift components. Sliders write into `mood`.
// Query: ?stage= ?cx= ?ow= ?flash=1 ?az=<deg> (camera azimuth) ?pol=<rad> ?dist= ?rot=0 (no auto-rotate)
//        ?post=1 (PainterPost) ?only=mobiles,strata,motes,tethers ?ui=0
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { PainterSky } from '../PainterSky.jsx';
import { PainterPost } from '../PainterPost.jsx';
import { Mobiles, Strata, Motes, Tethers } from '../drift/index.js';
import { stagePalette, driftState } from '../drift/shared.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.get(k) !== null ? +q.get(k) : d);
mood.stage = num('stage', 0); mood.complexity = num('cx', 0.2); mood.overwhelm = num('ow', 0);
const only = q.get('only') ? q.get('only').split(',') : null;
const show = (k) => !only || only.includes(k);
window.__mood = mood;

const SEA_R = 12.5, SEA_Y = -0.35, TARGET = new THREE.Vector3(0, -3.2, 0);
const col = (c) => new THREE.Color().setRGB(c[0], c[1], c[2]);

function Ticker() {
  const { camera, controls } = useThree();
  useEffect(() => {
    const az = num('az', null), pol = num('pol', 0.875), dist = num('dist', 37.8);
    if (az !== null) {
      const a = az * Math.PI / 180;
      camera.position.set(Math.sin(a) * Math.sin(pol) * dist, TARGET.y + Math.cos(pol) * dist, Math.cos(a) * Math.sin(pol) * dist);
      camera.lookAt(TARGET);
    }
    window.__cam = (azDeg, p = 0.875, d = 37.8) => {
      const a = azDeg * Math.PI / 180;
      camera.position.set(Math.sin(a) * Math.sin(p) * d, TARGET.y + Math.cos(p) * d, Math.cos(a) * Math.sin(p) * d);
      camera.lookAt(TARGET); controls?.update?.();
    };
  }, [camera, controls]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    mood.time += dt * (1 + mood.overwhelm * 0.8);
    mood.flash += (0 - mood.flash) * (1 - Math.exp(-4 * dt));
    window.__frames = (window.__frames || 0) + 1;
    // ?focus=i: frame one mobile up close (inspection only)
    const fi = window.__focus ?? num('focus', null);
    const m = fi !== null ? driftState.mobiles[fi] : null;
    if (m && m.size > 0) {
      const d = new THREE.Vector3(0.35, 0.25, 1).normalize().multiplyScalar(m.size * 3.4);
      camera.position.copy(m.pos).add(d); camera.lookAt(m.pos);
    }
  });
  return null;
}

// stand-in arena: sea disc, cut face, ink floor, units, core; tinted by the stage palette
function StandIn() {
  const top = useRef(), side = useRef(), core = useRef(), units = useRef();
  useFrame(() => {
    const p = stagePalette();
    top.current.material.color.copy(col(p.slots[0])).lerp(col(PALETTE.paper), 0.35);
    side.current.material.color.copy(col(p.slots[1])).lerp(col(PALETTE.ink), 0.45);
    core.current.material.color.copy(col(p.slots[4])).lerp(col(PALETTE.yolk), 0.6);
    core.current.rotation.y = mood.time * 0.4;
    units.current.children.forEach((m, i) => { m.position.y = 1 + 0.08 * Math.sin(mood.time * 1.7 + i); m.material.color.copy(col(p.slots[(i + 1) % 5])); });
  });
  const unitPos = [[3.2, 0], [-2.6, 1.9], [0.6, -3.1], [5.4, 2.2], [-5.0, -1.8], [1.5, 5.2], [-4.4, 4.6]];
  return (
    <group>
      <mesh ref={top} rotation-x={-Math.PI / 2} position-y={SEA_Y}><circleGeometry args={[SEA_R, 96]} /><meshLambertMaterial /></mesh>
      <mesh ref={side} position-y={SEA_Y - 2.5}><cylinderGeometry args={[SEA_R, SEA_R * 0.96, 5, 96, 1, true]} /><meshLambertMaterial side={THREE.DoubleSide} /></mesh>
      <mesh position-y={SEA_Y - 5} rotation-x={Math.PI / 2}><circleGeometry args={[SEA_R * 0.96, 96]} /><meshBasicMaterial color={col(PALETTE.ink)} /></mesh>
      <mesh position-y={SEA_Y + 0.5} rotation-x={Math.PI / 2}><torusGeometry args={[SEA_R + 0.12, 0.15, 10, 160]} /><meshLambertMaterial color={col(PALETTE.paper)} /></mesh>
      <mesh ref={core} position={[0, 1.7, 0]}><icosahedronGeometry args={[1.6, 1]} /><meshLambertMaterial flatShading /></mesh>
      <group ref={units}>{unitPos.map(([x, z], i) => (
        <mesh key={i} position={[x, 1, z]}><sphereGeometry args={[0.85, 24, 16]} /><meshLambertMaterial /></mesh>
      ))}</group>
    </group>
  );
}

function Slider({ name, min, max, step }) {
  const [v, setV] = useState(mood[name]);
  useEffect(() => { const id = setInterval(() => setV(mood[name]), 500); return () => clearInterval(id); }, [name]);
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 80 }}>{name}</span>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { const n = parseFloat(e.target.value); mood[name] = n; setV(n); }} />
      <span style={{ width: 40 }}>{(+v).toFixed(2)}</span>
    </label>
  );
}

function App() {
  useEffect(() => { if (q.get('flash')) setTimeout(() => { mood.flash = 1; }, 50); }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-paper)' }}>
      <Canvas linear legacy flat camera={{ position: [0, 21, 29], fov: 44, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
        <Ticker />
        <ambientLight intensity={0.7} />
        <directionalLight position={[-6, 10, 5]} intensity={1.6} />
        <PainterSky />
        <StandIn />
        {show('strata') && <Strata />}
        {show('mobiles') && <Mobiles clearCone={num('focus', null) === null} />}
        {show('tethers') && <Tethers />}
        {show('motes') && <Motes />}
        {num('focus', null) === null && <OrbitControls makeDefault autoRotate={q.get('rot') !== '0' && q.get('az') === null} autoRotateSpeed={0.3} enablePan={false}
          minDistance={12} maxDistance={90} target={[0, -3.2, 0]} enableDamping dampingFactor={0.08} />}
        {q.get('post') === '1' && <PainterPost quality="med" />}
      </Canvas>
      {q.get('ui') !== '0' && (
        <div style={{ position: 'absolute', left: 10, top: 10, padding: '8px 10px', background: 'var(--color-paper)', border: '3px solid var(--color-ink)',
          boxShadow: '2px 3px 0 0 var(--color-ink)', color: 'var(--color-ink)', font: '12px monospace', borderRadius: 8, display: 'grid', gap: 4 }}>
          <Slider name="stage" min={0} max={17} step={0.05} />
          <Slider name="complexity" min={0} max={1} step={0.01} />
          <Slider name="overwhelm" min={0} max={1} step={0.01} />
          <Slider name="depth" min={0} max={8} step={1} />
          <button onClick={() => { mood.flash = 1; }}>flash (reset)</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
