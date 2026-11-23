// Sea caustics: light threads floating just above the painted sea (vertex: sea.vert.glsl, so it rides
// the same waves). CAUSTIC_ITERS domain iterations (analytic sin/cos) + 1 value-noise tap for dry-brush breakup.
#include "./arena.common.glsl"
#ifndef CAUSTIC_ITERS
#define CAUSTIC_ITERS 4
#endif
uniform float uTime; uniform float uComplexity; uniform float uOverwhelm; uniform float uTension; uniform float uR;
uniform vec3 uPaper; uniform vec3 uC; uniform vec3 uGlow;
varying vec3 vW; varying float vH;

void main() {
  vec2 pw = vW.xz;
  float r = length(pw);
  vec2 q = pw * 0.55 - 250.0;
  float t = uTime * (0.32 + 0.25 * uTension) + 23.0;
  vec2 i2 = q; float c = 1.0; const float inten = 0.005;
  for (int n = 0; n < CAUSTIC_ITERS; n++) {
    float tn = t * (1.0 - (3.5 / float(n + 1)));
    i2 = q + vec2(cos(tn - i2.x) + sin(tn + i2.y), sin(tn - i2.y) + cos(tn + i2.x));
    c += 1.0 / length(vec2(q.x / (sin(i2.x + tn) / inten), q.y / (cos(i2.y + tn) / inten)));
  }
  c /= float(CAUSTIC_ITERS);
  c = 1.17 - pow(c, 1.4);
  float thick = mix(9.0, 3.5, uComplexity);
  float th = pow(abs(c), thick);
  // dry brush: the threads break like a dragged loaded brush
  float br = ar_noise(pw * vec2(2.3, 0.8) + vec2(t * 0.2, 0.0));
  th *= smoothstep(0.25, 0.55, br + 0.25 * uComplexity);
  float fade = smoothstep(uR, uR - 1.2, r) * smoothstep(1.0, 2.6, r);
  float a = clamp(th * (0.12 + 0.55 * uComplexity) * fade * (1.0 + 0.6 * smoothstep(0.0, 0.2, vH)), 0.0, 0.7);
  if (a < 0.004) discard;
  vec3 col = mix(uC, uGlow, smoothstep(0.3, 0.8, br));
  col = mix(col, uPaper, smoothstep(0.5, 1.0, th) * 0.6);
  gl_FragColor = vec4(col, a);
}
