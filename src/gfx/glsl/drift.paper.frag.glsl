// Cut-paper planes that hang in the air. One program, three interiors (uPattern):
//   0 ring field (ref b): jittered cells of flat discs with wobbly white outlines, 3x3 cell search
//   1 impasto stripe field: flow-bent bands of alternating stage colours, knife-ridged
//   2 knife swirl (ref a): a vortex of palette-knife strokes around an off-centre eye
// Silhouette (uShape): 0 wobbly disc, 1 rounded slab, 2 crescent cut. A white cut edge, an offset
// ink shadow (the design system's chrome, in paper), impasto relief lit from screen derivatives, and a
// facing term so the card darkens and flips to its bare paper back as it turns.
// Cost per covered pixel: ring field 9 hashes + 3 noise; stripes 4 noise; swirl 5 noise; edge 1 noise.
#include "./drift.common.glsl"
uniform float uTime; uniform float uPattern; uniform float uShape; uniform float uDetail; uniform float uTear;
uniform float uFade; uniform float uFlash; uniform float uSeed; uniform float uPale; uniform float uAspect;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uD; uniform vec3 uPaper; uniform vec3 uInk;
uniform vec3 uLight;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;

vec3 pal(float id) { id = mod(id, 4.0); return id < 0.5 ? uA : id < 1.5 ? uB : id < 2.5 ? uC : uD; }

float shapeSD(vec2 p) {
  float a = atan(p.y, p.x);
  float wob = 0.025 * sin(a * 3.0 + uSeed) + 0.018 * sin(a * 7.0 - uTime * 0.3 + uSeed * 2.0);
  if (uShape < 0.5) return length(p) - 0.86 - wob;
  if (uShape < 1.5) { vec2 b = vec2(0.86, 0.86 * uAspect); vec2 q = abs(p) - b + 0.22; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.22 - wob * 0.6; }
  float d0 = length(p) - 0.86 - wob;
  float d1 = length(p - vec2(0.42, 0.26)) - 0.62;
  return max(d0, -d1);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.y /= (uShape > 0.5 && uShape < 1.5) ? 1.0 : 1.0;
  float sd = shapeSD(p);
  float px = fwidth(sd) * 1.2;
  // offset ink shadow: the same silhouette shifted, visible only outside the card
  float sdS = shapeSD(p - vec2(0.035, -0.05));
  float edgeN = dr_noise(vec2(atan(p.y, p.x) * 6.0 + uSeed, 2.0));
  float tear = uTear * smoothstep(0.55, 0.85, dr_noise(p * 3.0 + uSeed + floor(uTime * 0.5)));
  float inside = smoothstep(px, -px, sd + tear * 0.4);
  float shadowA = smoothstep(px, -px, sdS) * (1.0 - inside) * 0.55;
  if (inside + shadowA < 0.01) discard;

  bool front = gl_FrontFacing;
  vec3 N = normalize(vN); if (!front) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  float facing = dot(N, normalize(uLight));
  float t = uTime * 0.6 + uSeed * 7.0;
  vec3 col; float height = 0.0;

  if (!front) {
    // bare paper back with the interior faintly showing through
    col = mix(uPaper, uD, 0.12) * (0.9 + 0.05 * dr_noise(p * 40.0));
  } else if (uPattern < 0.5) {
    // ring field
    float cells = 3.0 + 3.0 * uDetail;
    vec2 g = p * cells;
    vec2 ip = floor(g), fp = fract(g);
    col = mix(uPaper, pal(uSeed + 3.0), 0.35);
    float best = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      float h = dr_hash(ip + o + uSeed);
      vec2 c = o + 0.5 + (vec2(h, dr_hash(ip + o + 7.7)) - 0.5) * 0.6 + 0.08 * vec2(sin(t * 0.7 + h * 9.0), cos(t * 0.5 + h * 6.0));
      float R = 0.28 + 0.2 * h;
      float dd = length(fp - c);
      float rr = R * (1.0 + 0.07 * sin(atan(fp.y - c.y, fp.x - c.x) * 2.0 + h * 9.0));
      if (dd - rr < best) {
        best = dd - rr;
        vec3 fill = pal(floor(h * 4.0) + uSeed);
        float th = 0.07 + 0.03 * dr_noise(vec2(atan(fp.y - c.y, fp.x - c.x) * 3.0, h * 9.0));
        float fpx = fwidth(dd) * 1.2;
        float disc = smoothstep(rr - th + fpx, rr - th - fpx, dd);
        float band = smoothstep(th + fpx, th - fpx, abs(dd - rr));
        float dry = dr_bristle(atan(fp.y - c.y, fp.x - c.x) * 0.4 + h);
        col = mix(col, fill, disc * (h > 0.2 ? 1.0 : 0.0));
        col = mix(col, uInk, smoothstep(0.12, 0.0, dd) * step(0.75, h) * 0.9);
        col = mix(col, uPaper, band * smoothstep(0.2, 0.45, dry));
        height = max(height, band * 0.6 + disc * 0.25);
      }
    }
  } else if (uPattern < 1.5) {
    // impasto stripes
    vec2 q = p * dr_rot(uSeed);
    q.x += (dr_fbm(q * 1.3 + vec2(0.0, t * 0.08)) - 0.5) * (0.6 + 0.6 * uDetail);
    float k = q.x * (3.5 + 3.0 * uDetail) + dr_noise(q * 4.0) * 0.4;
    float id = floor(k), f = fract(k);
    col = pal(id + uSeed);
    float ridge = smoothstep(0.0, 0.18, f) * smoothstep(1.0, 0.72, f);
    float bris = dr_bristle(f * 0.6 + id * 0.37 + q.y * 0.05);
    col = mix(col, pal(id + uSeed + 1.0), smoothstep(0.6, 0.95, f) * 0.6);
    col = mix(col, uPaper, (1.0 - ridge) * 0.8 * smoothstep(0.35, 0.6, bris));
    height = ridge * (0.5 + 0.5 * bris);
  } else {
    // knife swirl
    vec2 c = vec2(-0.18, 0.12);
    vec2 d = p - c;
    float r = length(d), a = atan(d.y, d.x);
    float sw = a + r * (2.6 + 2.0 * uDetail) - t * 0.18 + (dr_fbm(p * 2.4 + t * 0.05) - 0.5) * 1.4;
    float k = sw / 6.2831 * (5.0 + 3.0 * uDetail);
    float id = floor(k), f = fract(k);
    float rag = dr_noise(vec2(id * 3.1, r * 6.0)) * 0.3;
    float m = smoothstep(0.05, 0.14, f + rag * 0.3) * smoothstep(0.95, 0.66 - rag, f);
    col = mix(uPaper, pal(id + uSeed), m);
    float dry = dr_bristle(f * 0.5 + id * 0.21);
    col = mix(col, uPaper, m * smoothstep(0.55, 0.85, dry) * 0.7);
    col = mix(col, uInk, smoothstep(0.09, 0.03, r) * 0.9);
    height = m * (0.4 + 0.6 * f);
  }

  // impasto relief from derivatives
  vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 2.2, -0.6, 0.6);
  vec3 nrm = normalize(vec3(-slope, 1.0));
  vec3 Ls = normalize(vec3(-0.4, 0.6, 0.7));
  col *= mix(1.0, dot(nrm, Ls) / Ls.z, 0.5);
  col += pow(max(dot(nrm, normalize(Ls + vec3(0.0, 0.0, 1.0))), 0.0), 40.0) * 0.16 * smoothstep(0.05, 0.3, height);
  // card lighting: three painted bands by facing, a paper sheen at grazing angles
  col *= 0.72 + 0.32 * dr_cel(clamp(facing * 0.5 + 0.5, 0.0, 1.0));
  col = mix(col, uPaper, pow(1.0 - abs(dot(N, V)), 4.0) * 0.4);
  // white cut edge
  float edge = smoothstep(px, -px, abs(sd + 0.028) - 0.028 - 0.012 * edgeN);
  col = mix(col, uPaper, edge * inside);
  col = mix(col, uPaper, uPale * 0.7);
  col = mix(col, uInk, shadowA > 0.0 && inside < 0.5 ? 0.8 : 0.0);
  col = mix(col, uPaper, uFlash);
  float a = max(inside, shadowA);
  if (dr_hash(gl_FragCoord.xy * 0.77 + uSeed) < 1.0 - uFade) discard;
  gl_FragColor = vec4(col, a);
}
