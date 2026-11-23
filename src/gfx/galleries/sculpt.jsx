// Sculpt gallery: every family form (raw / grown / refined), hybrids of each op, the six mutation
// axes, poles, siblings and all stressors (plain + affixed), as a grid of spinning raymarched SDFs.
// Query: ?sec=forms|hyb|muts|poles|str|all  ?cell=<px>  ?t=<seconds> (freeze time)  ?check=<n> (GLSL compile check of n random hybrids)
// window.__frames, window.__check = { done, n, errors[] }
import { useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import '../../index.css';
import { mood, PALETTE } from '../mood.js';
import { unitMaterial, stressorMaterial, sculptDebug, BRACKETS } from '../sculpt.js';
import { leaf, node, key } from '../../game/genome.js';
import { FAMILY } from '../../game/data.js';
import { ALL_STRESSORS } from '../../game/battle.js';
import { STRESSOR_AFFIXES } from '../../game/content/stressors.js';
import { MUTATION } from '../../game/content/mutations.js';

const q = new URLSearchParams(location.search);
const SEC = q.get('sec') || 'forms';
const CELL = +(q.get('cell') || 104);
const FREEZE = q.get('t');
const CHECK = +(q.get('check') || 0);
window.__mood = mood;
const FAMS = Object.keys(FAMILY);
const short = (f) => FAMILY[f].name.slice(0, 5).toLowerCase();
const Z = { twist: 0, noise: 0, hollow: 0, spikes: 0, rings: 0, stretch: 0 };

// ---- rows: [label, cells[]]; a cell is { label, mat: () => material } ----
const um = (g, link, muts = [], salt = '') => () => unitMaterial(g, link, muts, salt);
const fm = (g, link, F) => () => sculptDebug.material(`ax|${key(g)}|${link}|${JSON.stringify(F)}`, sculptDebug.unitSource(g, link, [], 'ax', F));
const L = leaf, N = node;
function rows() {
  const R = [];
  if (SEC === 'forms' || SEC === 'all') {
    [2, 6, 10].forEach((link, b) => R.push([`${BRACKETS[b]} L${link}`, FAMS.map((f) => ({ label: short(f), mat: um(L(f), link) }))]));
    R.push(['ladder', Array.from({ length: 12 }, (_, i) => ({ label: `knot L${i + 1}`, mat: um(L('rumination'), i + 1) }))]);
  }
  if (SEC === 'hyb' || SEC === 'all') {
    const pairs = [['rumination', 'reappraisal'], ['suppression', 'sublimation'], ['attunement', 'projection'], ['containment', 'equanimity'], ['dissociation', 'avoidance'], ['projection', 'rumination']];
    for (const op of ['blend', 'carve', 'mix']) R.push([op, pairs.map(([a, b], i) => ({ label: `${short(a)}${op[0]}${short(b)}`, mat: um(N(op, L(a), L(b), 0.35), [3, 4, 5, 6, 7, 9][i]) }))]);
    R.push(['deep', [
      { label: '3 blend', mat: um(N('blend', N('blend', L('rumination'), L('attunement')), L('equanimity'), 0.3), 6) },
      { label: '3 carve', mat: um(N('carve', N('blend', L('containment'), L('sublimation')), L('knot' in FAMILY ? 'knot' : 'rumination'), 0.3), 6) },
      { label: '3 mix', mat: um(N('mix', N('carve', L('suppression'), L('reappraisal')), L('dissociation'), 0.3), 7) },
      { label: '4 mixed', mat: um(N('blend', N('carve', L('containment'), L('projection')), N('mix', L('attunement'), L('equanimity')), 0.3), 8) },
      { label: '5 orbit', mat: um(N('blend', N('blend', N('blend', L('sublimation'), L('rumination')), L('avoidance')), N('blend', L('reappraisal'), L('attunement')), 0.3), 7) },
      { label: '6 leaves', mat: um(N('mix', N('blend', N('carve', L('suppression'), L('projection')), L('equanimity')), N('blend', N('blend', L('attunement'), L('dissociation')), L('rumination')), 0.3), 6) },
    ]]);
    R.push(['siblings', ['', 'a', 'b', 'c', 'd', 'e'].map((s, i) => ({ label: s ? `salt ${s}` : 'no salt', mat: um(N('blend', L('rumination'), L('attunement'), 0.3), 6, [], s) }))]);
  }
  if (SEC === 'muts' || SEC === 'all') {
    const g = N('blend', L('rumination'), L('reappraisal'), 0.3);
    const ax = Object.keys(Z);
    for (let i = 0; i < ax.length; i += 2) R.push([`${ax[i]} / ${ax[i + 1]}`, [ax[i], ax[i + 1]].flatMap((a) => [0, 0.5, 1].map((v) => ({ label: `${a} ${v}`, mat: fm(g, 6, { ...Z, [a]: v }) })))]);
    const sets = [['emotional_flooding', 'hyperarousal'], ['depersonalization', 'freeze_response'], ['flow_state', 'dialectical_thinking'], ['vagal_tone', 'secure_attachment'], ['return_of_the_repressed', 'kindling', 'trauma_bond'], ['radical_acceptance', 'reconsolidation', 'metacognition']].map((s) => s.filter((m) => MUTATION[m]));
    R.push(['real sets', sets.map((s, i) => ({ label: s.map((m) => m.slice(0, 4)).join('+'), mat: um(L(FAMS[i * 2 % 10]), 7, s) }))]);
  }
  if (SEC === 'poles' || SEC === 'all') {
    for (const p of [1, 0, -1]) R.push([p > 0 ? 'idealized' : p < 0 ? 'devalued' : 'whole', FAMS.map((f) => ({ label: short(f), mat: um(L(f, p), 6) }))]);
  }
  if (SEC === 'str' || SEC === 'all') {
    const S = ALL_STRESSORS;
    R.push(['stressors', S.slice(0, 10).map((d) => ({ label: d.id.slice(0, 7), mat: () => stressorMaterial(d.id) }))]);
    R.push(['', S.slice(10).map((d) => ({ label: d.id.slice(0, 7), mat: () => stressorMaterial(d.id) }))]);
    // one affix per style so all ten overlays show
    const byStyle = {}; for (const a of STRESSOR_AFFIXES) { const s = sculptDebug.affixStyle(a); if (!byStyle[s]) byStyle[s] = a; }
    const ax = Object.values(byStyle);
    R.push(['affixed', S.slice(0, 10).map((d, i) => { const a = ax[i % ax.length]; return { label: `${a.id.slice(0, 6)} ${d.id.slice(0, 4)}`, mat: () => stressorMaterial(d.id, a) }; })]);
    R.push(['', S.slice(10).map((d, i) => { const a = ax[(i + 3) % ax.length]; return { label: `${a.id.slice(0, 6)} ${d.id.slice(0, 4)}`, mat: () => stressorMaterial(d.id, a) }; })]);
  }
  return R;
}
const ROWS = rows();
const COLS = Math.max(...ROWS.map((r) => r[1].length));
const LABW = 92, PAD = 16, LABH = 16;
const W = LABW + COLS * CELL + PAD * 2, H = ROWS.length * (CELL + LABH) + PAD * 2;

// perspective camera far away (so the raymarch rays match the raster); looks slightly down like the game
// camera; cells sit in the plane through the origin facing it, 1 world unit = 1 css px there
const CAM_DIR = new THREE.Vector3(0, 0.38, 1).normalize();
const CAM_D = 2400;
function Grid() {
  const { camera } = useThree();
  const meshes = useMemo(() => {
    camera.position.copy(CAM_DIR).multiplyScalar(CAM_D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const geo = new THREE.SphereGeometry(1, 20, 14), out = [];
    ROWS.forEach(([, cells], r) => cells.forEach((c, i) => {
      const px = PAD + LABW + i * CELL + CELL / 2, py = PAD + r * (CELL + LABH) + LABH + CELL / 2;
      const m = new THREE.Mesh(geo, c.mat()); m.frustumCulled = false;
      m.position.copy(right).multiplyScalar(px - W / 2).addScaledVector(up, H / 2 - py);
      const s = CELL * 0.8; m.scale.setScalar(s); m.material.uniforms._scale.value = s; m.userData.ph = (r * 7 + i) * 1.7;
      out.push(m);
    }));
    return out;
  }, [camera]);
  useFrame((_, dt) => {
    mood.time = FREEZE !== null ? +FREEZE : mood.time + Math.min(dt, 0.1);
    window.__frames = (window.__frames || 0) + 1;
    for (const m of meshes) m.material.uniforms.time.value = mood.time + m.userData.ph;
  });
  return meshes.map((m) => <primitive key={m.uuid} object={m} />);
}

// GLSL compile check: n random hybrids + all stressor/affix pairs through three's real compile path
function Check({ n }) {
  const { gl, camera } = useThree();
  useEffect(() => {
    const errors = []; window.__check = { done: false, n: 0, errors };
    gl.debug.checkShaderErrors = true;
    gl.debug.onShaderError = (ctx, prog, vs, fs) => { errors.push((ctx.getShaderInfoLog(fs) || '') + (ctx.getProgramInfoLog(prog) || '')); };
    let seed = 99; const R = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296), pick = (a) => a[Math.floor(R() * a.length)];
    const MIDS = Object.keys(MUTATION);
    const rt = (k) => (k <= 1 ? L(pick(FAMS), R() < 0.2 ? (R() < 0.5 ? 1 : -1) : 0) : (() => { const a = 1 + Math.floor(R() * (k - 1)); return N(pick(['blend', 'carve', 'mix']), rt(a), rt(k - a), 0.2 + R() * 0.3); })());
    const mats = [];
    for (let i = 0; i < n; i++) mats.push(unitMaterial(rt(1 + Math.floor(R() * 6)), 1 + Math.floor(R() * 12), Array.from({ length: Math.floor(R() * 4) }, () => pick(MIDS)), 'c' + i));
    for (const d of ALL_STRESSORS) { mats.push(stressorMaterial(d.id)); mats.push(stressorMaterial(d.id, pick(STRESSOR_AFFIXES))); }
    if (q.get('broken')) mats.push(sculptDebug.material('broken', 'sphere(0.3);').clone()), (mats[mats.length - 1].fragmentShader += '\nvoid oops() { nope; }');
    const geo = new THREE.SphereGeometry(1, 8, 6);
    let i = 0;
    const tick = () => {
      const sc = new THREE.Scene();
      for (let j = 0; j < 6 && i < mats.length; j++, i++) sc.add(new THREE.Mesh(geo, mats[i]));
      gl.compile(sc, camera); gl.render(sc, camera); window.__check.n = i; // render forces the (parallel) link status check
      if (i < mats.length) setTimeout(tick, 0); else window.__check.done = true;
    };
    tick();
  }, [gl, camera, n]);
  return null;
}

function Labels() {
  const st = { position: 'absolute', font: '600 11px Fraunces, serif', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden' };
  return ROWS.flatMap(([lab, cells], r) => [
    <div key={`r${r}`} style={{ ...st, left: PAD, top: PAD + r * (CELL + LABH) + LABH + CELL / 2 - 8, width: LABW - 6, fontSize: 12, fontStyle: 'italic' }}>{lab}</div>,
    ...cells.map((c, i) => <div key={`c${r}_${i}`} style={{ ...st, left: PAD + LABW + i * CELL, top: PAD + r * (CELL + LABH), width: CELL, textAlign: 'center', fontWeight: 400, opacity: 0.75 }}>{c.label}</div>),
  ]);
}

function App() {
  return (
    <div style={{ position: 'relative', width: W, height: H, background: 'var(--color-paper)' }}>
      <Canvas dpr={1} gl={{ antialias: false }} style={{ position: 'absolute', inset: 0, width: W, height: H }}
        camera={{ fov: (2 * Math.atan(H / 2 / CAM_D) * 180) / Math.PI, near: 10, far: 6000, position: [0, 0, CAM_D] }} onCreated={({ gl }) => gl.setClearColor(new THREE.Color(...PALETTE.paper), 1)}>
        {CHECK ? <Check n={CHECK} /> : <Grid />}
      </Canvas>
      {!CHECK && <Labels />}
    </div>
  );
}
document.body.style.margin = '0';
document.body.style.background = 'var(--color-paper)';
window.__root = window.__root || createRoot(document.getElementById('root'));
window.__root.render(<App />);
window.__size = { W, H };
