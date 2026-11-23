// NON-MIND painter post: shared helpers (prepended to every painter effect).
// `luminance`, PI, saturate come from three's <common>; keep names pp_-prefixed.

float pp_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 pp_hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float pp_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = pp_hash12(i);
  float b = pp_hash12(i + vec2(1.0, 0.0));
  float c = pp_hash12(i + vec2(0.0, 1.0));
  float d = pp_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float pp_fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * pp_vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31;
    a *= 0.5;
  }
  return s;
}

// perceptual lightness of an HDR linear colour (0..~1)
float pp_plum(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return sqrt(l / (1.0 + l));
}

vec3 pp_perc(vec3 c) {
  return sqrt(c / (1.0 + c));
}

// slowly evolving brush-flow direction used where the image is flat
vec2 pp_flowDir(vec2 q, float t) {
  float a = pp_fbm(q * 1.7 + vec2(t * 0.013, -t * 0.009)) * 9.0;
  return vec2(cos(a), sin(a));
}
