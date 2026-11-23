// 4. Overwhelm: wobble, chromatic smear along strokes, tension streaks,
// posterisation, magenta/ultramarine splashes + gravity drips creeping in
// from the edges, whiteout, and the white flash burst.
// defines: SMEAR_TAPS

uniform float uOverwhelm;
uniform float uTension;
uniform float uFlash;
uniform float uTime;
uniform float uAudio;
uniform vec3 uPaper;
uniform vec3 uMagenta;
uniform vec3 uUltra;
uniform vec3 uViolet;
uniform vec3 uCrimson;

vec3 pp_ot(vec2 uv) {
  return texture2D(inputBuffer, uv).rgb;
}

vec3 pp_pcol(float h) {
  if (h < 0.47) return uMagenta;
  if (h < 0.86) return uUltra;
  if (h < 0.97) return uViolet;
  return uCrimson;
}

// returns paint colour (rgb) and coverage (a)
vec4 pp_splash(vec2 q, vec2 uv, float o, float asp, float t) {
  // how far in from the edges paint has crept
  float ed = min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y));
  float n2 = pp_fbm(q * 2.1 + 17.0);
  float front = 0.8 * pow(o, 1.35);
  float reach = smoothstep(front, front - 0.04, ed + (n2 - 0.5) * 0.32);
  if (reach <= 0.0) return vec4(0.0);

  // organic domain warp
  vec2 wq = q + (vec2(pp_fbm(q * 3.0 + 1.3), pp_fbm(q * 3.0 + 8.1)) - 0.5) * 0.35;
  float n1 = pp_fbm(wq * 9.0);

  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float cover = 0.0;
  float halo = 0.0;

  // --- thrown, dragged splashes
  vec2 cq = wq * 2.4;
  vec2 ci = floor(cq);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = ci + vec2(float(x), float(y));
      vec2 h2 = pp_hash22(cell);
      float h3 = pp_hash12(cell + 31.7);
      float h4 = pp_hash12(cell + 71.3);
      if (h3 > 0.3 + 0.4 * o) continue;
      vec2 c = cell + h2;
      float ang = (h4 - 0.5) * 0.9;
      vec2 d = cq - c;
      vec2 ad = vec2(cos(ang), sin(ang));
      float u = dot(d, ad);
      float v = dot(d, vec2(-ad.y, ad.x));
      float rad = 0.22 + 0.4 * h3;
      v += u * u * (h2.x - 0.5) * 0.8;                 // swept curve
      float ell = length(vec2(u * (0.33 + 0.2 * h4), v));
      float f = 1.0 - ell / rad + (n1 - 0.5) * 0.7;
      halo = max(halo, f);
      // dry-brush drag texture along the sweep
      vec2 d0 = q * 2.4 - c;
      float v0 = dot(d0, vec2(-ad.y, ad.x));
      float u0 = dot(d0, ad);
      float drag = 0.65 * pp_vnoise(vec2(u0 * 2.0, v0 * 45.0) + h2 * 40.0) + 0.35 * pp_vnoise(vec2(u0 * 5.0, v0 * 110.0) + h2 * 20.0);
      float body = smoothstep(0.0, 0.008, f) * smoothstep(0.3, 0.34, drag + f * 1.6);
      // gravity drips under the splash
      float dx = (cq.x - c.x) / rad;
      float colI = floor(dx * 4.0);
      float dh = pp_hash12(cell * 3.1 + colI);
      float fx = fract(dx * 4.0) - 0.5 + 0.03 * sin(cq.y * 9.0 + dh * 6.0);
      float len = (1.0 + 3.0 * dh * dh) * smoothstep(0.15, 1.0, o) * rad * (1.6 + 0.2 * sin(t * 0.25 + dh * 6.0));
      float dy = c.y - cq.y;
      float dw = (0.24 + 0.16 * dh) * (1.0 - 0.5 * clamp(dy / max(len, 1e-3), 0.0, 1.0));
      float on = step(dh, 0.4) * step(abs(dx), 0.8);
      float drip = on * smoothstep(dw, dw * 0.5, abs(fx)) * step(0.0, dy) * step(dy, len);
      float bulb = on * smoothstep(1.0, 0.7, length(vec2(fx / 4.0 * rad, dy - len)) / (0.06 * rad * (1.0 + dh)));
      float a = max(body, max(drip, bulb)) * reach;
      if (a <= 0.0) continue;
      vec3 pc = pp_pcol(pp_hash12(cell + 5.5));
      // pigment pools darker at the rim / in drag furrows, thins to tint inside
      float rim = (1.0 - smoothstep(0.0, 0.18, f)) * step(-0.02, f);
      pc = mix(pc, pc * pc * 0.5, rim * 0.5 + 0.25 * smoothstep(0.6, 0.9, drag));
      pc = mix(pc, mix(pc, uPaper, 0.5), smoothstep(0.4, 0.95, f) * smoothstep(0.45, 0.7, drag) * 0.7);
      acc += pc * a;
      wsum += a;
      cover = 1.0 - (1.0 - cover) * (1.0 - a);
    }
  }

  // --- horizontal drag streaks with beads (ref c, upper left)
  float row = floor(q.y * 52.0);
  float rh = pp_hash12(vec2(row, 3.0));
  float rowOn = step(rh, 0.06 + 0.3 * o);
  float rf = abs(fract(q.y * 52.0) - 0.5);
  float rlen = (0.15 + 0.7 * pp_hash12(vec2(row, 9.0))) * o * 1.3;
  float fromL = step(pp_hash12(vec2(row, 4.0)), 0.65);
  float xs = fromL > 0.5 ? q.x : asp - q.x;
  float bead = smoothstep(0.6, 1.0, pp_vnoise(vec2(xs * 40.0, row)));
  float sw = 0.06 + 0.3 * bead;
  float streak = rowOn * smoothstep(sw, sw * 0.6, rf + 0.15 * sin(xs * 6.0 + rh * 9.0)) * smoothstep(rlen, rlen * 0.7, xs);
  streak *= smoothstep(0.0, 0.15, o);
  if (streak > 0.0) {
    vec3 sc = pp_pcol(pp_hash12(vec2(row, 1.0)) * 0.8);
    acc += sc * streak;
    wsum += streak;
    cover = 1.0 - (1.0 - cover) * (1.0 - streak);
  }

  // --- spatter: dense near splashes, sparse elsewhere; sizes vary a lot
  vec2 sq = wq * 48.0;
  vec2 si = floor(sq);
  vec2 sh = pp_hash22(si + 13.0);
  float near = smoothstep(-0.9, -0.1, halo);
  float sdens = step(pp_hash12(si), (0.015 + 0.25 * near) * (0.4 + o));
  float sr = 0.06 + 0.32 * pow(sh.y, 3.0);
  vec2 sd = fract(sq) - (0.3 + 0.4 * sh);
  float drop = sdens * smoothstep(sr, sr * 0.75, length(sd * vec2(1.0, 1.0 + sh.x)));
  drop *= reach;
  if (drop > 0.0) {
    vec3 dc = pp_pcol(pp_hash12(si + 2.0));
    acc += dc * drop;
    wsum += drop;
    cover = 1.0 - (1.0 - cover) * (1.0 - drop);
  }

  vec3 paint = wsum > 0.0 ? acc / wsum : vec3(0.0);
  return vec4(paint, cover);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float o = clamp(uOverwhelm, 0.0, 1.0);
  float ten = clamp(uTension, 0.0, 1.0);
  float asp = resolution.x / resolution.y;
  float scale = resolution.y / 720.0;
  vec2 q = vec2(uv.x * asp, uv.y);
  float t = uTime;

  if (o < 0.002 && ten < 0.002 && uFlash < 0.002) {
    outputColor = inputColor;
    return;
  }

  // UV wobble (wet canvas swimming)
  vec2 w = vec2(pp_vnoise(q * 2.6 + vec2(0.0, t * 0.35)), pp_vnoise(q * 2.6 + vec2(5.2, -t * 0.31))) - 0.5;
  vec2 wuv = uv + w * (o * o * 0.03 + uAudio * 0.003);

  // stroke direction at the wobbled point
  vec2 e = texelSize * 2.0 * max(scale, 1.0);
  float ll = pp_plum(pp_ot(wuv - vec2(e.x, 0.0)));
  float lr = pp_plum(pp_ot(wuv + vec2(e.x, 0.0)));
  float ld = pp_plum(pp_ot(wuv - vec2(0.0, e.y)));
  float lu = pp_plum(pp_ot(wuv + vec2(0.0, e.y)));
  vec2 g = vec2(lr - ll, lu - ld);
  float gm = length(g);
  vec2 flow = pp_flowDir(q, t);
  vec2 dir = gm > 1e-5 ? vec2(-g.y, g.x) / gm : flow;
  dir = normalize(mix(flow, dir, smoothstep(0.002, 0.03, gm)));

  // chromatic smear along the stroke + tension streaks (horizontal drag)
  float sm = (o * 14.0 + ten * 4.0) * scale;
  vec2 sdir = normalize(vec2(1.0, 0.18 * sin(q.y * 3.0 + t * 0.2)));
  float sl = ten * 22.0 * scale;
  vec3 col;
  if (sm < 0.3 && sl < 0.3) {
    col = pp_ot(wuv);
  } else {
    vec3 acc = vec3(0.0);
    vec3 strk = vec3(0.0);
    for (int i = 0; i < SMEAR_TAPS; i++) {
      float f = float(i) / float(SMEAR_TAPS - 1) - 0.5;
      vec2 o2 = dir * sm * texelSize;
      acc.r += pp_ot(wuv + o2 * (f + 0.45)).r;
      acc.g += pp_ot(wuv + o2 * f).g;
      acc.b += pp_ot(wuv + o2 * (f - 0.45)).b;
      strk += pp_ot(wuv - sdir * texelSize * sl * (f + 0.5));
    }
    acc /= float(SMEAR_TAPS);
    strk /= float(SMEAR_TAPS);
    float sMask = smoothstep(0.35, 0.75, pp_vnoise(vec2(q.x * 1.5, q.y * 22.0) + t * 0.05));
    col = mix(acc, strk, ten * 0.65 * sMask);
  }

  // posterisation (in display space, dithered by paint noise)
  float pz = smoothstep(0.3, 0.85, o);
  if (pz > 0.0) {
    float lv = mix(12.0, 4.0, pz);
    vec3 dcol = sqrt(max(col, 0.0));
    float dth = pp_vnoise(q * vec2(14.0, 50.0) + dir * 4.0) - 0.5;
    vec3 post = (floor(dcol * lv + 0.5 + dth * 0.35)) / lv;
    col = mix(col, post * post, pz);
  }

  // whiteout toward canvas
  float wo = smoothstep(0.5, 1.0, o);
  col = mix(col, uPaper, wo * 0.93);

  // splashes + drips
  if (o > 0.01 || ten > 0.3) {
    vec4 sp = pp_splash(q, uv, max(o, (ten - 0.3) * 0.25), asp, t);
    // wet sheen on the paint body
    float hgt = sp.a;
    vec3 nn = normalize(vec3(-dFdx(hgt) * 3.0, -dFdy(hgt) * 3.0, 1.0));
    float sheen = pow(max(dot(nn, normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 30.0);
    vec3 paint = sp.rgb + sheen * 0.35 * sp.a;
    col = mix(col, paint, sp.a * 0.96);
  }

  // flash: white bloom burst from the centre
  float fl = clamp(uFlash, 0.0, 1.0);
  float rc = length((uv - 0.5) * vec2(asp, 1.0));
  col = mix(col, vec3(1.0), fl * (0.95 - 0.45 * smoothstep(0.0, 0.9, rc)));

  outputColor = vec4(max(col, 0.0), inputColor.a);
}
