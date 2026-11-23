// 30 seats (3 rings x 10) as hand-painted white rings on colour fields. One instanced mesh,
// one draw call. Inner arc = occupant tolerance, outer arc = charge in fights, invite pulse
// while a unit is selected, hover. Click behaviour is the Scene.jsx Seats handler, verbatim.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood } from '../mood.js';
import { ASPECT_TONES } from '../palettes/families.js';
import { hexToRgb } from '../palettes/stages.js';
import { game, act, choose, notify } from '../../game/store.js';
import { seatPos, ringsOpen, aspectsOf, unitStats } from '../../game/index.js';
import { SEA_Y, ease, tok, stagePalette } from './shared.js';
import seatVert from '../glsl/arena.seat.vert.glsl';
import seatFrag from '../glsl/arena.seat.frag.glsl';

const N = 30, DISC_R = 0.98;
const PAPER_RGB = hexToRgb('#fbf6ec');

export function SeatRings({ y = SEA_Y + 0.42 }) {
  const mesh = useRef();
  const hover = useRef(-1);
  const seats = useMemo(() => { const a = []; for (let r = 0; r < 3; r++) for (let d = 0; d < 10; d++) a.push({ ring: r, dir: d, pos: seatPos(r, d) }); return a; }, []);
  const st = useMemo(() => seats.map((_, i) => ({ s: 0.001, tone: [...PAPER_RGB], tol: 0, charge: 0, hov: 0, inv: 0, occ: 0, self: 0, fight: 0, seed: ((i * 0.6180339) % 1) })), [seats]);
  const tolCache = useRef({ t: 0, map: new Map(), max: 1 });
  const { geo, mat, attrs } = useMemo(() => {
    const geo = new THREE.CircleGeometry(DISC_R, 40);
    const attrs = {
      aTone: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3),
      aData: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4),
      aMisc: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4),
    };
    for (const k in attrs) { attrs[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, attrs[k]); }
    const mat = new THREE.ShaderMaterial({
      vertexShader: seatVert, fragmentShader: seatFrag, transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uOverwhelm: { value: 0 }, uPaper: { value: tok('paper') }, uInk: { value: tok('ink') },
        uMagenta: { value: tok('magenta') }, uYolk: { value: tok('yolk') }, uField: { value: tok('paper') } },
    });
    return { geo, mat, attrs };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = mesh.current;
    seats.forEach((s, i) => { dummy.position.set(s.pos[0], y, s.pos[1]); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.instanceMatrix.needsUpdate = true;
    // fixed bound: computeBoundingSphere would freeze on the first (tiny) matrices
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, y, 0), 9.5);
  }, [seats, dummy, y]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), G = game.G, open = ringsOpen(G), m = mesh.current;
    const B = G.battle, fighting = !!B && (G.phase === 'fight' || G.phase === 'won' || G.phase === 'lost');
    // idle tolerance: relative to the strongest seated unit, refreshed at 4 Hz
    const tc = tolCache.current; tc.t -= dt;
    if (tc.t <= 0) {
      tc.t = 0.25; tc.map.clear(); tc.max = 1;
      for (const u of G.units) if (u.seat) { try { const v = unitStats(G, u, {}).tol; tc.map.set(u.id, v); tc.max = Math.max(tc.max, v); } catch { /* stats are optional here */ } }
    }
    const pal = stagePalette();
    mat.uniforms.uField.value.set(...pal.ground);
    seats.forEach((s, i) => {
      const k = st[i], on = s.ring < open;
      const occ = G.units.find((u) => u.seat && u.seat.ring === s.ring && u.seat.dir === s.dir);
      const c = fighting && occ ? B.units.find((x) => x.uid === occ.id) : null;
      const isHover = hover.current === i && on;
      const want = on ? (isHover ? 1.18 : 1) * (game.selected && !occ ? 1.0 + 0.06 * Math.sin(mood.time * 6 + i) : 1) : 0.001;
      k.s = ease(k.s, want, dt, 14);
      const tone = occ ? hexToRgb(ASPECT_TONES[aspectsOf(occ.g)[0]] || '#fbf6ec') : PAPER_RGB;
      for (let j = 0; j < 3; j++) k.tone[j] = ease(k.tone[j], tone[j], dt, 8);
      const tolT = occ ? (c ? Math.max(0, c.hp / c.max) : Math.min(1, (tc.map.get(occ.id) || tc.max) / tc.max)) : 0;
      k.tol = ease(k.tol, tolT, dt, 12);
      k.charge = c ? ease(k.charge, Math.min(1, c.charge / 100), dt, 16) : ease(k.charge, 0, dt, 6);
      k.hov = ease(k.hov, isHover ? 1 : 0, dt, 16);
      k.inv = ease(k.inv, on && game.selected && !occ ? 1 : 0, dt, 12);
      k.occ = ease(k.occ, occ ? 1 : 0, dt, 12);
      k.self = ease(k.self, occ && game.selected === occ.id ? 1 : 0, dt, 14);
      k.fight = ease(k.fight, c ? 1 : 0, dt, 10);
      dummy.position.set(s.pos[0], y, s.pos[1]); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(k.s); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      attrs.aTone.setXYZ(i, k.tone[0], k.tone[1], k.tone[2]);
      attrs.aData.setXYZW(i, k.tol, k.charge, k.hov, k.inv);
      attrs.aMisc.setXYZW(i, k.occ, k.seed, k.self, k.fight);
    });
    m.instanceMatrix.needsUpdate = true;
    attrs.aTone.needsUpdate = attrs.aData.needsUpdate = attrs.aMisc.needsUpdate = true;
    mat.uniforms.uTime.value = mood.time; mat.uniforms.uOverwhelm.value = mood.overwhelm;
  });

  // handlers: copied from Scene.jsx Seats (per-seat mesh) and keyed by instanceId
  const over = (e) => { if (e.instanceId == null) return; hover.current = e.instanceId; document.body.style.cursor = 'pointer'; };
  const out = () => { hover.current = -1; document.body.style.cursor = ''; };
  const click = (e) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const s = seats[e.instanceId];
    const G = game.G, occ = G.units.find((u) => u.seat && u.seat.ring === s.ring && u.seat.dir === s.dir);
    if (game.selected && (!occ || occ.id !== game.selected) && !game.pending) { act('place', game.selected, { ring: s.ring, dir: s.dir }); game.selected = null; notify(); }
    else if (occ) choose(occ.id);
  };

  return (
    <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} renderOrder={3}
      onPointerOver={over} onPointerMove={over} onPointerOut={out} onClick={click} />
  );
}
export default SeatRings;
