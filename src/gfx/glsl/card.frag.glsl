// Drifting card. Front: paper, a brushed swatch in the card's tone, the card's mark in ink with wobble,
// dry-brush breakup and impasto relief. Back: palette-knife strokes in the tone and the stage palette,
// one white-outlined ring (ref b), flecks. Both: an inset ink line, a sweeping glint, a paper rim.
// Edges: ink, tinted. Writes display sRGB (Canvas is linear legacy flat). Cost: ~14 value-noise taps.
#include "./card.common.glsl"
uniform float uTime; uniform float uSymbol; uniform float uSeed; uniform float uGlint; uniform float uUrgency;
uniform float uFade; uniform float uFlash; uniform float uHover; uniform float uCx;
uniform vec3 uTone; uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uA; uniform vec3 uB;
varying vec3 vPos; varying vec3 vN; varying vec3 vVN; varying vec3 vViewDir;

#pragma CARD_SYMBOLS

// one palette-knife stroke: blunt loaded start, dry bristled tail, ragged edges
float cd_knife(vec2 p, vec2 c, float a, float len, float wid, float seed) {
  vec2 q = cd_rot(a) * (p - c);
  float u = q.x / len, v = q.y / wid;
  if (abs(u) > 1.2) return 0.0;
  float taper = 1.0 - 0.55 * smoothstep(-0.1, 1.0, u);
  float rag = (cd_noise(vec2(u * 5.0 + seed * 13.0, seed)) - 0.5) * 0.35;
  float m = smoothstep(0.12, -0.12, abs(v) - taper - rag) * smoothstep(1.05, 0.8, abs(u));
  float bristle = cd_noise(vec2(v * 9.0 + seed * 7.0, u * 0.6)) * 0.65 + cd_noise(vec2(v * 23.0, seed)) * 0.35;
  return m * smoothstep(0.18, 0.34, bristle + 0.32 * (1.0 - u));
}

void main() {
  vec2 p = vPos.xy;
  float edgeFace = 1.0 - smoothstep(0.4, 0.6, abs(vN.z));
  bool front = vN.z > 0.0;
  float t = uTime;
  vec3 col; float height = 0.0;

  // inset ink line, wobbly, shared by both faces
  float bd = cd_box(p, vec2(0.84, 1.28), 0.16) + (cd_noise(p * 6.0 + uSeed) - 0.5) * 0.018;
  float aaB = fwidth(bd) * 1.2 + 1e-4;

  if (front) {
    // paper with a faint canvas weave
    col = uPaper * (0.965 + 0.035 * cd_noise(p * 38.0)) - 0.012 * sin(p.x * 210.0) * sin(p.y * 210.0);
    vec2 s = (p - vec2(0.0, 0.08)) / 0.84;
    // brushed swatch in the card's tone
    float r = length(s * vec2(1.0, 0.92) + vec2(0.03, -0.02)) + (cd_fbm(s * 2.1 + uSeed * 3.0) - 0.5) * 0.38;
    float aaS = fwidth(r) * 1.4 + 1e-4;
    float sw = smoothstep(0.98 + aaS, 0.98 - aaS, r);
    float streak = cd_noise(cd_rot(0.6 + uSeed) * s * vec2(2.6, 24.0));
    vec3 swc = mix(uTone * 0.9, mix(uTone, uPaper, 0.42), smoothstep(0.35, 0.85, streak));
    sw *= smoothstep(0.08, 0.3, streak + 0.6 * (1.0 - r));          // dry edge of the swatch
    col = mix(col, swc, sw); height += sw * 0.35 * streak;
    // the mark: wobbled, varying width, dry at the edges
    vec2 sp = s + (vec2(cd_noise(s * 4.5 + 3.1), cd_noise(s * 4.5 + 9.7)) - 0.5) * 0.06;
    float d = cd_symbol(sp, uSymbol) + (cd_noise(s * 8.0 + uSeed) - 0.5) * 0.035;
    float aa = fwidth(d) * 1.1 + 1e-4;
    float m = smoothstep(aa, -aa, d);
    float br = cd_noise(cd_rot(0.9) * s * vec2(64.0, 5.0));
    m *= smoothstep(0.05, 0.3, br * 0.55 + clamp(-d / 0.06, 0.0, 1.0) * 0.9);
    vec3 ink = mix(uInk, uTone * 0.4, 0.14 + 0.1 * cd_noise(s * 12.0));
    col = mix(col, ink, m); height += m * (0.55 + 0.25 * br);
    // the inset line in ink, and a tone corner wash outside it
    col = mix(col, mix(uTone, uPaper, 0.2), smoothstep(-aaB, aaB, bd) * 0.55 * smoothstep(0.55, 0.2, cd_noise(p * 3.0 + uSeed)));
    col = mix(col, uInk, smoothstep(aaB, -aaB, abs(bd) - 0.016) * 0.9);
  } else {
    p.x = -p.x;
    // ground: the tone, softly banded along a warped flow
    vec2 q = p + (vec2(cd_noise(p * 1.7 + uSeed), cd_noise(p * 1.7 + uSeed + 5.0)) - 0.5) * 0.7;
    float band = sin((q.x * 1.3 + q.y * 0.9) * 3.4 + t * 0.15);
    col = mix(uTone * 0.86, mix(uTone, uPaper, 0.25), 0.5 + 0.5 * band);
    // palette-knife strokes: more as complexity grows
    float n = 4.0 + floor(uCx * 3.0);
    for (int i = 0; i < 7; i++) {
      float fi = float(i); if (fi >= n) break;
      vec2 h = vec2(cd_hash(vec2(fi, uSeed)), cd_hash(vec2(uSeed, fi + 3.0)));
      vec2 c = (h - 0.5) * vec2(1.5, 2.3);
      float a = 0.5 + (cd_hash(vec2(fi * 1.7, 9.0 + uSeed)) - 0.5) * 1.4 + 0.08 * sin(t * 0.3 + fi);
      float k = cd_knife(p, c, a, 0.55 + 0.35 * h.x, 0.13 + 0.06 * h.y, fi + uSeed);
      float pick = fract(fi * 0.618 + uSeed);
      vec3 sc = pick < 0.3 ? uPaper : pick < 0.55 ? uA : pick < 0.75 ? mix(uTone, uInk, 0.35) : uB;
      col = mix(col, sc, k * 0.92); height += k * 0.4;
    }
    // one white-outlined ring
    vec2 rc = vec2(0.28, 0.42) * (vec2(cd_hash(vec2(uSeed, 1.0)), cd_hash(vec2(2.0, uSeed))) * 2.0 - 1.0);
    float rd = length(p - rc) + (cd_noise(p * 7.0) - 0.5) * 0.03, R = 0.36;
    float aaR = fwidth(rd) * 1.2 + 1e-4;
    col = mix(col, mix(uA, uTone, 0.4), smoothstep(R - 0.05 + aaR, R - 0.05 - aaR, rd) * 0.85);
    float ring = smoothstep(0.045 + aaR, 0.045 - aaR, abs(rd - R));
    col = mix(col, uPaper * 1.02, ring); height = max(height, ring * 0.4);
    // flecks
    float fl = step(0.93, cd_hash(floor(p * 18.0) + uSeed)) * smoothstep(0.32, 0.1, length(fract(p * 18.0) - 0.5));
    col = mix(col, uInk, fl * 0.6);
    // paper margin outside the inset line, then the line
    col = mix(col, uPaper * (0.97 + 0.03 * cd_noise(p * 40.0)), smoothstep(-aaB, aaB, bd));
    col = mix(col, uInk, smoothstep(aaB, -aaB, abs(bd) - 0.018) * 0.9);
  }

  // impasto relief from screen derivatives
  vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 2.2, -0.6, 0.6);
  vec3 nrm = normalize(vec3(-slope, 1.0)); vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
  col *= mix(1.0, dot(nrm, L) / L.z, 0.45);
  col += pow(max(dot(nrm, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 40.0) * 0.12 * smoothstep(0.05, 0.3, height);

  // edges of the slab: ink with a little of the tone
  col = mix(col, mix(uInk, uTone, 0.3), edgeFace);

  // light: soft facing shade, paper rim, sweeping glint (faster and sparkling as time runs out)
  vec3 V = normalize(vViewDir), N = normalize(vVN);
  float facing = abs(dot(N, V));
  col *= 0.9 + 0.1 * facing;
  col = mix(col, uPaper, pow(1.0 - facing, 3.0) * 0.5);
  float speed = 0.22 + 0.9 * uUrgency;
  float sweep = fract(t * speed + uSeed) * 5.2 - 2.6;
  float gp = dot(vPos.xy, vec2(0.6, 0.8));
  float glint = exp(-pow((gp - sweep) / (0.16 - 0.05 * uUrgency), 2.0)) * (1.0 - edgeFace);
  col = mix(col, uPaper * 1.08, glint * 0.42 * uGlint);
  float sparkle = step(0.986 - 0.02 * uUrgency, cd_hash(floor(vPos.xy * 22.0) + floor(t * (3.0 + 9.0 * uUrgency))));
  sparkle *= smoothstep(0.3, 0.0, length(fract(vPos.xy * 22.0) - 0.5)) * (0.25 + 0.75 * uUrgency);
  col = mix(col, uPaper * 1.1, sparkle * uGlint * (1.0 - edgeFace));
  col = mix(col, uPaper, uHover * 0.05);
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, uFade);
}
