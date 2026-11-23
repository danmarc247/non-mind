// Strata: translucent horizontal slices of the same paint hovering below the vessel.
// uPattern: 0 flow-warped bands, 1 ring field, 2 dry-brush hatching, 3 knife arcs, 4 fleck field.
// Each fades to nothing at the rim; the top sheet (uShadow 1) catches a soft, contact-less shadow of
// the vessel, computed analytically by projecting the vessel's cylinder (three discs) along the light.
// Cost per covered pixel: bands 4 noise, rings 18 hashes, hatching 3 noise, arcs 3 noise,
// flecks 1 hash + 2 noise; shadow 3 analytic discs + 1 noise. All value noise, no lygia.
#include "./drift.common.glsl"
uniform float uTime; uniform float uPattern; uniform float uR; uniform float uShadow; uniform float uFade;
uniform float uComplexity; uniform float uOverwhelm; uniform float uFlash; uniform float uSeed; uniform float uAlpha;
uniform float uSpin;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD; uniform vec3 uPaper; uniform vec3 uInk;
uniform vec3 uLight; uniform float uVesselR; uniform float uVesselTop; uniform float uVesselBottom;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;

vec3 pal(float id) { id = mod(id, 4.0); return id < 0.5 ? uA : id < 1.5 ? uB : id < 2.5 ? uC : uD; }

void main() {
  vec2 w = vW.xz;
  float r = length(w);
  float rn = r / uR;
  float t = uTime;
  // the sheet's own rotating frame
  vec2 p = dr_rot(uSpin) * w / uR;           // -1..1
  float rimN = dr_noise(vec2(atan(p.y, p.x) * 4.0 + uSeed, t * 0.05));
  float rim = smoothstep(1.0, 0.72 + 0.1 * rimN, rn);
  float paint = 0.0; vec3 col = uPaper; float height = 0.0;

  if (uPattern < 0.5) {
    vec2 q = p * 2.2;
    vec2 wp = vec2(dr_fbm(q + vec2(t * 0.03, 0.0)), dr_fbm(q + vec2(5.2, -t * 0.025)));
    q += (wp - 0.5) * (1.2 + 0.8 * uComplexity);
    float k = (q.x + q.y * 0.4) * 3.0 + length(q) * 0.6;
    float id = floor(k), f = fract(k);
    paint = smoothstep(0.08, 0.2, f) * smoothstep(0.92, 0.7, f);
    col = pal(id + uSeed);
    height = paint;
  } else if (uPattern < 1.5) {
    vec2 g = p * (3.5 + 2.5 * uComplexity);
    vec2 ip = floor(g), fp = fract(g);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      float h = dr_hash(ip + o + uSeed);
      vec2 c = o + 0.5 + (vec2(h, dr_hash(ip + o + 3.3)) - 0.5) * 0.5;
      float dd = length(fp - c), R = 0.22 + 0.18 * h;
      float th = 0.05 + 0.03 * h;
      float band = smoothstep(th, th * 0.4, abs(dd - R));
      float disc = smoothstep(R - th, R - th - 0.03, dd) * step(0.35, h);
      col = mix(col, pal(floor(h * 4.0) + uSeed), disc);
      col = mix(col, uPaper, band);
      paint = max(paint, max(band, disc * 0.8));
      height = max(height, band);
    }
  } else if (uPattern < 2.5) {
    vec2 q = dr_rot(0.7 + uSeed) * p;
    float across = q.y * (18.0 + 10.0 * uComplexity);
    float row = floor(across);
    float u = q.x * 2.0 + dr_hash(vec2(row, uSeed)) * 4.0;
    float seg = fract(u * 0.7);
    float dry = dr_bristle(fract(across) * 0.3 + row * 0.11 + q.x * 0.03);
    paint = smoothstep(0.0, 0.1, seg) * smoothstep(0.8, 0.4, seg) * smoothstep(0.3, 0.5, dry);
    paint *= smoothstep(0.05, 0.35, fract(across)) * smoothstep(0.95, 0.65, fract(across));
    col = pal(row * 0.37 + uSeed);
    height = paint * 0.7;
  } else if (uPattern < 3.5) {
    float a = atan(p.y, p.x), rr = length(p);
    float k = rr * (7.0 + 4.0 * uComplexity) + dr_noise(vec2(a * 2.0, rr * 3.0)) * 0.8;
    float ring = floor(k), f = fract(k);
    float arc = fract(a / 6.2831 + dr_hash(vec2(ring, uSeed)) - t * 0.01 * (mod(ring, 2.0) * 2.0 - 1.0));
    float len = 0.25 + 0.4 * dr_hash(vec2(ring, 9.0));
    float dry = dr_bristle(f * 0.4 + ring * 0.2);
    paint = smoothstep(0.0, 0.04, arc) * smoothstep(len, len - 0.12, arc) * smoothstep(0.15, 0.35, f) * smoothstep(0.85, 0.6, f);
    paint *= smoothstep(0.25, 0.45, dry + 0.2 * (1.0 - arc / len));
    col = pal(ring + uSeed);
    height = paint;
  } else {
    vec2 g = p * 16.0;
    vec2 ip = floor(g), fp = fract(g) - 0.5;
    float h = dr_hash(ip + uSeed);
    float dot0 = smoothstep(0.22, 0.12, length(fp + (vec2(h, fract(h * 7.3)) - 0.5) * 0.4)) * step(0.55 - 0.3 * uComplexity, h);
    float wash = smoothstep(0.45, 0.7, dr_fbm(p * 3.0 + t * 0.02));
    paint = max(dot0, wash * 0.45);
    col = mix(pal(floor(h * 4.0) + uSeed), pal(uSeed + 2.0), wash * (1.0 - dot0));
    height = dot0;
  }

  // paper wash under the paint so the sheet is a slice, not just floating marks
  float base = 0.22 + 0.1 * dr_noise(p * 5.0 + uSeed);
  vec3 c = mix(uPaper, col, paint);
  float a = max(base, paint * 0.95) * rim;

  // contact-less vessel shadow: the cylinder projected along the light onto this plane
  if (uShadow > 0.5) {
    vec3 L = normalize(uLight);
    float sh = 1e5;
    for (int i = 0; i < 3; i++) {
      float hy = mix(uVesselBottom, uVesselTop, float(i) * 0.5);
      float k = (hy - vW.y) / L.y;
      vec2 hit = w + L.xz * k;
      sh = min(sh, length(hit) - uVesselR);
    }
    float gap = uVesselBottom - vW.y;
    float pen = 1.2 + gap * 0.45;
    float shadow = smoothstep(pen, -pen, sh + dr_noise(w * 0.5) * 0.6);
    float halo = smoothstep(uVesselR * 1.55, uVesselR * 0.9, r) * 0.25;
    c = mix(c, mix(uInk, pal(uSeed + 1.0), 0.25), shadow * 0.42 + halo * 0.3);
    a = max(a, (shadow * 0.5 + halo * 0.25) * rim);
  }
  // a white-outlined lip (ref b) inside the fade, broken by a dry brush, so each slice reads as a plate
  float lipR = 0.8 + 0.03 * rimN;
  float lip = smoothstep(0.03, 0.015, abs(rn - lipR)) * smoothstep(0.3, 0.5, dr_bristle(atan(p.y, p.x) * 0.6 + uSeed));
  float lipInk = smoothstep(0.012, 0.004, abs(rn - lipR - 0.038)) * 0.75;
  c = mix(c, uInk, lipInk); c = mix(c, uPaper, lip);
  a = max(a, max(lip, lipInk) * smoothstep(1.0, 0.85, rn));
  a *= smoothstep(lipR + 0.02, lipR - 0.02, rn) * 0.6 + 0.4;   // inside the lip is the slice, outside only a ghost
  // impasto from derivatives keeps the slices painterly when seen at a glance
  vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 1.6, -0.6, 0.6);
  c *= 1.0 + slope.x * 0.25 - slope.y * 0.15;
  c = mix(c, uPaper, uFlash * 0.7);
  c = mix(c, mix(uC, uPaper, 0.4), uOverwhelm * 0.15 * paint);
  gl_FragColor = vec4(c, a * uAlpha * uFade);
}
