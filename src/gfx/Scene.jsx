// The arena: a contained sea in a glass vessel, ten gates, seats in rings, a core, and living SDF sculptures.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mood, PALETTE } from './mood.js';
import { mixStagePalette, linearToSrgb } from './palettes/stages.js';
import { ASPECT_TONES, FAMILY_PALETTES } from './palettes/families.js';
import { unitMaterial, stressorMaterial, coreMaterial, sculptEnv } from './sculpt.js';
import PainterSkyDefault, * as SkyMod from './PainterSky.jsx';
import PainterPostDefault, * as PostMod from './PainterPost.jsx';
import { game, tick, act, choose, onEvent, notify } from '../game/store.js';
import { ARENA, seatPos, gatePos, ringsOpen, FAMILIES, aspectsOf, leaves, ANY_STRESSOR } from '../game/index.js';
import { GatePortals, SeatRings, GlassVessel, CoreAura, SeaCaustics } from './arena/index.js';
import { PaintFx, ArcVeil } from './fx/index.js';
import Director, { director } from './Director.jsx';
import seaFrag from './glsl/sea.frag.glsl';
import seaVert from './glsl/sea.vert.glsl';

const PainterSky = SkyMod.PainterSky || PainterSkyDefault;
const PainterPost = PostMod.PainterPost || PainterPostDefault;
const col = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const SEA_R = 12.5, SEA_Y = -0.35, UNIT_Y = 1.0;
const ease = (cur, tgt, dt, rate = 10) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

// ---------- the contained sea ----------
function Sea() {
  const top = useRef(), side = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
    uPaper: { value: new THREE.Vector3(...PALETTE.paper) }, uInk: { value: new THREE.Vector3(...PALETTE.ink) },
    uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uTension: { value: 0 }, uR: { value: SEA_R }, uSide: { value: 0 }, uPulse: { value: 0 },
  }), []);
  const sideU = useMemo(() => ({ ...uniforms, uSide: { value: 1 } }), [uniforms]);
  useFrame(() => {
    const p = mixStagePalette(Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0)));
    const s = (c) => c.map(linearToSrgb);
    // R3F copies a `uniforms` prop, so write to the live material uniforms, not the memoised objects
    for (const u of [top.current.material.uniforms, side.current.material.uniforms]) {
      u.uTime.value = mood.time; u.uA.value.set(...s(p.primary)); u.uB.value.set(...s(p.secondary)); u.uC.value.set(...s(p.accent));
      u.uComplexity.value = mood.complexity; u.uOverwhelm.value = mood.overwhelm; u.uTension.value = mood.tension; u.uPulse.value = mood.flash;
    }
  });
  return (
    <group>
      <mesh ref={top} rotation-x={-Math.PI / 2} position-y={SEA_Y}>
        <circleGeometry args={[SEA_R, 128, 0, Math.PI * 2]} />
        <shaderMaterial vertexShader={seaVert} fragmentShader={seaFrag} uniforms={uniforms} />
      </mesh>
      <mesh ref={side} position-y={SEA_Y - 2.5}>
        <cylinderGeometry args={[SEA_R, SEA_R * 0.96, 5, 128, 1, true]} />
        <shaderMaterial vertexShader={seaVert} fragmentShader={seaFrag} uniforms={sideU} />
      </mesh>
      <mesh position-y={SEA_Y - 5} rotation-x={Math.PI / 2}><circleGeometry args={[SEA_R * 0.96, 96]} /><meshBasicMaterial color={col(PALETTE.ink)} /></mesh>
    </group>
  );
}

// ---------- seats and gates ----------
function Seats() {
  const group = useRef();
  const seats = useMemo(() => { const a = []; for (let r = 0; r < 3; r++) for (let d = 0; d < 10; d++) a.push({ ring: r, dir: d, pos: seatPos(r, d) }); return a; }, []);
  useFrame((_, dt) => {
    const G = game.G, open = ringsOpen(G);
    group.current.children.forEach((m, i) => {
      const s = seats[i], on = s.ring < open;
      const occ = G.units.find((u) => u.seat && u.seat.ring === s.ring && u.seat.dir === s.dir);
      const want = on ? (m.userData.hover ? 1.18 : 1) * (game.selected && !occ ? 1.0 + 0.06 * Math.sin(mood.time * 6 + i) : 1) : 0.001;
      m.scale.setScalar(ease(m.scale.x, want, dt, 14));
      const tone = occ ? ASPECT_TONES[aspectsOf(occ.g)[0]] : '#fbf6ec';
      m.material.color.lerp(new THREE.Color(tone), 1 - Math.exp(-8 * dt));
      m.material.opacity = occ ? 0.95 : game.selected ? 0.9 : 0.55;
    });
  });
  return (
    <group ref={group}>
      {seats.map((s) => (
        <mesh key={`${s.ring}-${s.dir}`} position={[s.pos[0], SEA_Y + 0.12, s.pos[1]]} rotation-x={-Math.PI / 2}
          onPointerOver={(e) => { e.object.userData.hover = true; document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.object.userData.hover = false; document.body.style.cursor = ''; }}
          onClick={(e) => {
            e.stopPropagation();
            const G = game.G, occ = G.units.find((u) => u.seat && u.seat.ring === s.ring && u.seat.dir === s.dir);
            if (game.selected && (!occ || occ.id !== game.selected) && !game.pending) { act('place', game.selected, { ring: s.ring, dir: s.dir }); game.selected = null; notify(); }
            else if (occ) choose(occ.id);
          }}>
          <ringGeometry args={[0.62, 0.8, 40]} />
          <meshBasicMaterial color="#fbf6ec" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
function Gates() {
  return (
    <group>
      {FAMILIES.map((f) => {
        const [x, z] = gatePos(f.dir), a = Math.atan2(x, z);
        return (
          <group key={f.id} position={[x * 1.08, SEA_Y + 0.5, z * 1.08]} rotation-y={a}>
            <mesh><torusGeometry args={[0.9, 0.09, 10, 40, Math.PI]} /><meshBasicMaterial color={FAMILY_PALETTES[f.id].a} /></mesh>
            <mesh position-y={0.02}><torusGeometry args={[0.66, 0.05, 8, 40, Math.PI]} /><meshBasicMaterial color={FAMILY_PALETTES[f.id].b} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------- sculptures ----------
const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const DISC = new THREE.CircleGeometry(1, 28);
function Bodies() {
  const root = useRef();
  const map = useRef(new Map());
  const hover = useRef(null);
  const { camera } = useThree();
  useEffect(() => onEvent((e) => {
    const hit = (id, v) => { const b = map.current.get(id); if (b) b.flash = Math.max(b.flash, v); };
    if (e.type === 'hit') hit((e.side ? 'e' : 'c') + e.id, 0.25 + Math.min(0.6, e.amt * 2));
    if (e.type === 'cast') { const b = map.current.get('c' + e.id); if (b) b.pop = 1; }
    if (e.type === 'link' || e.type === 'integrate' || e.type === 'subtract') { const b = map.current.get('u' + e.id); if (b) { b.pop = 1.4; b.flash = 0.9; } }
  }), []);
  useFrame((_, dt) => {
    const G = game.G, B = G.battle, want = new Map();
    const fighting = B && (G.phase === 'fight' || G.phase === 'won' || G.phase === 'lost');
    for (const u of G.units) {
      if (!u.seat) continue;
      const c = fighting ? B.units.find((x) => x.uid === u.id) : null;
      const [sx, sz] = seatPos(u.seat.ring, u.seat.dir);
      want.set('u' + u.id, { k: `${u.id}|${u.link}|${leaves(u.g).length}|${(u.muts || []).length}`, mat: () => unitMaterial(u.g, u.link, u.muts || [], u.id), x: c ? c.x : sx, z: c ? c.z : sz, s: 1.9 + 0.09 * u.link + 0.1 * leaves(u.g).length, hp: c ? c.hp / c.max : 1, dead: c ? !c.alive : false, alias: c ? 'c' + c.id : null, sel: game.selected === u.id, tone: ASPECT_TONES[aspectsOf(u.g)[0]], charge: c ? c.charge / 100 : 0 });
    }
    if (fighting) for (const e of B.enemies) want.set('e' + e.id, { k: `${e.def}|${e.affix || ''}`, mat: () => stressorMaterial(e.def, e.affix || null), x: e.x, z: e.z, s: (e.boss ? 3.6 : 1.45) + Math.min(0.5, (ANY_STRESSOR[e.def]?.value || 1) * 0.07), hp: e.hp / e.max, dead: !e.alive, enemy: true, tone: '#1b1030' });
    // reconcile
    for (const [id, w] of want) {
      let b = map.current.get(id);
      if (!b || b.k !== w.k) {
        if (b) { root.current.remove(b.g); b.mesh.material.dispose(); }
        const g = new THREE.Group(), mesh = new THREE.Mesh(SPHERE, w.mat()), disc = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: w.tone, transparent: true, opacity: 0.5, depthWrite: false }));
        mesh.frustumCulled = false; disc.rotation.x = -Math.PI / 2; disc.position.y = SEA_Y + 0.16 - UNIT_Y;
        g.add(mesh, disc); g.position.set(w.x, UNIT_Y, w.z); g.scale.setScalar(0.01);
        mesh.userData.pick = id; root.current.add(g);
        b = { g, mesh, disc, k: w.k, flash: b ? 1 : 0.6, pop: 1, fade: 0, s: 0.01 };
        map.current.set(id, b);
      }
      if (w.alias) map.current.set(w.alias, b);
      b.w = w;
    }
    for (const [id, b] of map.current) {
      const w = want.get(id) || (id[0] === 'c' ? b.w : null);
      if (id[0] === 'c') { if (!fighting) map.current.delete(id); continue; }
      const gone = !want.has(id) || w.dead;
      b.fade = ease(b.fade, gone ? 1.05 : 0, dt, gone ? 5 : 12);
      if (!want.has(id) && b.fade > 1) { root.current.remove(b.g); b.mesh.material.dispose(); b.disc.material.dispose(); map.current.delete(id); continue; }
      if (w) {
        b.g.position.x = ease(b.g.position.x, w.x, dt, 16); b.g.position.z = ease(b.g.position.z, w.z, dt, 16);
        b.pop = ease(b.pop, 0, dt, 7); b.flash = ease(b.flash, 0, dt, 9);
        b.s = ease(b.s, w.s * (1 + 0.28 * b.pop + (w.sel ? 0.12 + 0.04 * Math.sin(mood.time * 7) : 0)), dt, 12);
        b.g.position.y = UNIT_Y + (w.enemy ? 0 : 0.08 * Math.sin(mood.time * 1.7 + b.g.id)) + 0.5 * b.pop;
        b.disc.scale.setScalar(Math.max(0.01, (0.35 + 0.25 * w.hp) / Math.max(0.2, b.s)) * (w.enemy ? 0.8 : 1));
        b.disc.material.opacity = gone ? 0 : 0.25 + 0.5 * w.hp + 0.25 * (w.charge || 0);
      }
      b.g.scale.setScalar(b.s);
      const u = b.mesh.material.uniforms;
      b.spark = ease(b.spark || 0, hover.current === id ? 1 : 0, dt, hover.current === id ? 14 : 5);
      u.time.value = mood.time + b.g.id * 3.7; u._scale.value = b.s * (1 + 0.06 * b.spark); u.uFlash.value = b.flash; u.uFade.value = b.fade; if (u.uSpark) u.uSpark.value = b.spark;
      if (b.spark > 0.01) b.g.scale.setScalar(b.s * (1 + 0.06 * b.spark));
    }
    void camera;
  });
  return <group ref={root}
    onClick={(e) => { const id = e.object.userData.pick; if (id && id[0] === 'u') { e.stopPropagation(); choose(+id.slice(1)); } }}
    onPointerOver={(e) => { const id = e.object.userData.pick; if (id) { e.stopPropagation(); hover.current = id; if (id[0] === 'u') document.body.style.cursor = 'pointer'; } }}
    onPointerOut={(e) => { if (hover.current === e.object.userData.pick) { hover.current = null; document.body.style.cursor = ''; } }} />;
}

function Core() {
  const mesh = useRef(), st = useRef({ stage: -1, pop: 0 });
  useEffect(() => onEvent((e) => { if (e.type === 'attend') st.current.pop = 1; if (e.type === 'coreHit') st.current.pop = -0.6; }), []);
  useFrame((_, dt) => {
    const s = st.current, G = game.G;
    if (s.stage !== G.stage) { s.stage = G.stage; const old = mesh.current.material; mesh.current.material = coreMaterial(G.stage); old?.dispose?.(); s.pop = 1.5; }
    s.pop = ease(s.pop, 0, dt, 9);
    const sc = 3.2 + 0.06 * G.stage + 0.45 * s.pop + 0.06 * Math.sin(mood.time * 2);
    mesh.current.scale.setScalar(sc);
    const u = mesh.current.material.uniforms;
    if (u) { u.time.value = mood.time; u._scale.value = sc; u.uFlash.value = Math.max(0, s.pop * 0.35) + mood.flash * 0.5; }
  });
  return <mesh ref={mesh} geometry={SPHERE} position={[0, 1.7, 0]} frustumCulled={false}
    onClick={(e) => { e.stopPropagation(); act('attend'); }}
    onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }} />;
}

// ---------- paint fx: strokes for strikes, splats for hits ----------
function Fx() {
  const N = 220;
  const mesh = useRef(), items = useRef([]), dummy = useMemo(() => new THREE.Object3D(), []), c = useMemo(() => new THREE.Color(), []);
  useEffect(() => onEvent((e) => {
    const push = (o) => { if (items.current.length < N) items.current.push({ t: 0, ...o }); };
    const tone = (a) => ASPECT_TONES[a] || '#ff2d7a';
    if (e.type === 'strike') push({ kind: 'stroke', x: e.x, z: e.z, tx: e.tx, tz: e.tz, life: 0.22, color: tone(e.aspect) });
    if (e.type === 'hit' && e.amt > 0.02) push({ kind: 'splat', x: e.x, z: e.z, life: 0.35, size: 0.3 + Math.min(1, e.amt * 3), color: e.side ? tone(e.aspect) : '#1b1030' });
    if (e.type === 'enemyDeath') for (let i = 0; i < (e.boss ? 14 : 5); i++) push({ kind: 'splat', x: e.x + (Math.random() - 0.5) * 1.6, z: e.z + (Math.random() - 0.5) * 1.6, life: 0.5 + Math.random() * 0.3, size: 0.4 + Math.random() * 0.9, color: ['#ff2d7a', '#2a2bff', '#ffd21f'][i % 3] });
    if (e.type === 'cast') push({ kind: 'ring', x: e.x, z: e.z, life: 0.5, size: 2.2, color: tone(e.aspect) });
    if (e.type === 'beat') { const [x, z] = gatePos(e.gate); push({ kind: 'ring', x, z, life: 0.6, size: 1.8, color: '#1b1030' }); }
    if (e.type === 'attend') push({ kind: 'ring', x: 0, z: 0, life: 0.45, size: 3.2, color: '#ffd21f' });
    if (e.type === 'waveWin' || e.type === 'stage' || e.type === 'reset' || e.type === 'link') mood.flash = e.type === 'reset' ? 1 : e.type === 'link' ? 0.25 : 0.5;
  }), []);
  useFrame((_, dt) => {
    const arr = items.current; let n = 0;
    for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t > arr[i].life) arr.splice(i, 1); }
    for (const it of arr) {
      const k = it.t / it.life, out = 1 - Math.pow(1 - k, 3);
      if (it.kind === 'stroke') {
        const dx = it.tx - it.x, dz = it.tz - it.z, len = Math.hypot(dx, dz), head = Math.min(1, k * 2.2), tail = Math.max(0, k * 2.2 - 1.2);
        dummy.position.set(it.x + dx * (head + tail) / 2, UNIT_Y + 0.1, it.z + dz * (head + tail) / 2);
        dummy.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx)); dummy.scale.set(Math.max(0.01, len * (head - tail)), 0.16 * (1 - k * 0.5), 1);
      } else if (it.kind === 'splat') {
        dummy.position.set(it.x, UNIT_Y + 0.2 - out * 0.6, it.z); dummy.rotation.set(-Math.PI / 2, 0, it.x * 7); const s = it.size * (0.4 + out * 0.8) * (1 - k * k); dummy.scale.set(s, s * 0.8, 1);
      } else { dummy.position.set(it.x, SEA_Y + 0.2, it.z); dummy.rotation.set(-Math.PI / 2, 0, 0); const s = it.size * out; dummy.scale.set(s, s, 1); }
      dummy.updateMatrix(); mesh.current.setMatrixAt(n, dummy.matrix); mesh.current.setColorAt(n, c.set(it.color)); n++;
    }
    mesh.current.count = n; mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[null, null, N]} frustumCulled={false} renderOrder={5}>
      <circleGeometry args={[0.5, 18]} />
      <meshBasicMaterial transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------- loop: sim + mood ----------
function Loop({ audioRef }) {
  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), G = game.G;
    tick(dt * director.timeScale);
    mood.time += dt * (1 + mood.overwhelm * 0.8);
    mood.complexity = ease(mood.complexity, Math.min(1, G.complexity / Math.max(1, G.capacity)), dt, 1.5);
    mood.overwhelm = ease(mood.overwhelm, G.overwhelm, dt, 1.2);
    mood.tension = ease(mood.tension, G.phase === 'fight' ? Math.min(1, 0.3 + (G.battle?.enemies.length || 0) / 20) : 0, dt, 2);
    { const sp = mixStagePalette(Math.min(17, mood.stage)); sculptEnv.a.value.set(...sp.primary.map(linearToSrgb)); sculptEnv.b.value.set(...sp.secondary.map(linearToSrgb)); sculptEnv.c.value.set(...sp.accent.map(linearToSrgb)); }
    mood.stage = ease(mood.stage, G.stage, dt, 0.8); mood.depth = G.depth; mood.wave = G.wave; mood.cycle = G.cycle; mood.arc = (G.wave - 1) % 10; mood.flash = ease(mood.flash, 0, dt, 4);
    const a = audioRef?.current;
    if (a) {
      try {
        const cam = state.camera, f = new THREE.Vector3(); cam.getWorldDirection(f);
        a.setListener({ position: cam.position.toArray(), forward: f.toArray(), up: cam.up.toArray() });
        a.setMood({ complexity: mood.complexity, overwhelm: mood.overwhelm, tension: mood.tension, depth: G.depth, stance: G.stance });
        const lv = a.getLevels?.(); if (lv) Object.assign(mood.audio, lv);
      } catch { /* audio is optional */ }
    }
  });
  return null;
}

export default function Scene({ audioRef, quality = 'med', post = true }) {
  return (
    <Canvas linear legacy flat camera={{ position: [0, 21, 29], fov: 44, near: 0.5, far: 900 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => { if (game.selected || game.pending) { game.selected = null; game.pending = null; notify(); } }}>
      <Loop audioRef={audioRef} />
      <Director />
      <PainterSky />
      <Sea />
      <SeaCaustics />
      <GatePortals />
      <SeatRings />
      <Core />
      <CoreAura />
      <Bodies />
      <ArcVeil />
      <PaintFx />
      <GlassVessel />
      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.3} enablePan={false} minDistance={12} maxDistance={46} minPolarAngle={0.35} maxPolarAngle={1.25} target={[0, -3.2, 0]} enableDamping dampingFactor={0.08} rotateSpeed={0.5} />
      {post && <PainterPost quality={quality} />}
    </Canvas>
  );
}
