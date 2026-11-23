// Core aura: raymarched volume inside a bounding sphere. Thin painted shells (more per stage),
// ten radial filaments toward the gates, an attend pulse shell, overwhelm reddening and tearing.
// AURA_STEPS steps x (1 value-noise3 + analytic shells/filaments). Premultiplied output.
#include "./arena.common.glsl"
#ifndef AURA_STEPS
#define AURA_STEPS 22
#endif
uniform float uTime; uniform float uStage; uniform float uComplexity; uniform float uOverwhelm; uniform float uTension;
uniform float uPulse; uniform float uFlash; uniform float uBound; uniform float uInner;
uniform vec3 uCenter;
uniform vec3 uPaper; uniform vec3 uBlood; uniform vec3 uMagenta; uniform vec3 uYolk;
uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; uniform vec3 uP3;
uniform vec3 uFam[10];
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
const float TAU = 6.2831853;

vec3 pick(float k) { k = mod(k, 4.0); return k < 1.0 ? uP0 : k < 2.0 ? uP1 : k < 3.0 ? uP2 : uP3; }

vec2 sphere(vec3 ro, vec3 rd, float R) {
  float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h); return vec2(-b - h, -b + h);
}

void main() {
  vec3 ro = cameraPosition - uCenter;
  vec3 rd = normalize(vW - cameraPosition);
  vec2 hb = sphere(ro, rd, uBound);
  if (hb.y <= 0.0) discard;
  float t0 = max(hb.x, 0.0), t1 = hb.y;
  vec2 hi = sphere(ro, rd, uInner);
  if (hi.x > 0.0) t1 = min(t1, hi.x);          // the core itself is opaque: stop there

  float layers = 1.5 + uStage * 0.62;          // 1.5 shells at stage 0 .. ~12 at stage 17
  float spacing = (uBound * 0.92 - uInner - 0.25) / 12.0;
  float r0 = uInner + 0.25;
  float ow = uOverwhelm;
  float dt = (t1 - t0) / float(AURA_STEPS);
  float jit = ar_hash(gl_FragCoord.xy + fract(uTime) * 37.0);
  float tt = t0 + dt * jit;
  vec3 acc = vec3(0.0); float A = 0.0;
  float pulseR = uInner + uPulse * 7.0;
  float pulseA = exp(-uPulse * 3.2) * step(0.0, uPulse);

  for (int i = 0; i < AURA_STEPS; i++) {
    vec3 p = ro + rd * tt;
    float r = length(p);
    float n = ar_noise3(p * 1.3 + vec3(0.0, uTime * 0.25, uTime * 0.1));
    float rw = r + (n - 0.5) * (0.18 + 0.5 * ow);
    // shells: one analytic evaluation, thin gaussian per layer
    float x = (rw - r0) / spacing;
    float li = floor(x), f = fract(x) - 0.5;
    float vis = clamp(layers - li, 0.0, 1.0) * step(0.0, li);
    float shell = exp(-f * f * 70.0) * vis;
    // tears: holes open with overwhelm
    shell *= smoothstep(ow * 0.75 - 0.05, ow * 0.75 + 0.12, n + 0.15 * sin(li * 2.3 + uTime));
    vec3 sc = mix(pick(li + floor(uStage * 0.5)), uPaper, 0.35 + 0.25 * mod(li, 2.0));

    // filaments to the ten gates (gate d at angle d/10 * TAU in xz)
    float rxz = length(p.xz);
    float a = atan(p.z, p.x);
    float sector = TAU / 10.0;
    float sid = floor(a / sector + 0.5);
    float da = (a / sector - sid) * sector;
    float lat = da * rxz;
    float yf = -0.28 * rxz;                       // they dip toward the gates on the rim
    float w = 0.05 + 0.04 * uComplexity + 0.03 * uTension;
    float fil = exp(-(lat * lat + (p.y - yf) * (p.y - yf)) / (w * w));
    fil *= smoothstep(uInner, uInner + 0.8, rxz) * smoothstep(uBound, uBound * 0.7, r);
    float flow = 0.45 + 0.55 * smoothstep(0.2, 1.0, sin(rxz * 2.6 - uTime * 3.0 + sid * 1.7));
    fil *= flow * (0.55 + 0.45 * uComplexity) * (1.0 - 0.5 * ow * step(0.5, n));
    int fi = int(mod(sid + 10.0, 10.0));
    vec3 fc = uPaper;
    for (int k = 0; k < 10; k++) if (k == fi) fc = uFam[k];
    fc = mix(fc, uPaper, 0.3);

    // attend pulse: a yolk shell racing outward
    float pul = exp(-pow((r - pulseR) * 3.0, 2.0)) * pulseA;

    float d = shell * 0.55 + fil * 0.9 + pul * 0.9;
    vec3 c = (sc * shell * 0.55 + fc * fil * 0.9 + mix(uYolk, uPaper, 0.2) * pul * 0.9) / max(d, 1e-4);
    // overwhelm: reddens toward blood/magenta
    c = mix(c, mix(uBlood, uMagenta, n), ow * 0.75);
    float dd = d * dt * 1.6;
    acc += (1.0 - A) * c * dd;
    A += (1.0 - A) * dd * 0.7;                    // alpha lags colour: additive-looking, still paint
    tt += dt;
  }
  acc = mix(acc, uPaper * A, uFlash * 0.4);
  // gentle posterisation of the halo, so it reads as layered paint
  float q = floor(A * 6.0 + 0.5) / 6.0;
  float s = A > 0.0 ? mix(1.0, q / A, 0.35) : 1.0;
  gl_FragColor = vec4(acc * s, clamp(A * s, 0.0, 0.85));
}
