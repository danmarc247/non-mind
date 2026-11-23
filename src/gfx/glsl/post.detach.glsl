// Detachment stage: lifts the arena off the far composition. Runs inside the
// Relief pass (same depth/convolution pass, no extra full-screen pass):
//   pp_softFocus  tilt-shift + depth soft focus, depth-aware gather (no near bleed)
//   pp_cutout     paper halo behind near silhouettes, ink line on them
//   pp_aerial     aerial perspective in paint: distance -> ground colour, cooler, flatter
// All patterns are screen-anchored or depth-derived; nothing time-varying, so a
// rotating camera does not make them crawl.
// defines: FOCUS_TAPS, HALO_TAPS

uniform float uFocus;     // soft focus strength (0 = off)
uniform float uAerial;    // aerial perspective strength
uniform float uHalo;      // cut-out halo strength
uniform vec2 uFocusDist;  // view distance: soft focus starts .x, full .y
uniform vec3 uHaze;       // ground colour with a faint cool tint (pipeline space)
uniform vec3 uHaloColor;  // stage ground / paper (pipeline space)

float pp_dz(vec2 uv) {
  return -getViewZ(readDepth(uv));
}

vec3 pp_softFocus(vec2 uv, vec3 c0, float z0, float scale) {
  // tilt-shift band: crisp middle, soft top and bottom of the frame
  float tilt = smoothstep(0.24, 0.5, abs(uv.y - 0.47));
  float far = smoothstep(uFocusDist.x, uFocusDist.y, z0);
  float r = uFocus * max(tilt * 3.2, far * 4.0) * scale;
  if (r < 0.35) return c0;
  vec3 acc = c0;
  float wsum = 1.0;
  for (int i = 0; i < FOCUS_TAPS; i++) {
    float fi = float(i);
    float a = fi * 2.39996 + 0.6;
    float rr = r * sqrt((fi + 0.5) / float(FOCUS_TAPS));
    vec2 o = vec2(cos(a), sin(a)) * rr * texelSize;
    float zi = pp_dz(uv + o);
    // a nearer sample must not bleed into a farther pixel (keeps units crisp)
    float w = smoothstep(z0 * 0.82, z0 * 0.94, zi);
    acc += texture2D(inputBuffer, uv + o).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}

// x: halo (this pixel lies just behind a nearer silhouette)
// y: ink (this pixel is the near side of a depth edge)
vec2 pp_cutout(vec2 uv, float z0, float scale) {
  float front = 0.0;
  float back = 0.0;
  for (int i = 0; i < HALO_TAPS; i++) {
    float fi = float(i);
    float ring = mod(fi, 2.0);
    float a = fi * (6.2831853 / float(HALO_TAPS)) + ring * 0.39;
    float rr = (1.4 + ring * 1.4) * scale;
    vec2 o = vec2(cos(a), sin(a)) * rr * texelSize;
    float zi = pp_dz(uv + o);
    float rel = (zi - z0) / max(min(zi, z0), 1e-3);
    back = max(back, rel);
    front = max(front, -rel);
  }
  return vec2(smoothstep(0.14, 0.5, front), smoothstep(0.04, 0.14, back));
}

vec3 pp_aerial(vec3 c, float z0, float near) {
  // layered recession: ~0.1 at 60 units, ~0.2 for the sky dome (sky stays a painting)
  float k = (1.0 - exp(-max(z0 - near, 0.0) / 60.0)) * 0.2 * uAerial;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), k * 0.8);            // lose saturation
  return mix(c, uHaze, k);                   // lose contrast toward the ground
}
