// Mobiles: large, slow, abstract bodies hanging in the mid-distance around the vessel, touching nothing.
// Three programs shared by 14 bodies: raymarched solids (drift.solid), cut-paper cards (drift.paper)
// and thin wire orbits (drift.wire). Each body unlocks at a stage, gains intricacy after it unlocks,
// crowds inward and tears with overwhelm (solids also multiply into a torn twin), and scatters
// outward and fades on a reset flash. Bodies that drift between the camera and the arena fade out
// and side-step, so the arena is never blocked from any orbit angle.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { ease, smooth, tok, LIGHT, setSlots, driftState, clearOfArena } from './shared.js';
import solidVert from '../glsl/drift.solid.vert.glsl';
import solidFrag from '../glsl/drift.solid.frag.glsl';
import paperVert from '../glsl/drift.paper.vert.glsl';
import paperFrag from '../glsl/drift.paper.frag.glsl';
import wireFrag from '../glsl/drift.wire.frag.glsl';

const D = Math.PI / 180;
// kind: solid (sub = SDF kind), paper (sub = pattern, shape), wire (host = index of a body it orbits, or a free centre)
// az/r/y: home position (degrees, horizontal radius, height); size: bounding radius (world units)
export const MOBILE_DEFS = [
  { kind: 'solid', sub: 0, az: 205, r: 34, y: 5, size: 4.6, unlock: 0, slot: 0 },
  { kind: 'paper', sub: 0, shape: 0, az: 68, r: 31, y: -3, size: 6.0, unlock: 1, slot: 1 },
  { kind: 'wire', host: 0, rings: 3, unlock: 2, slot: 2 },
  { kind: 'solid', sub: 2, az: 318, r: 38, y: -14, size: 5.0, unlock: 3, slot: 3 },
  { kind: 'paper', sub: 1, shape: 1, aspect: 0.55, az: 148, r: 46, y: 9, size: 7.5, unlock: 4, slot: 2 },
  { kind: 'solid', sub: 1, az: 22, r: 27, y: -15, size: 4.0, unlock: 5, slot: 4 },
  { kind: 'solid', sub: 4, az: 252, r: 50, y: -7, size: 6.5, unlock: 6, slot: 1 },
  { kind: 'wire', host: 6, rings: 2, unlock: 7, slot: 0 },
  { kind: 'solid', sub: 3, az: 112, r: 35, y: -21, size: 4.4, unlock: 8, slot: 3 },
  { kind: 'paper', sub: 2, shape: 2, az: 290, r: 29, y: 2, size: 5.2, unlock: 9, slot: 0 },
  { kind: 'solid', sub: 0, alt: 1, az: 352, r: 56, y: 12, size: 5.5, unlock: 11, slot: 2 },
  { kind: 'paper', sub: 0, shape: 1, aspect: 1.0, az: 178, r: 23, y: -20, size: 4.2, unlock: 12, slot: 4 },
  { kind: 'solid', sub: 2, alt: 1, az: 46, r: 50, y: -27, size: 5.2, unlock: 14, slot: 1 },
  { kind: 'wire', center: [0, -13, 0], radius: 27, rings: 2, unlock: 16, slot: 3 },
];

const SOLID_GEO = new THREE.IcosahedronGeometry(1.12, 1);
const PLANE_GEO = new THREE.PlaneGeometry(2, 2, 1, 1);
const RING_GEO = new THREE.TorusGeometry(1, 0.011, 5, 220);

const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const tmpInv = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpP = new THREE.Vector3();

function common() {
  return {
    uTime: { value: 0 }, uDetail: { value: 0 }, uTear: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 },
    uSeed: { value: 0 }, uPale: { value: 0 },
    uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3() },
    uPaper: { value: tok('paper') }, uInk: { value: tok('ink') },
  };
}

export function Mobiles({ count = 14, scale = 1, clearCone = true, instant = false }) {
  const root = useRef();
  const { camera } = useThree();
  const controls = useThree((s) => s.controls);
  const st = useRef({ scatter: 0, lastFlash: 0, t: 0 });

  const items = useMemo(() => {
    const solidBase = new THREE.ShaderMaterial({
      vertexShader: solidVert, fragmentShader: solidFrag, side: THREE.BackSide, toneMapped: false,
      uniforms: { ...common(), uKind: { value: 0 }, uAlt: { value: 0 }, uStepK: { value: 0.8 }, uCamObj: { value: new THREE.Vector3() }, uLightObj: { value: new THREE.Vector3() } },
    });
    const paperBase = new THREE.ShaderMaterial({
      vertexShader: paperVert, fragmentShader: paperFrag, side: THREE.DoubleSide, transparent: true, toneMapped: false,
      uniforms: { ...common(), uPattern: { value: 0 }, uShape: { value: 0 }, uAspect: { value: 1 }, uLight: { value: LIGHT.clone() } },
    });
    const wireBase = new THREE.ShaderMaterial({
      vertexShader: paperVert, fragmentShader: wireFrag, toneMapped: false,
      uniforms: { ...common(), uDash: { value: 0 }, uLight: { value: LIGHT.clone() } },
    });
    const out = [];
    MOBILE_DEFS.slice(0, count).forEach((d, i) => {
      const g = new THREE.Group();
      const it = { d, i, g, meshes: [], a: 0, twin: null, pos: new THREE.Vector3(), clear: 1, push: new THREE.Vector3(),
        w: [0.031 + 0.02 * hash(i), 0.023 + 0.017 * hash(i + 9), 0.019 + 0.02 * hash(i + 4)],
        rw: [(hash(i + 2) - 0.5) * 0.09, 0.03 + 0.05 * hash(i + 3), (hash(i + 5) - 0.5) * 0.07], ph: hash(i + 7) * 6.28 };
      if (d.kind === 'solid') {
        const m = solidBase.clone(); m.uniforms.uKind.value = d.sub; m.uniforms.uAlt.value = d.alt || 0; m.uniforms.uSeed.value = i * 1.37;
        m.uniforms.uStepK.value = d.sub === 1 ? 0.55 : d.sub === 2 ? 0.7 : 0.8;
        const mesh = new THREE.Mesh(SOLID_GEO, m); mesh.frustumCulled = true; g.add(mesh); it.meshes.push(mesh);
        const tm = m.clone(); tm.uniforms.uSeed.value = i * 1.37 + 5.1;
        const twin = new THREE.Mesh(SOLID_GEO, tm); twin.visible = false; g.add(twin); it.twin = twin;
      } else if (d.kind === 'paper') {
        const m = paperBase.clone(); m.uniforms.uPattern.value = d.sub; m.uniforms.uShape.value = d.shape; m.uniforms.uAspect.value = d.aspect || 1; m.uniforms.uSeed.value = i * 1.37;
        const mesh = new THREE.Mesh(PLANE_GEO, m); g.add(mesh); it.meshes.push(mesh);
      } else {
        for (let k = 0; k < d.rings; k++) {
          const m = wireBase.clone(); m.uniforms.uSeed.value = i * 1.37 + k; m.uniforms.uDash.value = k % 2;
          const mesh = new THREE.Mesh(RING_GEO, m); mesh.frustumCulled = false;
          mesh.userData.k = k; g.add(mesh); it.meshes.push(mesh);
        }
      }
      g.visible = false;
      out.push(it);
    });
    return { list: out, mats: [solidBase, paperBase, wireBase] };
  }, [count]);

  useEffect(() => {
    const r = root.current; items.list.forEach((it) => r.add(it.g));
    driftState.mobiles = items.list.map((it) => ({ pos: it.pos, size: 0, vis: 0, kind: it.d.kind }));
    return () => {
      items.list.forEach((it) => { r.remove(it.g); it.meshes.forEach((m) => m.material.dispose()); it.twin?.material.dispose(); });
      items.mats.forEach((m) => m.dispose()); driftState.mobiles = [];
    };
  }, [items]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), s = st.current;
    const O = mood.overwhelm, t = mood.time;
    // reset flash: a rising edge above 0.8 throws everything outward; it drifts back over ~3 s
    if (mood.flash > 0.8 && s.lastFlash <= 0.8) s.scatter = 1;
    s.lastFlash = mood.flash;
    s.scatter = ease(s.scatter, 0, dt, 0.7);
    const target = controls?.target || driftState.cameraTarget;
    const pale = Math.max(0, 1 - mood.stage / 4) * 0.85;

    for (const it of items.list) {
      const d = it.d, u0 = it.meshes[0].material.uniforms;
      const want = mood.stage >= d.unlock - 0.35 ? 1 : 0;
      it.a = instant ? want : ease(it.a, want, dt, want ? 0.9 : 2.5);
      const detail = smooth(d.unlock, d.unlock + 6, mood.stage) * 0.75 + mood.complexity * 0.25;
      const reg = driftState.mobiles[it.i];
      if (it.a < 0.003 && !want) { it.g.visible = false; if (reg) reg.vis = 0; continue; }
      it.g.visible = true;

      let size = (d.size || 1) * scale * (0.55 + 0.45 * it.a);
      if (d.kind === 'wire') {
        const host = d.host != null ? items.list[d.host] : null;
        if (host) { it.pos.copy(host.pos); size = host.d.size * 1.55 * scale; } else it.pos.set(...d.center);
        const hostVis = host ? host.vis || 0 : 1;
        it.vis = it.a * hostVis * (1 - s.scatter * 0.9);
        it.g.position.copy(it.pos);
        it.meshes.forEach((m, k) => {
          const R = host ? size * (1 + 0.22 * k) : d.radius * (1 + 0.12 * k) * (1 - 0.25 * O);
          m.scale.set(R, R * (0.78 + 0.1 * k), R);
          m.rotation.set(1.1 + 0.4 * k + 0.2 * Math.sin(t * 0.05 + k), t * (0.05 + 0.03 * k) * (k % 2 ? -1 : 1) + k, 0.35 * k + 0.15 * Math.sin(t * 0.04));
          if (!host) m.rotation.set(Math.PI / 2 + 0.22 * (k ? -1 : 1) + 0.05 * Math.sin(t * 0.07 + k), t * 0.012 * (k ? -1 : 1), 0.12 * k);
          const u = m.material.uniforms;
          u.uTime.value = t; u.uDetail.value = detail; u.uTear.value = O; u.uFade.value = it.vis; u.uFlash.value = mood.flash * 0.6; u.uPale.value = pale;
          setSlots(u, d.slot + k, ['uA', 'uB']);
        });
        if (reg) { reg.size = 0; reg.vis = it.vis; }
        continue;
      }

      // home position, crowding inward with overwhelm, thrown outward by the reset scatter
      const az = d.az * D + t * 0.006 * (it.i % 2 ? 1 : -1) * (1 + O);
      const rr = d.r * scale * (1 - 0.36 * O) * (1 + 0.9 * s.scatter);
      const yy = d.y * scale * (1 - 0.3 * O) * (1 + 0.6 * s.scatter);
      tmpP.set(Math.cos(az) * rr, yy, Math.sin(az) * rr);
      tmpP.x += Math.sin(t * it.w[0] * 6.28 + it.ph) * 1.6 + Math.sin(t * 1.7 + it.ph) * 0.25 * O;
      tmpP.y += Math.sin(t * it.w[1] * 6.28 + it.ph * 2.0) * 1.3;
      tmpP.z += Math.cos(t * it.w[2] * 6.28 + it.ph * 0.5) * 1.6;
      // clear view: fade out and side-step when between the camera and the arena
      const clear = clearCone ? clearOfArena(camera.position, target, tmpP, size) : 1;
      it.clear = instant ? clear : ease(it.clear, clear, dt, 3);
      if (clearCone && clear < 1) {
        // side-step perpendicular to the view axis, away from it
        tmpC.copy(target).sub(camera.position).normalize();
        tmpV.copy(tmpP).sub(camera.position); tmpV.addScaledVector(tmpC, -tmpV.dot(tmpC));
        if (tmpV.lengthSq() < 1e-4) tmpV.set(1, 0, 0);
        tmpV.normalize().multiplyScalar((1 - clear) * size * 1.6);
        it.push.lerp(tmpV, 1 - Math.exp(-2 * dt));
      } else it.push.multiplyScalar(Math.exp(-1.5 * dt));
      tmpP.add(it.push);
      it.pos.copy(tmpP);
      it.vis = it.a * (1 - s.scatter * 0.95) * it.clear;
      it.g.position.copy(tmpP);
      it.g.rotation.set(t * it.rw[0] + it.ph, t * it.rw[1] * (it.i % 2 ? -1 : 1), t * it.rw[2] + 0.3 * Math.sin(t * 0.07 + it.ph));
      if (d.kind === 'paper') it.g.rotation.set(0.25 * Math.sin(t * it.w[0] + it.ph), t * it.rw[1] * 0.9 + it.ph, 0.2 * Math.sin(t * it.w[2] * 1.3));
      it.g.scale.setScalar(size * (1 + 0.04 * Math.sin(t * 0.9 + it.ph) + mood.audio.low * 0.03));
      it.g.visible = it.vis > 0.004;
      if (reg) { reg.size = size; reg.vis = it.vis; }

      const setU = (u, seedOff) => {
        u.uTime.value = t + it.ph * 10.0 + seedOff; u.uDetail.value = detail; u.uTear.value = smooth(0.25, 1, O);
        u.uFade.value = it.vis; u.uFlash.value = Math.max(mood.flash * 0.5, s.scatter * 0.4); u.uPale.value = it.i === 0 ? pale : pale * 0.6;
        setSlots(u, d.slot);
      };
      setU(u0, 0);
      if (d.kind === 'solid') {
        it.g.updateMatrixWorld(true);
        const m = it.meshes[0];
        tmpInv.copy(m.matrixWorld).invert();
        u0.uCamObj.value.copy(camera.position).applyMatrix4(tmpInv);
        u0.uLightObj.value.copy(LIGHT).transformDirection(tmpInv);
        // overwhelm: a torn twin peels away from each solid
        const tw = it.twin, tu = tw.material.uniforms, k = smooth(0.2, 0.8, O);
        tw.visible = k > 0.01 && it.g.visible;
        if (tw.visible) {
          tw.position.set(Math.sin(t * 0.3 + it.ph) * 1.4 * k, 0.9 * k + 0.2 * Math.sin(t * 0.5), Math.cos(t * 0.3 + it.ph) * 1.4 * k);
          tw.rotation.set(t * 0.2 * k, it.ph + t * 0.1, 0); tw.scale.setScalar(0.62 + 0.15 * k);
          setU(tu, 3.3); tu.uFade.value = it.vis * k * 0.9; tu.uTear.value = 1;
          tw.updateMatrixWorld(true);
          tmpInv.copy(tw.matrixWorld).invert();
          tu.uCamObj.value.copy(camera.position).applyMatrix4(tmpInv);
          tu.uLightObj.value.copy(LIGHT).transformDirection(tmpInv);
        }
      }
    }
  });

  return <group ref={root} />;
}
export default Mobiles;
