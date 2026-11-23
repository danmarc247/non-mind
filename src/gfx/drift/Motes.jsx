// Motes: one instanced draw of small paint dabs and short strokes rising slowly through the whole
// volume around (never inside) the vessel. Denser with complexity, flare on flash, shimmer on audio.high.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { ease, smooth, tok, stagePalette } from './shared.js';
import vert from '../glsl/drift.motes.vert.glsl';
import frag from '../glsl/drift.motes.frag.glsl';

export function Motes({ max = 420, yMin = -32, yMax = 24, rMin = 15, rMax = 62, size = 0.32 }) {
  const { mesh, mat } = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index; g.setAttribute('position', base.getAttribute('position'));
    const seeds = new Float32Array(max * 4);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < max * 4; i++) seeds[i] = rnd();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = max;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false,
      uniforms: {
        uTime: { value: 0 }, uCount: { value: 0 }, uFlash: { value: 0 }, uHigh: { value: 0 }, uScatter: { value: 0 }, uFade: { value: 1 },
        uYMin: { value: yMin }, uYMax: { value: yMax }, uRMin: { value: rMin }, uRMax: { value: rMax }, uSize: { value: size },
        uP0: { value: new THREE.Vector3() }, uP1: { value: new THREE.Vector3() }, uP2: { value: new THREE.Vector3() }, uP3: { value: new THREE.Vector3() }, uP4: { value: new THREE.Vector3() },
        uPaper: { value: tok('paper') }, uInk: { value: tok('ink') },
      },
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.raycast = () => {};
    return { mesh, mat };
  }, [max, yMin, yMax, rMin, rMax, size]);
  useEffect(() => () => { mesh.geometry.dispose(); mat.dispose(); }, [mesh, mat]);

  const st = useMemo(() => ({ count: 0, flare: 0, last: 0 }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), u = mat.uniforms;
    const want = max * (0.18 + 0.62 * mood.complexity + 0.2 * smooth(0, 16, mood.stage)) * (1 + 0.3 * mood.overwhelm);
    st.count = ease(st.count, Math.min(max, want), dt, 1.2);
    if (mood.flash > st.last + 0.05) st.flare = Math.max(st.flare, mood.flash);
    st.last = mood.flash; st.flare = ease(st.flare, 0, dt, 3);
    u.uTime.value = mood.time * (1 + mood.overwhelm * 0.6); u.uCount.value = st.count;
    u.uFlash.value = st.flare; u.uScatter.value = smooth(0.7, 1, st.flare); u.uHigh.value = mood.audio.high || 0;
    const p = stagePalette();
    ['uP0', 'uP1', 'uP2', 'uP3', 'uP4'].forEach((k, i) => u[k].value.set(...p.slots[(i + (Math.floor(mood.depth) || 0)) % 5]));
  });
  return <primitive object={mesh} />;
}
export default Motes;
