// Tether ink: a soft-edged ribbon with dry pencil breaks along its length. 1 value-noise tap per pixel.
#include "./drift.common.glsl"
uniform float uFlash; uniform float uFray;
uniform vec3 uInk; uniform vec3 uPaper; uniform vec3 uA; uniform vec3 uB;
varying float vS; varying float vSide; varying float vPass; varying float vOn; varying float vId; varying float vLen;

void main() {
  if (vOn < 0.01) discard;
  float edge = smoothstep(1.0, 0.35, abs(vSide));
  float brk = dr_noise(vec2(vS * vLen * 2.2 + vId * 13.0 + vPass * 5.0, vPass));
  float keep = smoothstep(0.2 + 0.25 * uFray, 0.35 + 0.25 * uFray, brk + 0.15 * smoothstep(0.95, 1.0, vS));
  vec3 col = mod(vId, 3.0) < 0.5 ? mix(uInk, uA, 0.35) : mod(vId, 3.0) < 1.5 ? uInk : mix(uInk, uB, 0.3);
  col = mix(col, uPaper, uFlash * 0.7);
  float a = edge * keep * vOn * (vPass > 0.5 ? 0.35 : 0.9);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}
