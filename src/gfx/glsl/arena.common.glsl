// arena.common: cheap hash/value noise shared by the arena shaders (prefix ar_).
// No lygia here on purpose: every arena effect is budgeted in hash-noise taps.
float ar_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ar_hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ar_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ar_hash(i), ar_hash(i + vec2(1, 0)), u.x), mix(ar_hash(i + vec2(0, 1)), ar_hash(i + vec2(1, 1)), u.x), u.y);
}
float ar_noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ar_hash3(i), ar_hash3(i + vec3(1, 0, 0)), u.x), mix(ar_hash3(i + vec3(0, 1, 0)), ar_hash3(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(ar_hash3(i + vec3(0, 0, 1)), ar_hash3(i + vec3(1, 0, 1)), u.x), mix(ar_hash3(i + vec3(0, 1, 1)), ar_hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
// two-octave value fbm (2 taps)
float ar_fbm(vec2 p) { return ar_noise(p) * 0.65 + ar_noise(p * 2.13 + 7.1) * 0.35; }
// painted cel quantisation, matches sculpt.js MAIN bands
float ar_cel(float l) { return floor(l * 3.0 + 1.5) / 3.0; }
// bristle breakup across a stroke (1 tap), 0..1
float ar_bristle(float across) { return ar_noise(vec2(across * 38.0, 0.5)) * 0.6 + ar_noise(vec2(across * 95.0, 3.1)) * 0.4; }
