// Gate frame tube: cel-banded paint in the family colour, paper fresnel rim (matches sculpt.js MAIN).
#include "./arena.common.glsl"
uniform vec3 uA; uniform vec3 uB; uniform vec3 uPaper; uniform vec3 uInk; uniform float uFlare; uniform float uTime; uniform float uSeed;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(-0.35, 0.85, 0.4));
  float l = ar_cel(clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0));
  float stroke = ar_noise(vec2(vUv.x * 60.0 + uSeed * 9.0, vUv.y * 4.0));
  vec3 col = mix(uB, uA, smoothstep(0.35, 0.65, stroke * 0.6 + vUv.x * 0.0 + 0.2));
  col *= 0.55 + 0.55 * l;
  float rim = pow(1.0 - abs(dot(N, V)), 3.0);
  col = mix(col, uPaper, clamp(rim * 0.9 + uFlare * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
