// <ArcVeil />: one subtle arena-wide paint layer per wave-arc modifier (WAVE_ARC ids),
// live while a fight runs (game.G.battle.arc.id), cross-fading softly between waves.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { mixStagePalette, linearToSrgb } from '../palettes/stages.js';
import { game, onEvent } from '../../game/store.js';
import { WAVE_ARC } from '../../game/index.js';
import { fxClock, _registerFx, FX_ARENA } from './PaintFx.jsx';
import veilVert from '../glsl/fx.veil.vert.glsl';
import veilFrag from '../glsl/fx.veil.frag.glsl';

export const ARC_IDS = WAVE_ARC.map((a) => a.id);   // negation, ineffable, analogy, onemany, counting, placeless, same, observer, cancel, return
const NPTS = 24;
const VEIL_Y = FX_ARENA.UNIT_Y + 0.75;
const ease = (cur, tgt, dt, rate) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

export function ArcVeil() {
  const st = useMemo(() => ({ cur: -1, prev: -1, mix: 1, str: 0, pulse: 0, stage: -1 }), []);
  if (typeof window !== 'undefined') window.__veil = st;
  const uniforms = useMemo(() => {
    const v = (k) => ({ value: new THREE.Vector3(...PALETTE[k]) });
    return {
      uTime: { value: 0 }, uCur: { value: -1 }, uPrev: { value: -1 }, uMix: { value: 1 }, uStr: { value: 0 }, uR: { value: FX_ARENA.SEA_R - 0.6 }, uPulse: { value: 0 },
      uPaper: v('paper'), uInk: v('ink'), uMagenta: v('magenta'), uUltra: v('ultra'), uYolk: v('yolk'), uTangerine: v('tangerine'), uA: v('rose'),
      uPts: { value: Array.from({ length: NPTS }, () => new THREE.Vector4()) }, uNPts: { value: 0 },
    };
  }, []);
  // built imperatively: R3F copies a `uniforms` prop into its own objects, which would freeze numeric values
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: veilVert, fragmentShader: veilFrag, uniforms, transparent: true, depthWrite: false }), [uniforms]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const on = (e) => { if (e.type === 'attend') st.pulse = Math.min(1, st.pulse + 0.3); if (e.type === 'reset') st.str = 0; };
    const a = onEvent(on), b = _registerFx(on);
    return () => { a(); b(); };
  }, [st]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), G = game.G, B = G && G.battle;
    const fighting = !!B && G.phase === 'fight';
    const id = B && B.arc ? ARC_IDS.indexOf(B.arc.id) : -1;
    if (fighting && id >= 0 && id !== st.cur) { st.prev = st.str > 0.05 ? st.cur : -1; st.cur = id; st.mix = st.prev < 0 ? 1 : 0; }
    st.mix = ease(st.mix, 1, dt, 2.2);
    st.str = ease(st.str, fighting ? 1 : 0, dt, fighting ? 2.5 : 1.6);
    st.pulse = ease(st.pulse, 0, dt, 3);
    const u = uniforms;
    u.uTime.value = fxClock.t; u.uCur.value = st.cur; u.uPrev.value = st.prev; u.uMix.value = st.mix; u.uStr.value = st.str; u.uPulse.value = st.pulse;
    if (Math.abs(mood.stage - st.stage) > 0.02) { st.stage = mood.stage; const p = mixStagePalette(mood.stage).primary; u.uA.value.set(linearToSrgb(p[0]), linearToSrgb(p[1]), linearToSrgb(p[2])); }
    let n = 0;
    if (B && st.str > 0.01) {
      for (const e of B.enemies) { if (n >= NPTS) break; if (e.alive) u.uPts.value[n++].set(e.x, e.z, e.boss ? 1.7 : 0.75, 1); }
      for (const c of B.units) { if (n >= NPTS) break; if (c.alive) u.uPts.value[n++].set(c.x, c.z, 1.0, 0); }
    }
    u.uNPts.value = n;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={VEIL_Y} renderOrder={3} frustumCulled={false} material={mat}>
      <circleGeometry args={[FX_ARENA.SEA_R, 96]} />
    </mesh>
  );
}

export default ArcVeil;
