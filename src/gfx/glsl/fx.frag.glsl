// NON-MIND paint fx fragment: wet acrylic marks. Each kind computes
//   a   coverage (alpha), h   impasto height (lit from screen derivatives, wet specular),
//   m   mix colour 1 -> colour 2, wht   mix to paper (outlines, seams), ink   mix to ink.
// Cost: hash + value noise only (no simplex); at most 3 noise taps per pixel per kind.
// All colours come in as uniforms or per-instance token colours; display sRGB out.
uniform vec3 uPaper; uniform vec3 uInk;
varying vec2 vUv; varying float vK; varying float vAge; varying vec4 vC1; varying vec4 vC2; varying vec4 vX; varying vec3 vInfo;

const float FX_TAU = 6.2831853;
const float FX_PI = 3.1415927;

float fx_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float fx_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fx_n(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fx_h2(i), fx_h2(i + vec2(1.0, 0.0)), f.x), mix(fx_h2(i + vec2(0.0, 1.0)), fx_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fx_eo(float k) { k = clamp(k, 0.0, 1.0); return 1.0 - (1.0 - k) * (1.0 - k) * (1.0 - k); }
// back-out: soft ~10% overshoot, the "pop" of every mark
float fx_pop(float k) { k = clamp(k, 0.0, 1.0) - 1.0; return 1.0 + 2.2 * k * k * k + 1.2 * k * k; }
float fx_aa(float d, float w) { return smoothstep(w, -w, d); }

// Palette-knife / brush stroke in a strip. u 0..1 along (tail..head), v -1..1 across.
// hp/tp: head and tail positions along u. len: strip length in world units (bristle scale).
void fx_brush(float u, float v, float hp, float tp, float s, float len, out float a, out float h, out float m, out float wht) {
  float span = max(hp - tp, 1e-3), q = clamp((u - tp) / span, 0.0, 1.0);
  float inside = step(tp, u) * step(u, hp);
  float hw = 0.42 + 0.58 * smoothstep(0.0, 0.75, q);                 // dry thin tail -> loaded head
  float cap = smoothstep(1.0, 0.86, q) + 0.0;                        // rounded loaded head
  float rag = (fx_n(vec2(u * len * 3.0, s * 9.0)) - 0.5) * 0.28;
  float body = fx_aa(abs(v) - hw * (0.55 + 0.45 * cap) - rag, 0.08) * inside;
  float bristle = fx_n(vec2(v * 19.0 + s * 13.0, u * len * 0.8)) * 0.65 + fx_n(vec2(v * 47.0 + s * 3.0, u * len * 0.3)) * 0.35;
  float dry = (1.0 - q) * 0.85 - 0.1;
  body *= smoothstep(dry - 0.08, dry + 0.08, bristle + 0.1);
  a = body;
  h = body * (0.25 + 0.75 * q) * (0.55 + 0.45 * bristle) + body * smoothstep(0.75, 1.0, q) * 0.35;
  m = smoothstep(0.55, 1.0, abs(v) / max(hw, 1e-3)) * 0.6 + (1.0 - bristle) * 0.25;
  wht = body * smoothstep(0.78, 0.95, bristle) * 0.55 * q;           // wet glint streaks
}

// Irregular splash with satellites and an optional drip (drip > 0, screen-down = -y).
void fx_splat(vec2 p, float k, float s, float spike, float drip, out float a, out float h, out float m, out float wht) {
  float r = length(p), an = atan(p.y, p.x);
  float g = fx_pop(k / 0.24);
  float R = 0.5 * g;
  float edge = R * (1.0 + 0.32 * (fx_n(vec2(an * 1.9 + s * 20.0, s * 7.0)) - 0.5) + 0.1 * sin(an * 7.0 + s * 30.0));
  edge += R * spike * pow(max(0.0, sin(an * 4.0 + s * 11.0) * sin(an * 3.0 + s * 5.0)), 6.0) * 0.9;
  float body = fx_aa(r - edge, 0.025);
  float sat = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float aa = fx_h1(s * 17.0 + fi) * FX_TAU, dd = R * (1.25 + 0.75 * fx_h1(s * 5.0 + fi * 3.1)) * (0.8 + 0.35 * fx_eo(k / 0.4));
    float rr = (0.035 + 0.05 * fx_h1(s * 2.0 + fi * 7.7)) * g;
    sat = max(sat, fx_aa(length(p - vec2(cos(aa), sin(aa)) * dd) - rr, 0.02));
  }
  float dr = 0.0;
  if (drip > 0.0) {
    float x0 = (fx_h1(s * 3.3) - 0.5) * R * 0.9;
    float L = drip * smoothstep(0.18, 0.9, k) * 0.45;
    float y0 = -edge * 0.7, y = p.y - y0;
    float wd = 0.05 * (1.0 - 0.5 * clamp(-y / max(L, 1e-3), 0.0, 1.0));
    dr = fx_aa(abs(p.x - x0) - wd, 0.015) * step(-L, y) * step(y, 0.0);
    dr = max(dr, fx_aa(length(p - vec2(x0, y0 - L)) - 0.07, 0.015) * step(0.01, L));
  }
  a = max(body, max(sat, dr));
  float n = fx_n(p * 5.0 + s * 3.0);
  h = body * (0.45 + 0.35 * n) + fx_aa(abs(r - edge * 0.82) - 0.04, 0.03) * body * 0.45 + max(sat, dr) * 0.6;
  m = smoothstep(0.35, 0.8, n) * 0.85;
  // dries out: breakup grows toward the end
  float dryT = smoothstep(0.55, 1.0, k) * 1.05 - 0.1;
  a *= smoothstep(dryT - 0.06, dryT + 0.06, fx_n(p * 9.0 + s * 4.0) * 0.8 + 0.2 - 0.2 * r);
  wht = 0.0;
}

// White-outlined ring band (ref b): R radius, th band half-width.
void fx_ring(float r, float an, float R, float th, float s, out float a, out float h, out float wht) {
  float rr = R * (1.0 + 0.045 * sin(an * 3.0 + s * 10.0) + 0.04 * (fx_n(vec2(an * 2.0, s * 5.0)) - 0.5));
  float d = abs(r - rr);
  float band = fx_aa(d - th, 0.012);
  float outline = fx_aa(abs(d - th) - max(0.006, th * 0.28), 0.008);
  a = max(band, outline);
  h = band * 0.5 + outline * 0.35;
  wht = outline * 0.95;
}

void main() {
  int kind = int(vInfo.x + 0.5);
  float k = vK, s = vInfo.y, age = vAge;
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p), an = atan(p.y, p.x);
  float a = 0.0, h = 0.0, m = 0.0, wht = 0.0, ink = 0.0;
  float fade = 1.0;

  if (kind == 1 || kind == 31) {
    // hit splat (billboard, drips) / ground splash (no drip). vX.x spike, vX.y drip
    fx_splat(p, k, s, vX.x, vX.y, a, h, m, wht);
    fade = 1.0 - smoothstep(0.78, 1.0, k);
  } else if (kind == 2) {
    // miss: a pale dry scuff
    vec2 q = vec2(p.x * cos(s * 3.0) - p.y * sin(s * 3.0), p.x * sin(s * 3.0) + p.y * cos(s * 3.0));
    float hp = fx_eo(k / 0.45) * 1.0, u = q.x * 0.5 + 0.5;
    fx_brush(u, q.y * 2.2, hp, 0.0, s, 2.0, a, h, m, wht);
    float br = fx_n(vec2(q.y * 34.0, s * 9.0));
    a *= smoothstep(0.35, 0.6, br) * 0.85;
    h *= 0.3; wht = 0.6; m = 0.0;
    fade = 1.0 - smoothstep(0.5, 1.0, k);
  } else if (kind == 3) {
    // droplet: a glossy dome
    a = fx_aa(r - 0.8, 0.08);
    h = sqrt(max(0.0, 1.0 - r * r / 0.64)) * 0.9;
    m = smoothstep(0.2, 0.8, r) * 0.4;
  } else if (kind == 4) {
    // paint mote: a soft irregular dab with a paper rim
    float e = 0.72 + 0.18 * (fx_n(vec2(an * 1.5 + s * 10.0, s)) - 0.5);
    a = fx_aa(r - e, 0.1);
    h = a * (0.4 + 0.4 * (1.0 - r));
    wht = fx_aa(abs(r - e * 0.92) - 0.05, 0.04) * 0.6;
    m = r * 0.6;
    fade = smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.75, 1.0, k));
  } else if (kind == 5) {
    // spark: hot core, paper centre
    a = fx_aa(r - 0.55, 0.2);
    wht = smoothstep(0.35, 0.0, r);
    h = a * 0.5;
    m = smoothstep(0.1, 0.55, r);
  } else if (kind == 6) {
    // heal petal: a teardrop rising, with a paper vein
    vec2 q = vec2(p.x / (0.62 * (1.05 - p.y * 0.45)), p.y);
    float d = length(q) - 0.88;
    a = fx_aa(d, 0.06);
    wht = fx_aa(abs(p.x) - 0.025, 0.02) * step(p.y, 0.5) * a * 0.8 + fx_aa(abs(d + 0.06) - 0.035, 0.03) * 0.7;
    h = a * (0.5 - 0.3 * p.y);
    m = smoothstep(-0.8, 0.9, p.y);
    fade = smoothstep(0.0, 0.15, k) * (1.0 - smoothstep(0.6, 1.0, k));
  } else if (kind == 7) {
    // confetti fleck: a tumbling flake, two-sided
    float fl = cos(age * (6.0 + 6.0 * s) + s * 20.0);
    vec2 q = vec2(p.x / max(0.12, abs(fl)), p.y * 1.4);
    float rag = (fx_n(q * 3.0 + s * 9.0) - 0.5) * 0.25;
    a = fx_aa(max(abs(q.x), abs(q.y)) - 0.7 - rag, 0.06);
    m = step(0.0, fl);
    h = a * 0.4; wht = fx_aa(abs(max(abs(q.x), abs(q.y)) - 0.66 - rag) - 0.04, 0.03) * 0.5;
    fade = 1.0 - smoothstep(0.8, 1.0, k);
  } else if (kind == 8) {
    // subtract: a wedge carved out, ink-cut faces
    float half_ = 0.55, da = abs(mod(an - vX.x + FX_PI, FX_TAU) - FX_PI);
    float disc = fx_aa(r - 0.85, 0.03);
    float wedge = disc * fx_aa(da - half_, 0.04);
    a = wedge;
    ink = fx_aa(abs(da - half_) - 0.06, 0.03) * wedge * 0.8;
    wht = fx_aa(abs(r - 0.8) - 0.035, 0.02) * wedge;
    h = wedge * (0.5 + 0.3 * fx_n(p * 6.0 + s));
    m = fx_n(p * 4.0 + s) * 0.5;
    fade = 1.0 - smoothstep(0.7, 1.0, k);
  } else if (kind == 9) {
    // split: one blob tears in two along a white seam
    float tear = fx_eo((k - 0.18) / 0.5), sep = tear * 0.5;
    float wob = (1.0 - smoothstep(0.0, 0.2, k)) * 0.08 * sin(k * 60.0);
    float seamL = 0.07 * sin(p.y * 16.0 + s * 9.0) + 0.06 * (fx_n(vec2(p.y * 7.0, s)) - 0.5);
    vec2 qa = p + vec2(sep, 0.0), qb = p - vec2(sep, 0.0);
    float sa = 0.07 * sin(qa.y * 16.0 + s * 9.0) + 0.06 * (fx_n(vec2(qa.y * 7.0, s)) - 0.5);
    float sb = 0.07 * sin(qb.y * 16.0 + s * 9.0) + 0.06 * (fx_n(vec2(qb.y * 7.0, s)) - 0.5);
    float R0 = 0.52 * (1.0 + wob) * fx_pop(k / 0.15);
    float A_ = fx_aa(length(qa * vec2(1.0, 1.0 + wob)) - R0, 0.02) * fx_aa(qa.x - sa + 0.004 * tear, 0.01);
    float B_ = fx_aa(length(qb * vec2(1.0, 1.0 + wob)) - R0, 0.02) * fx_aa(sb - qb.x + 0.004 * tear, 0.01);
    a = max(A_, B_);
    float seam = max(A_ * fx_aa(abs(qa.x - sa) - 0.06 * smoothstep(0.0, 0.2, tear), 0.02), B_ * fx_aa(abs(qb.x - sb) - 0.06 * smoothstep(0.0, 0.2, tear), 0.02));
    seam = max(seam, fx_aa(abs(p.x - seamL) - 0.03, 0.015) * fx_aa(r - R0, 0.02) * (1.0 - smoothstep(0.0, 0.08, tear)) * smoothstep(0.08, 0.18, k));
    wht = seam;
    m = step(0.0, p.x);
    h = a * (0.55 + 0.3 * fx_n(p * 5.0 + s)) + seam * 0.4;
    fade = 1.0 - smoothstep(0.72, 1.0, k);
  } else if (kind == 10) {
    // repurpose: the form flattens into a stamp
    float e = fx_eo(k / 0.8);
    vec2 c = vec2(0.0, -0.55 * e);
    vec2 q = (p - c) / vec2(0.55 * (1.0 + 0.75 * e), 0.55 * (1.0 - 0.92 * e) + 0.02);
    float d = length(q) - 1.0;
    a = fx_aa(d, 0.06);
    wht = fx_aa(abs(d + 0.08) - 0.06, 0.04) * a;
    h = a * sqrt(max(0.0, 1.0 - dot(q, q))) * 0.8;
    m = e;
    fade = 1.0 - smoothstep(0.85, 1.0, k);
  } else if (kind == 11) {
    // mutation: glitch-shimmer shell, rows slide like misregistered prints
    float row = floor((p.y + 1.0) * 6.0), tick = floor(age * 26.0);
    float off = (fx_h2(vec2(row, tick + s * 50.0)) - 0.5) * 0.35 * (1.0 - k);
    vec2 q = vec2(p.x + off, p.y);
    float rq = length(q);
    float shell = fx_aa(abs(rq - 0.78 * fx_pop(k / 0.3)) - 0.09, 0.02);
    float gap = step(0.25, fx_h2(vec2(row * 3.0, tick)));
    a = shell * gap;
    m = mod(row, 2.0);
    wht = fx_aa(abs(abs(rq - 0.78 * fx_pop(k / 0.3)) - 0.09) - 0.015, 0.01) * a;
    h = a * 0.5;
    fade = 1.0 - smoothstep(0.6, 1.0, k);
  } else if (kind == 12) {
    // reset bloom: a white wave washes everything out, then fades to silence
    float R = fx_eo(k / 0.55) * 1.02;
    float e = R * (1.0 + 0.03 * sin(an * 5.0 + s * 9.0) + 0.04 * (fx_n(vec2(an * 3.0, s)) - 0.5));
    a = fx_aa(r - e, 0.03);
    float rim = fx_aa(abs(r - e + 0.04) - 0.035, 0.02);
    h = rim * 0.6;
    m = rim;
    wht = 1.0 - rim;
    fade = 1.0 - smoothstep(0.5, 1.0, k);
  } else if (kind == 14) {
    // ending: a slow white column of light-paint
    float x = vUv.x * 2.0 - 1.0, y = vUv.y;
    float grow = fx_eo(k / 0.35);
    float wd = 0.55 + 0.25 * sin(y * 9.0 - age * 1.2 + s * 4.0) * 0.3;
    float streak = fx_n(vec2(x * 13.0 + s * 4.0, y * 2.0 - age * 0.9));
    a = fx_aa(abs(x) - wd, 0.35) * step(y, grow) * smoothstep(grow, grow - 0.15, y);
    a *= 0.75 + 0.25 * streak;
    float bands = smoothstep(0.85, 1.0, sin((y * 4.0 - age * 0.7) * FX_TAU) * 0.5 + 0.5);
    wht = 1.0 - 0.45 * bands * smoothstep(0.1, 0.5, abs(x));
    m = 1.0;
    h = a * (0.3 + 0.4 * streak);
    fade = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.7, 1.0, k));
  } else if (kind == 20 || kind == 22) {
    // strike stroke (20) / retreat swoosh (22) along a ribbon: loaded head, dry tail
    float u = vUv.x, v = vUv.y * 2.0 - 1.0;
    float hp = fx_eo(k / 0.5) * 1.04, tp = smoothstep(0.3, 1.0, k) * 1.02;
    fx_brush(u, v, hp, tp, s, vX.y, a, h, m, wht);
    if (kind == 22) { a *= 0.9; wht += a * 0.15; }
  } else if (kind == 21) {
    // integrate braid ribbon: a twisting band with paper edges
    float u = vUv.x, v = vUv.y * 2.0 - 1.0;
    float hp = fx_eo(k / 0.55) * 1.05, tp = smoothstep(0.45, 1.0, k) * 1.02;
    float inside = step(tp, u) * step(u, hp);
    float body = fx_aa(abs(v) - 0.78, 0.08) * inside;
    float tw = fract(u * 7.0 - age * 3.0 + s);
    a = body;
    m = smoothstep(0.42, 0.5, tw) * smoothstep(1.0, 0.92, tw);
    wht = fx_aa(abs(abs(v) - 0.72) - 0.08, 0.04) * body;
    h = body * (0.5 + 0.4 * (1.0 - abs(v)));
  } else if (kind == 30) {
    // ring: vX.x start R, vX.y end R, vX.z half-width, vX.w ticks lit (link), vC2.a fill alpha
    float R = mix(vX.x, vX.y, fx_pop(k / 0.6) * 0.6 + fx_eo(k) * 0.4);
    float th = vX.z * (1.0 - 0.55 * k);
    float band, hh, ww;
    fx_ring(r, an, R, th, s, band, hh, ww);
    float fill = fx_aa(r - R, 0.02) * vC2.a * (1.0 - k);
    a = max(band, fill); h = hh; wht = ww; m = fill * (1.0 - band);
    if (vX.w > 0.0) {
      float cell = floor((an / FX_TAU + 0.5) * 12.0), lit = step(cell + 0.5, vX.w);
      float ca = (cell + 0.5) / 12.0 * FX_TAU - FX_PI;
      float dot_ = fx_aa(length(p - vec2(cos(ca), sin(ca)) * R) - th * 1.4, 0.01);
      a = max(a, dot_); wht = mix(wht, lit, dot_); ink = max(ink, dot_ * (1.0 - lit) * 0.8); h = max(h, dot_ * 0.7);
    }
    fade = 1.0 - smoothstep(0.55, 1.0, k);
  } else if (kind == 32) {
    // burst_affect kiln flare: yolk core, tangerine rays
    float R = fx_pop(k / 0.3) * 0.92;
    float n = fx_n(vec2(an * 3.0 + s * 7.0, age * 3.0));
    float ray = pow(abs(sin(an * 7.0 + s * 5.0 + n * 1.5)), 5.0);
    float e = R * (0.45 + 0.55 * ray);
    a = fx_aa(r - e, 0.04);
    m = smoothstep(0.15 * R, 0.9 * e, r);
    wht = smoothstep(0.25 * R, 0.0, r);
    ink = fx_aa(abs(r - e) - 0.02, 0.015) * 0.35;
    h = a * (0.4 + 0.5 * ray * (1.0 - r));
    fade = 1.0 - smoothstep(0.45, 1.0, k);
  } else if (kind == 33) {
    // heal rosette: soft concentric petals turning slowly
    float acc = 0.0, w2 = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i), R = (0.35 + fi * 0.25) * fx_pop((k - fi * 0.08) / 0.45);
      float pe = R * (0.75 + 0.25 * abs(cos((an + fi * 0.4 + age * (0.6 - fi * 0.3)) * 4.0)));
      float band = fx_aa(r - pe, 0.02) * (1.0 - fx_aa(r - pe + 0.11, 0.02));
      acc = max(acc, band); w2 = max(w2, fx_aa(abs(r - pe) - 0.012, 0.01) * step(0.01, R));
    }
    a = acc * 0.85; wht = w2; m = r; h = acc * 0.45;
    fade = 1.0 - smoothstep(0.55, 1.0, k);
  } else if (kind == 34) {
    // taunt: an ink star that pulses twice and hardens
    float R = 0.78 * (fx_pop(k / 0.3) + 0.12 * sin(k * FX_TAU * 2.0) * (1.0 - k));
    float e = R * (0.5 + 0.5 * pow(abs(cos(an * 5.0 + s)), 6.0));
    a = fx_aa(r - e, 0.02) * (1.0 - fx_aa(r - e * 0.55, 0.02) * 0.65);
    wht = fx_aa(abs(r - e) - 0.018, 0.012);
    h = a * 0.6; m = smoothstep(0.3, 0.9, r / max(e, 1e-3));
    fade = 1.0 - smoothstep(0.6, 1.0, k);
  } else if (kind == 35) {
    // transfer: two crescents trade places, a wound handed over
    float th = age * 7.0 + s * 6.0, d = 0.34 * fx_pop(k / 0.3);
    vec2 c1 = vec2(cos(th), sin(th)) * d, c2 = -c1;
    float A_ = fx_aa(length(p - c1) - 0.3, 0.02), B_ = fx_aa(length(p - c2) - 0.3, 0.02);
    float sw = fx_aa(abs(r - d) - 0.04, 0.02) * smoothstep(0.0, 1.0, fract((an - th) / FX_TAU)) * 0.6;
    a = max(max(A_, B_), sw);
    m = B_ * (1.0 - A_);
    wht = fx_aa(abs(length(p - c1) - 0.3) - 0.02, 0.012) + fx_aa(abs(length(p - c2) - 0.3) - 0.02, 0.012);
    h = max(A_, B_) * 0.6;
    fade = 1.0 - smoothstep(0.6, 1.0, k);
  } else if (kind == 36) {
    // equalize: a level line sweeps the arena, leaving a flattened wash behind it
    float yl = mix(-1.0, 1.0, fx_eo(k / 0.8));
    float inA = fx_aa(r - 0.97, 0.01);
    float line = fx_aa(abs(p.y - yl + 0.004 * sin(p.x * 40.0 + s)) - 0.011, 0.004);
    float halo = fx_aa(abs(p.y - yl) - 0.035, 0.015);
    float wash = step(p.y, yl) * smoothstep(yl - 0.6, yl, p.y) * (0.35 + 0.3 * fx_n(vec2(p.x * 3.0, p.y * 60.0)));
    a = inA * max(max(line, halo * 0.9), wash);
    wht = halo * (1.0 - line);
    m = wash * (1.0 - halo);
    h = line * 0.6 + halo * 0.3;
    fade = 1.0 - smoothstep(0.75, 1.0, k);
  } else if (kind == 37) {
    // waveLose: ink bleeds in from the rim
    float front = 1.0 - 0.24 * fx_eo(k / 0.6);
    float ten = fx_n(vec2(an * 5.0 + s * 3.0, age * 0.6)) * 0.12 + pow(fx_n(vec2(an * 19.0, s)), 3.0) * 0.16;
    float e = front - ten;
    a = smoothstep(e - 0.01, e + 0.04, r) * fx_aa(r - 0.985, 0.006);
    m = fx_aa(abs(r - e - 0.02) - 0.02, 0.02);
    h = m * 0.6 + a * 0.2 * fx_n(p * 14.0);
    ink = 0.0;
    fade = 1.0 - smoothstep(0.65, 1.0, k);
  } else if (kind == 38) {
    // waveStart spoke: a stroke from the gate (u=0) inward
    float u = vUv.x, v = vUv.y * 2.0 - 1.0;
    float hp = fx_eo(k / 0.45) * 1.04, tp = smoothstep(0.4, 1.0, k) * 1.02;
    fx_brush(u, v, hp, tp, s, vX.y, a, h, m, wht);
  } else if (kind == 39) {
    // repurpose stamp: a sealed print sinking into the sea, ripples out
    float sink = smoothstep(0.1, 1.0, k);
    float sq = max(abs(p.x), abs(p.y)) * 0.6 + r * 0.4;
    float S = 0.42 * fx_pop(k / 0.18) * (1.0 - 0.25 * sink);
    float body = fx_aa(sq - S, 0.02);
    float seal = fx_aa(abs(fract(r * 9.0 - age) - 0.5) - 0.12, 0.08) * body;
    float rip = 0.0;
    for (int i = 0; i < 2; i++) { float fi = float(i); float R = S + fx_eo(k - fi * 0.2) * 0.5; rip = max(rip, fx_aa(abs(r - R) - 0.012, 0.01) * step(fi * 0.2, k) * (1.0 - k)); }
    a = max(body, rip);
    m = seal * 0.6; ink = body * sink * 0.55; wht = rip + fx_aa(abs(sq - S) - 0.02, 0.012) * body;
    h = body * (0.4 + 0.3 * seal) * (1.0 - sink);
    fade = 1.0 - smoothstep(0.75, 1.0, k);
  } else if (kind == 40) {
    // blink: an ink hole closes, its paper rim flies out
    float R = 0.55 * (1.0 - fx_eo(k / 0.7)) * fx_pop(k / 0.12);
    float hole = fx_aa(r - R, 0.02);
    float rim = fx_aa(abs(r - (0.5 + 0.45 * fx_eo(k))) - 0.03 * (1.0 - k), 0.012);
    a = max(hole, rim); ink = hole; wht = rim; h = rim * 0.4 + hole * 0.2;
    fade = 1.0 - smoothstep(0.75, 1.0, k);
  } else if (kind == 41) {
    // invert: a disc that flips the colours under it (inverting blend), soft edge
    float R = fx_pop(k / 0.35) * 0.86;
    float e = R * (1.0 + 0.04 * sin(an * 4.0 + s * 9.0 + age * 3.0));
    a = fx_aa(r - e, 0.04) * (1.0 - smoothstep(0.55, 1.0, k)) * 0.92;
    gl_FragColor = vec4(vec3(a * vC1.a), 1.0);
    if (a < 0.004) discard;
    return;
  }

  a *= fade * vC1.a;
  vec3 col = mix(vC1.rgb, vC2.rgb, clamp(m, 0.0, 1.0));
  col = mix(col, uInk, clamp(ink, 0.0, 1.0));
  col = mix(col, uPaper, clamp(wht, 0.0, 1.0));
  // impasto: lit from screen-space slope of h, normalised to the quad's own pixel size
  float px = max(fwidth(vUv.x) + fwidth(vUv.y), 1e-4);
  vec2 sl = clamp(vec2(dFdx(h), dFdy(h)) / px * 0.03, -0.8, 0.8);
  vec3 n = normalize(vec3(-sl, 1.0)), L = normalize(vec3(-0.45, 0.6, 0.66));
  col *= mix(1.0, clamp(dot(n, L) / L.z, 0.45, 1.35), 0.55);
  col += uPaper * pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.4 * smoothstep(0.05, 0.35, h);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
