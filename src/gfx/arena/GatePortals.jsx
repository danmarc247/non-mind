// Ten gate portals on the rim: a painted arch frame (tube) + a portal surface showing the family's
// "field weather". One shader program, ten looks via uMode. Flares and ripples on 'beat' events.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { FAMILY_PALETTES } from '../palettes/families.js';
import { onEvent } from '../../game/store.js';
import { FAMILIES, gatePos } from '../../game/index.js';
import { SEA_Y, ease, hex3, tok } from './shared.js';
import uvVert from '../glsl/arena.uv.vert.glsl';
import litVert from '../glsl/arena.lit.vert.glsl';
import portalFrag from '../glsl/arena.portal.frag.glsl';
import frameFrag from '../glsl/arena.frame.frag.glsl';

// family id -> weather mode in arena.portal.frag.glsl
export const WEATHER_MODE = {
  reappraisal: 0, suppression: 1, rumination: 2, avoidance: 3, attunement: 4,
  projection: 5, dissociation: 6, sublimation: 7, containment: 8, equanimity: 9,
};
const HALF_W = 0.72, SPRING = 1.25, W = 1.72, H = 2.12, TUBE_R = 0.085;

function archCurve() {
  const pts = [], r = HALF_W + 0.05;
  for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(r, (SPRING * i) / 6, 0));
  for (let i = 1; i < 24; i++) { const a = (Math.PI * i) / 24; pts.push(new THREE.Vector3(Math.cos(a) * r, SPRING + Math.sin(a) * r, 0)); }
  for (let i = 6; i >= 0; i--) pts.push(new THREE.Vector3(-r, (SPRING * i) / 6, 0));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

export function GatePortals({ radiusScale = 1.08, y = SEA_Y - 0.05, scale = 1 }) {
  const groups = useRef([]);
  const { plane, tube, portalBase, frameBase } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(W, H, 1, 1); plane.translate(0, H / 2, 0);
    const tube = new THREE.TubeGeometry(archCurve(), 72, TUBE_R, 8, false);
    const common = { uTime: { value: 0 }, uSeed: { value: 0 }, uFlare: { value: 0 }, uPaper: { value: tok('paper') }, uInk: { value: tok('ink') }, uA: { value: tok('paper') }, uB: { value: tok('paper') } };
    const portalBase = new THREE.ShaderMaterial({
      vertexShader: uvVert, fragmentShader: portalFrag, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { ...common, uMode: { value: 0 }, uRip: { value: 99 }, uTension: { value: 0 }, uOverwhelm: { value: 0 }, uComplexity: { value: 0 },
        uC: { value: tok('paper') }, uMagenta: { value: tok('magenta') }, uSize: { value: new THREE.Vector2(W, H) }, uHalfW: { value: HALF_W }, uSpring: { value: SPRING } },
    });
    const frameBase = new THREE.ShaderMaterial({ vertexShader: litVert, fragmentShader: frameFrag, toneMapped: false, uniforms: common });
    return { plane, tube, portalBase, frameBase };
  }, []);
  const gates = useMemo(() => FAMILIES.map((f, i) => {
    const pal = FAMILY_PALETTES[f.id];
    const portal = portalBase.clone(), frame = frameBase.clone();
    const pu = portal.uniforms, fu = frame.uniforms;
    pu.uMode.value = WEATHER_MODE[f.id] ?? i; pu.uSeed.value = fu.uSeed.value = i * 0.137 + 0.05;
    pu.uA.value = hex3(pal.a); pu.uB.value = hex3(pal.b); pu.uC.value = hex3(pal.c);
    fu.uA.value = hex3(pal.a); fu.uB.value = hex3(pal.b);
    const [x, z] = gatePos(f.dir);
    return { id: f.id, dir: f.dir, portal, frame, pos: [x * radiusScale, y, z * radiusScale], rot: Math.atan2(x, z), kick: 0, flare: 0, rip: 99 };
  }), [portalBase, frameBase, radiusScale, y]);
  useEffect(() => () => { gates.forEach((g) => { g.portal.dispose(); g.frame.dispose(); }); }, [gates]);
  useEffect(() => () => { plane.dispose(); tube.dispose(); portalBase.dispose(); frameBase.dispose(); }, [plane, tube, portalBase, frameBase]);
  useEffect(() => onEvent((e) => {
    if (e.type !== 'beat') return;
    const g = gates.find((x) => x.dir === e.gate); if (g) { g.kick = 1; g.rip = 0; }
  }), [gates]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    gates.forEach((g, i) => {
      g.flare = ease(g.flare, g.kick, dt, 18);      // ~150 ms attack
      g.kick = ease(g.kick, 0, dt, 3.2);            // ~300 ms hold, soft release
      g.rip += dt;
      const pu = g.portal.uniforms, fu = g.frame.uniforms;
      pu.uTime.value = fu.uTime.value = mood.time;
      pu.uFlare.value = fu.uFlare.value = g.flare;
      pu.uRip.value = g.rip;
      pu.uTension.value = mood.tension; pu.uOverwhelm.value = mood.overwhelm; pu.uComplexity.value = mood.complexity;
      const grp = groups.current[i];
      if (grp) grp.scale.setScalar(scale * (1 + 0.1 * g.flare + 0.025 * mood.tension * Math.sin(mood.time * 2.2 + i * 0.7)));
    });
  });

  return (
    <group>
      {gates.map((g, i) => (
        <group key={g.id} ref={(el) => { groups.current[i] = el; }} position={g.pos} rotation-y={g.rot}>
          <mesh geometry={plane} material={g.portal} />
          <mesh geometry={tube} material={g.frame} />
        </group>
      ))}
    </group>
  );
}
export default GatePortals;
