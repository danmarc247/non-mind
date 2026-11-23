// Camera direction: soft zooms and held breaths at moments of realization.
// It never takes the camera away: it leans toward a focus, slows time a little, then lets go.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { game, onEvent } from '../game/store.js';
import { seatPos, gatePos } from '../game/index.js';
import { mood } from './mood.js';

export const director = { timeScale: 1, spin: 0 };
const HOME = new THREE.Vector3(0, -3.2, 0);
// kind -> [zoom (fraction of distance kept), hold seconds, time scale, priority]
const MOMENTS = {
  link: [0.62, 1.5, 0.35, 3], integrate: [0.66, 1.3, 0.45, 3], subtract: [0.66, 1.3, 0.45, 3], split: [0.7, 1.2, 0.5, 3],
  mutation: [0.8, 0.7, 0.8, 1], repurpose: [0.75, 1.0, 0.6, 2], ending: [0.5, 3.2, 0.2, 5], stage: [1.22, 2.4, 0.6, 4],
  boss: [0.8, 1.6, 0.6, 2], waveWin: [1.08, 1.1, 1, 1], waveLose: [0.9, 1.4, 0.7, 2], reset: [0.42, 2.6, 0.3, 6], first: [0.7, 2.0, 1, 2],
};
const smooth = (x) => x * x * (3 - 2 * x);

export default function Director() {
  const { camera, controls } = useThree();
  const m = useRef(null), cur = useRef({ focus: HOME.clone(), zoom: 1, drift: 0 });
  useEffect(() => onEvent((e, G) => {
    const at = (kind, p) => { const d = MOMENTS[kind]; if (m.current && m.current.pri > d[3] && m.current.t < m.current.hold) return; m.current = { kind, focus: p, zoom: d[0], hold: d[1], scale: d[2], pri: d[3], t: 0 }; };
    const unitPos = (id) => { const u = G.units.find((x) => x.id === id); if (!u || !u.seat) return new THREE.Vector3(0, 1.2, 0); const [x, z] = seatPos(u.seat.ring, u.seat.dir); return new THREE.Vector3(x, 0.8, z); };
    // joining and parting give the whole stage a push: it turns faster for a moment, then settles
    if (['link', 'integrate', 'subtract', 'split'].includes(e.type)) director.spin = Math.min(9, director.spin + (e.type === 'link' ? 3.2 : 4.5));
    if (e.type === 'stage' || e.type === 'reset') director.spin = Math.min(9, director.spin + 2.5);
    if (['link', 'integrate', 'subtract', 'mutation'].includes(e.type)) at(e.type, unitPos(e.id));
    else if (e.type === 'split') at('split', unitPos(e.a));
    else if (e.type === 'repurpose') at('repurpose', new THREE.Vector3(0, 0, 0));
    else if (e.type === 'ending' || e.type === 'reset') at(e.type, new THREE.Vector3(0, 1.7, 0));
    else if (e.type === 'stage') at('stage', HOME.clone());
    else if (e.type === 'waveWin' || e.type === 'waveLose') at(e.type, HOME.clone());
    else if (e.type === 'beat' && G.battle && G.battle.beat === 9 && (G.wave === 10 || G.battle.arc.mod.boss)) { const [x, z] = gatePos(e.gate); at('boss', new THREE.Vector3(x * 0.8, 0.8, z * 0.8)); }
    else if (e.type === 'attend' && G.stats.clicks === 1) at('first', new THREE.Vector3(0, 1.7, 0));
  }), []);
  useFrame((_, dtRaw) => {
    if (!controls) return;
    const dt = Math.min(dtRaw, 0.1), c = cur.current, mo = m.current;
    let wantFocus = HOME, wantZoom = 1, wantScale = 1;
    if (mo) {
      mo.t += dt;
      const inT = 0.45, outT = 0.7, k = mo.t < inT ? smooth(mo.t / inT) : mo.t > mo.hold ? 1 - smooth(Math.min(1, (mo.t - mo.hold) / outT)) : 1;
      wantFocus = HOME.clone().lerp(mo.focus, k * 0.7); wantZoom = 1 + (mo.zoom - 1) * k; wantScale = 1 + (mo.scale - 1) * k;
      if (mo.t > mo.hold + outT) m.current = null;
    }
    // a slow breathing dolly so the picture is never still; deeper when the fight is tense
    c.drift += dt * 0.12;
    const breathe = 1 + 0.018 * Math.sin(c.drift * 2.1) - 0.03 * mood.tension + 0.05 * mood.overwhelm * Math.sin(c.drift * 9);
    const a = 1 - Math.exp(-5 * dt);
    const prevZoom = c.zoom;
    c.zoom += (wantZoom * breathe - c.zoom) * a;
    const delta = wantFocus.clone().sub(c.focus).multiplyScalar(a);
    c.focus.add(delta);
    // apply as a relative change so the player's own orbiting and zooming are preserved
    controls.target.add(delta); camera.position.add(delta);
    const off = camera.position.clone().sub(controls.target).multiplyScalar(c.zoom / prevZoom);
    // the player's own distance is what stays within limits; the director's lean is applied on top of it,
    // so a moment can never ratchet a zoomed-in player outward or a zoomed-out player inward
    const own = Math.min(64, Math.max(12, off.length() / c.zoom));
    off.setLength(own * c.zoom);
    camera.position.copy(controls.target).add(off);
    director.timeScale += (wantScale - director.timeScale) * (1 - Math.exp(-8 * dt));
    // the stage always turns: a little faster with every stage of the loop, faster still when overwhelmed
    director.spin *= Math.exp(-1.1 * dt);
    controls.autoRotate = true;
    controls.autoRotateSpeed = (0.35 + 0.11 * mood.stage) * (1 + 0.8 * mood.overwhelm) + director.spin;
    if (!game.started) { const ang = dt * 0.05; camera.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, ang); }
  });
  return null;
}
