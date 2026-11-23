// Tethers: a slack hand-drawn line from P0 toward P1 that stops a gap short of it.
// Each vertex knows its tether (aId), its place along the line (aS, 0..1), its side (aSide) and its
// pass (aPass: 0 main stroke, 1 a fainter second pencil pass with its own jitter). The curve is
// built here: a sagging chord, low-frequency hand wobble, then a screen-space ribbon of uWidth px.
#define NT 6
attribute float aId; attribute float aS; attribute float aSide; attribute float aPass;
uniform vec3 uP0[NT]; uniform vec3 uP1[NT]; uniform float uGap[NT]; uniform float uOn[NT]; uniform float uSag[NT];
uniform float uTime; uniform float uWidth; uniform vec2 uRes; uniform float uFray;
varying float vS; varying float vSide; varying float vPass; varying float vOn; varying float vId; varying float vLen;

vec3 pointAt(int id, float s, float seed) {
  vec3 a = uP0[id], b = uP1[id];
  vec3 d = b - a; float L = length(d);
  vec3 e = a + d * ((L - uGap[id]) / max(L, 1e-3));   // the free end, a gap short of the target
  vec3 p = mix(a, e, s);
  p.y -= uSag[id] * L * 4.0 * s * (1.0 - s);          // slack
  vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
  vec3 up = normalize(cross(side, d));
  float w1 = sin(s * 7.0 + seed * 3.0 + uTime * 0.23) * 0.5 + sin(s * 17.0 + seed * 7.0 - uTime * 0.31) * 0.25;
  float w2 = cos(s * 5.0 + seed * 5.0 + uTime * 0.19) * 0.5 + sin(s * 23.0 + seed) * 0.2;
  float amp = (0.06 + 0.012 * L) * (1.0 + uFray * 2.5) * (0.4 + s);
  return p + side * w1 * amp + up * w2 * amp;
}

void main() {
  int id = int(aId + 0.5);
  float seed = aId * 1.7 + aPass * 4.1;
  float s = aS;
  float ds = 0.01;
  vec3 P = pointAt(id, s, seed);
  vec3 Q = pointAt(id, min(1.0, s + ds), seed);
  vec3 R = pointAt(id, max(0.0, s - ds), seed);
  vec4 cp = projectionMatrix * viewMatrix * vec4(P, 1.0);
  vec4 cq = projectionMatrix * viewMatrix * vec4(Q, 1.0);
  vec4 cr = projectionMatrix * viewMatrix * vec4(R, 1.0);
  vec2 sq = cq.xy / cq.w * uRes, sr = cr.xy / cr.w * uRes;
  vec2 tng = normalize(sq - sr + vec2(1e-5, 0.0));
  vec2 nrm = vec2(-tng.y, tng.x);
  // pressure: lands lightly, swells, lifts toward the free end, which gets a small ink bulb
  float press = smoothstep(0.0, 0.12, s) * (0.75 + 0.25 * sin(s * 9.0 + seed)) * mix(1.0, 0.5, smoothstep(0.7, 0.97, s));
  press += smoothstep(0.975, 1.0, s) * 1.4;
  float w = uWidth * (aPass > 0.5 ? 0.6 : 1.0) * max(press, 0.2);
  cp.xy += nrm * aSide * w / uRes * cp.w;
  gl_Position = cp;
  vS = s; vSide = aSide; vPass = aPass; vOn = uOn[id]; vId = aId; vLen = length(uP1[id] - uP0[id]);
}
