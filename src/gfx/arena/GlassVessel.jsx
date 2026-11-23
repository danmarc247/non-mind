// The glass vessel around the sea: a tapered transparent wall (far side, then near side)
// plus a thick paper-white lip and a thin foot. Never writes depth, so the sea's cut face shows through.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { SEA_R, SEA_Y, tok, setPaletteSlots } from './shared.js';
import litVert from '../glsl/arena.lit.vert.glsl';
import glassFrag from '../glsl/arena.glass.frag.glsl';

export function GlassVessel({ radius = SEA_R + 0.12, top = SEA_Y + 0.5, depth = 5, taper = 0.96, lip = 0.15 }) {
  const bottom = SEA_Y - depth;
  const h = top - bottom, rBot = (radius - 0.12) * taper + 0.12;
  const { wall, lipGeo, footGeo, back, front, lipMat } = useMemo(() => {
    const wall = new THREE.CylinderGeometry(radius, rBot, h, 160, 6, true);
    const lipGeo = new THREE.TorusGeometry(radius, lip, 14, 200);
    const footGeo = new THREE.TorusGeometry(rBot, lip * 0.45, 8, 160);
    const uniforms = {
      uTime: { value: 0 }, uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uTension: { value: 0 }, uFlash: { value: 0 },
      uLip: { value: 0 }, uWaterY: { value: SEA_Y }, uBottomY: { value: bottom },
      uPaper: { value: tok('paper') }, uInk: { value: tok('ink') }, uMagenta: { value: tok('magenta') },
      uP0: { value: new THREE.Vector3() }, uP1: { value: new THREE.Vector3() }, uP2: { value: new THREE.Vector3() }, uP3: { value: new THREE.Vector3() },
    };
    const base = { vertexShader: litVert, fragmentShader: glassFrag, toneMapped: false, uniforms };
    const back = new THREE.ShaderMaterial({ ...base, side: THREE.BackSide, transparent: true, depthWrite: false });
    const front = new THREE.ShaderMaterial({ ...base, side: THREE.FrontSide, transparent: true, depthWrite: false });
    const lipMat = new THREE.ShaderMaterial({ ...base, uniforms: { ...uniforms, uLip: { value: 1 } } });
    return { wall, lipGeo, footGeo, back, front, lipMat };
  }, [radius, rBot, h, lip, bottom]);
  useEffect(() => () => { [wall, lipGeo, footGeo, back, front, lipMat].forEach((x) => x.dispose()); }, [wall, lipGeo, footGeo, back, front, lipMat]);

  useFrame(() => {
    const u = front.uniforms;   // shared uniform objects (back + lip reuse them)
    u.uTime.value = mood.time; u.uComplexity.value = mood.complexity; u.uOverwhelm.value = mood.overwhelm;
    u.uTension.value = mood.tension; u.uFlash.value = mood.flash;
    setPaletteSlots(u);
  });

  return (
    <group>
      <mesh geometry={wall} material={back} position-y={bottom + h / 2} renderOrder={1} />
      <mesh geometry={wall} material={front} position-y={bottom + h / 2} renderOrder={8} />
      <mesh geometry={lipGeo} material={lipMat} position-y={top} rotation-x={Math.PI / 2} />
      <mesh geometry={footGeo} material={lipMat} position-y={bottom} rotation-x={Math.PI / 2} />
    </group>
  );
}
export default GlassVessel;
