// Core aura, rendered on a bounding sphere around the core.
//  1. a raymarched soft haze (AURA_STEPS steps x 1 value-noise3): stage-palette breath, torn by overwhelm
//  2. thin painted shells, computed analytically per ray (exact chord through each shell, so they
//     read as crisp wobbly rings around the core from any angle, ref b); 1 + 0.62*stage of them
//  3. ten filaments to the gates, analytic ray-to-segment distance, with flowing pulses
//  4. an attend pulse shell racing outward
// Premultiplied output (ONE, ONE_MINUS_SRC_ALPHA): colour runs ahead of alpha, so it reads additive.
#include "./arena.common.glsl"
#ifndef AURA_STEPS
#define AURA_STEPS 12
#endif
#define MAX_SHELLS 12
uniform float uTime; uniform float uStage; uniform float uComplexity; uniform float uOverwhelm; uniform float uTension;
uniform float uPulse; uniform float uFlash; uniform float uBound; uniform float uInner;
uniform vec3 uCenter;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uBlood; uniform vec3 uMagenta; uniform vec3 uYolk;
uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; uniform vec3 uP3;
uniform vec3 uFam[10];
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
const float TAU = 6.2831853;

vec3 pick(float k) { k = mod(k, 4.0); return k < 1.0 ? uP0 : k < 2.0 ? uP1 : k < 3.0 ? uP2 : uP3; }
vec2 sphereHit(vec3 ro, vec3 rd, float R) {
  float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h); return vec2(-b - h, -b + h);
}
// chord length through a sphere of radius R for a ray with impact parameter b
float chord(float R, float b2) { return 2.0 * sqrt(max(R * R - b2, 0.0)); }

void over(inout vec3 acc, inout float A, vec3 c, float a) { acc += (1.0 - A) * c * a; A += (1.0 - A) * a; }

void main() {
  vec3 ro = cameraPosition - uCenter;
  vec3 rd = normalize(vW - cameraPosition);
  vec2 hb = sphereHit(ro, rd, uBound);
  if (hb.y <= 0.0) discard;
  float t0 = max(hb.x, 0.0), t1 = hb.y;
  vec2 hi = sphereHit(ro, rd, uInner);
  bool blocked = hi.x > 0.0;
  if (blocked) t1 = min(t1, hi.x);

  float ow = uOverwhelm;
  float tc = -dot(ro, rd);
  vec3 pc = ro + rd * tc;                 // closest approach to the centre
  float b = length(pc);
  vec3 dir = pc / max(b, 1e-4);
  // painterly wobble of every ring, keyed on the direction around the view axis (as the sky rings)
  float wobN = ar_noise3(dir * 2.2 + vec3(uTime * 0.15, 0.0, 0.0));
  vec3 acc = vec3(0.0); float A = 0.0;

  // ---- 4. attend pulse (front-most, drawn first) ----
  float pr = uInner + uPulse * 7.0;
  float pa = exp(-uPulse * 3.0) * step(0.0, uPulse);
  float pRing = smoothstep(0.22, 0.0, abs(b - pr * (1.0 + 0.04 * (wobN - 0.5)))) * pa;
  over(acc, A, mix(uYolk, uPaper, 0.15), pRing * 0.8);

  // ---- 2. analytic shells ----
  float layers = 1.0 + uStage * 0.62;
  float spacing = (uBound * 0.9 - uInner - 0.3) / float(MAX_SHELLS);
  float b2 = b * b;
  for (int i = 0; i < MAX_SHELLS; i++) {
    float fi = float(i);
    float vis = clamp(layers - fi, 0.0, 1.0);
    if (vis <= 0.0) break;
    float R = uInner + 0.3 + spacing * (fi + 0.5);
    R *= 1.0 + (0.05 + 0.18 * ow) * (wobN - 0.5) + 0.02 * sin(dot(dir, vec3(1.3, 0.7, 1.1)) * 3.0 + fi * 1.7 + uTime * 0.6);
    float w = 0.05 + 0.025 * uComplexity;
    float L = chord(R + w, b2) - chord(R - w, b2);
    if (blocked && b < R) L *= 0.5;       // the back half is behind the core
    float peak = 2.0 * sqrt(2.0 * R * w) * 2.0;
    float d = clamp(L / peak, 0.0, 1.0);
    float ring = smoothstep(0.32, 0.62, d);                 // crisp limb ring
    float body = d * 0.12;                                  // faint face-on veil
    // dry-brush gaps along the ring, tearing wider with overwhelm
    float ang = atan(dot(dir, vec3(0.0, 1.0, 0.0)), dot(dir, normalize(cross(rd, vec3(0.0, 1.0, 0.0)))));
    float gap = ar_noise(vec2(ang * 3.0 + fi * 7.3, fi + uTime * 0.2));
    float keep = smoothstep(0.18 + 0.6 * ow, 0.3 + 0.6 * ow, gap);
    vec3 sc = pick(fi + floor(uStage * 0.5));
    sc = mix(sc, uPaper, mod(fi, 2.0) * 0.55);             // alternate white-outlined rings
    sc = mix(sc, mix(uBlood, uMagenta, gap), ow * 0.8);
    over(acc, A, sc, (ring * 0.75 + body) * keep * vis);
  }

  // ---- 3. filaments to the gates ----
  float fw = 0.055 + 0.04 * uComplexity + 0.03 * uTension;
  for (int k = 0; k < 10; k++) {
    float a = float(k) / 10.0 * TAU;
    vec3 dirk = vec3(cos(a), -0.28, sin(a));
    vec3 pa0 = dirk * (uInner + 0.15);
    vec3 u = dirk * (uBound * 0.95 - uInner);
    vec3 w0 = ro - pa0;
    float B = dot(rd, u), C = dot(u, u), D = dot(rd, w0), E = dot(u, w0);
    float den = max(C - B * B, 1e-5);
    float s = clamp((E - B * D) / den, 0.0, 1.0);
    vec3 q = pa0 + u * s;
    float tq = max(dot(q - ro, rd), 0.0);
    if (blocked && tq > hi.x) continue;
    float dd = length(ro + rd * tq - q);
    float fil = smoothstep(0.6, 0.0, dd);
    float flow = 0.4 + 0.6 * smoothstep(0.3, 1.0, sin(s * 14.0 - uTime * 3.0 + float(k) * 1.7));
    float fade = smoothstep(0.0, 0.08, s) * smoothstep(1.0, 0.6, s);
    float tear = 1.0 - ow * step(0.55, ar_noise(vec2(s * 9.0, float(k) + uTime)));
    vec3 fc = mix(uFam[k], uPaper, 0.25 + 0.3 * (1.0 - flow));
    over(acc, A, fc, fil * flow * fade * tear * (0.55 + 0.4 * uComplexity));
  }

  // ---- 1. raymarched haze behind it all ----
  float dt = (t1 - t0) / float(AURA_STEPS);
  float tt = t0 + dt * ar_hash(gl_FragCoord.xy);
  float haze = 0.0; vec3 hc = vec3(0.0);
  for (int i = 0; i < AURA_STEPS; i++) {
    vec3 p = ro + rd * tt;
    float r = length(p);
    float n = ar_noise3(p * 0.9 + vec3(0.0, -uTime * 0.3, uTime * 0.12));
    float dens = smoothstep(uBound, uInner, r) * (0.25 + 0.75 * n);
    dens *= mix(1.0, smoothstep(0.35, 0.65, n), ow);         // tears open with overwhelm
    hc += mix(pick(floor(n * 3.0) + floor(uStage)), mix(uBlood, uMagenta, n), ow * 0.8) * dens;
    haze += dens;
    tt += dt;
  }
  float hA = clamp(haze * dt * (0.05 + 0.03 * uStage / 17.0 + 0.06 * uTension + 0.12 * ow), 0.0, 0.5);
  vec3 hcol = hc / max(haze, 1e-4);
  over(acc, A, hcol, hA);

  acc = mix(acc, uPaper * A, uFlash * 0.4);
  // alpha lags colour: additive-looking, still paint
  gl_FragColor = vec4(acc, A * 0.82);
}
