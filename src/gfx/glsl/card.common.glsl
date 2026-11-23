// card.common: hash / value noise, rounded-rect and segment distances for the drifting card (prefix cd_).
// No lygia on purpose: the card is small on screen and budgeted in hash-noise taps.
float cd_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float cd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cd_hash(i), cd_hash(i + vec2(1, 0)), u.x), mix(cd_hash(i + vec2(0, 1)), cd_hash(i + vec2(1, 1)), u.x), u.y);
}
float cd_fbm(vec2 p) { return cd_noise(p) * 0.62 + cd_noise(p * 2.07 + 7.1) * 0.38; }
mat2 cd_rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float cd_seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// one polygon edge for an exact signed polygon distance (winding sign in s, squared distance in dd)
void cd_edge(vec2 p, vec2 vi, vec2 vj, inout float dd, inout float s) {
  vec2 e = vj - vi, w = p - vi, b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  dd = min(dd, dot(b, b));
  bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
  if (all(c) || all(not(c))) s *= -1.0;
}
float cd_box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
