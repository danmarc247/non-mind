// Genome -> Shader Park program -> GLSL raymarch material.
// Every regulator is an SDF sculpture compiled from its genome tree, so a hybrid is the literal
// CSG (blend / carve) of its parents, and every new combination is a form nobody has seen before.
import * as THREE from 'three';
import { sculptToThreeJSShaderSource } from 'shader-park-core';
import { key, leaves } from '../game/genome.js';
import { unitColors } from './palettes/families.js';
import { PALETTE } from './mood.js';

const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(',')})`;

// Family forms. A, B = colours; each stays inside radius ~0.5.
const FORMS = {
  lens: (A, B) => `color(${A}); sphere(0.4); difference(); displace(0,0,0.36); sphere(0.34); union(); displace(0,0,-0.36); color(${B}); torus(0.43,0.035);`,
  slab: (A, B) => `color(${A}); box(0.3,0.4,0.18); color(${B}); displace(0,0.22,0); box(0.38,0.05,0.24); displace(0,-0.44,0); box(0.38,0.05,0.24);`,
  knot: (A, B) => `rotateY(time*0.7); color(${A}); torus(0.3,0.085); rotateX(1.57); color(${B}); torus(0.3,0.075); rotateZ(1.57); color(${A}); torus(0.3,0.065);`,
  shard: (A, B) => `rotateZ(0.45); color(${A}); box(0.07,0.48,0.07); rotateY(0.9); rotateZ(-0.9); color(${B}); box(0.05,0.36,0.16);`,
  rings: (A, B) => `color(${A}); sphere(0.19); color(${B}); rotateX(0.5+0.2*sin(time)); torus(0.32,0.04); rotateX(1.1); color(${A}); torus(0.44,0.03);`,
  spike: (A, B) => `color(${A}); sphere(0.22); mirrorXYZ(); color(${B}); line(vec3(0,0,0), vec3(0.3,0.3,0.3), 0.045); line(vec3(0,0,0), vec3(0.46,0.0,0.0), 0.035);`,
  shell: (A, B) => `color(${A}); sphere(0.42); difference(); sphere(0.37); displace(0.1,0.28,0.22); sphere(0.3); union(); displace(-0.1,-0.28,-0.22); color(${B}); sphere(0.1+0.03*sin(time*2.0));`,
  flame: (A, B) => `color(${A}); sphere(0.28); blend(0.18); displace(0.04*sin(time*3.0),0.26,0); color(${B}); sphere(0.18); displace(-0.06*sin(time*2.3),0.2,0); sphere(0.09);`,
  bowl: (A, B) => `color(${A}); sphere(0.44); difference(); displace(0,0.2,0); sphere(0.43); union(); displace(0,-0.22+0.04*sin(time*1.5),0); color(${B}); sphere(0.13);`,
  orbit: (A, B) => `color(${A}); sphere(0.2); color(${B}); rotateX(time*0.8); torus(0.38,0.025); rotateZ(time*1.1+1.0); torus(0.46,0.02);`,
  // stressors
  burr: (A, B) => `rotateY(time); color(${A}); sphere(0.2); mirrorXYZ(); color(${B}); line(vec3(0,0,0), vec3(0.34,0.34,0.34), 0.03); line(vec3(0,0,0), vec3(0.42,0,0.2), 0.03);`,
  dart: (A, B) => `rotateZ(1.57); color(${A}); box(0.05,0.44,0.05); color(${B}); displace(0,0.3,0); box(0.14,0.06,0.14);`,
  needle: (A, B) => `rotateX(time*2.0); color(${A}); line(vec3(-0.45,0,0), vec3(0.45,0,0), 0.03); color(${B}); sphere(0.12);`,
  blob: (A, B) => `let q=getSpace(); color(${A}); sphere(0.3+0.07*sin(q.x*9.0+time*2.0)*sin(q.y*8.0+time)); blend(0.2); displace(0.22,0.1,0); color(${B}); sphere(0.17);`,
  weight: (A, B) => `color(${A}); box(0.34,0.26,0.34); color(${B}); displace(0,0.3,0); torus(0.12,0.04);`,
  maw: (A, B) => `rotateY(time*0.4); color(${A}); sphere(0.46); difference(); displace(0,0,0.3); sphere(0.34); union(); displace(0,0,-0.3); mirrorXYZ(); color(${B}); line(vec3(0.2,0.2,0.2), vec3(0.42,0.42,0.42), 0.05);`,
};
import { FAMILY } from '../game/data.js';
import { ANY_STRESSOR } from '../game/battle.js';
import { formOf } from '../game/content/mutations.js';

const OFF = [[0.2, 0.08, 0], [-0.16, 0.14, 0.1], [0.05, -0.2, 0.14], [-0.1, -0.08, -0.2], [0.14, 0.2, -0.12]];
function treeSrc(g, link, ctx) {
  if (g.t === 'leaf') {
    const c = unitColors(g.f, Math.round(4 + (link - 1) * 8 / 11));
    const tint = (col, p) => col.map((x) => (p > 0 ? x + (1 - x) * 0.45 : p < 0 ? x * 0.45 : x));
    const crown = g.pole > 0 ? `displace(0,0.44,0); color(${v3(PALETTE.paper)}); sphere(0.06);` : g.pole < 0 ? `displace(0,-0.4,0); color(${v3(PALETTE.ink)}); box(0.2,0.03,0.2);` : '';
    return `shape(()=>{ ${FORMS[FAMILY[g.f].form](v3(tint(c.a, g.pole)), v3(tint(c.b, g.pole)))} ${crown} })();`;
  }
  const o = OFF[ctx.i++ % OFF.length];
  const op = g.op === 'carve' ? 'difference();' : g.op === 'mix' ? `mixGeo(${g.k.toFixed(2)});` : `blend(${g.k.toFixed(2)});`;
  const s = g.op === 'carve' ? 1.1 : 1;
  return `shape(()=>{ ${treeSrc(g.a, link, ctx)} ${op} displace(${(o[0] * s).toFixed(2)},${(o[1] * s).toFixed(2)},${(o[2] * s).toFixed(2)}); rotateY(${(ctx.i * 1.3).toFixed(2)}); ${treeSrc(g.b, link, ctx)} })();`;
}

// Link refinement: low links are knotted (domain warp), high links gain halo rings.
function unitSource(g, link, muts = []) {
  // mutations deform the body: twist, noise, hollow, spikes, rings
  const F = formOf(muts);
  const W = Math.max(0, 1 - (link - 1) / 5) * 0.06 + 0.01 * Math.min(4, leaves(g).length) + 0.07 * F.noise;
  const halos = Math.floor(link / 3) + Math.round(F.rings * 2);
  let halo = '';
  for (let i = 0; i < halos; i++) halo += `shape(()=>{ rotateX(${(0.6 + i * 0.9).toFixed(2)}+time*${(0.3 + i * 0.17).toFixed(2)}); color(${v3(PALETTE.paper)}); torus(${(0.5 + i * 0.045).toFixed(3)},0.012); })();`;
  return `setMaxIterations(48); setStepSize(0.8);
let sp=getSpace(); displace(noise(sp*5.0+time*0.5)*${W.toFixed(3)}, noise(sp*5.0+vec3(7.0,1.0,3.0)-time*0.4)*${W.toFixed(3)}, 0);
rotateY(time*0.25${F.twist > 0 ? `+sp.y*${(F.twist * 4).toFixed(2)}` : ''});
${F.stretch > 0 ? `displace(0, sp.y*${(-0.25 * F.stretch).toFixed(2)}, 0);` : ''}
${treeSrc(g, link, { i: 0 })}
${F.hollow > 0 ? `difference(); sphere(${(0.12 + 0.2 * F.hollow).toFixed(2)}); union();` : ''}
${F.spikes > 0 ? `shape(()=>{ mirrorXYZ(); color(${v3(PALETTE.ink)}); line(vec3(0.15,0.15,0.15), vec3(${(0.3 + 0.2 * F.spikes).toFixed(2)},${(0.3 + 0.2 * F.spikes).toFixed(2)},${(0.3 + 0.2 * F.spikes).toFixed(2)}), 0.02); })();` : ''}
${halo}`;
}

const MAIN = `
uniform float uFlash; uniform float uFade; uniform vec3 uRim; uniform float uGlow;
void main() {
  vec3 ro = (cameraPosition - sculptureCenter) / _scale;
  vec3 rd = getRayDirection();
  float t = intersect(ro, rd, stepSize);
  if (t >= max_dist) discard;
  vec3 p = ro + rd * t;
  if (length(p) > 1.02) discard;
  vec3 n = calcNormal(p);
  ShadedMaterial sm = shade(p, n);
  vec3 c = sm.color; c = c / (c + vec3(1.0)); c = pow(c, vec3(1.0 / 2.2));
  // painterly: quantised light bands + rim in paper white
  float l = dot(n, normalize(vec3(0.4, 0.8, 0.45)));
  c *= 0.82 + 0.18 * floor(l * 3.0 + 1.5) / 3.0;
  float fr = pow(1.0 - max(dot(n, -rd), 0.0), 2.2);
  c = mix(c, uRim, fr * (0.35 + uGlow * 0.5));
  c = mix(c, vec3(1.0), uFlash);
  float dz = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  if (dz < uFade) discard;
  gl_FragColor = vec4(c, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * vec4(p * _scale + sculptureCenter, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
}`;

const cache = new Map();
function compile(src) {
  const s = sculptToThreeJSShaderSource(src);
  if (s.error) console.warn('sculpt error', s.error);
  const cut = s.frag.lastIndexOf('void main()');
  return { vert: s.vert, frag: s.frag.slice(0, cut) + MAIN };
}
function material(k, srcFn, rim, glow) {
  let base = cache.get(k);
  if (!base) {
    let sh;
    try { sh = compile(srcFn()); } catch (e) { console.warn('sculpt failed', k, e); sh = compile('sphere(0.35);'); }
    base = new THREE.ShaderMaterial({
      vertexShader: sh.vert, fragmentShader: sh.frag, side: THREE.BackSide,
      uniforms: { time: { value: 0 }, opacity: { value: 1 }, _scale: { value: 1 }, mouse: { value: new THREE.Vector3() }, stepSize: { value: 0.8 }, resolution: { value: new THREE.Vector2(1, 1) }, msdf: { value: null }, uFlash: { value: 0 }, uFade: { value: 0 }, uRim: { value: new THREE.Vector3(...rim) }, uGlow: { value: glow } },
    });
    cache.set(k, base);
  }
  const m = base.clone();
  m.uniforms.uRim.value = new THREE.Vector3(...rim);
  return m;
}

export function unitMaterial(g, link, muts = []) {
  const c = unitColors(leaves(g)[0].f, link);
  return material(`u|${key(g)}|${link}|${muts.join(',')}`, () => unitSource(g, link, muts), PALETTE.paper, c.glow || 0);
}
export function stressorMaterial(defId) {
  const d = ANY_STRESSOR[defId] || ANY_STRESSOR.intrusion;
  const A = v3(PALETTE[d.color] || PALETTE.ink), B = v3(PALETTE.ink);
  return material(`s|${d.id}`, () => `setMaxIterations(36); setStepSize(0.85); ${FORMS[d.form](A, B)}`, PALETTE.ink, 0);
}
// The core: a form that gains structure with every stage of the loop.
export function coreMaterial(stage) {
  const cols = ['paper', 'yolk', 'teal', 'magenta', 'ultra', 'tangerine', 'violet', 'rose', 'leaf', 'sky'];
  let s = `setMaxIterations(56); setStepSize(0.8); let sp=getSpace(); color(${v3(PALETTE.paper)}); sphere(0.2+0.015*sin(time*1.3));`;
  for (let i = 0; i < stage; i++) {
    const c = v3(PALETTE[cols[(i + 1) % cols.length]]), a = (i * 2.399).toFixed(2), r = (0.26 + (i % 6) * 0.04).toFixed(2);
    s += i % 3 === 0 ? `shape(()=>{ rotateX(${a}+time*${(0.2 + i * 0.03).toFixed(2)}); rotateZ(${a}); color(${c}); torus(${r},0.018); })();`
      : i % 3 === 1 ? `shape(()=>{ blend(0.12); rotateY(${a}+time*0.3); displace(${r},0,0); color(${c}); sphere(0.07); })();`
        : `shape(()=>{ rotateY(${a}); rotateX(time*0.4+${a}); color(${c}); box(0.03,${r},0.03); })();`;
  }
  return material(`core|${stage}`, () => s, PALETTE.yolk, 0.6);
}
