// Thin wire orbits (torus tubes, uv.x runs along the loop): a dry-brushed painted line with
// dashes that slide, cel-lit across the tube, paper glints. 2 value-noise taps per pixel.
#include "./drift.common.glsl"
uniform float uTime; uniform float uDetail; uniform float uFade; uniform float uFlash; uniform float uSeed;
uniform float uPale; uniform float uTear; uniform float uDash;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uLight;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;

void main() {
  float s = vUv.x;
  float run = s * (40.0 + 60.0 * uDetail) - uTime * 0.6 * (mod(uSeed, 2.0) > 1.0 ? -1.0 : 1.0);
  float dash = smoothstep(0.0, 0.08, fract(run * 0.1 * uDash)) * smoothstep(1.0, 0.8, fract(run * 0.1 * uDash));
  float dry = dr_noise(vec2(s * 260.0 + uSeed * 13.0, vUv.y * 3.0));
  float keep = mix(1.0, dash, step(0.5, uDash)) * smoothstep(0.18 + 0.3 * uTear, 0.32 + 0.3 * uTear, dry);
  if (keep < 0.5) discard;
  vec3 N = normalize(vN);
  float l = dr_cel(clamp(dot(N, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = mix(uA, uB, smoothstep(0.4, 0.7, dr_noise(vec2(s * 18.0 + uSeed, 1.0))));
  col *= 0.7 + 0.35 * l;
  col = mix(col, uPaper, smoothstep(0.85, 0.95, l) * 0.5);
  col = mix(col, uPaper, uPale * 0.6);
  col = mix(col, uPaper, uFlash);
  if (dr_hash(gl_FragCoord.xy * 0.71 + uSeed) < 1.0 - uFade) discard;
  gl_FragColor = vec4(col, 1.0);
}
