// Gallery for the painter post stack: colourful test scene + mood sliders.
// URL params: ?bypass=1 &q=low|med|high &ow=0..1 &tension=0..1 &flash=0..1
import { createRoot } from 'react-dom/client';
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { PainterPost } from '../PainterPost.jsx';

window.__mood = mood;
const params = new URLSearchParams(location.search);
mood.overwhelm = parseFloat(params.get('ow') || '0');
mood.tension = parseFloat(params.get('tension') || '0');
mood.flash = parseFloat(params.get('flash') || '0');
mood.complexity = parseFloat(params.get('cx') || '0.3');
mood.stage = parseFloat(params.get('stage') || '0');
// default matches the game Canvas (linear legacy flat = display sRGB, no colour management); ?cm=1 for colour-managed
const CM = params.get('cm') === '1';

const COLS = ['magenta', 'ultra', 'yolk', 'tangerine', 'teal', 'violet', 'blood', 'leaf', 'rose', 'sky', 'magenta', 'yolk'];

function Background() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `#define CM_POW ${CM ? 'pow(col, vec3(2.2))*1.1' : 'col'}
          varying vec3 vP; uniform float uTime;
          void main(){
            float y = vP.y*0.5+0.5; float x = atan(vP.z, vP.x);
            vec3 a = vec3(1.0,0.82,0.25), b = vec3(1.0,0.45,0.65), c = vec3(0.45,0.75,1.0);
            vec3 col = mix(a, b, smoothstep(0.2,0.6,y + 0.08*sin(x*3.0+uTime*0.2)));
            col = mix(col, c, smoothstep(0.55,0.95,y));
            gl_FragColor = vec4(CM_POW, 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => (mat.uniforms.uTime.value = mood.time));
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[60, 32, 16]} />
    </mesh>
  );
}

function Shapes() {
  const group = useRef();
  const items = useMemo(
    () =>
      COLS.map((c, i) => {
        const a = (i / COLS.length) * Math.PI * 2;
        const r = 2.2 + (i % 3) * 1.1;
        return { c: PALETTE[c], kind: i % 3, a, r, y: 0.6 + (i % 4) * 0.35, s: 0.45 + ((i * 7) % 5) * 0.12 };
      }),
    [],
  );
  useFrame(() => {
    const t = mood.time;
    group.current.children.forEach((m, i) => {
      const it = items[i];
      if (!it) return;
      const a = it.a + t * 0.12 * (i % 2 ? 1 : -0.7);
      m.position.set(Math.cos(a) * it.r, it.y + Math.sin(t * 0.8 + i) * 0.15, Math.sin(a) * it.r);
      m.rotation.set(t * 0.3 + i, t * 0.2 + i * 0.5, 0);
    });
  });
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} castShadow>
          {it.kind === 0 && <sphereGeometry args={[it.s, 32, 16]} />}
          {it.kind === 1 && <torusGeometry args={[it.s, it.s * 0.35, 16, 48]} />}
          {it.kind === 2 && <boxGeometry args={[it.s * 1.4, it.s * 1.4, it.s * 1.4]} />}
          <meshStandardMaterial color={new THREE.Color().setRGB(...it.c, THREE.SRGBColorSpace)} roughness={0.45} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

// small "game units" to test legibility
function Units() {
  const units = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -2 + (i % 3) * 0.55, z: 1.2 + Math.floor(i / 3) * 0.55, c: PALETTE[COLS[(i * 5) % 12]] })), []);
  return (
    <group>
      {units.map((u, i) => (
        <mesh key={i} position={[u.x, 0.16, u.z]} castShadow>
          {i % 2 ? <coneGeometry args={[0.13, 0.3, 12]} /> : <octahedronGeometry args={[0.15]} />}
          <meshStandardMaterial color={new THREE.Color().setRGB(...u.c, THREE.SRGBColorSpace)} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Clock() {
  useFrame((_, dt) => {
    mood.time += Math.min(dt, 0.1);
    if (mood.flash > 0 && window.__flashDecay) mood.flash = Math.max(0, mood.flash - dt * 0.8);
  });
  return null;
}

function Slider({ label, k, max = 1 }) {
  const [v, setV] = useState(mood[k]);
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 70 }}>{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={max > 1 ? 0.1 : 0.01}
        value={v}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          mood[k] = n;
          setV(n);
        }}
      />
      <span style={{ width: 32 }}>{v.toFixed(2)}</span>
    </label>
  );
}

function App() {
  const [bypass, setBypass] = useState(params.get('bypass') === '1');
  const [quality, setQuality] = useState(params.get('q') || 'med');
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#fbf6ec', position: 'relative' }}>
      <Canvas linear={!CM} legacy={!CM} flat={!CM} shadows camera={{ position: [0, 4.2, 7.5], fov: 45 }} dpr={[1, 2]}>
        <Clock />
        <Background />
        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#fff6e0', '#8fd3ff', 0.6]} />
        <directionalLight position={[4, 8, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[9, 64]} />
          <meshStandardMaterial color="#f3ead9" roughness={0.9} />
        </mesh>
        <Shapes />
        <Units />
        {!bypass && <PainterPost quality={quality} />}
      </Canvas>
      {params.get('ui') !== '0' && (
        <div
          style={{
            position: 'absolute', left: 12, top: 12, padding: 10, background: 'rgba(251,246,236,0.85)',
            font: '12px monospace', color: '#1b1030', display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 6,
          }}
        >
          <button onClick={() => setBypass((b) => !b)}>{bypass ? 'post: OFF (bypass)' : 'post: ON'}</button>
          <select value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="low">low</option>
            <option value="med">med</option>
            <option value="high">high</option>
          </select>
          <Slider label="overwhelm" k="overwhelm" />
          <Slider label="tension" k="tension" />
          <Slider label="flash" k="flash" />
          <Slider label="complexity" k="complexity" />
          <Slider label="stage/17" k="stage" max={17} />
          <button onClick={() => { mood.flash = 1; window.__flashDecay = true; }}>reset flash</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
