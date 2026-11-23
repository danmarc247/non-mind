// Plain picture: the same scene without the painted shaders. Sculptures become simple solids in their
// family colours, the sky a three-colour wash of the stage palette, the sea a flat disc; the post
// stack, strata, motes, drifting bodies, veils and paint effects are not mounted at all.
//
// Setting: localStorage `non-mind-plain` ('1' on). Change it from anywhere with
//   window.dispatchEvent(new CustomEvent('nonmind:plain', { detail: true | false }))
// Every change is announced as `nonmind:plain-changed` with detail { plain }.
import * as THREE from 'three';
import { unitColors } from './palettes/families.js';
import { mixStagePalette, linearToSrgb, hexToRgb } from './palettes/stages.js';

const KEY = 'non-mind-plain';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const plain = { on: read() };
const subs = new Set();
export const onPlain = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function setPlain(v) {
  v = !!v;
  if (v === plain.on) return;
  plain.on = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
  subs.forEach((f) => f(v));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nonmind:plain-changed', { detail: { plain: v } }));
}
if (typeof window !== 'undefined') window.addEventListener('nonmind:plain', (e) => setPlain(typeof e.detail === 'boolean' ? e.detail : !plain.on));

// One small solid per family, so ten families still read as ten shapes. All are about radius 1.
const GEO = {
  reappraisal: new THREE.SphereGeometry(1, 18, 12),
  suppression: new THREE.BoxGeometry(1.45, 1.45, 1.45),
  rumination: new THREE.TorusGeometry(0.78, 0.34, 10, 24),
  avoidance: new THREE.ConeGeometry(0.95, 1.7, 5),
  attunement: new THREE.IcosahedronGeometry(1, 1),
  projection: new THREE.OctahedronGeometry(1.1, 0),
  dissociation: new THREE.TorusKnotGeometry(0.62, 0.22, 48, 8),
  sublimation: new THREE.ConeGeometry(0.85, 1.8, 14),
  containment: new THREE.CylinderGeometry(0.85, 0.85, 1.3, 16),
  equanimity: new THREE.DodecahedronGeometry(1, 0),
};
const STRESSOR_GEO = new THREE.TetrahedronGeometry(1.15, 0);
const GREAT_GEO = new THREE.IcosahedronGeometry(1, 0);
const CORE_GEO = new THREE.SphereGeometry(1, 24, 16);
export const plainUnitGeo = (familyId) => GEO[familyId] || GEO.reappraisal;
export const plainStressorGeo = (great) => (great ? GREAT_GEO : STRESSOR_GEO);
export const plainCoreGeo = () => CORE_GEO;

// The sculpture shaders draw a form of about half the mesh scale inside a unit sphere, so the solid is
// drawn at SHRINK of the same scale and everything that sizes, picks and animates a body stays as it is.
const SHRINK = 0.5;
const VERT = /* glsl */ `
uniform float time; uniform float uTurn;
varying vec3 vN; varying vec3 vV;
void main() {
  float a = time * uTurn; float c = cos(a), s = sin(a);
  vec3 p = position * ${SHRINK.toFixed(2)};
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec3 n = normal; n.xz = mat2(c, -s, s, c) * n.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform float uFlash; uniform float uFade; uniform float uSpark; uniform float uGlow;
varying vec3 vN; varying vec3 vV;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  if (uFade > 0.0 && hash(gl_FragCoord.xy) < uFade) discard;   // fades out without sorting
  vec3 n = normalize(vN);
  float lit = 0.62 + 0.38 * max(0.0, dot(n, normalize(vec3(0.35, 0.8, 0.5))));
  float rim = pow(1.0 - max(0.0, dot(n, normalize(vV))), 2.2);
  vec3 col = mix(uA * lit, uB, rim * 0.75) + uGlow * uB * 0.25;
  col = mix(col, vec3(1.0), clamp(uFlash * 0.7 + uSpark * 0.18, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
}`;
const rgb = (c) => new THREE.Vector3(...(typeof c === 'string' ? hexToRgb(c) : c));
// Carries the uniforms the scene writes on every body (time, _scale, uFlash, uFade, uSpark).
export function plainMaterial(a, b, { turn = 0.35, glow = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { time: { value: 0 }, _scale: { value: 1 }, uFlash: { value: 0 }, uFade: { value: 0 }, uSpark: { value: 0 }, uTurn: { value: turn }, uGlow: { value: glow }, uA: { value: rgb(a) }, uB: { value: rgb(b) } },
  });
}
export function plainUnitMaterial(familyId, link) {
  const c = unitColors(familyId, link);
  return plainMaterial(c.a, c.b, { turn: 0.25 + 0.03 * link, glow: Math.min(1, (link - 1) / 10) });
}
export function plainStressorMaterial(tone) {
  const t = typeof tone === 'string' ? hexToRgb(tone) : tone;
  return plainMaterial(t.map((v) => v * 0.55), t, { turn: -0.6 });
}
export function plainCoreMaterial(stage) {
  const sp = mixStagePalette(Math.min(17, stage));
  return plainMaterial(sp.accent.map(linearToSrgb), sp.glow.map(linearToSrgb), { turn: 0.15, glow: 1 });
}

// Sky: one back-facing sphere, three palette colours by height. No noise, no loops.
const SKY_VERT = /* glsl */ `varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; varying vec3 vD;
void main() {
  float h = vD.y * 0.5 + 0.5;
  vec3 c = mix(uLow, uMid, smoothstep(0.18, 0.55, h));
  c = mix(c, uTop, smoothstep(0.5, 0.95, h));
  gl_FragColor = vec4(c, 1.0);
}`;
export function plainSkyMaterial() {
  return new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Vector3(1, 1, 1) }, uMid: { value: new THREE.Vector3(1, 1, 1) }, uLow: { value: new THREE.Vector3(1, 1, 1) } } });
}
// The stage palette, softened toward its ground so the wash stays calm behind the arena.
export function plainColours(stage) {
  const sp = mixStagePalette(Math.min(17, stage));
  const s = (k) => sp[k].map(linearToSrgb);
  const soft = (c, g, k) => c.map((v, i) => v * (1 - k) + g[i] * k);
  const ground = s('ground');
  return { top: soft(s('primary'), ground, 0.45), mid: soft(s('secondary'), ground, 0.6), low: soft(s('tertiary'), ground, 0.5), sea: soft(s('secondary'), ground, 0.25), rim: s('ink'), ground };
}
