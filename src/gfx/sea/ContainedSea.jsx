// ContainedSea: the sea as living abstract paint held in the glass vessel. Drop-in for Scene.jsx Sea():
// same footprint (top disc R 12.5 at y -0.35, a cut wall 5 deep tapered to 0.96, an ink floor).
// Seven surface movements cross-fade with mood.stage; game events drop ripples (16-slot ring buffer).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { stagePalette } from '../arena/shared.js';
import { onEvent } from '../../game/store.js';
import { gatePos } from '../../game/battle.js';
import vert from '../glsl/sea2.vert.glsl';
import topFrag from '../glsl/sea2.top.frag.glsl';
import wallFrag from '../glsl/sea2.wall.frag.glsl';

export const SEA_R = 12.5, SEA_Y = -0.35;
export const RIPPLES = 16;
// movement centres on the 0..17 stage axis: canvas, marbling, kaleidoscope, colonies, reaction, fold, flood
export const MOVEMENTS = ['canvas', 'marbling', 'kaleidoscope', 'colonies', 'reaction', 'fold', 'flood'];
const CENTRES = [0, 3, 6, 9, 12, 15, 17];
const SLOTS = ['primary', 'secondary', 'accent', 'glow', 'tertiary'];

// Pure: stage (0..17) + overwhelm (0..1) -> 7 normalised weights. Plateau of 1.1 stages, cross-fade over 0.8.
export function movementWeights(stage, overwhelm = 0, out = new Array(7).fill(0)) {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Math.abs(stage - CENTRES[i]);
    const x = Math.min(1, Math.max(0, (1.9 - d) / 0.8));
    out[i] = x * x * (3 - 2 * x); sum += out[i];
  }
  const o = Math.min(1, Math.max(0, overwhelm));
  for (let i = 0; i < 7; i++) out[i] = (out[i] / (sum || 1)) * (1 - o);
  out[6] += o;
  return out;
}

const v3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);

export function ContainedSea({ radius = SEA_R, y = SEA_Y, depth = 5, taper = 0.96 }) {
  const st = useRef({ t: 0, now: 0, head: 0, flash: 0, w: new Array(7).fill(0) });
  const { top, wall, floorGeo, topMat, wallMat, floorMat, uniforms } = useMemo(() => {
    const uniforms = {
      uT: { value: 0 }, uNow: { value: 0 }, uTension: { value: 0 }, uComplexity: { value: 0 }, uOverwhelm: { value: 0 },
      uLow: { value: 0 }, uFlash: { value: 0 }, uR: { value: radius }, uY: { value: y },
      uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uPal: { value: Array.from({ length: 5 }, () => new THREE.Vector3(1, 1, 1)) },
      uGround: { value: v3(PALETTE.paper) }, uPaper: { value: v3(PALETTE.paper) }, uInk: { value: v3(PALETTE.ink) },
      uMagenta: { value: v3(PALETTE.magenta) }, uUltra: { value: v3(PALETTE.ultra) },
      uMoveA: { value: new THREE.Vector4(1, 0, 0, 0) }, uMoveB: { value: new THREE.Vector4() },
    };
    const top = new THREE.RingGeometry(0.0001, radius, 256, 96);
    const wall = new THREE.CylinderGeometry(radius, radius * taper, depth, 192, 1, true);
    const floorGeo = new THREE.CircleGeometry(radius * taper, 96);
    const topMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: topFrag, uniforms, toneMapped: false });
    const wallMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: wallFrag, uniforms, defines: { SEA_WALL: 1 }, toneMapped: false });
    const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...PALETTE.ink, THREE.SRGBColorSpace) });
    return { top, wall, floorGeo, topMat, wallMat, floorMat, uniforms };
  }, [radius, y, depth, taper]);
  useEffect(() => () => { [top, wall, floorGeo, topMat, wallMat, floorMat].forEach((x) => x.dispose()); }, [top, wall, floorGeo, topMat, wallMat, floorMat]);

  // ripple ring buffer: kind 0 drop, 1 gate wake, 2 flash ring; w = kind*10 + strength (< 10)
  const drop = useMemo(() => (x, z, str, kind = 0) => {
    const s = st.current, r = uniforms.uRip.value[s.head];
    r.set(x, z, s.now, kind * 10 + Math.min(9.9, Math.max(0.05, str)));
    s.head = (s.head + 1) % RIPPLES;
  }, [uniforms]);

  useEffect(() => onEvent((e) => {
    if (e.type === 'attend') drop(0, 0, 0.9);
    else if (e.type === 'hit' && Number.isFinite(e.x)) drop(e.x, e.z, 0.3 + Math.min(0.7, (e.amt || 0) * 2));
    else if (e.type === 'enemyDeath' && Number.isFinite(e.x)) drop(e.x, e.z, e.boss ? 2 : 1.1);
    else if (e.type === 'beat' && e.gate != null) { const [gx, gz] = gatePos(e.gate); drop(gx, gz, 1.4, 1); }
  }), [drop]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), s = st.current, u = uniforms;
    s.t += dt * (1 + mood.overwhelm * 1.5 + mood.audio.low * 0.3);
    s.now += dt;
    if (mood.flash > s.flash + 0.25) drop(0, 0, 1.6, 2);         // one white ring outward per flash
    s.flash = mood.flash;
    u.uT.value = s.t; u.uNow.value = s.now;
    u.uTension.value = mood.tension; u.uComplexity.value = mood.complexity; u.uOverwhelm.value = mood.overwhelm;
    u.uLow.value = Math.min(1, mood.audio.low); u.uFlash.value = mood.flash;
    const p = stagePalette(), d = Math.floor(mood.depth) || 0;
    for (let i = 0; i < 5; i++) u.uPal.value[i].set(...p[SLOTS[(i + d) % 5]]);
    u.uGround.value.set(...p.ground);
    const w = movementWeights(mood.stage, mood.overwhelm, s.w);
    u.uMoveA.value.set(w[0], w[1], w[2], w[3]); u.uMoveB.value.set(w[4], w[5], w[6], 0);
  });

  return (
    <group>
      <mesh geometry={top} material={topMat} rotation-x={-Math.PI / 2} position-y={y} />
      <mesh geometry={wall} material={wallMat} position-y={y - depth / 2} />
      <mesh geometry={floorGeo} material={floorMat} position-y={y - depth} rotation-x={Math.PI / 2} />
    </group>
  );
}
export default ContainedSea;
