// Genome -> Shader Park program -> GLSL raymarch material.
// Every regulator is an SDF sculpture compiled from its genome tree, so a hybrid is the literal
// CSG of its parents (blend fuses with a painted seam, carve bites and shows the carver's colour
// on the cut, mix breathes from one parent into the other), and every new combination is new.
// Each family grows through three forms on the ladder (raw 1-4, grown 5-8, refined 9-12), every unit
// is a seeded sibling (genome key + mutations + optional salt), mutations deform the body on six
// unmistakable axes, and poles crown (+1) or crack (-1) a leaf.
import * as THREE from 'three';
import { sculptToThreeJSShaderSource } from 'shader-park-core';
import { key, leaves } from '../game/genome.js';
import { unitColors } from './palettes/families.js';
import { PALETTE } from './mood.js';
import { FAMILY } from '../game/data.js';
import { ALL_STRESSORS, ANY_STRESSOR } from '../game/battle.js';
import { formOf } from '../game/content/mutations.js';

// ---- small helpers ----
const f3 = (x) => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3);
const v3 = (c) => `vec3(${c.map((x) => f3(Math.min(1, Math.max(0, x)))).join(',')})`;
const INK = v3(PALETTE.ink), PAPER = v3(PALETTE.paper), MAG = v3(PALETTE.magenta);
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
// a no-geometry primitive that only carries a material (used after mixMat to repaint a region)
const PAINT = 'displace(9.0,9.0,9.0); sphere(0.001);';

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rngOf(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Form kit: A/B/C colours, s = scale (1 = radius 0.5), seeded jitters so siblings differ.
function kit(A, B, C, s, rng) {
  const j = Array.from({ length: 8 }, () => rng() * 2 - 1);
  const spd = 0.75 + 0.55 * rng();
  const P = f3(rng() * 6.283);
  return {
    A, B, C, P, j,
    L: (x, i) => f3(x * s * (i === undefined ? 1 : 1 + 0.1 * j[i % 8])),   // a length (scaled, maybe jittered)
    W: (x) => f3(x * spd),                                                 // an angular speed
    a: (x, i = 0) => f3(x + 0.3 * j[i % 8]),                               // an angle
  };
}

// ---- family forms: three growth stages each (raw / grown / refined), radius <= 0.5 * s ----
// raw = knotted, heavy, crowded; grown = full, balanced; refined = open, hollow, luminous, simple.
const FORMS = {
  lens: [
    (k) => `color(${k.A}); sphere(${k.L(0.31, 0)}); blend(${k.L(0.09)}); displace(${k.L(0.15, 1)},${k.L(0.11)},${k.L(0.08)}); color(${k.B}); sphere(${k.L(0.15, 2)}); displace(${k.L(-0.3)},${k.L(-0.2)},${k.L(0.03)}); sphere(${k.L(0.13, 3)}); union(); reset();
      rotateY(time*${k.W(0.5)}+${k.P}); rotateX(${k.a(1.2, 4)}); color(${k.B}); torus(${k.L(0.37)},${k.L(0.06, 5)}); rotateZ(${k.a(1.0, 6)}); color(${k.A}); torus(${k.L(0.36)},${k.L(0.05, 7)});`,
    (k) => `rotateX(0.25*sin(time*${k.W(0.6)}+${k.P})); color(${k.A}); sphere(${k.L(0.4, 0)}); difference(); displace(0,0,${k.L(0.37)}); sphere(${k.L(0.32, 1)}); displace(0,0,${k.L(-0.74)}); sphere(${k.L(0.32, 2)}); union(); reset();
      rotateX(0.25*sin(time*${k.W(0.6)}+${k.P})); color(${k.B}); torus(${k.L(0.42)},${k.L(0.035, 3)}); color(${k.C}); sphere(${k.L(0.05)});`,
    (k) => `rotateX(1.57+0.3*sin(time*${k.W(0.4)}+${k.P})); rotateZ(${k.a(0.2, 0)}); color(${k.B}); torus(${k.L(0.41)},${k.L(0.022, 1)}); color(${k.A}); cylinder(${k.L(0.39)},${k.L(0.009)}); difference(); cylinder(${k.L(0.21, 2)},${k.L(0.03)}); union();
      color(${k.C}); sphere(${k.L(0.075, 3)}+${k.L(0.015)}*sin(time*2.0)); rotateX(1.57); color(${k.B}); torus(${k.L(0.28)},${k.L(0.014)});`,
  ],
  slab: [
    (k) => `rotateZ(${k.a(0.12, 0)}); color(${k.A}); box(${k.L(0.29, 1)},${k.L(0.24, 2)},${k.L(0.22, 3)}); blend(${k.L(0.05)}); displace(${k.L(0.05)},${k.L(0.25)},0); rotateZ(${k.a(-0.2, 4)}); color(${k.B}); box(${k.L(0.37)},${k.L(0.07)},${k.L(0.27)}); union(); reset();
      displace(${k.L(-0.04)},${k.L(-0.3)},${k.L(0.03)}); rotateY(${k.a(0.3, 5)}); color(${k.A}); box(${k.L(0.34)},${k.L(0.08, 6)},${k.L(0.28)}); reset();
      rotateY(time*${k.W(0.4)}+${k.P}); displace(${k.L(0.31)},${k.L(0.04)},0); color(${k.B}); sphere(${k.L(0.075, 7)});`,
    (k) => `rotateY(0.3*sin(time*${k.W(0.3)}+${k.P})); color(${k.A}); box(${k.L(0.28, 0)},${k.L(0.37, 1)},${k.L(0.17, 2)}); color(${k.B}); displace(0,${k.L(0.25)}+${k.L(0.03)}*sin(time*${k.W(0.9)}),0); box(${k.L(0.38)},${k.L(0.05)},${k.L(0.24, 3)}); reset();
      displace(0,${k.L(-0.25)},0); box(${k.L(0.38)},${k.L(0.05)},${k.L(0.24, 4)}); reset(); color(${k.C}); displace(0,0,${k.L(0.18)}); box(${k.L(0.06)},${k.L(0.2, 5)},${k.L(0.02)});`,
    (k) => `rotateY(time*${k.W(0.25)}+${k.P}); color(${k.B}); displace(0,${k.L(0.31)}+${k.L(0.05)}*sin(time*${k.W(0.8)}),0); box(${k.L(0.36, 0)},${k.L(0.022)},${k.L(0.26, 1)}); reset();
      displace(0,${k.L(-0.31)}-${k.L(0.05)}*sin(time*${k.W(0.8)}),0); color(${k.A}); box(${k.L(0.36, 2)},${k.L(0.022)},${k.L(0.26, 3)}); reset();
      color(${k.C}); sphere(${k.L(0.13, 4)}); rotateX(${k.a(0.4, 5)}); color(${k.B}); torus(${k.L(0.22)},${k.L(0.015)});`,
  ],
  knot: [
    (k) => `rotateY(time*${k.W(0.45)}+${k.P}); color(${k.A}); sphere(${k.L(0.15, 0)}); blend(${k.L(0.04)}); torus(${k.L(0.25)},${k.L(0.1, 1)}); union(); rotateX(1.57); color(${k.B}); torus(${k.L(0.26)},${k.L(0.095, 2)});
      rotateZ(1.57); color(${k.A}); torus(${k.L(0.27)},${k.L(0.09, 3)}); rotateX(${k.a(0.8, 4)}); color(${k.B}); torus(${k.L(0.21)},${k.L(0.07, 5)});`,
    (k) => `rotateY(time*${k.W(0.7)}+${k.P}); color(${k.A}); torus(${k.L(0.3, 0)},${k.L(0.075)}); rotateX(1.57); color(${k.B}); torus(${k.L(0.3, 1)},${k.L(0.065)}); rotateZ(1.57); color(${k.A}); torus(${k.L(0.3, 2)},${k.L(0.055)});`,
    (k) => `rotateY(time*${k.W(0.35)}+${k.P}); rotateX(${k.a(0.45, 0)}); color(${k.A}); torus(${k.L(0.4, 1)},${k.L(0.024)}); rotateX(${k.a(0.9, 2)}); color(${k.B}); torus(${k.L(0.29, 3)},${k.L(0.016)}); reset();
      rotateX(${k.a(0.45, 0)}); rotateY(time*${k.W(1.3)}+${k.P}); displace(${k.L(0.4, 1)},0,0); color(${k.C}); sphere(${k.L(0.06)});`,
  ],
  shard: [
    (k) => `rotateY(time*${k.W(0.2)}+${k.P}); rotateZ(${k.a(0.3, 0)}); color(${k.A}); box(${k.L(0.1, 1)},${k.L(0.42)},${k.L(0.1)}); rotateY(0.9); rotateZ(${k.a(-0.75, 2)}); color(${k.B}); box(${k.L(0.09)},${k.L(0.38, 3)},${k.L(0.12)});
      rotateX(${k.a(1.1, 4)}); color(${k.A}); box(${k.L(0.08)},${k.L(0.34, 5)},${k.L(0.1)}); reset(); blend(${k.L(0.06)}); color(${k.B}); sphere(${k.L(0.14, 6)});`,
    (k) => `rotateY(0.5*sin(time*${k.W(0.4)}+${k.P})); rotateZ(${k.a(0.45, 0)}); color(${k.A}); box(${k.L(0.07)},${k.L(0.48, 1)},${k.L(0.07)}); rotateY(0.9); rotateZ(${k.a(-0.9, 2)}); color(${k.B}); box(${k.L(0.05)},${k.L(0.36, 3)},${k.L(0.16)});`,
    (k) => `rotateY(time*${k.W(0.3)}+${k.P}); rotateZ(${k.a(0.1, 0)}); rotateY(0.785); color(${k.A}); box(${k.L(0.05, 1)},${k.L(0.46)},${k.L(0.05, 1)}); reset();
      rotateY(time*${k.W(0.3)}+${k.P}); displace(${k.L(0.22)}+${k.L(0.07)}*sin(time*${k.W(0.7)}),${k.L(0.12, 2)},0); rotateZ(${k.a(-0.45, 3)}); color(${k.C}); box(${k.L(0.025)},${k.L(0.16, 4)},${k.L(0.025)});`,
  ],
  rings: [
    (k) => `color(${k.A}); sphere(${k.L(0.25, 0)}); color(${k.B}); rotateX(${k.a(0.5, 1)}+0.2*sin(time*${k.W(1.0)}+${k.P})); torus(${k.L(0.28)},${k.L(0.07, 2)}); rotateX(1.2); color(${k.A}); torus(${k.L(0.31)},${k.L(0.06, 3)}); rotateZ(${k.a(0.9, 4)}); color(${k.B}); torus(${k.L(0.33)},${k.L(0.05, 5)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.19, 0)}); color(${k.B}); rotateX(${k.a(0.5, 1)}+0.2*sin(time*${k.W(1.0)}+${k.P})); torus(${k.L(0.32, 2)},${k.L(0.04)}); rotateX(1.1); color(${k.A}); torus(${k.L(0.44, 3)},${k.L(0.03)});`,
    (k) => `color(${k.C}); sphere(${k.L(0.09, 0)}); rotateX(${k.a(0.4, 1)}+0.3*sin(time*${k.W(0.6)}+${k.P})); color(${k.B}); torus(${k.L(0.27, 2)},${k.L(0.016)}); rotateX(1.3+0.3*sin(time*${k.W(0.45)})); color(${k.A}); torus(${k.L(0.44, 3)},${k.L(0.016)});`,
  ],
  spike: [
    (k) => `rotateY(time*${k.W(0.4)}+${k.P}); color(${k.A}); sphere(${k.L(0.27, 0)}); mirrorXYZ(); color(${k.B}); line(vec3(0.0,0.0,0.0), vec3(${k.L(0.25, 1)},${k.L(0.25, 2)},${k.L(0.25, 3)}), ${k.L(0.075)}); line(vec3(0.0,0.0,0.0), vec3(${k.L(0.38, 4)},0.0,0.0), ${k.L(0.065)}); line(vec3(0.0,0.0,0.0), vec3(0.0,${k.L(0.36, 5)},0.0), ${k.L(0.06)});`,
    (k) => `rotateY(time*${k.W(0.5)}+${k.P}); color(${k.A}); sphere(${k.L(0.21, 0)}); mirrorXYZ(); color(${k.B}); roundCone(vec3(0.0,0.0,0.0), vec3(${k.L(0.29, 1)},${k.L(0.29, 2)},${k.L(0.29, 3)}), ${k.L(0.06)}, ${k.L(0.012)}); roundCone(vec3(0.0,0.0,0.0), vec3(${k.L(0.47, 4)},0.0,0.0), ${k.L(0.05)}, ${k.L(0.01)});`,
    (k) => `rotateY(time*${k.W(0.5)}+${k.P}); rotateZ(${k.a(0.25, 0)}); color(${k.A}); sphere(${k.L(0.1, 1)}); color(${k.B}); roundCone(vec3(0.0,0.0,0.0), vec3(${k.L(0.48)},0.0,0.0), ${k.L(0.04)}, ${k.L(0.006)}); roundCone(vec3(0.0,0.0,0.0), vec3(${k.L(-0.22, 2)},0.0,0.0), ${k.L(0.03)}, ${k.L(0.006)});
      displace(${k.L(0.3)}+${k.L(0.04)}*sin(time*${k.W(1.4)}),0,0); rotateZ(1.57); color(${k.C}); torus(${k.L(0.09, 3)},${k.L(0.014)});`,
  ],
  shell: [
    (k) => `color(${k.A}); sphere(${k.L(0.41, 0)}); difference(); sphere(${k.L(0.29)}); displace(${k.L(0.18, 1)},${k.L(0.3)},${k.L(0.16)}); sphere(${k.L(0.13, 2)}); union(); reset();
      mirrorXYZ(); displace(${k.L(0.25, 3)},${k.L(0.25)},${k.L(0.2)}); color(${k.B}); sphere(${k.L(0.07, 4)}); reset(); color(${k.B}); sphere(${k.L(0.17, 5)}+${k.L(0.02)}*sin(time*${k.W(1.5)}+${k.P}));`,
    (k) => `color(${k.A}); sphere(${k.L(0.42, 0)}); difference(); sphere(${k.L(0.37)}); displace(${k.L(0.1, 1)},${k.L(0.28)},${k.L(0.22, 2)}); sphere(${k.L(0.3)}); union(); reset(); displace(${k.L(-0.1)},${k.L(-0.28)},${k.L(-0.22)}); reset();
      color(${k.B}); sphere(${k.L(0.1, 3)}+${k.L(0.03)}*sin(time*${k.W(2.0)}+${k.P}));`,
    (k) => `rotateY(time*${k.W(0.2)}+${k.P}); color(${k.A}); sphere(${k.L(0.44, 0)}); shell(${k.L(0.014)}); difference(); mirrorXYZ(); displace(${k.L(0.3)},${k.L(0.3)},${k.L(0.3)}); sphere(${k.L(0.27, 1)}); union(); reset();
      displace(${k.L(0.1)}*sin(time*${k.W(0.5)}+${k.P}),${k.L(0.12)}*cos(time*${k.W(0.4)}),${k.L(0.07)}); color(${k.C}); sphere(${k.L(0.09, 2)});`,
  ],
  flame: [
    (k) => `color(${k.A}); sphere(${k.L(0.29, 0)}); blend(${k.L(0.14)}); displace(${k.L(0.19, 1)},${k.L(-0.08)},${k.L(0.06)}); color(${k.B}); sphere(${k.L(0.16, 2)}); displace(${k.L(-0.36)},${k.L(0.02)},${k.L(-0.1)}); sphere(${k.L(0.15, 3)}); reset();
      displace(${k.L(0.03)}*sin(time*${k.W(2.0)}+${k.P}),${k.L(0.24, 4)},0); color(${k.B}); sphere(${k.L(0.12, 5)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.28, 0)}); blend(${k.L(0.18)}); displace(${k.L(0.04)}*sin(time*${k.W(3.0)}+${k.P}),${k.L(0.26, 1)},0); color(${k.B}); sphere(${k.L(0.18, 2)}); displace(${k.L(-0.06)}*sin(time*${k.W(2.3)}),${k.L(0.2, 3)},0); sphere(${k.L(0.09, 4)});`,
    (k) => `displace(${k.L(0.03)}*sin(time*${k.W(2.5)}+${k.P}),${k.L(0.1)},0); color(${k.A}); sphere(${k.L(0.19, 0)}); blend(${k.L(0.16)}); displace(0,${k.L(0.19, 1)},0); color(${k.B}); sphere(${k.L(0.1)}); displace(${k.L(0.02)}*sin(time*${k.W(3.1)}),${k.L(0.14, 2)},0); sphere(${k.L(0.045)});
      shell(${k.L(0.016)}); union(); reset(); displace(0,${k.L(-0.02)},0); color(${k.C}); sphere(${k.L(0.1, 3)}+${k.L(0.02)}*sin(time*${k.W(4.0)}));
      reset(); displace(${k.L(0.05)}*sin(time*${k.W(1.3)}),${k.L(0.44)}+${k.L(0.03)}*sin(time*${k.W(2.0)}),0); color(${k.B}); sphere(${k.L(0.03)});`,
  ],
  bowl: [
    (k) => `color(${k.A}); sphere(${k.L(0.41, 0)}); difference(); displace(0,${k.L(0.3)},0); sphere(${k.L(0.27, 1)}); union(); reset(); displace(0,${k.L(0.1)},0); color(${k.B}); sphere(${k.L(0.15, 2)}); reset();
      displace(0,${k.L(0.3)}+${k.L(0.015)}*sin(time*${k.W(1.2)}+${k.P}),0); rotateZ(${k.a(0.12, 3)}); color(${k.A}); cylinder(${k.L(0.25, 4)},${k.L(0.035)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.44, 0)}); difference(); displace(0,${k.L(0.2)},0); sphere(${k.L(0.43)}); union(); reset(); displace(0,${k.L(-0.22, 1)}+${k.L(0.04)}*sin(time*${k.W(1.5)}+${k.P}),0); color(${k.B}); sphere(${k.L(0.13, 2)});`,
    (k) => `rotateZ(0.12*sin(time*${k.W(0.5)}+${k.P})); color(${k.A}); sphere(${k.L(0.44, 0)}); shell(${k.L(0.015)}); difference(); displace(0,${k.L(0.05, 1)},0); box(${k.L(0.5)},${k.L(0.3)},${k.L(0.5)}); union(); reset();
      displace(0,${k.L(0.02)}+${k.L(0.05)}*sin(time*${k.W(1.2)}+${k.P}),0); color(${k.C}); sphere(${k.L(0.1, 2)}); rotateY(time*${k.W(0.8)}); rotateX(0.3); color(${k.B}); torus(${k.L(0.17, 3)},${k.L(0.013)});`,
  ],
  orbit: [
    (k) => `color(${k.A}); sphere(${k.L(0.27, 0)}); rotateX(time*${k.W(0.4)}+${k.P}); color(${k.B}); torus(${k.L(0.32)},${k.L(0.055, 1)}); rotateZ(${k.a(1.2, 2)}); torus(${k.L(0.35)},${k.L(0.05, 3)}); displace(${k.L(0.35)},0,0); color(${k.A}); sphere(${k.L(0.08, 4)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.2, 0)}); color(${k.B}); rotateX(time*${k.W(0.8)}+${k.P}); torus(${k.L(0.38, 1)},${k.L(0.025)}); rotateZ(time*${k.W(1.1)}+1.0); torus(${k.L(0.46, 2)},${k.L(0.02)});`,
    (k) => `color(${k.C}); sphere(${k.L(0.085, 0)}); rotateX(${k.a(0.4, 1)}+time*${k.W(0.3)}+${k.P}); color(${k.B}); torus(${k.L(0.31, 2)},${k.L(0.014)}); rotateZ(1.0+time*${k.W(0.5)}); color(${k.A}); torus(${k.L(0.46)},${k.L(0.015)}); rotateY(time*${k.W(1.1)}); displace(${k.L(0.46)},0,0); color(${k.B}); sphere(${k.L(0.045)});`,
  ],
};
export const BRACKETS = ['raw', 'grown', 'refined'];
export const bracketOf = (link) => (link <= 4 ? 0 : link <= 8 ? 1 : 2);

// ---- leaves ----
// colour grade: links 1..12 read grades 3..10, so refined forms stay luminous but keep their chroma
const gradeLink = (link) => Math.round(3 + (link - 1) * 7 / 11);
function leafColors(l, link) {
  const c = unitColors(l.f, gradeLink(link));
  const p = l.pole;
  const t = (col) => col.map((x) => (p > 0 ? x + (1 - x) * 0.42 : p < 0 ? x * 0.42 + PALETTE.ink[0] * 0.2 : x));
  return { a: t(c.a), b: t(c.b), c: t(c.c) };
}
function leafSrc(l, link, R, rng) {
  const col = leafColors(l, link);
  const s = (R / 0.5) * (l.pole > 0 ? 1.06 : l.pole < 0 ? 0.94 : 1);
  const k = kit(v3(col.a), v3(col.b), v3(col.c), s, rng);
  const form = FORMS[FAMILY[l.f].form][bracketOf(link)](k);
  const L = (x) => f3(x * s);
  if (l.pole > 0) {
    // idealized: lighter, a hovering paper halo and a crown bead, slightly larger
    return `shape(()=>{ shape(()=>{ ${form} })();
      shape(()=>{ displace(0,${L(0.45)}+${L(0.02)}*sin(time*1.3+${k.P}),0); rotateX(0.15*sin(time*0.7)); color(${PAPER}); torus(${L(0.15)},${L(0.016)}); })();
      shape(()=>{ displace(0,${L(0.38)},0); color(${PAPER}); sphere(${L(0.05)}); })(); })();`;
  }
  if (l.pole < 0) {
    // devalued: darker, sunk and squashed, two ink cracks through it, an ink slab under it
    const a1 = f3(0.5 + rng() * 0.8), a2 = f3(-0.4 - rng() * 0.8);
    return `shape(()=>{ shape(()=>{ let sq=getSpace(); displace(0,sq.y*-0.16-${L(0.06)},0); ${form} })();
      difference(); let cr = shape(()=>{ rotateZ(${a1}); rotateY(${f3(rng() * 3)}); box(${L(0.6)},${L(0.011)},${L(0.6)}); rotateX(${a2}); box(${L(0.6)},${L(0.009)},${L(0.6)}); return getSDF()+0.0; })();
      union(); mixMat(smoothstep(0.0,${L(0.035)},cr)); color(${INK}); ${PAINT} reset();
      displace(0,${L(-0.4)},0); color(${INK}); box(${L(0.22)},${L(0.025)},${L(0.22)}); })();`;
  }
  return `shape(()=>{ ${form} })();`;
}

// ---- hybrids ----
// The dominant colour a subtree shows (used for seams and the carved inner face).
function domColor(g, link) {
  if (g.t === 'leaf') return leafColors(g, link).a;
  return domColor(g.op === 'carve' || leaves(g.a).length >= leaves(g.b).length ? g.a : g.b, link);
}
function unitDir(rng, front = false) {
  const th = rng() * 6.283, y = (rng() * 2 - 1) * 0.7;
  const r = Math.sqrt(1 - y * y);
  let x = Math.cos(th) * r, z = Math.sin(th) * r;
  if (front && z < 0.2) z = Math.abs(z) + 0.3;
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}
const place = (d, r) => `displace(${f3(d[0] * r)},${f3(d[1] * r)},${f3(d[2] * r)});`;

// R = radius budget for this subtree; depth = nesting; each node arranges its children inside R.
function treeSrc(g, link, R, rng, depth) {
  if (g.t === 'leaf') return leafSrc(g, link, R, rngOf(Math.floor(rng() * 4294967296)));
  const nA = leaves(g.a).length, nB = leaves(g.b).length, wA = nA / (nA + nB), wB = 1 - wA;
  const id = `n${depth}_${Math.floor(rng() * 1e6)}`;
  const kk = f3(Math.max(0.03, (g.k || 0.3) * R * 0.55 * (0.8 + 0.4 * rng())));
  const cA = domColor(g.a, link), cB = domColor(g.b, link);
  if (g.op === 'carve') {
    // a clean bite: B removed from A, and the cut face is painted in B's colour
    const rA = R * 0.96, rB = R * (0.5 + 0.12 * wB), d = unitDir(rng, true);
    const A = treeSrc(g.a, link, rA, rng, depth + 1), B = treeSrc(g.b, link, rB, rng, depth + 1);
    return `shape(()=>{ ${A}
      difference(); let cut_${id} = shape(()=>{ ${place(d, rA * 0.82)} rotateY(${f3(rng() * 6.28)}+time*${f3(0.15 + rng() * 0.2)}); ${B} return getSDF()+0.0; })();
      union(); mixMat(smoothstep(0.0,${f3(0.03 * R / 0.5)},abs(cut_${id}))); color(${v3(cB)}); ${PAINT} })();`;
  }
  if (g.op === 'mix') {
    // a slow breathing morph: the body is A, then B, then A again
    const A = treeSrc(g.a, link, R * 0.96, rng, depth + 1), B = treeSrc(g.b, link, R * 0.96, rng, depth + 1);
    const w = f3(0.35 + rng() * 0.25), ph = f3(rng() * 6.283);
    return `shape(()=>{ ${A}
      let m_${id} = 0.5+0.42*sin(time*${w}+${ph}); mixMat(m_${id}); mixGeo(m_${id});
      shape(()=>{ rotateY(${f3(1 + rng() * 2)}); rotateX(${f3((rng() - 0.5) * 0.8)}); ${B} })(); })();`;
  }
  // blend: smooth fusion with a painted seam. Small subtrees sit side by side or stacked;
  // a deep or lopsided pair orbits: the lesser parent circles and fuses as it passes.
  const seam = v3(lum(cA) + lum(cB) > 1.45 ? PALETTE.ink : PALETTE.paper);
  const orbit = depth >= 1 ? rng() < 0.6 : (nA + nB >= 3 && Math.abs(nA - nB) >= 1 && rng() < 0.5);
  let a, b;
  if (orbit) {
    const big = nA >= nB, rBig = R * 0.72, rSm = R * 0.42;
    const tilt = f3((rng() - 0.5) * 1.2), w = f3((0.25 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1)), ph = f3(rng() * 6.283);
    const sm = `rotateX(${tilt}); rotateY(time*${w}+${ph}); displace(${f3(R - rSm * 0.9)},0,0);`;
    a = big ? `shape(()=>{ ${treeSrc(g.a, link, rBig, rng, depth + 1)} return getSDF()+0.0; })()` : `shape(()=>{ ${sm} ${treeSrc(g.a, link, rSm, rng, depth + 1)} return getSDF()+0.0; })()`;
    b = big ? `shape(()=>{ ${sm} ${treeSrc(g.b, link, rSm, rng, depth + 1)} return getSDF()+0.0; })()` : `shape(()=>{ ${treeSrc(g.b, link, rBig, rng, depth + 1)} return getSDF()+0.0; })()`;
  } else {
    const rA = R * (0.5 + 0.22 * wA), rB = R * (0.5 + 0.22 * wB);
    const d = rng() < 0.45 ? [0.25 * (rng() - 0.5), 1, 0.2 * (rng() - 0.5)] : unitDir(rng);
    const n = Math.hypot(...d), dd = d.map((x) => x / n);
    a = `shape(()=>{ ${place(dd, -(R - rA))} rotateY(${f3(rng() * 6.28)}); ${treeSrc(g.a, link, rA, rng, depth + 1)} return getSDF()+0.0; })()`;
    b = `shape(()=>{ ${place(dd, R - rB)} rotateY(${f3(rng() * 6.28)}); ${treeSrc(g.b, link, rB, rng, depth + 1)} return getSDF()+0.0; })()`;
  }
  const sw = f3(0.035 * R / 0.5);
  return `shape(()=>{ let da_${id} = ${a}; blend(${kk}); let db_${id} = ${b};
    union(); mixMat(smoothstep(${f3(0.35 * 0.035 * R / 0.5)},${sw},abs(da_${id}-db_${id}))); color(${seam}); ${PAINT} })();`;
}

// ---- the whole unit: mutations deform the body, link adds knots (low) or halos (high) ----
function unitSource(g, link, muts = [], salt = '', formOverride = null) {
  const F = formOverride || formOf(muts);
  const ls = leaves(g);
  const rng = rngOf(`${key(g)}|${[...muts].sort().join(',')}|${salt}`);
  const head = leafColors(ls[0], link);
  const stH = 1 + 0.75 * F.stretch, stW = 1 / Math.sqrt(stH);
  const twist = 3.6 * F.twist;
  const step = Math.max(0.5, 0.8 / (1 + 0.45 * F.twist + 0.25 * F.noise));
  const W = Math.max(0, 1 - (link - 1) / 5) * 0.06 + 0.01 * Math.min(4, ls.length);
  const shrink = 1 - 0.1 * F.spikes - 0.06 * F.rings - (link >= 8 ? 0.04 : 0);
  const R = 0.5 * shrink;
  let s = `setMaxIterations(48); setStepSize(${f3(step)});\n`;
  // body
  s += `shape(()=>{ let sp=getSpace();\n`;
  s += `rotateY(time*${f3(0.2 + rng() * 0.12)}+${f3(rng() * 6.28)}); rotateX(${f3((rng() - 0.5) * 0.3)});\n`;
  if (F.stretch > 0) s += `displace(sp.x*${f3(1 - stW)}, sp.y*${f3(1 - 1 / stH)}, sp.z*${f3(1 - stW)});\n`;
  if (F.twist > 0) s += `rotateY(sp.y*${f3(twist)}+${f3(0.3 * F.twist)}*sin(time*0.7));\n`;
  if (W > 0.004) s += `displace(noise(sp*5.0+time*0.5)*${f3(W)}, noise(sp*5.0+vec3(7.0,1.0,3.0)-time*0.4)*${f3(W)}, 0);\n`;
  s += treeSrc(g, link, R, rng, 0) + '\n';
  if (F.noise > 0) s += `expand(noise(getSpace()*${f3(9 + 4 * F.noise)}+vec3(0.0,time*0.6,0.0))*${f3(0.012 + 0.03 * F.noise)}+noise(getSpace()*23.0-time*0.4)*${f3(0.008 * F.noise)});\n`;
  if (F.hollow > 0) {
    const t = f3(0.016 + 0.008 * (1 - F.hollow)), wr = f3(0.1 + 0.14 * F.hollow), wp = f3(0.3);
    s += `let d0=getSDF()+0.0; shell(${t}); difference(); shape(()=>{ mirrorXYZ(); displace(${wp},${wp},${wp}); sphere(${wr}); })(); shape(()=>{ mirrorXYZ(); displace(${f3(0.46)},0.0,0.0); sphere(${f3(0.05 + 0.12 * F.hollow)}); })();
union(); mixMat(smoothstep(-${t},0.0,d0)); color(${v3(head.c)}); ${PAINT}\n`;
  }
  s += `})();\n`;
  // spikes: tapered ink thorns, radial
  if (F.spikes > 0) {
    const r0 = 0.16, r1 = (0.4 + 0.16 * F.spikes) * Math.max(1, 0.9 * stW + 0.1), q = (r) => f3(r / Math.sqrt(3));
    s += `shape(()=>{ rotateY(time*0.25); mirrorXYZ(); color(${INK}); roundCone(vec3(${q(r0)},${q(r0)},${q(r0)}), vec3(${q(r1)},${q(r1)},${q(r1)}), ${f3(0.02 + 0.02 * F.spikes)}, 0.004);`;
    if (F.spikes >= 0.45) s += ` roundCone(vec3(${f3(r0)},0.0,0.0), vec3(${f3(r1 * 0.95)},0.0,0.0), ${f3(0.018 + 0.015 * F.spikes)}, 0.004); roundCone(vec3(0.0,0.0,${f3(r0)}), vec3(0.0,0.0,${f3(r1 * 0.95)}), ${f3(0.018 + 0.015 * F.spikes)}, 0.004);`;
    s += ` })();\n`;
  }
  // rings: coloured orbit bands (the head leaf's second colour), one beaded
  const nr = F.rings > 0 ? 1 + Math.round(F.rings * 2) : 0;
  for (let i = 0; i < nr; i++) {
    const c = v3(i % 2 ? head.a : head.b);
    s += `shape(()=>{ rotateZ(${f3(0.5 + i * 1.1 + rng() * 0.4)}); rotateX(${f3(0.3 + i * 0.8)}+time*${f3((0.25 + i * 0.13) * (i % 2 ? -1 : 1))}); color(${c}); torus(${f3(0.47 + i * 0.03)},${f3(0.02 - i * 0.003)});${i === 0 ? ` rotateY(time*0.9); displace(${f3(0.47)},0.0,0.0); color(${PAPER}); sphere(0.03);` : ''} })();\n`;
  }
  // halos: paper rings for refinement
  const halos = link >= 8 ? Math.floor((link - 5) / 3) : 0;
  for (let i = 0; i < halos; i++) s += `shape(()=>{ rotateX(${f3(0.6 + i * 0.9)}+time*${f3(0.3 + i * 0.17)}); rotateZ(${f3(i * 0.7)}); color(${PAPER}); torus(${f3(0.5 + i * 0.035)},0.009); })();\n`;
  return s;
}

// ---- stressors: 2-3 seeded variants per form, affixes add a magenta distortion ----
const SFORMS = {
  burr: [
    (k) => `rotateY(time*${k.W(1.0)}); color(${k.A}); sphere(${k.L(0.2, 0)}); mirrorXYZ(); color(${k.B}); line(vec3(0.0,0.0,0.0), vec3(${k.L(0.34, 1)},${k.L(0.34, 2)},${k.L(0.34, 3)}), ${k.L(0.03)}); line(vec3(0.0,0.0,0.0), vec3(${k.L(0.42, 4)},0.0,${k.L(0.2)}), ${k.L(0.03)});`,
    (k) => `rotateY(time*${k.W(0.6)}); rotateX(time*${k.W(0.4)}); color(${k.A}); sphere(${k.L(0.16, 0)}+${k.L(0.02)}*sin(time*9.0)); mirrorXYZ(); color(${k.B}); roundCone(vec3(0.0,0.0,0.0), vec3(${k.L(0.44)}+${k.L(0.04)}*sin(time*7.0),0.0,0.0), ${k.L(0.05)}, ${k.L(0.006)}); roundCone(vec3(0.0,0.0,0.0), vec3(0.0,${k.L(0.4)}+${k.L(0.04)}*sin(time*6.0+1.0),0.0), ${k.L(0.05)}, ${k.L(0.006)}); roundCone(vec3(0.0,0.0,0.0), vec3(0.0,0.0,${k.L(0.42)}+${k.L(0.04)}*sin(time*8.0+2.0)), ${k.L(0.05)}, ${k.L(0.006)});`,
    (k) => `rotateY(time*${k.W(0.5)}); color(${k.A}); sphere(${k.L(0.23, 0)}); color(${k.B}); displace(0.0,0.0,${k.L(0.2)}); sphere(${k.L(0.08)}); reset(); rotateY(time*${k.W(0.5)}); mirrorXYZ(); color(${k.B}); roundCone(vec3(${k.L(0.12)},${k.L(0.12)},${k.L(0.12)}), vec3(${k.L(0.3, 1)},${k.L(0.24, 2)},${k.L(0.18, 3)}), ${k.L(0.04)}, ${k.L(0.005)}); reset(); rotateX(1.57); color(${k.A}); torus(${k.L(0.33)},${k.L(0.02)});`,
  ],
  dart: [
    (k) => `rotateZ(1.57); color(${k.A}); box(${k.L(0.05)},${k.L(0.44, 0)},${k.L(0.05)}); color(${k.B}); displace(0.0,${k.L(0.3)},0.0); box(${k.L(0.14, 1)},${k.L(0.06)},${k.L(0.14, 1)});`,
    (k) => `rotateZ(1.57); displace(0.0,${k.L(0.03)}*sin(time*${k.W(9.0)}),0.0); color(${k.A}); roundCone(vec3(0.0,${k.L(0.42)},0.0), vec3(0.0,${k.L(-0.2)},0.0), ${k.L(0.02)}, ${k.L(0.09, 0)}); color(${k.B}); displace(0.0,${k.L(-0.3)},0.0); sphere(${k.L(0.06)}); displace(0.0,${k.L(-0.12)},0.0); sphere(${k.L(0.04)});`,
    (k) => `rotateX(1.57); color(${k.B}); torus(${k.L(0.34, 0)},${k.L(0.03)}); rotateY(time*${k.W(3.5)}); color(${k.A}); displace(${k.L(0.15)},0.0,0.0); box(${k.L(0.17)},${k.L(0.03)},${k.L(0.04)}); reset(); rotateX(1.57); color(${k.A}); sphere(${k.L(0.07)});`,
  ],
  needle: [
    (k) => `rotateX(time*${k.W(2.0)}); color(${k.A}); line(vec3(${k.L(-0.45)},0.0,0.0), vec3(${k.L(0.45)},0.0,0.0), ${k.L(0.03)}); color(${k.B}); sphere(${k.L(0.12, 0)});`,
    (k) => `rotateY(time*${k.W(0.5)}); color(${k.B}); sphere(${k.L(0.06)}); rotateZ(0.4*sin(time*${k.W(1.3)})); color(${k.A}); line(vec3(${k.L(-0.42)},0.0,0.0), vec3(${k.L(0.42)},0.0,0.0), ${k.L(0.022)}); displace(${k.L(0.4)},${k.L(-0.06)},0.0); sphere(${k.L(0.075, 0)}); displace(${k.L(-0.8)},0.0,0.0); color(${k.B}); sphere(${k.L(0.075, 1)});`,
    (k) => `rotateY(time*${k.W(0.7)}); rotateZ(0.3*sin(time*${k.W(1.9)})); color(${k.A}); line(vec3(${k.L(-0.4)},${k.L(-0.2)},0.0), vec3(0.0,${k.L(0.12)},0.0), ${k.L(0.026)}); line(vec3(0.0,${k.L(0.12)},0.0), vec3(${k.L(0.35)},${k.L(-0.08)},0.0), ${k.L(0.026)}); color(${k.B}); displace(${k.L(0.12)},${k.L(0.34)}+${k.L(0.03)}*sin(time*3.0),0.0); sphere(${k.L(0.07, 0)});`,
  ],
  blob: [
    (k) => `let q=getSpace(); color(${k.A}); sphere(${k.L(0.3, 0)}+${k.L(0.07)}*sin(q.x*9.0+time*2.0)*sin(q.y*8.0+time)); blend(${k.L(0.2)}); displace(${k.L(0.22, 1)},${k.L(0.1)},0.0); color(${k.B}); sphere(${k.L(0.17, 2)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.2, 0)}); blend(${k.L(0.08)}); displace(${k.L(0.2)}+${k.L(0.03)}*sin(time*2.1),${k.L(0.1)},0.0); color(${k.B}); sphere(${k.L(0.14, 1)}); displace(${k.L(-0.36)},${k.L(0.06)}+${k.L(0.03)}*sin(time*1.7),${k.L(0.12)}); color(${k.A}); sphere(${k.L(0.13, 2)}); displace(${k.L(0.14)},${k.L(-0.3)},${k.L(-0.16)}); color(${k.B}); sphere(${k.L(0.12, 3)});`,
    (k) => `let q=getSpace(); displace(0.0,q.y*0.6,0.0); color(${k.A}); sphere(${k.L(0.34, 0)}+${k.L(0.02)}*sin(time*${k.W(0.8)})); difference(); displace(0.0,${k.L(0.3)},0.0); sphere(${k.L(0.2, 1)}); union(); reset(); displace(0.0,${k.L(-0.02)},0.0); color(${k.B}); torus(${k.L(0.2)},${k.L(0.02)});`,
  ],
  weight: [
    (k) => `color(${k.A}); box(${k.L(0.34, 0)},${k.L(0.26, 1)},${k.L(0.34, 0)}); color(${k.B}); displace(0.0,${k.L(0.3)},0.0); torus(${k.L(0.12)},${k.L(0.04)});`,
    (k) => `rotateY(0.15*sin(time*${k.W(0.6)})); color(${k.A}); displace(0.0,${k.L(-0.26)},0.0); box(${k.L(0.36, 0)},${k.L(0.1)},${k.L(0.3)}); displace(${k.L(0.03)},${k.L(0.22)},0.0); color(${k.B}); box(${k.L(0.3, 1)},${k.L(0.09)},${k.L(0.26)}); displace(${k.L(-0.04)},${k.L(0.2)},0.0); color(${k.A}); box(${k.L(0.24, 2)},${k.L(0.08)},${k.L(0.22)});`,
    (k) => `color(${k.A}); sphere(${k.L(0.33, 0)}); difference(); rotateY(time*${k.W(0.3)}); displace(${k.L(0.3)},${k.L(0.3)},0.0); box(${k.L(0.3)},${k.L(0.3)},${k.L(0.5)}); union(); reset(); displace(0.0,${k.L(-0.4)},0.0); color(${k.B}); torus(${k.L(0.1)},${k.L(0.03)});`,
  ],
  maw: [
    (k) => `rotateY(time*${k.W(0.4)}); color(${k.A}); sphere(${k.L(0.46, 0)}); difference(); displace(0.0,0.0,${k.L(0.3)}); sphere(${k.L(0.34, 1)}); union(); displace(0.0,0.0,${k.L(-0.3)}); mirrorXYZ(); color(${k.B}); line(vec3(${k.L(0.2)},${k.L(0.2)},${k.L(0.2)}), vec3(${k.L(0.42)},${k.L(0.42)},${k.L(0.42)}), ${k.L(0.05)});`,
    (k) => `rotateY(time*${k.W(0.3)}); color(${k.A}); sphere(${k.L(0.45, 0)}); shell(${k.L(0.03)}); difference(); displace(0.0,0.0,${k.L(0.42)}); sphere(${k.L(0.26, 1)}); union(); reset(); rotateY(time*${k.W(0.3)}); color(${k.B}); sphere(${k.L(0.07)}+${k.L(0.02)}*sin(time*1.1)); mirrorXYZ(); roundCone(vec3(${k.L(0.25)},${k.L(0.25)},0.0), vec3(${k.L(0.14)},${k.L(0.14)},${k.L(0.1)}), ${k.L(0.04)}, ${k.L(0.005)});`,
  ],
};
// variant index: position of the def among defs of the same form, so siblings never repeat until wrap
const SVAR = {};
for (const d of ALL_STRESSORS) { SVAR[d.form] = SVAR[d.form] || []; SVAR[d.form].push(d.id); }
const AFFIX_STYLE = { veils: 'cage', echoes: 'echo', splits: 'crack', returns: 'orbit', anchors: 'anchor', hastens: 'streak' };
const AFFIX_FREE = ['corona', 'turbulence', 'halo', 'swell'];
function affixStyle(affix) {
  if (!affix) return null;
  const id = typeof affix === 'string' ? affix : affix.id;
  const beh = typeof affix === 'object' ? affix.behavior : null;
  return AFFIX_STYLE[beh] || AFFIX_FREE[hashStr(id) % AFFIX_FREE.length];
}
function stressorSource(defId, affix = null) {
  const d = ANY_STRESSOR[defId] || ANY_STRESSOR.intrusion;
  const list = SVAR[d.form] || [d.id], vs = SFORMS[d.form] || SFORMS.burr;
  const vi = Math.max(0, list.indexOf(d.id)) % vs.length;
  const rng = rngOf('s|' + d.id);
  const A = v3(PALETTE[d.color] || PALETTE.ink), B = INK;
  const style = affixStyle(affix);
  const k = kit(A, B, PAPER, style ? 0.86 : 0.96, rng);
  const body = `shape(()=>{ ${vs[vi](k)} })();`;
  const ar = rngOf('a|' + d.id + '|' + (typeof affix === 'string' ? affix : affix?.id));
  let s = `setMaxIterations(36); setStepSize(${style === 'turbulence' ? '0.7' : '0.85'});\n`;
  if (style === 'crack') s += `shape(()=>{ ${body} difference(); let cr = shape(()=>{ rotateZ(${f3(0.6 + ar())}); box(0.6,0.016,0.6); rotateX(${f3(-0.9 - ar())}); box(0.6,0.013,0.6); return getSDF()+0.0; })(); union(); mixMat(smoothstep(0.0,0.04,cr)); color(${MAG}); ${PAINT} })();\n`;
  else if (style === 'turbulence') s += `shape(()=>{ ${body} expand(noise(getSpace()*14.0+time*0.9)*0.03); })();\nshape(()=>{ rotateY(time*0.6); displace(0.0,0.4,0.0); color(${MAG}); sphere(0.05); })();\n`;
  else if (style === 'swell') s += `shape(()=>{ ${body} blend(0.08); displace(${f3(0.18 + 0.1 * ar())},0.14,0.12); color(${MAG}); sphere(0.15+0.03*sin(time*1.6)); })();\n`;
  else s += body + '\n';
  if (style === 'cage') s += `shape(()=>{ rotateY(time*0.3); color(${PAPER}); sphere(0.47); shell(0.008); difference(); shape(()=>{ mirrorXYZ(); displace(0.27,0.27,0.27); sphere(0.24); })(); shape(()=>{ mirrorXYZ(); displace(0.0,0.0,0.47); sphere(0.14); })(); })();\n`;
  if (style === 'echo') s += `shape(()=>{ rotateY(-time*0.6); displace(0.38,0.12,0.0); color(${MAG}); sphere(0.07+0.02*sin(time*3.0)); rotateY(time*1.2); torus(0.1,0.012); })();\n`;
  if (style === 'orbit') s += `shape(()=>{ rotateX(0.9); rotateY(time*1.1); color(${INK}); torus(0.45,0.014); displace(0.45,0.0,0.0); color(${MAG}); sphere(0.045); })();\n`;
  if (style === 'anchor') s += `shape(()=>{ color(${MAG}); line(vec3(0.0,-0.2,0.0), vec3(0.0,-0.44,0.0), 0.016); displace(0.0,-0.44,0.0); color(${INK}); cylinder(0.2,0.03); })();\n`;
  if (style === 'streak') s += `shape(()=>{ rotateY(time*0.5); color(${MAG}); roundCone(vec3(-0.1,0.05,0.0), vec3(-0.48,0.1,0.0), 0.045, 0.004); roundCone(vec3(-0.1,-0.08,0.06), vec3(-0.44,-0.14,0.1), 0.035, 0.004); })();\n`;
  if (style === 'corona') s += `shape(()=>{ rotateY(time*0.4); mirrorXYZ(); color(${MAG}); roundCone(vec3(0.24,0.0,0.24), vec3(0.36,0.0,0.36), 0.03, 0.004); roundCone(vec3(0.33,0.0,0.0), vec3(0.48,0.0,0.0), 0.03, 0.004); })();\n`;
  if (style === 'halo') s += `shape(()=>{ rotateX(0.5+0.2*sin(time)); rotateZ(time*0.7); color(${MAG}); torus(0.44,0.02); rotateX(1.4); color(${PAPER}); torus(0.4,0.01); })();\n`;
  return s;
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

// unitMaterial(g, link, muts, salt?): salt (e.g. the unit id) is optional; without it, units that
// share genome key + mutations are identical twins, with it every unit is its own sibling.
export function unitMaterial(g, link, muts = [], salt = '') {
  const c = unitColors(leaves(g)[0].f, gradeLink(link));
  return material(`u|${key(g)}|${link}|${[...muts].sort().join(',')}|${salt}`, () => unitSource(g, link, muts, salt), PALETTE.paper, (c.glow || 0) * 0.6);
}
// stressorMaterial(defId, affix?): affix is an affix id or def ({ id, behavior }); affixed bodies get a magenta rim.
export function stressorMaterial(defId, affix = null) {
  const d = ANY_STRESSOR[defId] || ANY_STRESSOR.intrusion;
  const aid = affix ? (typeof affix === 'string' ? affix : affix.id) : '';
  return material(`s|${d.id}|${aid}`, () => stressorSource(d.id, affix), aid ? PALETTE.magenta : PALETTE.ink, aid ? 0.3 : 0);
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

// For galleries and the compile check: raw sources and a material from any source.
export const sculptDebug = {
  unitSource, stressorSource, FORMS, SFORMS, affixStyle, compile,
  material: (k, src, rim = PALETTE.paper, glow = 0) => material(k, () => src, rim, glow),
};
