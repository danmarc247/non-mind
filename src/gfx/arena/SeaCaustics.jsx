// Light threads floating just above the sea, riding the sea's own waves (sea.vert.glsl).
// Thickens and brightens with complexity, coloured from the stage palette accent/glow.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { SEA_R, tok, stagePalette } from './shared.js';
import seaVert from '../glsl/sea.vert.glsl';
import causticsFrag from '../glsl/arena.caustics.frag.glsl';

export function SeaCaustics({ radius = 12.4, y = -0.3, iters = 4 }) {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.CircleGeometry(radius, 128);
    const mat = new THREE.ShaderMaterial({
      vertexShader: seaVert, fragmentShader: causticsFrag, defines: { CAUSTIC_ITERS: iters },
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: {
        uTime: { value: 0 }, uSide: { value: 0 }, uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uTension: { value: 0 }, uR: { value: SEA_R },
        uPaper: { value: tok('paper') }, uC: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() },
      },
    });
    return { geo, mat };
  }, [radius, iters]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(() => {
    const u = mat.uniforms, p = stagePalette();
    u.uTime.value = mood.time; u.uComplexity.value = mood.complexity; u.uOverwhelm.value = mood.overwhelm; u.uTension.value = mood.tension;
    u.uC.value.set(...p.accent); u.uGlow.value.set(...p.glow);
  });
  return <mesh geometry={geo} material={mat} rotation-x={-Math.PI / 2} position-y={y} renderOrder={2} raycast={() => null} />;
}
export default SeaCaustics;
