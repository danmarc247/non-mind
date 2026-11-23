// Card fx: paint dabs (kind 0) in the card's tone, paper and the stage accent; a wobbly paper-white
// ring with a thin ink edge (kind 1) that opens and thins as uRing runs 0..1. 2 value-noise taps.
#include "./card.common.glsl"
uniform float uKind; uniform float uRing; uniform float uFade; uniform float uTime;
uniform vec3 uTone; uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uA;
varying vec2 vQ; varying float vA; varying float vSeed;
void main() {
  if (vA * uFade < 0.01) discard;
  vec2 q = vQ;
  vec3 col; float a;
  if (uKind < 0.5) {
    float r = length(q) + (cd_noise(q * 3.0 + vSeed * 20.0) - 0.5) * 0.35;
    a = smoothstep(0.95, 0.72, r);
    float k = fract(vSeed * 7.0);
    col = k < 0.5 ? uTone : k < 0.8 ? uPaper : uA;
    col = mix(col, uPaper, smoothstep(0.35, 0.0, length(q - vec2(-0.25, 0.3))) * 0.5);
  } else if (uKind > 1.5) {
    // ground mark: a brushed ring in the tone around a paper one, breathing; uRing is the urgency here
    float d = length(q) + (cd_noise(q * 3.0 + 4.0) - 0.5) * 0.08;
    float R = 0.68 + 0.05 * sin(uTime * (1.6 + 4.0 * uRing));
    float px = fwidth(d) * 1.2 + 1e-4;
    float tone = smoothstep(0.1 + px, 0.1 - px, abs(d - R)) * smoothstep(0.15, 0.4, cd_noise(vec2(atan(q.y, q.x) * 3.0, d * 6.0)) + 0.25);
    float paper = smoothstep(0.03 + px, 0.03 - px, abs(d - R + 0.2));
    col = mix(uTone, uPaper, paper);
    a = max(tone * 0.85, paper * 0.7);
  } else {
    float k = uRing, e = 1.0 - pow(1.0 - k, 3.0);
    float R = 0.2 + 0.72 * e, th = 0.1 * (1.0 - k) + 0.025;
    float d = length(q) + (cd_noise(q * 4.0 + 2.0) - 0.5) * 0.05;
    float px = fwidth(d) * 1.2 + 1e-4;
    float band = smoothstep(th + px, th - px, abs(d - R));
    float edge = smoothstep(0.012 + px, 0.012 - px, abs(d - R - th - 0.02));
    col = mix(uInk, uPaper, band);
    a = max(band, edge * 0.6) * (1.0 - k);
  }
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a * vA * uFade);
}
