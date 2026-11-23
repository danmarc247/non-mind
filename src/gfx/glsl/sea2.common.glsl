// ContainedSea shared block (vertex + fragment). No lygia here: analytic waves only.
// Swell: 3 directional sines + a central breathing ring, analytic gradient.
// Ripples: a fixed ring buffer of 16, evaluated PER VERTEX (never per pixel), passed as a varying.
uniform float uT;          // paint clock (speeds up with overwhelm / audio)
uniform float uNow;        // plain clock for ripple ages
uniform float uTension;
uniform float uComplexity;
uniform float uOverwhelm;
uniform float uLow;        // mood.audio.low
uniform float uFlash;
uniform float uR;          // sea radius
uniform float uY;          // sea level (world y)
uniform vec4  uRip[16];    // x, z, birth (uNow), kind*10 + strength   kind: 0 drop, 1 gate wake, 2 flash ring

// h, dh/dx, dh/dz
vec3 sea_swell(vec2 p) {
  float t = uT;
  float A = 0.05 + 0.13 * uTension + 0.1 * uOverwhelm;
  vec3 s = vec3(0.0);
  vec2 k1 = vec2(0.42, 0.21), k2 = vec2(-0.17, 0.53), k3 = vec2(0.61, -0.44) * (1.0 + 0.8 * uTension);
  float a1 = A, a2 = A * 0.7, a3 = A * (0.25 + 0.75 * uTension);
  float f1 = dot(k1, p) + t * 0.7, f2 = dot(k2, p) - t * 0.55, f3 = dot(k3, p) + t * (1.3 + 1.4 * uTension);
  s.x = a1 * sin(f1) + a2 * sin(f2) + a3 * sin(f3);
  s.yz = a1 * k1 * cos(f1) + a2 * k2 * cos(f2) + a3 * k3 * cos(f3);
  // central rings breathing with the low band
  float r = length(p) + 1e-4;
  float ac = (0.025 + 0.12 * uLow) * exp(-r * 0.22);
  float fc = r * 1.6 - t * 1.4;
  s.x += ac * sin(fc);
  s.yz += (ac * 1.6 * cos(fc) - 0.22 * ac * sin(fc)) * (p / r);
  float e = smoothstep(uR, uR - 2.2, r);
  return s * e;
}

// h, dh/dx, dh/dz, white crest amount
vec4 sea_ripples(vec2 p) {
  vec4 o = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    vec4 R = uRip[i];
    float age = uNow - R.z;
    if (age < 0.0 || age > 7.0 || R.w <= 0.0) continue;
    float kind = floor(R.w / 10.0), str = R.w - kind * 10.0;
    vec2 dv = p - R.xy; float d = length(dv) + 1e-4;
    float speed = kind > 1.5 ? 6.5 : (kind > 0.5 ? 3.4 : 2.6);
    float wl = kind > 1.5 ? 0.8 : 0.6;
    float x = d - age * speed;
    float env = exp(-x * x / (wl * wl)) * exp(-age * (kind > 1.5 ? 0.35 : 0.6)) * str * smoothstep(0.0, 0.25, age);
    if (kind > 0.5 && kind < 1.5) env *= smoothstep(-0.1, 0.8, dot(dv / d, -normalize(R.xy + 1e-4)));
    float fq = 4.2, s = sin(x * fq), c = cos(x * fq);
    float amp = 0.16;
    o.x += amp * env * c;
    o.yz += amp * env * (-fq * s - 2.0 * x / (wl * wl) * c) * (dv / d);
    o.w += env * smoothstep(0.45, 1.0, c) * (kind > 1.5 ? 1.6 : 0.7);
  }
  float e = smoothstep(uR, uR - 1.2, length(p));
  return o * vec4(e, e, e, e);
}
