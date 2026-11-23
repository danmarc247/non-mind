// Tethers: very thin, slack, hand-drawn lines that almost connect things and visibly do not.
// Each ends a short gap before its target; the gap opens and closes slowly and never closes.
// One draw call: all tethers (x2 pencil passes) live in one ribbon geometry built in the vertex shader.
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { gatePos } from '../../game/index.js';
import { ease, smooth, tok, setSlots, driftState, SEA_R, SEA_Y, VESSEL_TOP, VESSEL_BOTTOM, CORE } from './shared.js';
import vert from '../glsl/drift.tether.vert.glsl';
import frag from '../glsl/drift.tether.frag.glsl';

const NT = 6, SEG = 64;
// from / to: { mobile: i } | { core: dir-of-gate } | { gate: dir } | { rim: true } | { foot: true } | { strata: [x, z] } | { under: [x, z] }
export const TETHER_DEFS = [
  { from: { core: 3 }, to: { gate: 3 }, unlock: 1, sag: 0.05 },
  { from: { mobile: 0 }, to: { rim: true }, unlock: 2, sag: 0.08 },
  { from: { strata: [6, 4] }, to: { under: [6, 4] }, unlock: 3, sag: 0.0 },
  { from: { mobile: 3 }, to: { foot: true }, unlock: 4, sag: 0.1 },
  { from: { core: 7 }, to: { gate: 7 }, unlock: 7, sag: 0.05 },
  { from: { mobile: 5 }, to: { mobile: 8 }, unlock: 9, sag: 0.12 },
];

const tR1 = new THREE.Vector3(), tR2 = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tD = new THREE.Vector3();
const gateWorld = (dir, out) => { const [x, z] = gatePos(dir); return out.set(x * 1.08, SEA_Y + 0.9, z * 1.08); };

export function Tethers({ width = 1.4, instant = false }) {
  const { size, viewport } = useThree();
  const { mesh, mat } = useMemo(() => {
    const n = NT * 2 * (SEG + 1) * 2;
    const id = new Float32Array(n), s = new Float32Array(n), side = new Float32Array(n), pass = new Float32Array(n), pos = new Float32Array(n * 3);
    const index = [];
    let v = 0;
    for (let t = 0; t < NT; t++) for (let p = 0; p < 2; p++) {
      const start = v;
      for (let k = 0; k <= SEG; k++) for (const sd of [-1, 1]) { id[v] = t; s[v] = k / SEG; side[v] = sd; pass[v] = p; v++; }
      for (let k = 0; k < SEG; k++) { const a = start + k * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aId', new THREE.BufferAttribute(id, 1)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); g.setAttribute('aPass', new THREE.BufferAttribute(pass, 1));
    g.setIndex(index);
    const arr = () => Array.from({ length: NT }, () => new THREE.Vector3());
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: {
        uP0: { value: arr() }, uP1: { value: arr() }, uGap: { value: new Array(NT).fill(1) }, uOn: { value: new Array(NT).fill(0) },
        uSag: { value: new Array(NT).fill(0) }, uTime: { value: 0 }, uWidth: { value: width }, uRes: { value: new THREE.Vector2(640, 400) },
        uFray: { value: 0 }, uFlash: { value: 0 },
        uInk: { value: tok('ink') }, uPaper: { value: tok('paper') }, uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() },
      },
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.raycast = () => {};
    return { mesh, mat };
  }, [width]);
  useEffect(() => () => { mesh.geometry.dispose(); mat.dispose(); }, [mesh, mat]);
  const st = useMemo(() => ({ on: new Array(NT).fill(0), snap: 0, last: 0 }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), u = mat.uniforms, t = mood.time, O = mood.overwhelm;
    u.uRes.value.set(size.width * viewport.dpr * 0.5, size.height * viewport.dpr * 0.5);
    u.uWidth.value = width * viewport.dpr;
    if (mood.flash > 0.8 && st.last <= 0.8) st.snap = 1;
    st.last = mood.flash; st.snap = ease(st.snap, 0, dt, 0.8);
    const M = driftState.mobiles;
    TETHER_DEFS.forEach((d, i) => {
      let vis = mood.stage >= d.unlock - 0.35 ? 1 : 0;
      const end = (spec, out, other) => {
        if (spec.mobile != null) {
          const m = M[spec.mobile];
          if (!m || m.vis < 0.05) { vis = 0; return out.set(0, 0, 0); }
          vis *= Math.min(1, m.vis * 1.3);
          // leave from / arrive at the body's surface, toward the other end
          tD.copy(other).sub(m.pos).normalize();
          return out.copy(m.pos).addScaledVector(tD, m.size * 0.82);
        }
        if (spec.core != null) { gateWorld(spec.core, tD); tD.sub(tB.set(...CORE)).normalize(); return out.set(...CORE).addScaledVector(tD, 2.1); }
        if (spec.gate != null) return gateWorld(spec.gate, out);
        if (spec.rim) { tD.copy(other); tD.y = 0; tD.setLength(SEA_R + 0.2); return out.set(tD.x, VESSEL_TOP + 0.1, tD.z); }
        if (spec.foot) { tD.copy(other); tD.y = 0; tD.setLength(SEA_R * 0.96); return out.set(tD.x, VESSEL_BOTTOM - 0.1, tD.z); }
        if (spec.strata) return out.set(spec.strata[0], -9 + 0.2, spec.strata[1]);
        if (spec.under) return out.set(spec.under[0], VESSEL_BOTTOM - 0.15, spec.under[1]);
        return out.set(0, 0, 0);
      };
      // rough endpoints first (for directions), then refined
      const rough = (spec, out) => spec.mobile != null ? (M[spec.mobile] ? out.copy(M[spec.mobile].pos) : out.set(0, 0, 0)) : end(spec, out, tA.set(0, 0, 0));
      const ra = rough(d.from, tR1), rb = rough(d.to, tR2);
      end(d.from, u.uP0.value[i], rb);
      end(d.to, u.uP1.value[i], ra);
      st.on[i] = instant ? vis * (1 - st.snap * 0.8) : ease(st.on[i], vis * (1 - st.snap * 0.8), dt, vis ? 1.2 : 3);
      u.uOn.value[i] = st.on[i];
      const L = u.uP0.value[i].distanceTo(u.uP1.value[i]);
      // the gap breathes; it never closes, it widens with overwhelm and snaps open on a reset
      u.uGap.value[i] = Math.min(L * 0.4, 0.45 + 0.03 * L + (0.6 + 0.02 * L) * (0.5 + 0.5 * Math.sin(t * (0.17 + 0.04 * i) + i * 1.9)) + O * 2.5 + st.snap * L * 0.3);
      u.uSag.value[i] = d.sag * (1 + 0.4 * Math.sin(t * 0.11 + i));
    });
    u.uTime.value = t; u.uFray.value = smooth(0.3, 1, O); u.uFlash.value = mood.flash * 0.5;
    setSlots(u, 2, ['uA', 'uB']);
  });
  return <primitive object={mesh} />;
}
export default Tethers;
