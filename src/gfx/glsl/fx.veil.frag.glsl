// NON-MIND ArcVeil: one subtle arena-wide layer per wave-arc modifier, cross-faded between waves.
// Drawn on a disc just above the seated units, so it half-covers them and the sea.
// Cost per pixel: two veils (current + previous) while cross-fading, one otherwise; each veil is
// hash/value noise (<= 3 taps) or analytic, plus a 24-point loop for analogy/same only.
uniform float uTime; uniform float uCur; uniform float uPrev; uniform float uMix; uniform float uStr; uniform float uR; uniform float uPulse;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uMagenta; uniform vec3 uUltra; uniform vec3 uYolk; uniform vec3 uTangerine; uniform vec3 uA;
uniform vec4 uPts[24]; uniform float uNPts;
varying vec3 vW;

const float VL_TAU = 6.2831853;
float vl_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vl_n(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vl_h2(i), vl_h2(i + vec2(1.0, 0.0)), f.x), mix(vl_h2(i + vec2(0.0, 1.0)), vl_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float vl_bayer(vec2 c) {
  vec2 q = mod(floor(c), 4.0);
  float b = mod(q.x + 2.0 * q.y, 4.0);   // cheap ordered pattern
  return (b * 4.0 + mod(q.x * 3.0 + q.y * 2.0, 4.0) + 0.5) / 16.0;
}
float vl_aa(float d, float w) { return smoothstep(w, -w, d); }

// returns colour (rgb) and alpha (a), straight alpha
vec4 veil(int id, vec2 p) {
  float t = uTime, r = length(p), an = atan(p.y, p.x);
  if (id == 0) {
    // negation: drifting dither fog that half-hides things
    float n = vl_n(p * 0.28 + vec2(t * 0.06, t * 0.035)) * 0.65 + vl_n(p * 0.7 - vec2(t * 0.04, 0.0)) * 0.35;
    float d = step(vl_bayer(gl_FragCoord.xy / 3.0), smoothstep(0.35, 0.8, n));
    return vec4(mix(uPaper, uA, 0.15), d * 0.55);
  }
  if (id == 1) {
    // ineffable: lines of unreadable script, written and erased
    float y = p.y * 1.4, row = floor(y);
    float wave = abs(fract(y) - 0.5 + 0.12 * sin(p.x * 5.0 + row * 3.0 + vl_n(p * 2.0) * 3.0));
    float word = step(0.45, vl_n(vec2(p.x * 1.3 - t * 0.35 * (mod(row, 2.0) * 2.0 - 1.0), row * 7.0)));
    float erase = smoothstep(0.2, 0.8, sin(t * 0.5 + row * 1.7) * 0.5 + 0.5);
    float line = vl_aa(wave - 0.025, 0.012) * word * erase;
    return vec4(mix(uInk, uPaper, 0.35), line * 0.32);
  }
  if (id == 2 || id == 6) {
    // analogy: every stressor drags a faint likeness; same: your own forms mirrored through the core
    float g = 0.0, o = 0.0;
    vec2 off = vec2(cos(t * 0.4), sin(t * 0.4)) * 0.9;
    for (int i = 0; i < 24; i++) {
      if (float(i) >= uNPts) break;
      vec4 q = uPts[i];
      if (id == 2 && q.w < 0.5) continue;
      if (id == 6 && q.w > 0.5) continue;
      vec2 c = id == 2 ? q.xy + off : -q.xy;
      float d = length(p - c);
      g = max(g, vl_aa(d - q.z * 0.85, q.z * 0.35));
      o = max(o, vl_aa(abs(d - q.z) - 0.05, 0.03));
    }
    if (id == 6) {
      float spokes = vl_aa(abs(fract(an / VL_TAU * 10.0) - 0.5) * r * 0.62 - 0.015, 0.01) * smoothstep(1.5, 3.0, r);
      return vec4(mix(uA, uPaper, max(o, 0.6)), max(g * 0.22, max(o * 0.45, spokes * 0.18)));
    }
    return vec4(mix(uInk, uPaper, o), max(g * 0.3, o * 0.4));
  }
  if (id == 3) {
    // one/many: cells that keep dividing
    vec2 q = p * 0.32;
    float best = 9.0, second = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = floor(q) + vec2(float(i), float(j));
      vec2 o = vec2(vl_h2(c), vl_h2(c + 7.1));
      o = 0.5 + 0.38 * sin(t * 0.35 + o * VL_TAU);
      float d = length(q - c - o);
      if (d < best) { second = best; best = d; } else if (d < second) second = d;
    }
    float edge = vl_aa(second - best - 0.035, 0.02);
    float split = vl_aa(abs(fract(best * 3.0 - t * 0.2) - 0.5) - 0.03, 0.02) * smoothstep(0.1, 0.35, best);
    return vec4(mix(uMagenta, uPaper, edge), max(edge * 0.32, split * 0.1));
  }
  if (id == 4) {
    // counting: tallies near the rim, never the same count twice
    float sec = floor((an / VL_TAU + 0.5) * 10.0);
    float u = fract((an / VL_TAU + 0.5) * 10.0);
    float cnt = 1.0 + floor(vl_h2(vec2(sec, floor(t * 1.2 + sec * 0.37))) * 5.0);
    float idx = floor(u * 7.0) - 1.0, lu = fract(u * 7.0);
    float stroke = vl_aa(abs(lu - 0.5) - 0.07, 0.04) * step(0.0, idx) * step(idx, cnt - 1.0) * step(idx, 3.0);
    float band = smoothstep(8.6, 9.0, r) * smoothstep(10.8, 10.4, r);
    float slash = cnt > 4.5 ? vl_aa(abs((r - 9.7) * 1.2 - (u * 7.0 - 3.0) * 0.5) - 0.06, 0.04) * step(0.14, u) * step(u, 0.72) : 0.0;
    return vec4(uInk, max(stroke * band, slash * band) * 0.5);
  }
  if (id == 5) {
    // placeless: a slow rotating moire from two offset gratings
    vec2 c1 = vec2(cos(t * 0.11), sin(t * 0.11)) * 2.2, c2 = vec2(cos(-t * 0.08 + 2.0), sin(-t * 0.08 + 2.0)) * 2.6;
    float g1 = sin(length(p - c1) * 5.2), g2 = sin(length(p - c2) * 5.2);
    float mo = smoothstep(0.55, 1.0, g1 * g2);
    return vec4(mix(uUltra, uPaper, step(0.0, g1) * 0.6), mo * 0.2);
  }
  if (id == 7) {
    // observer: rings around the core, quickened by your attention
    float ph = t * 0.12 + uPulse * 0.3;
    float rings = vl_aa(abs(fract(r * 0.32 - ph) - 0.5) - 0.035, 0.03) * smoothstep(1.6, 2.6, r);
    float iris = vl_aa(abs(r - 2.3 - uPulse * 0.4) - 0.12, 0.05);
    return vec4(mix(uUltra, uPaper, rings), max(rings * (0.16 + 0.25 * uPulse), iris * (0.25 + 0.4 * uPulse)));
  }
  if (id == 8) {
    // cancel: a desaturating paper wash and a quiet grid
    vec2 g = abs(fract(p / 1.3) - 0.5);
    float line = vl_aa(0.5 - max(g.x, g.y) - 0.025, 0.015);
    return vec4(mix(uPaper, uInk, line * 0.6), 0.22 + line * 0.18);
  }
  // return: warm light from the core
  float glow = exp(-r * 0.24);
  float rays = pow(abs(sin(an * 5.0 + t * 0.07)), 10.0) * exp(-r * 0.1);
  vec3 c = mix(uTangerine, uYolk, glow);
  c = mix(c, uPaper, smoothstep(0.55, 0.95, glow));
  return vec4(c, glow * 0.38 + rays * 0.16);
}

void main() {
  vec2 p = vW.xz;
  float edge = smoothstep(uR, uR - 1.2, length(p));
  vec4 a = uCur >= 0.0 ? veil(int(uCur + 0.5), p) : vec4(0.0);
  vec4 b = (uPrev >= 0.0 && uMix < 0.999) ? veil(int(uPrev + 0.5), p) : vec4(0.0);
  float wa = a.a * uMix, wb = b.a * (1.0 - uMix);
  float al = wa + wb;
  if (al * uStr * edge < 0.003) discard;
  vec3 col = (a.rgb * wa + b.rgb * wb) / max(al, 1e-4);
  gl_FragColor = vec4(col, clamp(al * uStr * edge, 0.0, 1.0));
}
