// Gate portal: one program, ten "field weathers" picked by uMode (uniform branch, coherent).
// Cost per pixel: 2-4 value-noise taps (mirror mode: 9 hashes for a 3x3 voronoi). Small on screen.
#include "./arena.common.glsl"
uniform float uTime; uniform float uMode; uniform float uSeed;
uniform float uFlare; uniform float uRip; uniform float uTension; uniform float uOverwhelm; uniform float uComplexity;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uMagenta;
uniform vec2 uSize;      // plane size in world units (w, h)
uniform float uHalfW;    // inner half width of the arch opening
uniform float uSpring;   // height of the straight legs
varying vec2 vUv;

const float TAU = 6.2831853;

// arch signed distance (negative inside the opening)
float archSd(vec2 q) {
  float side = abs(q.x) - uHalfW;
  float top = length(q - vec2(0.0, uSpring)) - uHalfW;
  float d = q.y < uSpring ? side : top;
  return max(d, -q.y);
}

vec3 weather(vec2 p, float t) {
  int m = int(uMode + 0.5);
  vec3 col = uA;
  if (m == 0) {            // glass: refraction ripples over soft panes
    vec2 c = vec2(0.35 * sin(t * 0.3), 0.6 + 0.3 * cos(t * 0.23));
    float r = length(p - c);
    float w = sin(r * 13.0 - t * 2.6) * exp(-r * 1.1);
    vec2 q = p + normalize(p - c + 1e-4) * w * 0.09;
    float pane = ar_noise(q * 2.2 + 3.0);
    col = mix(uA, uB, smoothstep(0.3, 0.75, pane));
    float glint = smoothstep(0.06, 0.0, abs(fract(q.x * 1.6 + q.y * 0.9 + 0.1 * t) - 0.5) - 0.42);
    col = mix(col, uC, max(smoothstep(0.55, 0.95, w), glint * 0.7));
  } else if (m == 1) {     // lead: heavy strata sinking slowly
    float y = p.y * 2.6 + (ar_noise(vec2(p.x * 1.1, t * 0.04)) - 0.5) * 0.9 + t * 0.07;
    float k = floor(y), f = fract(y), h = ar_hash(vec2(k, 3.1));
    col = h < 0.55 ? uA : h < 0.85 ? uB : uC;
    col = mix(col, uInk, 0.25 * smoothstep(0.2, 1.0, f));
    col = mix(col, uPaper, smoothstep(0.035, 0.0, f) * 0.55 * step(0.6, ar_noise(vec2(p.x * 6.0, k))));
  } else if (m == 2) {     // wheel: turning spiral arms
    vec2 q = p - vec2(0.0, 0.55);
    float r = length(q), a = atan(q.y, q.x);
    float s = sin(a * 3.0 + log(r + 0.04) * 5.5 - t * 2.0);
    col = mix(uA, uB, smoothstep(-0.25, 0.25, s));
    col = mix(col, uC, smoothstep(0.82, 1.0, s));
    col = mix(col, uC, smoothstep(0.16, 0.1, r));
  } else if (m == 3) {     // door: a slit of light, spilling
    float slitW = 0.07 + 0.05 * sin(t * 0.7) + 0.08 * uFlare;
    float slit = smoothstep(slitW + 0.02, slitW - 0.02, abs(p.x)) * smoothstep(-1.0, -0.6, p.y);
    float spill = exp(-abs(p.x) * 3.2) * (0.55 + 0.25 * ar_noise(vec2(p.y * 3.0, t * 0.5)));
    col = mix(uA, uB, spill);
    col = mix(col, uC, slit);
    float floorSpill = smoothstep(0.0, -0.95, p.y) * exp(-abs(p.x) * 1.8);
    col = mix(col, uB, floorSpill * 0.6);
  } else if (m == 4) {     // strings: plucked standing waves
    col = uA;
    float n = 6.0, x = (p.x + 1.0) * 0.5 * n;
    float id = floor(x), fx = fract(x) - 0.5;
    float mode = 1.0 + mod(id, 3.0);
    float L = (p.y + 1.0) / 2.6;
    float amp = (0.08 + 0.25 * uFlare + 0.1 * uTension) * sin(t * (3.0 + id) + id);
    float disp = sin(mode * 3.14159 * L) * amp;
    float line = smoothstep(0.07, 0.02, abs(fx - disp));
    col = mix(col, uB, line);
    col = mix(col, uC, line * smoothstep(0.5, 1.0, abs(sin(mode * 3.14159 * L))) * 0.6);
  } else if (m == 5) {     // mirror: shards, each reflecting a sliding stripe
    vec2 q = p * 2.0; vec2 ip = floor(q), fp = fract(q);
    float d1 = 9.0, d2 = 9.0; float hid = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(i, j); float h = ar_hash(ip + g);
      vec2 o = vec2(h, fract(h * 17.13)) * 0.9;
      float d = length(g + o - fp);
      if (d < d1) { d2 = d1; d1 = d; hid = h; } else if (d < d2) d2 = d;
    }
    float ang = hid * TAU;
    float stripe = fract(dot(p, vec2(cos(ang), sin(ang))) * 1.7 + t * 0.15 + hid);
    col = mix(uA, uB, smoothstep(0.4, 0.6, stripe));
    col = mix(col, uInk, 0.18 * step(0.7, hid));
    col = mix(col, uC, smoothstep(0.09, 0.02, d2 - d1));
  } else if (m == 6) {     // fog: slow layered drift
    float f1 = ar_fbm(p * 1.4 + vec2(t * 0.08, 0.0));
    float f2 = ar_fbm(p * 2.6 - vec2(t * 0.05, t * 0.02) + f1);
    col = mix(uB, uC, smoothstep(0.3, 0.7, f1));
    col = mix(col, uA, smoothstep(0.45, 0.8, f2));
  } else if (m == 7) {     // kiln: rising fire, cel-banded
    float f = ar_fbm(vec2(p.x * 2.2, p.y * 1.4 - t * 1.3));
    float h = (p.y + 1.0) / 2.6;
    float heat = f * 1.25 - h * 0.85 + 0.25 - abs(p.x) * 0.35 + 0.2 * uFlare;
    float b = ar_cel(clamp(heat, 0.0, 1.0));
    col = mix(uB, uA, smoothstep(0.2, 0.5, b));
    col = mix(col, uC, smoothstep(0.6, 0.9, b));
  } else if (m == 8) {     // bowl: concentric holding arcs
    vec2 q = (p - vec2(0.0, -1.15)) * vec2(1.0, 1.55);
    float r = length(q);
    float bands = r * 3.2 - t * 0.25;
    float k = floor(bands), f = fract(bands);
    col = mod(k, 2.0) < 1.0 ? uA : uB;
    col = mix(col, uC, smoothstep(0.08, 0.0, abs(f - 0.5) - 0.42));
  } else {                 // open sky: gradient, painted cloud strokes, a sun
    float h = (p.y + 1.0) / 2.6;
    col = mix(uC, uA, smoothstep(0.1, 0.9, h));
    float cl = ar_fbm(vec2(p.x * 1.2 - t * 0.06, p.y * 5.0));
    col = mix(col, mix(uPaper, uC, 0.3), smoothstep(0.62, 0.78, cl) * 0.85);
    vec2 sp = p - vec2(0.25 * sin(t * 0.1), 0.95);
    float sr = length(sp);
    col = mix(col, uB, smoothstep(0.24, 0.2, sr));
    col = mix(col, uB, smoothstep(0.06, 0.0, abs(sr - 0.36 - 0.03 * sin(t))) * 0.6);
  }
  return col;
}

void main() {
  vec2 q = (vUv - vec2(0.5, 0.0)) * uSize;   // x centred, y from the base
  // brush wobble on the arch outline
  float wob = (ar_noise(vec2(q.y * 3.0 + uSeed * 7.0, q.x * 3.0 + uTime * 0.2)) - 0.5) * 0.06;
  float d = archSd(q) + wob;
  float px = fwidth(d) * 1.2;
  if (d > 0.05 + px) discard;

  // interior coordinates: x -1..1 across the opening, y from -1 at the base
  vec2 p = vec2(q.x / uHalfW, q.y / uHalfW - 1.0);
  float t = uTime * (0.7 + 0.6 * uTension + 1.2 * uOverwhelm) + uSeed * 11.0;

  // a beat ripples outward from the threshold
  vec2 o = vec2(0.0, -1.0);
  float rr = length(p - o);
  float front = uRip * 3.2;
  float ripple = exp(-pow((rr - front) * 5.0, 2.0)) * exp(-uRip * 2.2);
  p += normalize(p - o + 1e-4) * ripple * 0.12;

  vec3 col = weather(p, t);
  // painted texture: dragged bristle streaks
  float streak = ar_noise(vec2(p.x * 26.0 + p.y * 3.0, p.y * 2.5 + uSeed));
  col *= 0.94 + 0.1 * streak;
  // breathing with tension, flare toward paper
  col = mix(col, uPaper, 0.12 * uTension * (0.5 + 0.5 * sin(uTime * 2.2 + uSeed * 5.0)) + 0.35 * uFlare);
  col = mix(col, uPaper, ripple * 0.7);
  col = mix(col, uMagenta, uOverwhelm * 0.45 * smoothstep(0.55, 0.85, ar_noise(p * 2.0 + uTime * 0.4)));

  // white painted outline inside the opening (dry-brushed), ink hairline at the very edge
  float th = 0.07 + 0.03 * uFlare;
  float band = smoothstep(px, -px, d + 0.0) * smoothstep(-th - px, -th + px, d);
  float along = q.y + q.x * 0.6;
  float dry = ar_bristle((d + th) / th * 0.3 + uSeed) + 0.35 * ar_noise(vec2(along * 7.0, uSeed));
  band *= smoothstep(0.28, 0.42, dry);
  col = mix(col, uPaper, band * 0.95);
  col = mix(col, uInk, smoothstep(0.0, 0.05, d) * 0.85);

  // impasto: height from the outline band, lit from screen derivatives
  float height = band * 0.35 + streak * 0.05;
  vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 2.2, -0.6, 0.6);
  vec3 nrm = normalize(vec3(-slope, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
  col *= mix(1.0, dot(nrm, L) / L.z, 0.5);

  gl_FragColor = vec4(col, 1.0);
}
