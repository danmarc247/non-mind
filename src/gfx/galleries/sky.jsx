import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import '../../index.css';
import { mood } from '../mood.js';
import { PainterSky } from '../PainterSky.jsx';

window.__mood = mood;

function Ticker() {
  useFrame((_, dt) => {
    mood.time += Math.min(dt, 0.1);
    window.__frames = (window.__frames || 0) + 1;
    mood.flash *= 0.92;
  });
  return null;
}

function Spheres() {
  const items = [
    [-2.4, 0, 0, '#ff2d7a'],
    [0, 0, 0, '#f4efe6'],
    [2.4, 0, 0, '#2a2bff'],
  ];
  return items.map(([x, y, z, c]) => (
    <mesh key={x} position={[x, y, z]}>
      <sphereGeometry args={[0.9, 48, 24]} />
      <meshStandardMaterial color={c} roughness={0.45} />
    </mesh>
  ));
}

function Slider({ name, min, max, step }) {
  const [v, setV] = useState(mood[name]);
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 90 }}>{name}</span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => { const n = parseFloat(e.target.value); mood[name] = n; setV(n); }}
      />
      <span style={{ width: 36 }}>{v}</span>
    </label>
  );
}

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 0.5, 7], fov: 55, far: 2000 }} dpr={[1, 2]}>
        <Ticker />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <PainterSky />
        <Spheres />
        <OrbitControls enablePan={false} />
      </Canvas>
      <div
        id="ui"
        style={{
          position: 'absolute', left: 10, top: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.55)',
          color: '#fff', font: '12px monospace', borderRadius: 6, display: 'grid', gap: 4,
        }}
      >
        <Slider name="stage" min={0} max={17} step={0.05} />
        <Slider name="complexity" min={0} max={1} step={0.01} />
        <Slider name="overwhelm" min={0} max={1} step={0.01} />
        <Slider name="depth" min={0} max={8} step={1} />
        <button onClick={() => { mood.flash = 1; }}>flash</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
