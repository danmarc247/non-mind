// Mote dabs and short strokes: a loaded head, a dry bristled tail, a paper glint; flare to white on flash.
// Cost per covered pixel: 2 value-noise taps. Motes are a few pixels each.
#include "./drift.common.glsl"
uniform float uFlash; uniform float uFade;
uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; uniform vec3 uP3; uniform vec3 uP4; uniform vec3 uPaper; uniform vec3 uInk;
varying vec2 vQ; varying float vKind; varying float vCol; varying float vAlpha; varying float vSeed;

void main() {
  if (vAlpha < 0.01) discard;
  vec2 q = vQ;
  float m;
  if (vKind > 0.5) {
    float taper = 1.0 - 0.6 * smoothstep(-0.6, 1.0, q.x);
    float rag = (dr_noise(vec2(q.x * 4.0 + vSeed * 30.0, 1.0)) - 0.5) * 0.3;
    m = smoothstep(0.08, -0.08, abs(q.y) - taper * 0.9 - rag) * smoothstep(1.0, 0.8, abs(q.x));
    m *= smoothstep(0.2, 0.4, dr_bristle(q.y * 0.4 + vSeed) + 0.3 * (1.0 - q.x));
  } else {
    float r = length(q) + (dr_noise(q * 3.0 + vSeed * 20.0) - 0.5) * 0.3;
    m = smoothstep(0.95, 0.75, r);
  }
  if (m < 0.02) discard;
  float k = fract(vCol * 5.0);
  vec3 col = k < 0.2 ? uP0 : k < 0.4 ? uP1 : k < 0.6 ? uP2 : k < 0.8 ? uP3 : uP4;
  if (fract(vCol * 31.0) < 0.12) col = uPaper;
  if (fract(vCol * 17.0) < 0.05) col = uInk;
  col = mix(col, uPaper, smoothstep(0.3, 0.0, length(q - vec2(-0.25, 0.3))) * 0.5);
  col = mix(col, uPaper, uFlash * 0.8);
  gl_FragColor = vec4(col, m * clamp(vAlpha, 0.0, 1.0) * uFade);
}
