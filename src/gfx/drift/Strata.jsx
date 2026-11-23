// Strata: two to five large translucent horizontal sheets hovering below the vessel, each a slice of
// a different paint pattern, soft-edged, counter-rotating. The top sheet carries the vessel's
// contact-less shadow. depthWrite off, drawn before the other transparents.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { ease, smooth, tok, LIGHT, setSlots, SEA_R, VESSEL_TOP, VESSEL_BOTTOM } from './shared.js';
import vert from '../glsl/drift.paper.vert.glsl';
import frag from '../glsl/drift.strata.frag.glsl';

// y, radius, pattern, unlock stage, spin rate (rad/s, sign = direction), alpha
export const STRATA_DEFS = [
  { y: -9, r: 17.5, pattern: 0, unlock: 0, spin: 0.012, alpha: 0.95, slot: 0 },
  { y: -14, r: 21, pattern: 1, unlock: 0, spin: -0.008, alpha: 0.85, slot: 1 },
  { y: -19, r: 24.5, pattern: 2, unlock: 5, spin: 0.006, alpha: 0.75, slot: 2 },
  { y: -24, r: 28, pattern: 3, unlock: 9, spin: -0.005, alpha: 0.7, slot: 3 },
  { y: -29, r: 32, pattern: 4, unlock: 13, spin: 0.004, alpha: 0.65, slot: 4 },
];
const GEO = new THREE.CircleGeometry(1, 96);
const SHADOW_LIGHT = new THREE.Vector3(0.38, 1, 0.22).normalize();

export function Strata({ count = 5, scale = 1, instant = false }) {
  const sheets = useMemo(() => STRATA_DEFS.slice(0, count).map((d, i) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      uniforms: {
        uTime: { value: 0 }, uPattern: { value: d.pattern }, uR: { value: d.r * scale }, uShadow: { value: i === 0 ? 1 : 0 },
        uFade: { value: 0 }, uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uFlash: { value: 0 }, uSeed: { value: i * 2.17 + 0.3 },
        uAlpha: { value: d.alpha }, uSpin: { value: 0 },
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3() },
        uPaper: { value: tok('paper') }, uInk: { value: tok('ink') }, uLight: { value: SHADOW_LIGHT.clone() },
        uVesselR: { value: SEA_R + 0.12 }, uVesselTop: { value: VESSEL_TOP }, uVesselBottom: { value: VESSEL_BOTTOM },
      },
    });
    const mesh = new THREE.Mesh(GEO, m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = d.y * scale; mesh.scale.setScalar(d.r * scale);
    mesh.renderOrder = -2 - i; mesh.frustumCulled = false; mesh.raycast = () => {};
    return { d, mesh, m, a: 0, spin: i * 1.3 };
  }), [count, scale]);
  useEffect(() => () => sheets.forEach((s) => s.m.dispose()), [sheets]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), O = mood.overwhelm;
    for (const s of sheets) {
      const want = mood.stage >= s.d.unlock - 0.35 ? 1 : 0;
      s.a = instant ? want : ease(s.a, want, dt, want ? 0.8 : 2.5);
      s.mesh.visible = s.a > 0.004;
      if (!s.mesh.visible) continue;
      s.spin += dt * s.d.spin * (1 + O * 3 + mood.audio.low * 0.5);
      const u = s.m.uniforms;
      u.uTime.value = mood.time; u.uSpin.value = s.spin; u.uFade.value = s.a * (1 - 0.6 * smooth(0.6, 1, mood.flash));
      u.uComplexity.value = mood.complexity; u.uOverwhelm.value = O; u.uFlash.value = mood.flash * 0.5;
      setSlots(u, s.d.slot);
      // slow breathing apart: the slices separate a little as overwhelm rises
      s.mesh.position.y = s.d.y * scale * (1 + 0.15 * O) + Math.sin(mood.time * 0.13 + s.spin * 3.0) * 0.4;
    }
  });
  return <group>{sheets.map((s, i) => <primitive key={i} object={s.mesh} />)}</group>;
}
export default Strata;
