// Seat ring: a hand-painted white ring on a colour field (ref b).
// Wobbling brush edge, loaded start + dry tail with bristle gaps, inner tolerance arc,
// outer charge arc (fights), invite ripple, hover. ~5 value-noise taps per pixel, tiny footprint.
#include "./arena.common.glsl"
uniform float uTime; uniform float uOverwhelm;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uMagenta; uniform vec3 uYolk; uniform vec3 uField;
varying vec2 vP; varying vec3 vTone; varying vec4 vData; varying vec4 vMisc;
const float TAU = 6.2831853;

// arc mask: radius R, half width w, covering fraction k of the circle clockwise from 12 o'clock
float arc(float r, float a01, float R, float w, float k, float px) {
  float on = step(a01, k) * step(0.001, k);
  return smoothstep(w + px, w - px, abs(r - R)) * on;
}

void main() {
  float tol = vData.x, charge = vData.y, hover = vData.z, invite = vData.w;
  float occ = vMisc.x, seed = vMisc.y, self = vMisc.z, fight = vMisc.w;
  vec2 p = vP;
  float r = length(p), a = atan(p.y, p.x);
  float px = fwidth(r) * 1.1;
  // clockwise from 12 o'clock, 0..1 (the disc lies flat, so "up" on the disc is world -z after rotation)
  float a01 = fract(0.25 - a / TAU);

  // ---- the painted ring ----
  float wob = 0.03 * sin(a * 3.0 + seed * 6.0 + uTime * 0.5) + 0.02 * sin(a * 5.0 - seed * 3.0)
            + (ar_noise(vec2(a * 2.2 + seed * 10.0, uTime * 0.25)) - 0.5) * (0.05 + 0.06 * uOverwhelm);
  float R = 0.7 + wob + 0.03 * hover;
  float u = fract((a + TAU * 0.5) / TAU + seed);                   // 0 loaded start .. 1 dry tail
  float th = (0.085 + 0.025 * hover + 0.015 * invite) * (1.0 - 0.4 * smoothstep(0.6, 1.0, u));
  float across = (r - R) / th;
  float band = smoothstep(th + px, th - px, abs(r - R));
  float dry = mix(0.12, 0.5, smoothstep(0.45, 1.0, u));
  float bristle = ar_bristle(across * 0.18 + seed * 3.0) + 0.25 * ar_noise(vec2(u * 40.0, seed * 7.0));
  band *= smoothstep(dry - 0.06, dry + 0.06, bristle + 0.12);
  // overlap at the seam: a second short loaded dab where the stroke started
  band = max(band, smoothstep(th * 1.1 + px, th * 1.1 - px, abs(r - R - 0.01)) * smoothstep(0.08, 0.0, u) );

  // ---- fill: a flat colour field (occupant tint), or bare paper ----
  float inside = smoothstep(R - th * 0.4 + px, R - th * 0.4 - px, r);
  float fieldN = ar_noise(p * 3.0 + seed * 5.0);
  vec3 fill = mix(uField, vTone, occ);
  fill *= 0.92 + 0.12 * fieldN;
  fill = mix(fill, uMagenta, invite * (0.7 + 0.2 * sin(uTime * 6.0 + seed * 9.0)) * (1.0 - occ));
  fill = mix(fill, uPaper, hover * 0.25);
  float fillA = mix(0.1 + 0.5 * invite + 0.25 * hover, 0.78, occ);

  vec3 col = fill; float alpha = inside * fillA;

  // ---- inner arc: occupant tolerance ----
  float tolArc = arc(r, a01, 0.5, 0.035, tol, px) * occ;
  float tolBack = smoothstep(0.035 + px, 0.035 - px, abs(r - 0.5)) * occ * 0.25;
  col = mix(col, uInk, tolBack * 0.6);
  col = mix(col, uPaper, tolArc);

  // ---- outer arc: charge during fights ----
  float full = step(0.995, charge);
  float chArc = arc(r, a01, 0.88, 0.04 + 0.015 * full, charge, px) * fight * occ;
  float chBack = smoothstep(0.04 + px, 0.04 - px, abs(r - 0.88)) * fight * occ;
  col = mix(col, uInk, chBack * 0.35 * (1.0 - chArc));
  col = mix(col, mix(uYolk, uPaper, full * (0.5 + 0.5 * sin(uTime * 18.0))), chArc);
  alpha = max(alpha, max(chArc, chBack * 0.35));

  // ---- offset ink shadow under the ring (the HUD's offset-shadow language) ----
  vec2 ps = p - vec2(0.045, -0.055);
  float rs = length(ps);
  float shadow = smoothstep(th + px, th - px, abs(rs - R)) * smoothstep(dry - 0.1, dry + 0.1, bristle + 0.2);
  col = mix(col, uInk, shadow * (1.0 - band) * 0.55);
  alpha = max(alpha, shadow * 0.4);

  // ---- ring on top ----
  vec3 ringCol = mix(uPaper, uMagenta, self * 0.65);
  col = mix(col, ringCol, band);
  alpha = max(alpha, band * mix(0.6, 1.0, max(occ, max(hover, invite))));

  // ---- invite: a ripple drifting outward ----
  float ph = fract(uTime * 0.9 + seed);
  float rip = smoothstep(0.03 + px, 0.0, abs(r - (0.74 + ph * 0.24))) * (1.0 - ph) * invite;
  col = mix(col, uPaper, rip);
  alpha = max(alpha, rip * 0.8);

  // impasto: ring is thick paint
  float height = band * 0.35 + tolArc * 0.15 + chArc * 0.15;
  vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 2.2, -0.6, 0.6);
  vec3 nrm = normalize(vec3(-slope, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
  col *= mix(1.0, dot(nrm, L) / L.z, 0.5);

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
