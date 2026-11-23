// Drift solids: raymarched SDF bodies inside a unit bounding sphere (object space).
// One program, six kinds picked by uKind (uniform branch):
//   0 kaleidoscopic fold (2..3 counter-turning tiers, each a polar mirror fold of 5..9 windowed blades)
//   1 twisted band (Moebius-like ribbon loop, 1/3/5 half twists)
//   2 gyroid slab (gyroid labyrinth cut by a disc; uAlt 1 = by a ball)
//   3 torus knot (trefoil, + a second linked strand with detail)
//   4 nested shells with windows (1..3 counter-rotating perforated shells and a seed)
// Cost per covered pixel: <= 40 march steps + 4 normal taps (each one map(); the fold is 3 tiers max),
// 3 value-noise taps for paint texture, 1 hash for the dissolve. Misses near the silhouette draw a
// cut-paper outline from the closest approach, so the body reads as a paper cut-out pinned in the air.
#include "./drift.common.glsl"
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform float uTime; uniform float uKind; uniform float uAlt; uniform float uDetail; uniform float uTear;
uniform float uFade; uniform float uFlash; uniform float uSeed; uniform float uPale; uniform float uStepK;
uniform vec3 uCamObj; uniform vec3 uLightObj;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD; uniform vec3 uPaper; uniform vec3 uInk;
varying vec3 vObj;

float gId = 0.0;

float dr_box(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

float sdFold(vec3 p) {
  // kaleidoscope: each tier folds space into N mirrored sectors and hangs a tilted blade in it;
  // tiers turn against each other, so the symmetry itself rotates
  float N = 5.0 + 2.0 * floor(uDetail * 2.99) + uAlt;
  float sec = 6.2831 / N;
  float d = length(vec2(length(p.xz) - 0.0, p.y * 0.35)) - 0.07;   // spindle
  gId = 3.0;
  float tiers = 2.0 + floor(uDetail * 1.99);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (fi >= tiers) break;
    float a = atan(p.z, p.x) + uTime * (0.07 + 0.04 * fi) * (mod(fi, 2.0) > 0.5 ? -1.0 : 1.0) + fi * 0.6;
    a = abs(mod(a + sec * 0.5, sec) - sec * 0.5);
    vec3 q = vec3(cos(a) * length(p.xz), p.y, sin(a) * length(p.xz));
    float yi = (fi - (tiers - 1.0) * 0.5) * (0.42 - 0.1 * uAlt);
    vec3 bq = q - vec3(0.5 - 0.06 * fi, yi, 0.0);
    bq.xy = dr_rot(0.55 - 0.45 * fi + 0.15 * sin(uTime * 0.2 + fi)) * bq.xy;
    bq.xz = dr_rot(0.35) * bq.xz;
    float len = 0.36 - 0.05 * fi;
    float bl = dr_box(bq, vec3(len, 0.018, 0.12 - 0.02 * fi)) - 0.006;
    // a round window punched through each blade
    bl = max(bl, -(length(bq.xz - vec2(len * 0.45, 0.0)) - 0.055));
    if (bl < d) { d = bl; gId = fi; }
  }
  // a crown ring that sits on the folds
  float ring = length(vec2(length(p.xz) - 0.86, p.y - 0.02 * sin(atan(p.z, p.x) * N + uTime * 0.3))) - 0.014;
  if (ring < d) { d = ring; gId = 2.0; }
  return d * 0.85;
}

float sdBand(vec3 p) {
  float k = 1.0 + 2.0 * floor(uDetail * 2.99);          // half twists: 1, 3, 5
  float R = 0.62;
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - R, p.y);
  q = dr_rot(a * k * 0.5 + uTime * 0.25) * q;
  float d1 = dr_box(vec3(q, 0.0), vec3(0.3, 0.028, 1.0)) - 0.006;
  // ladder windows through the band
  float cells = 9.0 + 6.0 * uDetail;
  float u = fract(a / 6.2831 * cells) - 0.5;
  float win = length(vec2(u * 6.2831 * R / cells, q.x - 0.0)) - 0.07 * smoothstep(0.2, 0.8, uDetail);
  d1 = max(d1, -win);
  gId = q.x > 0.0 ? 0.0 : 1.0;
  // a thin second band, phase-shifted, inside
  vec2 q2 = dr_rot(a * k * 0.5 + 1.5708 - uTime * 0.25) * vec2(length(p.xz) - R * 0.62, p.y);
  float d2 = dr_box(vec3(q2, 0.0), vec3(0.14, 0.02, 1.0));
  if (d2 < d1) { gId = 2.0; d1 = d2; }
  return d1;
}

float sdGyroid(vec3 p) {
  float f = 7.0 + 6.0 * uDetail;
  vec3 q = p * f + vec3(0.0, uTime * 0.12, 0.0);
  float g = dot(sin(q), cos(q.yzx));
  float dg = abs(g) / f * 0.55 - 0.018;
  float bound = uAlt > 0.5 ? length(p) - 0.9 : max(length(p.xz) - 0.9, abs(p.y) - 0.26);
  float d = max(dg, bound);
  gId = g > 0.0 ? 0.0 : 1.0;
  if (bound > dg - 0.004) gId = 2.0;          // the cut face
  // a solid paper rim around the slab
  float rim = uAlt > 0.5 ? abs(length(p) - 0.92) - 0.02 : max(abs(length(p.xz) - 0.92) - 0.03, abs(p.y) - 0.27);
  if (rim < d) { d = rim; gId = 3.0; }
  return d;
}

float sdKnot(vec3 p) {
  float R = 0.56, r = 0.075 + 0.02 * (1.0 - uDetail);
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - R, p.y);
  float d = 1e5;
  for (int i = 0; i < 2; i++) {
    float aa = (a + 6.2831 * float(i)) * 1.5 + uTime * 0.2;
    vec2 o = vec2(cos(aa), sin(aa)) * 0.24;
    float s = length(q - o) - r;
    if (s < d) { d = s; gId = 0.0; }
  }
  if (uDetail > 0.45) {
    for (int i = 0; i < 2; i++) {
      float aa = (a + 6.2831 * float(i)) * 1.5 + 3.1416 + uTime * 0.2;
      vec2 o = vec2(cos(aa), sin(aa)) * 0.24;
      float s = length(q - o) - r * 0.55;
      if (s < d) { d = s; gId = 1.0; }
    }
  }
  return d * 0.8;
}

float sdShells(vec3 p) {
  float n = 1.0 + floor(uDetail * 2.99);
  float d = length(p) - 0.17; gId = 3.0;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= n) break;
    float fi = float(i);
    float R = 0.86 - fi * 0.23;
    vec3 q = p;
    q.xz = dr_rot(uTime * (0.09 + 0.05 * fi) * (mod(fi, 2.0) > 0.5 ? -1.0 : 1.0) + uSeed) * q.xz;
    q.yz = dr_rot(0.5 * fi + 0.2) * q.yz;
    float lq = length(q);
    float sh = abs(lq - R) - 0.022;
    float N = 5.0 + 2.0 * fi, sec = 6.2831 / N;
    float az = atan(q.z, q.x); az = mod(az + sec * 0.5, sec) - sec * 0.5;
    float el = asin(clamp(q.y / max(lq, 1e-3), -1.0, 1.0));
    float row = clamp(floor(el / 0.62 + 0.5), -1.0, 1.0);
    vec2 w = vec2(az * R * cos(el), (el - row * 0.62) * R);
    float win = length(w) - R * (0.27 + 0.05 * fi);
    sh = max(sh, -win);
    if (sh < d) { d = sh; gId = fi; }
  }
  return d;
}

float map(vec3 p) {
  vec3 p0 = p;
  if (uTear > 0.001) {
    float band = floor(p.y * 5.0 + uSeed);
    p.xz += (vec2(dr_hash(vec2(band, uSeed)), dr_hash(vec2(band, 3.1 + uSeed))) - 0.5) * 0.32 * uTear;
  }
  float d;
  if (uKind < 0.5) d = sdFold(p);
  else if (uKind < 1.5) d = sdBand(p);
  else if (uKind < 2.5) d = sdGyroid(p);
  else if (uKind < 3.5) d = sdKnot(p);
  else d = sdShells(p);
  if (uTear > 0.001) {
    float f = fract(p0.y * 5.0 + uSeed);
    d = max(d, 0.035 * uTear - min(f, 1.0 - f) * 0.2);
  }
  return d;
}

vec3 pal(float id) {
  id = mod(id, 4.0);
  return id < 0.5 ? uA : id < 1.5 ? uB : id < 2.5 ? uC : uD;
}

void main() {
  vec3 ro = uCamObj, rd = normalize(vObj - uCamObj);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.0, h = b * b - c;
  if (h < 0.0) discard;
  h = sqrt(h);
  float t = max(-b - h, 0.0), tEnd = -b + h;
  float minD = 1e5, tMin = t, steps = 0.0;
  bool hit = false;
  for (int i = 0; i < 40; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < minD) { minD = d; tMin = t; }
    if (d < 0.0012 * t) { hit = true; break; }
    t += d * uStepK;
    steps += 1.0;
    if (t > tEnd) break;
  }
  float dz = dr_hash(gl_FragCoord.xy * 0.913 + uSeed);
  vec3 col; vec3 P;
  if (!hit) {
    // cut-paper outline from the closest approach: a white brush band with a hairline of ink outside
    float px = 0.0011 * tMin;
    float w = px * (2.2 + 1.2 * uDetail);
    if (minD > w * 1.9 || minD < 0.0) discard;
    P = ro + rd * tMin;
    float brk = dr_noise(vec2(atan(P.y, P.x) * 9.0 + uSeed, P.z * 7.0));
    if (brk < 0.18 + 0.25 * uTear) discard;
    col = minD < w ? uPaper : mix(uInk, uPaper, 0.25);
    if (dz < 1.0 - uFade) discard;
    gl_FragColor = vec4(mix(col, uPaper, uFlash), 1.0);
  } else {
    P = ro + rd * t;
    float id = gId;
    vec2 e = vec2(0.0018, -0.0018);
    vec3 N = normalize(e.xyy * map(P + e.xyy) + e.yyx * map(P + e.yyx) + e.yxy * map(P + e.yxy) + e.xxx * map(P + e.xxx));
    vec3 L = normalize(uLightObj);
    float ndv = clamp(dot(N, -rd), 0.0, 1.0);
    vec3 base = pal(id + uSeed);
    // palette-knife texture: streaks along a fixed object axis, loaded with the next colour
    vec3 ax = normalize(vec3(0.3, 1.0, 0.2));
    float along = dot(P, ax), across = dot(P, normalize(cross(ax, vec3(1.0, 0.0, 0.0))));
    float n1 = dr_noise(vec2(across * 34.0, along * 3.0 + uSeed));
    float n2 = dr_noise(vec2(across * 11.0 + 4.0, along * 1.6));
    base = mix(base, pal(id + uSeed + 1.0), smoothstep(0.6, 0.8, n2) * 0.8);
    base *= 0.8 + 0.32 * n1;
    float diff = dot(N, L) * 0.5 + 0.5;
    float cel = dr_cel(diff);
    vec3 shade = mix(base, pal(id + uSeed + 2.0), 0.3) * 0.5 + uInk * 0.12;
    col = mix(shade, base, clamp(cel, 0.0, 1.0));
    // impasto highlight fleck and soft cavity from the march
    vec3 Hh = normalize(L - rd);
    float sp = pow(max(dot(N, Hh), 0.0), 36.0);
    col = mix(col, uPaper, smoothstep(0.35, 0.6, sp * (0.6 + 0.8 * n1)) * 0.85);
    col *= 1.0 - 0.35 * smoothstep(12.0, 38.0, steps);
    // paper rim, then an ink contour at the very edge
    float fr = pow(1.0 - ndv, 3.0);
    col = mix(col, uPaper, smoothstep(0.25, 0.6, fr) * 0.75);
    col = mix(col, uInk, smoothstep(0.16, 0.05, ndv) * 0.55);
    col = mix(col, uPaper, uPale * 0.72);
    col = mix(col, uPaper, uFlash);
    if (dz < 1.0 - uFade) discard;
    gl_FragColor = vec4(col, 1.0);
  }
  vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(P, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
}
