// Raymarched halo around the core: painted shells (one more layer per ~1.6 stages), ten filaments
// to the gates in family colours, a yolk shell on 'attend', reddening/tearing with overwhelm.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { FAMILY_PALETTES } from '../palettes/families.js';
import { onEvent } from '../../game/store.js';
import { FAMILIES } from '../../game/index.js';
import { ease, hex3, tok, setPaletteSlots } from './shared.js';
import litVert from '../glsl/arena.lit.vert.glsl';
import auraFrag from '../glsl/arena.aura.frag.glsl';

export function CoreAura({ position = [0, 1.7, 0], radius = 4.5, inner = 1.25, steps = 22 }) {
  const st = useMemo(() => ({ pulse: 99, flash: 0 }), []);
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, 40, 24);
    const fam = Array.from({ length: 10 }, () => tok('paper'));
    for (const f of FAMILIES) if (f.dir < 10) fam[f.dir] = hex3(FAMILY_PALETTES[f.id].a);
    const mat = new THREE.ShaderMaterial({
      vertexShader: litVert, fragmentShader: auraFrag, defines: { AURA_STEPS: steps },
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uTime: { value: 0 }, uStage: { value: 0 }, uComplexity: { value: 0 }, uOverwhelm: { value: 0 }, uTension: { value: 0 },
        uPulse: { value: 99 }, uFlash: { value: 0 }, uBound: { value: radius }, uInner: { value: inner },
        uCenter: { value: new THREE.Vector3(...position) },
        uPaper: { value: tok('paper') }, uBlood: { value: tok('blood') }, uMagenta: { value: tok('magenta') }, uYolk: { value: tok('yolk') },
        uP0: { value: new THREE.Vector3() }, uP1: { value: new THREE.Vector3() }, uP2: { value: new THREE.Vector3() }, uP3: { value: new THREE.Vector3() },
        uFam: { value: fam },
      },
    });
    return { geo, mat };
  }, [radius, inner, steps, position[0], position[1], position[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useEffect(() => onEvent((e) => { if (e.type === 'attend') { st.pulse = 0; st.flash = 1; } }), [st]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), u = mat.uniforms;
    st.pulse += dt; st.flash = ease(st.flash, 0, dt, 6);
    u.uTime.value = mood.time; u.uStage.value = mood.stage; u.uComplexity.value = mood.complexity;
    u.uOverwhelm.value = mood.overwhelm; u.uTension.value = mood.tension;
    u.uPulse.value = st.pulse; u.uFlash.value = Math.max(mood.flash, st.flash * 0.5);
    setPaletteSlots(u);
  });

  return <mesh geometry={geo} material={mat} position={position} renderOrder={6} raycast={() => null} />;
}
export default CoreAura;
