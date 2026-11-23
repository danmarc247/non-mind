// 1. Painterly filter: anisotropic generalized Kuwahara, 4 sectors.
// Orientation from the local structure tensor (Sobel on perceptual luminance);
// flat regions borrow a slowly drifting flow field so they still get strokes.
// defines: RINGS, ANGLES (taps per sector = RINGS*ANGLES), WIDE_TENSOR (0/1)

uniform float uStrength;  // 0..1 blend
uniform float uRadius;    // brush radius in px at 720p
uniform float uTime;
uniform float uComplexity;

float pp_kl(vec2 uv) {
  return pp_plum(texture2D(inputBuffer, uv).rgb);
}

vec3 pp_tensor(vec2 uv, vec2 d) {
  float tl = pp_kl(uv + vec2(-d.x, d.y));
  float tc = pp_kl(uv + vec2(0.0, d.y));
  float tr = pp_kl(uv + vec2(d.x, d.y));
  float ml = pp_kl(uv + vec2(-d.x, 0.0));
  float mr = pp_kl(uv + vec2(d.x, 0.0));
  float bl = pp_kl(uv + vec2(-d.x, -d.y));
  float bc = pp_kl(uv + vec2(0.0, -d.y));
  float br = pp_kl(uv + vec2(d.x, -d.y));
  float gx = (tr + 2.0 * mr + br - tl - 2.0 * ml - bl) * 0.25;
  float gy = (tl + 2.0 * tc + tr - bl - 2.0 * bc - br) * 0.25;
  return vec3(gx * gx, gy * gy, gx * gy);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float scale = resolution.y / 720.0;
  float asp = resolution.x / resolution.y;
  vec2 q = vec2(uv.x * asp, uv.y);

  // --- structure tensor ---
  vec3 st = pp_tensor(uv, texelSize * max(1.0, 1.25 * scale));
#if WIDE_TENSOR == 1
  st = st * 0.6 + pp_tensor(uv, texelSize * 3.0 * max(1.0, scale)) * 0.4;
#endif
  float E = st.x;
  float G = st.y;
  float F = st.z;
  float disc = sqrt(max((E - G) * (E - G) + 4.0 * F * F, 0.0));
  float l1 = 0.5 * (E + G + disc);
  float l2 = 0.5 * (E + G - disc);
  vec2 tng = vec2(l1 - E, -F);
  float tl = length(tng);
  tng = tl > 1e-7 ? tng / tl : vec2(0.0, 1.0);
  float aniso = (l1 + l2) > 1e-7 ? (l1 - l2) / (l1 + l2) : 0.0;

  // blend toward the flow field where there is no structure
  float structure = smoothstep(0.00004, 0.0025, l1);
  vec2 flow = pp_flowDir(q * (1.0 + uComplexity), uTime);
  vec2 dir = normalize(mix(flow, tng * sign(dot(tng, flow) + 1e-4), structure));
  aniso = mix(0.55, aniso, structure);

  // hand jitter of the stroke frame
  float jit = pp_vnoise(q * 14.0) - 0.5;
  float cs = cos(jit * 0.35);
  float sn = sin(jit * 0.35);
  dir = vec2(cs * dir.x - sn * dir.y, sn * dir.x + cs * dir.y);
  vec2 nrm = vec2(-dir.y, dir.x);

  // brush size varies across the canvas; shrinks on strong edges so small
  // game units survive (legibility at overwhelm 0)
  float edge = smoothstep(0.004, 0.03, l1);
  float r = uRadius * scale * (0.7 + 0.6 * pp_vnoise(q * 3.3 + 11.0)) * mix(1.0, 0.55, edge);
  float ra = r * (1.0 + aniso);            // along stroke
  float rb = r / (1.0 + 0.8 * aniso);      // across stroke
  vec2 ax = dir * ra * texelSize;
  vec2 bx = nrm * rb * texelSize;

  vec3 c0 = texture2D(inputBuffer, uv).rgb;
  vec3 p0 = pp_perc(c0);

  vec3 sumC = vec3(0.0);
  float sumW = 0.0;

  for (int s = 0; s < 4; s++) {
    float base = float(s) * 1.5707963;
    vec3 mC = c0;
    vec3 mP = p0;
    vec3 mP2 = p0 * p0;
    float n = 1.0;
    for (int i = 0; i < RINGS; i++) {
      float rho = (float(i) + 1.0) / float(RINGS);
      for (int j = 0; j < ANGLES; j++) {
        float th = base + (float(j) + 0.5) / float(ANGLES) * 1.5707963 - 0.7853982;
        vec2 o = ax * (cos(th) * rho) + bx * (sin(th) * rho);
        vec3 c = texture2D(inputBuffer, uv + o).rgb;
        vec3 p = pp_perc(c);
        mC += c;
        mP += p;
        mP2 += p * p;
        n += 1.0;
      }
    }
    mC /= n;
    mP /= n;
    vec3 v = max(mP2 / n - mP * mP, 0.0);
    float var = v.r + v.g + v.b;
    float w = 1.0 / (1.0 + pow(var * 900.0, 3.0));
    sumC += mC * w;
    sumW += w;
  }

  vec3 k = sumC / max(sumW, 1e-6);
  outputColor = vec4(mix(c0, k, uStrength), inputColor.a);
}
