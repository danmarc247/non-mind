#include "/lygia/generative/snoise.glsl"
uniform float uTime; uniform float uSide; uniform float uComplexity; uniform float uOverwhelm; uniform float uTension; uniform float uR; uniform float uPulse;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uPaper; uniform vec3 uInk;
varying vec3 vW; varying float vH;

// painted water: flow-warped bands of the stage palette, white ring foam (ten directions), ink in the troughs
vec3 surface(vec2 p) {
  float t = uTime * 0.12;
  vec2 q = p * 0.16;
  vec2 warp = vec2(snoise(vec3(q, t)), snoise(vec3(q + 5.2, t + 3.0)));
  q += warp * (0.35 + 0.5 * uComplexity);
  float n = snoise(vec3(q * 1.6, t * 1.7));
  float bands = sin((n * 3.0 + length(p) * 0.55 - uTime * 0.35) * 3.14159);
  float streak = snoise(vec3(q.x * 9.0 + warp.y * 3.0, q.y * 1.2, t)) * 0.5 + 0.5;
  vec3 c = mix(uPaper, uA, smoothstep(-0.2, 0.9, n + 0.25 + 0.5 * uComplexity));
  c = mix(c, uB, smoothstep(0.1, 0.8, bands) * (0.35 + 0.5 * uComplexity));
  c = mix(c, uC, smoothstep(0.72, 0.95, streak) * (0.25 + 0.6 * uComplexity));
  // concentric foam rings breathing out from the core, plus ten spokes
  float r = length(p), a = atan(p.y, p.x);
  float ring = smoothstep(0.06, 0.0, abs(fract(r * 0.45 - uTime * 0.08) - 0.5) - 0.44);
  float spoke = smoothstep(0.035, 0.0, abs(fract(a / 6.28318 * 10.0 + 0.5) - 0.5) * r * 0.62 - 0.02) * smoothstep(1.5, 4.0, r);
  c = mix(c, uPaper, (ring * 0.55 + spoke * 0.4) * (0.6 + 0.4 * streak));
  c = mix(c, uInk, smoothstep(0.02, -0.18, vH) * 0.35);
  c = mix(c, vec3(1.0, 0.176, 0.478), uOverwhelm * smoothstep(0.3, 0.9, snoise(vec3(p * 0.3, uTime * 0.5))) * 0.7);
  c += uPaper * smoothstep(0.1, 0.28, vH) * 0.35;      // crest light
  c = mix(c, uPaper, uPulse * 0.5);
  return c;
}
void main() {
  if (uSide < 0.5) { gl_FragColor = vec4(surface(vW.xz), 1.0); return; }
  // cut face of the vessel: strata of the same paint, darker with depth, slow caustic threads
  float d = clamp((-vW.y - 0.3) / 5.0, 0.0, 1.0);
  float a = atan(vW.z, vW.x);
  float n = snoise(vec3(a * 3.0, vW.y * 0.9 - uTime * 0.05, uTime * 0.07));
  float strata = sin((vW.y * 2.2 + n * 1.3) * 3.14159);
  vec3 c = mix(uA, uB, smoothstep(-0.3, 0.6, strata));
  c = mix(c, uC, smoothstep(0.75, 0.98, snoise(vec3(a * 14.0, vW.y * 0.6 + uTime * 0.2, 1.0)) * 0.5 + 0.5) * 0.6);
  c = mix(c, uInk, d * 0.85);
  c = mix(c, uPaper, smoothstep(0.05, 0.0, d) * 0.8);
  gl_FragColor = vec4(c, 1.0);
}
