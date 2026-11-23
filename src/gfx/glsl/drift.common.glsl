// drift.common: cheap hash / value noise for the detached bodies (prefix dr_).
// No lygia on purpose: every drift effect is budgeted in hash-noise taps.
float dr_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float dr_hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dr_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dr_hash(i), dr_hash(i + vec2(1, 0)), u.x), mix(dr_hash(i + vec2(0, 1)), dr_hash(i + vec2(1, 1)), u.x), u.y);
}
float dr_noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dr_hash3(i), dr_hash3(i + vec3(1, 0, 0)), u.x), mix(dr_hash3(i + vec3(0, 1, 0)), dr_hash3(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dr_hash3(i + vec3(0, 0, 1)), dr_hash3(i + vec3(1, 0, 1)), u.x), mix(dr_hash3(i + vec3(0, 1, 1)), dr_hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float dr_fbm(vec2 p) { return dr_noise(p) * 0.65 + dr_noise(p * 2.13 + 7.1) * 0.35; }
mat2 dr_rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// painted cel quantisation, matches sculpt.js MAIN bands
float dr_cel(float l) { return floor(l * 3.0 + 1.5) / 3.0; }
// bristle breakup across a stroke (2 taps), 0..1
float dr_bristle(float across) { return dr_noise(vec2(across * 38.0, 0.5)) * 0.6 + dr_noise(vec2(across * 95.0, 3.1)) * 0.4; }
