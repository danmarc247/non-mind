// PainterSky fragment: a living acrylic painting on the inside of a sphere.
// Everything is a function of the 3D view direction -> no UV seams, no pole pinch.
//
// Noise budget per pixel (main path): 1 psrdnoise (flow + warp, gradient for free),
// 2 snoise (colour masses), 1 snoise (scratch contours), +1 snoise only when overwhelm > 0.
// Everything else (strokes, bristles, flecks, rings, drips, weave) is hash / analytic.

#include "/lygia/generative/psrdnoise.glsl"
#include "/lygia/generative/snoise.glsl"
#include "/lygia/generative/random.glsl"

uniform float uTime;
uniform float uComplexity;
uniform float uOverwhelm;
uniform float uFlash;
uniform vec3  uAudio;        // low, mid, high
uniform vec3  uPal[8];       // stage hue slots (rotated by depth) + 3 on-token blends; 0..2 dominate
uniform float uSat;          // stage saturation (0.22 .. 1.3)
uniform float uContrast;     // stage contrast around the ground (0.8 .. 1.28)
// Stage motifs, 0..1 each, ramped in JS so every stage adds something visible:
uniform vec4  uMotifA;       // wash, scratch, flecks, giant strokes
uniform vec4  uMotifB;       // ring cells, knife smear, impasto, small strokes
uniform vec4  uMotifC;       // swirl, ink accents, clustered discs, drips
uniform vec4  uMotifD;       // tear, chord, collapse (stage 17), stroke density
uniform vec3  uPaper;
uniform vec3  uInk;
uniform vec3  uMagenta;
uniform vec3  uUltra;
uniform vec4  uRings[6];     // xyz = centre direction, w = radius (chord)
uniform vec4  uRingFill[6];  // rgb = fill colour, a = fill opacity

varying vec3 vDir;

// ---------------------------------------------------------------- helpers
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// cheap 1D value noise for bristle streaks
float vnoise1(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
}

vec3 pal(float x) {
  int i = int(clamp(floor(fract(x) * 8.0), 0.0, 7.0));
  return uPal[i];
}

// biased palette pick: first entries (rotated by depth) dominate
vec3 palBiased(float h, float region) {
  float x = pow(h, 1.7) * 0.75 + region;
  return pal(x);
}

// --------------------------------------------------------------- strokes
// One layer of palette-knife strokes living in 3D cells, drawn in the
// tangent plane of the sphere using the pixel's flow frame (T,B).
// Keeps the two highest-priority strokes covering this pixel.
void strokeLayer(
  vec3 p, vec3 d, vec3 T, vec3 B, float scale, float density, float region,
  float seed, float px, float tear,
  inout vec3 col1, inout float m1, inout float h1, inout float pr1,
  inout vec3 col2, inout float m2, inout float pr2
) {
  vec3 q = p * scale;
  vec3 base = floor(q - 0.5);
  float aa = px * scale;
  for (int z = 0; z < 2; z++)
  for (int y = 0; y < 2; y++)
  for (int x = 0; x < 2; x++) {
    vec3 c = base + vec3(float(x), float(y), float(z));
    vec4 h = random4(c + seed);
    if (h.x > density) continue;
    vec4 k = random4(c * 1.37 + seed + 11.7);
    vec3 cc = c + 0.5 + (h.yzw - 0.5) * 0.5;
    vec3 rel = q - cc;
    float off = abs(dot(rel, d));
    if (off > 0.55) continue;

    // rotate frame a little per stroke
    float a = (k.x - 0.5) * 0.9;
    float ca = cos(a), sa = sin(a);
    vec3 t = T * ca + B * sa;
    vec3 b = B * ca - T * sa;
    // the sphere slices each stroke 'ellipsoid': crisp edges, size shrinks off-plane
    float slice = sqrt(max(1.0 - off * off / 0.3, 0.0));
    float L = mix(0.45, 0.78, h.y) * (0.35 + 0.65 * slice);
    float W = mix(0.10, 0.26, h.z) * (1.0 - 0.25 * k.w) * slice;
    if (W < 0.01) continue;
    float along = dot(rel, t);
    float across = dot(rel, b);
    across += (k.y - 0.5) * 1.6 * along * along; // curved knife sweep
    float u = along / L;              // -1 (loaded start) .. 1 (dry tail)
    float v = across / W;

    // shape: blunt start, tapering/feathered tail, ragged edges
    float taper = 1.0 - 0.55 * smoothstep(0.1, 1.0, u) - 0.25 * smoothstep(-0.6, -1.0, u);
    float rag = 0.12 * (vnoise1(along * 23.0 + h.w * 40.0) - 0.5);
    float edge = abs(v) - taper - rag;
    float aaw = aa / W + 0.02;
    float m = smoothstep(aaw, -aaw, edge);
    m *= smoothstep(1.0, 0.86, abs(u) + 0.08 * vnoise1(across * 31.0 + h.y * 9.0));

    // bristle streaks running along the stroke
    float br  = vnoise1(across * 38.0 + h.w * 17.0);
    float br2 = vnoise1(across * 95.0 + k.z * 31.0);
    float bristle = br * 0.6 + br2 * 0.4;
    // dry brush: paint breaks up into streaks toward the tail
    float dry = smoothstep(-0.1, 1.0, u) * (0.45 + 0.4 * uMotifB.z);
    m *= smoothstep(dry - 0.08, dry + 0.08, bristle + 0.12);
    // overwhelm tears strokes into fragments
    if (tear > 0.0) {
      float tr = random(vec2(floor(along * 7.0 + across * 2.0), h.x * 91.0));
      m *= smoothstep(tear - 0.05, tear + 0.05, tr);
    }
    if (m < 0.003) continue;

    // colour: regional palette, knife-smeared with a second colour / white
    vec3 cA = palBiased(k.z, region + seed * 0.13);
    vec3 cB = (k.w > 0.55) ? uPaper : pal(k.z * 0.75 + region + 0.37);
    if (h.w > 1.0 - 0.09 * uMotifC.y && scale > 0.9) cA = mix(uInk, uPal[1], 0.2);
    float smear = smoothstep(0.35, 0.85, br2 * 0.7 + 0.3 * vnoise1(along * 6.0 + k.x * 5.0))
                * mix(0.25, 0.8, k.y) * (0.15 + 0.85 * uMotifB.y);
    vec3 sc = mix(cA, cB, smear * (0.4 + 0.6 * smoothstep(-0.2, 1.0, u)));

    float pr = k.x + seed * 0.0;
    if (pr > pr1) {
      col2 = col1; m2 = m1; pr2 = pr1;
      col1 = sc; m1 = m; pr1 = pr;
      // impasto height: bristle ridges + paint piled at the start + edge ridge
      h1 = m * (0.35 + 0.45 * bristle + 0.45 * smoothstep(-0.4, -0.95, u)
                + 0.3 * smoothstep(-0.35, 0.0, edge));
    } else if (pr > pr2) {
      col2 = sc; m2 = m; pr2 = pr;
    }
  }
}

void main() {
  vec3 d = normalize(vDir);
  float t = uTime;
  float C = uComplexity;
  float O = uOverwhelm;
  float px = length(fwidth(d));                 // pixel footprint in direction units

  // ------------------------------------------------- flow field + domain warp
  vec3 g;
  float n0 = psrdnoise(d * 1.35 + vec3(0.0, t * 0.015, 0.0), vec3(0.0),
                       t * (0.1 + 0.12 * uMotifC.x + O * 0.35) + uAudio.y * 0.3, g);
  // strokes follow the iso-lines of n0 -> swirls around its extrema
  vec3 T = cross(d, g);
  float tl = length(T);
  T = tl > 1e-4 ? T / tl : normalize(cross(d, vec3(0.31, 0.83, 0.47)));
  vec3 B = cross(d, T);

  vec3 p = d * 3.0 + g * (0.04 + 0.08 * uMotifC.x + 0.1 * O);   // warped painting space
  float K = 1.0 - uMotifD.z;                     // everything but splashes fades at the collapse
  float sat = clamp(uSat, 0.0, 1.0) * (0.85 + 0.15 * C);

  // ------------------------------------------------- big colour masses
  float m1n = snoise(p * 0.55 + vec3(t * 0.02, 0.0, -t * 0.015));
  float m2n = snoise(p * 1.6 - T * 0.35 + vec3(0.0, -t * 0.03, 0.0)); // smeared along flow
  float mass = m1n * 0.7 + m2n * 0.3;
  float region = mass * 0.3 + 0.5;

  // underpaint: a thin wet-in-wet wash of two colours, dragged along the flow
  float drag = vnoise1(dot(p, B) * 22.0 + m2n * 3.0) * 0.6 + vnoise1(dot(p, B) * 61.0 - m1n * 5.0) * 0.4;
  vec3 washA = pal(region + 0.05);
  vec3 washB = pal(region + 0.42);
  vec3 wash = mix(washA, washB, smoothstep(-0.12, 0.12, m2n + (drag - 0.5) * 0.6));
  wash = mix(wash, uPaper, smoothstep(0.55, 0.9, drag) * 0.5);
  float ce = 0.8 - 0.6 * uMotifD.w - 0.3 * C;
  float cover = smoothstep(ce - 0.04, ce + 0.04, mass + 0.25 * drag) * uMotifA.x * K;
  vec3 col = mix(uPaper, mix(uPaper, wash, sat), cover * (0.25 + 0.45 * uMotifD.w));
  float height = cover * 0.1 * drag;

  // ------------------------------------------------- brush strokes: 3 layers, big -> small
  float tear = max(O > 0.35 ? (O - 0.35) * 0.9 : 0.0, uMotifD.x * 0.22);
  float D = uMotifD.w;
  float opa = 0.6 + 0.4 * smoothstep(0.0, 0.5, D);
  float dens[3];
  dens[0] = 0.92 * D * uMotifA.w * K;
  dens[1] = mix(0.07, 0.8, D) * mix(1.0, 0.25, uMotifD.z);
  dens[2] = 0.6 * D * uMotifB.w * K;
  float scl[3];
  scl[0] = 0.55; scl[1] = 1.05; scl[2] = 2.1;
  float topM = 0.0;
  for (int l = 0; l < 3; l++) {
    if (dens[l] < 0.01) continue;
    vec3 c1 = vec3(0.0), c2 = vec3(0.0);
    float s1 = 0.0, s2 = 0.0, hh = 0.0, pr1 = -1.0, pr2 = -1.0;
    float seed = float(l) * 7.31;
    strokeLayer(p, d, T, B, scl[l], dens[l], region, seed, px * 3.0, tear,
                c1, s1, hh, pr1, c2, s2, pr2);
    col = mix(col, mix(uPaper, c2, sat), s2 * opa);
    col = mix(col, mix(uPaper, c1, sat), s1 * opa);
    height = mix(height, hh, s1) + 0.25 * s2 * (1.0 - s1);
    topM = max(topM, s1);
  }
  float s1 = topM;
  height *= 0.45 + 0.55 * uMotifB.z;
  height += uAudio.x * 0.15 * topM;

  // ------------------------------------------------- overwhelm: splashes + drips
  float Os = max(O, uMotifD.z * 0.8);
  if (Os > 0.01 || uMotifC.w > 0.01) {
    float sp = snoise(p * 1.1 + vec3(3.7, t * 0.06, -1.3)) + 0.35 * m2n;
    float br = vnoise1(dot(p, B) * 60.0) * 0.18;           // dragged texture
    float thr = 1.15 - Os * 0.95 + step(Os, 0.01) * 9.0;
    float splash = smoothstep(thr, thr + 0.06, sp + br);
    vec3 sc = mix(uMagenta, uUltra, smoothstep(-0.25, 0.25, m1n + br));
    sc = mix(sc, mix(uMagenta, uInk, 0.6), smoothstep(thr + 0.35, thr + 0.6, sp) * 0.8); // dark cores
    col = mix(col, sc, splash);
    height = max(height, splash * (0.4 + br * 2.0));

    // drips: vertical runs in world -y, columns hashed over the horizontal direction
    vec2 hd = d.xz / max(length(d.xz), 1e-3);
    vec2 dq = hd * 90.0;
    vec2 cell = floor(dq);
    vec4 dh = random4(vec3(cell, 5.0));
    float dripAmt = max(Os, uMotifC.w * 0.35 * K);
    if (dh.x < dripAmt * 0.55) {
      vec2 cp = cell + 0.25 + dh.yz * 0.5;
      float dx = length(dq - cp);
      float ph = fract(t * (0.04 + 0.05 * dh.w) + dh.y);
      float y0 = mix(-0.15, 0.55, dh.z);
      float len = mix(0.1, 0.45, dh.w) * smoothstep(0.0, 0.7, ph) * max(dripAmt, 0.3);
      float fy = (y0 - d.y) / max(len, 1e-3);              // 0 at top, 1 at tip
      float w = mix(0.22, 0.08, clamp(fy, 0.0, 1.0));
      float run = step(0.0, fy) * step(fy, 1.0) * smoothstep(w + 0.05, w - 0.05, dx);
      float bulb = smoothstep(0.32, 0.22, length(vec2(dx, (d.y - (y0 - len)) * 90.0)));
      float drip = max(run, bulb) * (1.0 - smoothstep(0.8, 1.0, ph));
      vec3 dc = Os > 0.3 ? (dh.y > 0.5 ? uMagenta : uUltra) : pal(dh.y);
      col = mix(col, dc, drip);
      height = max(height, drip * 0.6);
    }
  }

  // ------------------------------------------------- thin white scratch curves
  float sn = snoise(p * 0.8 + vec3(5.2, -t * 0.04, 1.7));
  float kk = sn * (1.0 + 1.2 * uMotifA.y + 0.8 * C) + 0.5;
  float lw = abs(fract(kk + 0.5) - 0.5) / max(fwidth(kk), 1e-4);
  float scratch = 1.0 - smoothstep(0.4, 1.4, lw);
  // fragment the contours into separate flicked curves
  scratch *= smoothstep(0.15, 0.35, n0 * 0.5 + 0.5 - 0.3 * mass) * uMotifA.y * K;
  scratch *= smoothstep(0.3, 0.45, vnoise1(dot(p, T) * 3.0 + sn * 9.0 + mass * 5.0));
  col = mix(col, uPaper * 1.03, scratch * 0.9);
  height -= scratch * 0.1;

  // ------------------------------------------------- drifting white-outlined rings (ref b)
  for (int i = 0; i < 6; i++) {
    vec4 r = uRings[i];
    if (r.w <= 0.0) continue;
    vec3 rd = d - r.xyz;
    float dist = length(rd);
    if (dist > r.w * 1.6) continue;
    float wob = 1.0 + 0.06 * sin(dot(rd, vec3(1.3, 0.7, 1.1)) * 2.0 / r.w + float(i) * 2.1)
                    + 0.04 * sin(dot(rd, vec3(-0.5, 1.7, 0.3)) * 2.0 / r.w);
    float rr = r.w * wob;
    float thick = r.w * 0.13;
    float band = smoothstep(thick + px, thick - px, abs(dist - rr));
    // dry-brush streaks around the circumference
    float strk = vnoise1((dist - rr) / thick * 3.0 + float(i) * 13.0);
    float fill = smoothstep(rr - thick + px, rr - thick - px, dist) * uRingFill[i].a;
    col = mix(col, uRingFill[i].rgb, fill);
    col = mix(col, uPaper * 1.02, band * 0.95);
    height = max(height, band * (0.25 + 0.15 * strk));
  }

  // ------------------------------------------------- procedural ring cells (ref b clusters)
  {
    vec3 rq = p * 1.7 + vec3(0.0, t * 0.01, 0.0);
    vec3 rc = floor(rq);
    vec4 rh = random4(rc + 41.7);
    float rdens = (0.22 * uMotifB.x + 0.33 * uMotifC.z) * (0.7 + 0.3 * C) * K;
    if (rh.x < rdens) {
      vec3 rel = rq - (rc + 0.5 + (rh.yzw - 0.5) * 0.2);
      float off = abs(dot(rel, d));
      vec3 tp = rel - d * dot(rel, d);
      float dist = length(tp);
      float R = mix(0.16, 0.34, rh.y);
      vec2 lp = vec2(dot(tp, T), dot(tp, B)) / max(dist, 1e-4);   // unit dir around the ring
      float wob = 1.0 + 0.07 * lp.x * lp.y * (rh.z - 0.5) * 4.0 + 0.05 * (lp.x * (rh.w - 0.5) * 2.0);
      float rr = R * wob;
      float th = R * mix(0.1, 0.18, rh.w) * (1.0 + 0.35 * lp.y);   // loaded on one side
      float aa = px * 3.0 * 1.7;
      float band = smoothstep(th + aa, th - aa, abs(dist - rr)) * smoothstep(0.45, 0.3, off);
      float strk = vnoise1((dist - rr) / th * 3.0 + rh.z * 20.0);
      float fill = smoothstep(rr - th * 0.5 + aa, rr - th * 0.5 - aa, dist) * smoothstep(0.45, 0.3, off);
      vec3 fcol = pal(rh.z + region * 0.5);
      if (rh.w > 0.75) fcol = uInk;
      float fillOn = step(0.3 + 0.5 * (1.0 - uMotifC.z), rh.w);   // discs get filled from stage 12
      col = mix(col, mix(uPaper, fcol, sat), fill * fillOn * 0.95);
      float inner = smoothstep(R * 0.45 + aa, R * 0.45 - aa, dist) * step(0.55, rh.y) * uMotifC.z;
      col = mix(col, mix(uPaper, pal(rh.w + 0.5), sat), inner * 0.9);
      vec3 rim = rh.z > 0.85 ? pal(0.01) : uPaper * 1.03;
      col = mix(col, rim, band);
      height = max(height, band * (0.25 + 0.15 * strk));
    }
  }

  // ------------------------------------------------- paint flecks
  {
    vec3 fq = p * 22.0;
    vec3 fc = floor(fq);
    vec4 fh = random4(fc + 3.3);
    float fdens = (0.08 + 0.2 * C + 0.15 * uMotifD.y) * uMotifA.z * K + 0.35 * Os;
    float fr = 0.08 + 0.2 * fh.z * fh.z;
    float fd = length(fq - fc - 0.3 - fh.xyw * 0.4);
    float aa = px * 3.0 * 22.0;
    float fleck = step(fh.x * 0.999 + 0.001, fdens) * smoothstep(fr + aa, fr - aa, fd);
    vec3 fcol = fh.w > 0.6 ? uPaper * 1.03 : (Os > 0.3 && fh.y > 0.5 ? mix(uMagenta, uUltra, fh.w) : pal(fh.y + region));
    col = mix(col, fcol, fleck);
    height = max(height, fleck * 0.7);
  }

  // ------------------------------------------------- canvas weave
  vec3 wq = d * 700.0;
  float weave = sin(wq.x + sin(wq.y * 0.5)) * sin(wq.y) + sin(wq.z) * sin(wq.x);
  float wfade = 1.0 - smoothstep(0.004, 0.012, px);
  height += weave * 0.02 * wfade;

  // ------------------------------------------------- impasto lighting from height derivatives
  float dhx = dFdx(height);
  float dhy = dFdy(height);
  vec2 slope = clamp(vec2(dhx, dhy) * 2.2, -0.6, 0.6);
  vec3 nrm = normalize(vec3(-slope, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
  float diff = dot(nrm, L) / L.z;                       // 1.0 on flat paint
  float spec = pow(max(dot(nrm, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);
  col *= mix(1.0, diff, 0.55);
  col += spec * 0.18 * smoothstep(0.05, 0.3, height);
  col += weave * 0.012 * wfade * (1.0 - s1);

  // ------------------------------------------------- stage grading: saturation push + contrast around the ground
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, max(uSat, 1.0) * (1.0 + 0.08 * uMotifD.y));
  col = uPaper + (col - uPaper) * uContrast;
  col = clamp(col, 0.0, 1.0);

  // ------------------------------------------------- audio shimmer + flash
  col *= 1.0 + uAudio.x * 0.08;
  col += uAudio.z * 0.05 * scratch;
  col = mix(col, vec3(1.0), uFlash * 0.8);
  col += uFlash * 0.35 * vec3(1.0, 0.97, 0.92);

  gl_FragColor = vec4(col, 1.0);
}
