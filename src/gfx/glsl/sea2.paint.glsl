// ContainedSea paint: the surface is a painting that never dries.
// Seven "movements" cross-faded by stage (weights computed in JS, normalised; at most 2-3 live at once,
// each behind a uniform branch, so a pixel only pays for the live ones).
//
// Noise budget per pixel: shared flow 1 psrdnoise(2D, gradient) + per live movement:
//   a canvas 1 snoise | b marbling 2 | c kaleido 1 | d colonies 0 (2x2 cells) | e reaction 2 | f fold 0 (9 folds) | g overwhelm 1 (2x2 cells)
// Worst case (two live + overwhelm) is 1 psrdnoise + 4 snoise. Everything else is hash / analytic.
#include "/lygia/generative/psrdnoise.glsl"
#include "/lygia/generative/snoise.glsl"

uniform vec3 uPal[5];      // stage slots in display sRGB, rotated by depth: primary, secondary, accent, glow, tertiary
uniform vec3 uGround;      // stage ground
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uMagenta;
uniform vec3 uUltra;
uniform vec4 uMoveA;       // a canvas, b marbling, c kaleidoscope, d ring colonies
uniform vec4 uMoveB;       // e reaction, f fold, g overwhelm, (unused)

float sp_h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2  sp_h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float sp_h0(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float sp_vn(float x) { float i = floor(x), f = fract(x); return mix(sp_h0(i), sp_h0(i + 1.0), f * f * (3.0 - 2.0 * f)); }
vec3  sp_pal(float x) { return uPal[int(mod(floor(x), 5.0))]; }
mat2  sp_rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// smooth-edged band with a pixel-width antialias from a field and its fwidth
float sp_aa(float d, float w) { return 1.0 - smoothstep(-w, w, d); }

struct SeaCtx { vec2 p; float r; float a; vec2 g; vec2 N; float fn; float t; };

// (a) bare canvas: weave, a faint wash, ONE slow ring breathing from the core (dry brush)
vec4 mv_canvas(SeaCtx c) {
  vec3 col = uGround;
  float weave = sin(c.p.x * 34.0) * sin(c.p.y * 34.0 + sin(c.p.x * 3.0));
  col *= 1.0 - 0.03 * (weave * 0.5 + 0.5);
  float wash = snoise(vec3(c.p * 0.16 + c.g * 0.35, c.t * 0.03));
  col = mix(col, uPal[1], 0.14 * smoothstep(-0.1, 0.9, wash));
  col = mix(col, uPal[0], 0.1 * smoothstep(6.0, 1.5, c.r));
  float R = 4.8 + 1.1 * sin(c.t * 0.32) + 0.9 * uLow;
  float d = abs(c.r - R - 0.22 * wash);
  float th = 0.2 + 0.05 * sin(c.a * 3.0 + c.t * 0.2);
  float dry = sp_vn(c.a * 46.0 + c.r * 3.0) * 0.6 + sp_vn(c.a * 113.0) * 0.4;
  float tail = 0.5 + 0.5 * sin(c.a - c.t * 0.12);                      // loaded start -> dry tail
  float band = smoothstep(th, th * 0.35, d) * smoothstep(tail * 0.55 - 0.05, tail * 0.55 + 0.08, dry);
  col = mix(col, uPal[0], band * 0.92);
  float hair = smoothstep(0.03, 0.0, abs(c.r - R * 0.62 - 0.1 * wash)) * 0.35;
  col = mix(col, uInk, hair * smoothstep(0.3, 0.7, dry));
  return vec4(col, band * 0.55 + hair * 0.1 + 0.03 * weave);
}

// (b) flow-field marbling: two advection steps, veined bands, bristle drag across the flow
vec4 mv_marble(SeaCtx c) {
  vec2 q = c.p * 0.15 + c.g * 0.6;
  float n1 = snoise(vec3(q, c.t * 0.04));
  q += vec2(-c.N.y, c.N.x) * n1 * 0.45 + c.N * n1 * 0.2;
  float n2 = snoise(vec3(q * 1.8 + 3.1, c.t * 0.05));
  float v = (n1 * 1.3 + n2 * 0.6 + c.fn * 0.5) * 2.2 + c.r * 0.06;
  float f = fract(v), id = floor(v);
  vec3 col = mix(sp_pal(id), sp_pal(id + 1.0), smoothstep(0.82, 0.93, f));
  float w = fwidth(v) * 1.2 + 0.01;
  float vein = sp_aa(abs(f - 0.5) - 0.47, w);                            // paper vein at each band seam
  float across = dot(c.p, c.N);
  float br = sp_vn(across * 26.0) * 0.6 + sp_vn(across * 71.0) * 0.4;
  col *= 0.9 + 0.2 * br;
  col = mix(col, uPaper, vein * 0.9);
  float inkv = sp_aa(abs(fract(v * 0.5 + 0.25) - 0.5) - 0.485, w);       // every other seam carries ink
  col = mix(col, uInk, inkv * 0.6);
  return vec4(col, 0.25 * br + 0.35 * vein + 0.2 * smoothstep(0.0, 0.9, f));
}

// (c) ten-fold kaleidoscope: mirror sectors whose edges are the ten gate spokes
vec4 mv_kaleido(SeaCtx c) {
  float seg = 6.2831853 / 10.0;
  float am = abs(mod(c.a + seg * 0.5, seg) - seg * 0.5);                 // 0 on a gate spoke
  vec2 k = c.r * vec2(cos(am), sin(am));
  float n = snoise(vec3(k * 0.3, c.t * 0.035));
  float rings = c.r * 0.5 + n * 0.9 - c.t * 0.05;
  float petal = k.y * 1.4 - sin(k.x * 0.8 - c.t * 0.18) * 0.9 + n * 0.5;
  float ri = floor(rings), pi = floor(petal);
  vec3 col = sp_pal(ri * 2.0 + pi);
  col = mix(col, uGround, 0.25 * step(0.5, fract((ri + pi) * 0.5)));
  float wr = fwidth(rings) + 0.01, wp = fwidth(petal) + 0.01;
  float lr = sp_aa(abs(fract(rings) - 0.5) - 0.46, wr);
  float lp = sp_aa(abs(fract(petal) - 0.5) - 0.46, wp);
  col = mix(col, uInk, max(lr, lp) * 0.85);
  float spoke = sp_aa(am * c.r - 0.05 - 0.02 * c.r * 0.1, 0.03) * smoothstep(1.6, 3.0, c.r);
  col = mix(col, uPaper, spoke);
  float dotc = sp_aa(length(fract(vec2(rings, petal)) - 0.5) - 0.12, 0.05);   // a bead in each glass cell
  col = mix(col, uPaper, dotc * 0.8);
  return vec4(col, 0.3 * max(lr, lp) + 0.5 * spoke + 0.4 * dotc + 0.1);
}

// (d) white-outlined ring colonies that drift, merge (smooth union) and split (drift apart)
vec4 mv_colonies(SeaCtx c) {
  vec2 q = c.p * 0.27 + c.g * 0.12 + vec2(c.t * 0.025, -c.t * 0.018);
  vec2 base = floor(q - 0.5);
  float d = 10.0, dn = 10.0, id = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 cc = base + vec2(float(i), float(j));
    vec2 h = sp_h2(cc);
    vec2 ctr = cc + 0.5 + 0.3 * vec2(sin(c.t * (0.11 + 0.2 * h.x) + h.y * 6.28), cos(c.t * (0.09 + 0.2 * h.y) + h.x * 6.28));
    float rad = 0.2 + 0.13 * sin(c.t * 0.21 + h.x * 9.0);
    float di = length(q - ctr) - rad;
    float hh = clamp(0.5 + 0.5 * (d - di) / 0.22, 0.0, 1.0);
    d = mix(d, di, hh) - 0.22 * hh * (1.0 - hh);
    if (di < dn) { dn = di; id = sp_h1(cc + 7.0); }
  }
  vec3 bg = mix(sp_pal(floor(c.fn * 1.6 + 2.0) + 2.0), uGround, 0.2);
  float w = fwidth(d) + 0.004;
  vec3 col = bg;
  col = mix(col, sp_pal(id * 5.0), sp_aa(d, w));
  float outline = sp_aa(abs(d) - 0.045, w);
  float inner = sp_aa(abs(d + 0.11) - 0.014, w);
  float pip = sp_aa(dn + 0.17 + 0.03 * sin(c.t + id * 20.0), w);
  float streak = sp_vn(atan(q.y - base.y, q.x - base.x) * 9.0 + id * 30.0);
  col = mix(col, uInk, inner * 0.7);
  col = mix(col, sp_pal(id * 5.0 + 2.0), pip);
  col = mix(col, uPaper, outline * (0.75 + 0.25 * streak));
  float dry = smoothstep(0.62, 0.8, sp_vn(dot(c.p, c.N) * 30.0)) * 0.12;   // dry streak across the ground
  col = mix(col, uPaper, dry * (1.0 - sp_aa(d, w)));
  return vec4(col, 0.6 * outline + 0.2 * sp_aa(d, w) + 0.3 * pip);
}

// (e) reaction-diffusion look: band-limited noise thresholded; spots near the core, labyrinths outward
vec4 mv_reaction(SeaCtx c) {
  vec2 q = c.p * 0.62 + c.g * 0.25;
  float n = snoise(vec3(q, c.t * 0.02)) * 0.7 + snoise(vec3(q * 2.05 + 7.3, c.t * 0.03)) * 0.3;
  float thr = mix(0.42, 0.0, smoothstep(2.5, 9.5, c.r + 1.6 * sin(c.t * 0.05 + c.a * 2.0)));
  float f = n - thr;
  float w = fwidth(f) + 0.006;
  float m = sp_aa(-f, w);
  float rim = sp_aa(abs(f) - 0.035, w);
  float core = sp_aa(-(f - 0.16), w);
  vec3 col = mix(uPal[2], uGround, 0.15);
  col = mix(col, uPal[0], m);
  col = mix(col, uPal[3], core * 0.8);
  col = mix(col, uPaper, rim);
  col = mix(col, uInk, sp_aa(abs(f + 0.12) - 0.01, w) * 0.45);           // ghost contour outside
  return vec4(col, 0.35 * m + 0.4 * rim + 0.15 * core);
}

// (f) folded interference: iterative domain folding, orbit-trap colouring, thin paper interference lines
vec4 mv_fold(SeaCtx c) {
  vec2 z = sp_rot(c.t * 0.012) * c.p * 0.085 + c.g * 0.02;
  z = vec2(abs(z.x), z.y);
  vec2 C = vec2(-0.64, -0.52) + 0.07 * vec2(sin(c.t * 0.06), cos(c.t * 0.045));
  float t1 = 10.0, t2 = 10.0, acc = 0.0;
  for (int i = 0; i < 9; i++) {
    z = abs(z) / clamp(dot(z, z), 0.12, 1.2) + C;
    t1 = min(t1, abs(z.y));
    t2 = min(t2, length(z - vec2(0.25, 0.1)));
    acc += exp(-6.0 * abs(dot(z, z) - 0.5));
  }
  float v = t2 * 5.0 + acc * 0.25;
  vec3 col = mix(sp_pal(floor(v)), sp_pal(floor(v) + 1.0), smoothstep(0.7, 0.95, fract(v)));
  float w1 = fwidth(t1) * 1.5 + 0.002;
  col = mix(col, uInk, sp_aa(t1 - 0.012, w1) * 0.8);
  float il = sin(acc * 9.0 + c.t * 0.3) ;
  float wl = fwidth(acc * 9.0) + 0.05;
  col = mix(col, uPaper, smoothstep(0.92 - wl * 0.3, 1.0, il) * 0.7);
  col = mix(col, uGround, smoothstep(0.35, 0.0, t2) * 0.5);
  return vec4(col, 0.3 * smoothstep(0.0, 1.0, fract(v)) + 0.3 * smoothstep(0.9, 1.0, il));
}

// (g) overwhelm: white canvas floods in; magenta and ultramarine splashes with spikes and satellites
vec4 mv_flood(SeaCtx c) {
  vec3 col = uPaper;
  vec2 q = c.p * 0.27;
  vec2 base = floor(q - 0.5);
  float rag = snoise(vec3(c.p * 0.9, c.t * 0.08)) * 0.06;
  float h = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 cc = base + vec2(float(i), float(j));
    float seed = sp_h1(cc);
    float ph = c.t * 0.07 + seed;
    float ep = floor(ph), life = fract(ph);
    vec2 hh = sp_h2(cc + ep * 13.1);
    vec2 ctr = cc + 0.25 + 0.5 * hh;
    vec2 dv = q - ctr; float dl = length(dv);
    float an = atan(dv.y, dv.x);
    float grow = smoothstep(0.0, 0.12, life) * (0.65 + 0.35 * uOverwhelm);
    float rad = (0.12 + 0.2 * hh.x) * grow;
    float spikes = pow(abs(sin(an * (3.0 + floor(hh.y * 4.0)) + hh.x * 6.0)), 14.0) * 0.6 * rad;
    float d = dl - rad - spikes - rag * rad * 3.0;
    vec3 sc = hh.y > 0.5 ? uMagenta : uUltra;
    float m = sp_aa(d, 0.012);
    float sat = 0.0;
    for (int s = 0; s < 2; s++) {   // satellites
      float fs = float(s);
      vec2 o = vec2(cos(hh.x * 30.0 + fs * 2.1), sin(hh.x * 30.0 + fs * 2.1)) * rad * (1.6 + 0.5 * fs);
      sat = max(sat, sp_aa(length(dv - o) - rad * (0.16 - 0.04 * fs), 0.01));
    }
    m = max(m, sat * grow);
    vec3 cc2 = mix(sc, mix(sc, uInk, 0.45), sp_aa(d + rad * 0.55, 0.02));
    col = mix(col, cc2, m * (1.0 - smoothstep(0.85, 1.0, life)));
    h = max(h, m * 0.7);
  }
  return vec4(col, h);
}

// The whole surface. Returns colour; height (paint impasto 0..~1) through `hgt`.
vec3 sea_paint(vec2 p, out float hgt) {
  SeaCtx c;
  c.p = p; c.r = length(p); c.a = atan(p.y, p.x); c.t = uT;
  vec2 g;
  c.fn = psrdnoise(p * 0.1 + vec2(0.0, c.t * 0.015), vec2(0.0), c.t * 0.12, g);
  c.g = g; c.N = normalize(g + vec2(1e-4, 0.0));
  vec3 col = vec3(0.0); float h = 0.0; vec4 m;
  if (uMoveA.x > 0.003) { m = mv_canvas(c);   col += m.rgb * uMoveA.x; h += m.a * uMoveA.x; }
  if (uMoveA.y > 0.003) { m = mv_marble(c);   col += m.rgb * uMoveA.y; h += m.a * uMoveA.y; }
  if (uMoveA.z > 0.003) { m = mv_kaleido(c);  col += m.rgb * uMoveA.z; h += m.a * uMoveA.z; }
  if (uMoveA.w > 0.003) { m = mv_colonies(c); col += m.rgb * uMoveA.w; h += m.a * uMoveA.w; }
  if (uMoveB.x > 0.003) { m = mv_reaction(c); col += m.rgb * uMoveB.x; h += m.a * uMoveB.x; }
  if (uMoveB.y > 0.003) { m = mv_fold(c);     col += m.rgb * uMoveB.y; h += m.a * uMoveB.y; }
  if (uMoveB.z > 0.003) { m = mv_flood(c);    col += m.rgb * uMoveB.z; h += m.a * uMoveB.z; }
  // central rings, pulsed by the low band (always, faint)
  float cr = smoothstep(0.06, 0.0, abs(fract(c.r * 0.9 - c.t * 0.25) - 0.5) - 0.44) * smoothstep(3.8, 1.6, c.r);
  float pulse = 0.12 + 0.55 * uLow;
  col = mix(col, uPaper, cr * pulse);
  hgt = h + cr * pulse * 0.3;
  return col;
}
