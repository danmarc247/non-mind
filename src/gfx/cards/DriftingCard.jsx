// DriftingCard: while game.G.cardOffer exists, one card floats above the sea at (x, ~2.6, z).
// A thin rounded slab with shader faces (front: the card's painted mark; back: a knife-painted pattern
// in its tone). Soft pop in, slow turn, bob, a few motes, a sweeping glint that quickens in the last 8 s.
// Hover lifts it and turns it to the camera; click collects it (500 ms: flip, shrink toward the
// bottom-right where the book lives, paper-white ring). Unclaimed, it drifts up and fades.
// State is read by polling game.G every frame (no React state at 60 Hz); the card text is never read here.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { game, act } from '../../game/store.js';
import { cardById } from '../../game/content/cards.js';
import { ease, tok, stagePalette } from '../arena/shared.js';
import { symbolGLSL, symbolIndex } from './symbols.js';
import cardVert from '../glsl/card.vert.glsl';
import cardFrag from '../glsl/card.frag.glsl';
import fxVert from '../glsl/card.fx.vert.glsl';
import fxFrag from '../glsl/card.fx.frag.glsl';

const HW = 0.5, HH = 0.72, DEPTH = 0.045, RADIUS = 0.11;
export const CARD_Y = 2.6;
const MOTES = 22, COLLECT_S = 0.5, URGENT_S = 8;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Live view of the card for galleries and HUD hints: world position, phase ('idle'|'live'|'collect'|'gone'), id. */
export const cardView = { pos: new THREE.Vector3(), phase: 'idle', id: null, hover: false };

export function slabGeometry() {
  const s = new THREE.Shape(), x = HW, y = HH, r = RADIUS;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -DEPTH / 2);
  return g;
}
/** The card's face material (front mark + back pattern); one per card on screen. */
export function cardMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: cardVert, fragmentShader: cardFrag.replace('#pragma CARD_SYMBOLS', symbolGLSL()),
    transparent: true, toneMapped: false, side: THREE.FrontSide,
    uniforms: {
      uHalfW: { value: HW }, uTime: { value: 0 }, uSymbol: { value: 0 }, uSeed: { value: 0.3 }, uGlint: { value: 1 }, uUrgency: { value: 0 },
      uFade: { value: 0 }, uFlash: { value: 0 }, uHover: { value: 0 }, uCx: { value: 0 },
      uTone: { value: tok('yolk') }, uPaper: { value: tok('paper') }, uInk: { value: tok('ink') }, uA: { value: tok('magenta') }, uB: { value: tok('teal') },
    },
  });
}
function fxMesh(count, kind) {
  const g = new THREE.InstancedBufferGeometry(), base = new THREE.PlaneGeometry(1, 1);
  g.index = base.index; g.setAttribute('position', base.getAttribute('position'));
  const seeds = new Float32Array(count * 4), idx = new Float32Array(count);
  let s = 11 + kind; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < count * 4; i++) seeds[i] = rnd();
  for (let i = 0; i < count; i++) idx[i] = i;
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    vertexShader: fxVert, fragmentShader: fxFrag, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: kind !== 1, toneMapped: false,
    uniforms: {
      uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 }, uCount: { value: count }, uSize: { value: [0.17, 2.6, 2.4][kind] }, uKind: { value: kind },
      uRing: { value: 1 }, uFade: { value: 0 }, uTone: { value: tok('paper') }, uPaper: { value: tok('paper') }, uInk: { value: tok('ink') }, uA: { value: tok('yolk') },
    },
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = [7, 12, 3][kind]; m.raycast = () => {}; m.visible = false;
  return m;
}

// fixedYaw / timeScale (galleries only): hold the slow turn at this angle (0 shows the front to a camera on +z); slow the card's clock.
export function DriftingCard({ y = CARD_Y, scale = 1.6, groundY = 0.1, fixedYaw = null, timeScale = 1 }) {
  const { camera } = useThree();
  const mesh = useRef();
  const parts = useMemo(() => {
    const geo = slabGeometry(), mat = cardMaterial();
    return { geo, mat, motes: fxMesh(MOTES, 0), ring: fxMesh(1, 1), ground: fxMesh(1, 2) };
  }, []);
  useEffect(() => () => { parts.geo.dispose(); parts.mat.dispose(); for (const m of [parts.motes, parts.ring, parts.ground]) { m.geometry.dispose(); m.material.dispose(); } }, [parts]);

  const st = useMemo(() => ({
    phase: 'idle', id: null, k: 0, pop: 0, phi: 0, s: 0.01, fade: 0, hov: 0, hover: false, yaw: 0, ringK: 1, clock: 0, motes: 0,
    pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), q: new THREE.Quaternion(), qIdle: new THREE.Quaternion(),
    qFace: new THREE.Quaternion(), qFrom: new THREE.Quaternion(), e: new THREE.Euler(), dummy: new THREE.Object3D(), v: new THREE.Vector3(), flipAx: new THREE.Vector3(0, 1, 0), qFlip: new THREE.Quaternion(),
  }), []);

  // a sensible hit volume: a sphere around the card, biased nearer so it wins over the sea and seat rings
  useEffect(() => {
    const m = mesh.current, sph = new THREE.Sphere(), hit = new THREE.Vector3();
    m.raycast = function raycast(raycaster, hits) {
      if (st.phase !== 'live' || st.fade < 0.3) return;
      sph.center.copy(m.position); sph.radius = (HH + 0.12) * m.scale.x;
      if (!raycaster.ray.intersectSphere(sph, hit)) return;
      const d = raycaster.ray.origin.distanceTo(hit);
      hits.push({ distance: Math.max(0.01, d - 1.5), point: hit.clone(), object: m });
    };
  }, [st]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1) * timeScale, m = mesh.current, u = parts.mat.uniforms, G = game.G, o = G.cardOffer;
    st.clock += dt * (1 + 0.6 * (st.phase === 'live' ? smooth(URGENT_S, 0, o ? o.t : 99) : 0));
    // phase changes, by polling
    if (o && st.id !== o.id && st.phase !== 'collect') {
      const c = cardById[o.id];
      st.phase = 'live'; st.id = o.id; st.k = 0; st.pop = 1; st.s = 0.01; st.fade = 0; st.hov = 0; st.phi = 0;
      st.pos.set(o.x, y, o.z);
      u.uSymbol.value = symbolIndex(c?.symbol); u.uSeed.value = ((c?.n ?? 0) * 0.618 + 0.13) % 1;
      u.uTone.value.fromArray(PALETTE[c?.tone] || PALETTE.yolk); parts.motes.material.uniforms.uTone.value.copy(u.uTone.value);
    } else if (st.phase === 'live' && (!o || o.id !== st.id)) {
      const got = (G.cards || []).includes(st.id);
      st.phase = got ? 'collect' : 'gone'; st.k = 0;
      st.from.copy(m.position); st.qFrom.copy(m.quaternion);
      if (got) { st.ringK = 0; parts.ring.material.uniforms.uCenter.value.copy(m.position); }
      if (st.hover) { st.hover = false; document.body.style.cursor = ''; }
    }
    st.k += dt;
    const urgency = st.phase === 'live' && o ? smooth(URGENT_S, 0, o.t) : 0;

    if (st.phase === 'live') {
      st.pop = ease(st.pop, 0, dt, 7); st.fade = ease(st.fade, 1, dt, 12);
      st.hov = ease(st.hov, st.hover ? 1 : 0, dt, st.hover ? 14 : 6);
      // the slow turn dwells facing the camera and hurries past edge-on, so the card always reads
      st.phi += dt * (0.42 + 0.5 * urgency) * (1 - st.hov);
      const camYaw = Math.atan2(camera.position.x - st.pos.x, camera.position.z - st.pos.z);
      st.yaw = fixedYaw !== null ? fixedYaw : camYaw + st.phi - 0.42 * Math.sin(2 * st.phi);
      const t = st.clock;
      m.position.set(st.pos.x, st.pos.y + 0.14 * Math.sin(t * 1.6 + st.pos.x) + 0.45 * st.hov + 0.6 * st.pop, st.pos.z);
      st.e.set(0.12 * Math.sin(t * 0.9), st.yaw, 0.07 * Math.sin(t * 1.3 + 1)); st.qIdle.setFromEuler(st.e);
      st.dummy.position.copy(m.position); st.dummy.lookAt(camera.position); st.qFace.copy(st.dummy.quaternion);
      m.quaternion.copy(st.qIdle).slerp(st.qFace, st.hov);
      const want = scale * (1 + 0.28 * st.pop) * (1 + 0.1 * st.hov) * (1 + 0.025 * urgency * Math.sin(t * 11));
      st.s = ease(st.s, want, dt, 12);
      u.uFlash.value = Math.max(0, st.pop - 0.4) * 0.5 + mood.flash * 0.25;
      st.motes = ease(st.motes, 9 + 13 * urgency + 4 * st.hov, dt, 3);
    } else if (st.phase === 'collect') {
      const k = Math.min(1, st.k / COLLECT_S), e = 1 - Math.pow(1 - k, 3);
      // target: a point toward the bottom-right of the view, close to the camera
      st.v.set(0.84, -0.8, 0.5).unproject(camera).sub(camera.position).normalize();
      st.to.copy(camera.position).addScaledVector(st.v, 7);
      m.position.lerpVectors(st.from, st.to, e); m.position.y += Math.sin(k * Math.PI) * 0.9;
      st.dummy.position.copy(m.position); st.dummy.lookAt(camera.position);
      st.qFlip.setFromAxisAngle(st.flipAx, e * Math.PI * 2);
      m.quaternion.copy(st.qFrom).slerp(st.dummy.quaternion, smooth(0, 0.4, k)).multiply(st.qFlip);
      st.s = scale * (1.12 * (1 - 0.86 * e)) * (1 + 0.22 * Math.sin(Math.min(1, k * 2.5) * Math.PI));
      st.fade = 1 - smooth(0.7, 1, k);
      u.uFlash.value = 0.55 * (1 - smooth(0, 0.5, k));
      st.motes = ease(st.motes, 0, dt, 10);
      if (k >= 1) { st.phase = 'idle'; st.id = null; st.fade = 0; }
    } else if (st.phase === 'gone') {
      m.position.y += dt * (0.8 + st.k * 2.2);
      st.yaw += dt * (1 + st.k * 2); st.e.set(0.1, st.yaw, 0); m.quaternion.setFromEuler(st.e);
      st.fade = ease(st.fade, 0, dt, 2.6); st.s = ease(st.s, scale * 0.8, dt, 2);
      u.uFlash.value = 0; st.motes = ease(st.motes, 0, dt, 4);
      if (st.fade < 0.015) { st.phase = 'idle'; st.id = null; st.fade = 0; }
    }
    st.ringK = Math.min(1, st.ringK + dt / 0.6);

    // uniforms
    const pal = stagePalette();
    m.visible = st.phase !== 'idle';
    m.scale.setScalar(Math.max(0.01, st.s));
    u.uTime.value = st.clock; u.uUrgency.value = urgency; u.uFade.value = st.fade; u.uHover.value = st.hov; u.uCx.value = mood.complexity;
    u.uA.value.set(...pal.accent); u.uB.value.set(...pal.primary);
    const mu = parts.motes.material.uniforms;
    parts.motes.visible = m.visible && st.motes > 0.3;
    mu.uCenter.value.copy(m.position); mu.uTime.value = st.clock; mu.uCount.value = st.motes; mu.uFade.value = st.fade; mu.uA.value.set(...pal.accent);
    const ru = parts.ring.material.uniforms;
    parts.ring.visible = st.ringK < 1; ru.uRing.value = st.ringK; ru.uFade.value = 1;
    const gu = parts.ground.material.uniforms;
    parts.ground.visible = m.visible && st.phase === 'live';
    gu.uCenter.value.set(st.pos.x, groundY, st.pos.z); gu.uTime.value = st.clock; gu.uRing.value = urgency; gu.uFade.value = st.fade * (1 - 0.6 * st.hov);
    gu.uTone.value.copy(u.uTone.value);
    cardView.pos.copy(m.position); cardView.phase = st.phase; cardView.id = st.id; cardView.hover = st.hover;
  });

  return (
    <group>
      <mesh ref={mesh} geometry={parts.geo} material={parts.mat} visible={false} frustumCulled={false} renderOrder={4}
        onClick={(e) => { e.stopPropagation(); if (st.phase === 'live' && game.G.cardOffer) act('collectCard'); }}
        onPointerOver={(e) => { e.stopPropagation(); if (st.phase !== 'live') return; st.hover = true; document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { if (st.hover) { st.hover = false; document.body.style.cursor = ''; } }}
        onPointerDown={(e) => e.stopPropagation()} />
      <primitive object={parts.motes} />
      <primitive object={parts.ring} />
      <primitive object={parts.ground} />
    </group>
  );
}

export default DriftingCard;
