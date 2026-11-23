// NON-MIND paint fx: one instanced quad per mark. All motion is computed here from the
// spawn attributes and uTime, so the CPU never touches a live instance after spawning it.
//   aP  xyz position (A),            w size
//   aQ  xyz velocity | B | params,   w angle / spiral height
//   aT  x t0, y life, z kind, w seed
//   aC1 rgb colour 1, a intensity
//   aC2 rgb colour 2, a fill / extra
//   aM  x mode, y gravity | arc | spiral, z home-from-k | braid amp, w spin | braid phase
//   aX  kind params (x, y, z, w); for particles w = 1 enables the pop/shrink size curve
// modes: 0 ground decal, 1 particle billboard, 2 ribbon A->B, 3 spiral particle, 4 column
attribute vec4 aP; attribute vec4 aQ; attribute vec4 aT; attribute vec4 aC1; attribute vec4 aC2; attribute vec4 aM; attribute vec4 aX;
uniform float uTime; uniform vec3 uCore;
varying vec2 vUv; varying float vK; varying float vAge; varying vec4 vC1; varying vec4 vC2; varying vec4 vX; varying vec3 vInfo;

const float FX_TAU = 6.2831853;
const float FX_PI = 3.1415927;

vec2 fx_rot(vec2 l, float a) { float c = cos(a), s = sin(a); return vec2(c * l.x - s * l.y, s * l.x + c * l.y); }

void main() {
  float life = max(aT.y, 1e-4), age = uTime - aT.x, k = age / life;
  vK = k; vAge = age; vUv = uv; vC1 = aC1; vC2 = aC2; vX = aX; vInfo = vec3(aT.z, aT.w, life);
  if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // dead or not yet born: degenerate
  int mode = int(aM.x + 0.5);
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camF = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec2 l = position.xy;
  vec3 w;
  if (mode == 0) {
    // ground decal, horizontal, aQ.xy = aspect, aQ.w = yaw
    vec2 r = fx_rot(l * aP.w * vec2(max(aQ.x, 1e-3), max(aQ.y, 1e-3)), aQ.w);
    w = aP.xyz + vec3(r.x, 0.0, r.y);
  } else if (mode == 1) {
    // ballistic particle, optional homing to the core, optional velocity stretch (aX.z)
    vec3 v = aQ.xyz + vec3(0.0, -aM.y * age, 0.0);
    vec3 p = aP.xyz + aQ.xyz * age + vec3(0.0, -0.5 * aM.y * age * age, 0.0);
    if (aM.z > 0.0) { float h = smoothstep(aM.z, 1.0, k); p = mix(p, uCore, h * h * (3.0 - 2.0 * h)); v = mix(v, (uCore - p) * 3.0, h); }
    float sc = aP.w * mix(1.0, smoothstep(0.0, 0.12, k) * (1.0 - k * k), aX.w);
    vec2 d2 = vec2(dot(v, camR), dot(v, camU));
    float st = 1.0 + aX.z * min(length(d2), 8.0) * 0.12;
    float ang = aX.z > 0.0 ? atan(d2.y, d2.x + 1e-5) : aM.w * age + aT.w * FX_TAU;
    vec2 rl = fx_rot(l * vec2(st, 1.0 / sqrt(st)) * sc, ang);
    w = p + camR * rl.x + camU * rl.y;
  } else if (mode == 2) {
    // ribbon from A to B: arc (aM.y) lifts the middle, braid (aM.z amp, aM.w phase) weaves it
    vec3 A = aP.xyz, B = aQ.xyz, d = B - A;
    float u = l.x + 0.5;
    vec3 side = cross(d, camF); side = side / max(length(side), 1e-4);
    vec3 c = A + d * u + vec3(0.0, aM.y * sin(FX_PI * u), 0.0);
    c += side * aM.z * sin(u * FX_PI * 3.0 + aM.w + age * 7.0) * (1.0 - u * 0.85);
    c.y += aM.z * 0.6 * cos(u * FX_PI * 3.0 + aM.w + age * 7.0) * (1.0 - u * 0.85);
    w = c + side * l.y * aP.w;
  } else if (mode == 3) {
    // spiral inward around aP: aQ.x r0, aQ.y a0, aQ.z turns, aQ.w start height
    float e = k * k * (3.0 - 2.0 * k);
    float r = aQ.x * (1.0 - e), a = aQ.y + aQ.z * FX_TAU * e;
    vec3 p = aP.xyz + vec3(cos(a) * r, aQ.w * (1.0 - e), sin(a) * r);
    vec3 tg = vec3(-sin(a), 0.0, cos(a)) * sign(aQ.z + 1e-5);
    vec2 d2 = vec2(dot(tg, camR), dot(tg, camU));
    float sc = aP.w * (0.45 + 0.55 * (1.0 - e)) * smoothstep(0.0, 0.08, k);
    vec2 rl = fx_rot(l * vec2(2.2, 0.75) * sc, atan(d2.y, d2.x + 1e-5));
    w = p + camR * rl.x + camU * rl.y;
  } else {
    // vertical column, cylindrical billboard: aP.w width, aQ.y height
    vec3 side = cross(vec3(0.0, 1.0, 0.0), camF); side = side / max(length(side), 1e-4);
    w = aP.xyz + side * l.x * aP.w + vec3(0.0, (l.y + 0.5) * aQ.y, 0.0);
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
