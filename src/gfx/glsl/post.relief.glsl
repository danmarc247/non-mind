// 2. Brush relief + canvas + ink edge.
// Height = palette-knife dabs (oriented along the stroke direction, layered by
// random z-order) + bristle noise line-integrated along the stroke (LIC) +
// a little perceptual luminance; lit as wet impasto. Each dab also nudges
// the local tone so smooth shading breaks into discrete strokes.
// defines: LIC_TAPS (half length)

uniform float uRelief;   // impasto lighting amount
uniform float uBristle;  // bristle groove amount
uniform float uCanvas;   // canvas weave amount
uniform float uInk;      // ink edge amount
uniform float uDab;      // dab tone breakup amount
uniform float uTime;
uniform vec3 uInkColor;  // in the pipeline's colour space
uniform vec2 uNearFar;

vec3 pp_rt(vec2 uv) {
  return texture2D(inputBuffer, uv).rgb;
}

float pp_lz(vec2 uv) {
  return -getViewZ(readDepth(uv));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float scale = max(resolution.y / 720.0, 0.5);
  float asp = resolution.x / resolution.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec3 col = inputColor.rgb;
  float z0 = -getViewZ(depth);
  float farK = pp_farK(z0, uNearFar);   // arena: no dabs, light relief
  float dabK = uDab * farK;
  float relK = uRelief * mix(0.4, 1.0, farK);

  // gradient of the filtered image -> stroke direction
  vec2 e = texelSize * 1.5 * max(1.0, scale);
  float ll = pp_plum(pp_rt(uv - vec2(e.x, 0.0)));
  float lr = pp_plum(pp_rt(uv + vec2(e.x, 0.0)));
  float ld = pp_plum(pp_rt(uv - vec2(0.0, e.y)));
  float lu = pp_plum(pp_rt(uv + vec2(0.0, e.y)));
  vec2 g = vec2(lr - ll, lu - ld);
  float gm = length(g);
  vec2 flow = pp_flowDir(q, uTime);
  vec2 tng = gm > 1e-5 ? vec2(-g.y, g.x) / gm : flow;
  vec2 dir = normalize(mix(flow, tng * sign(dot(tng, flow) + 1e-4), smoothstep(0.003, 0.03, gm)));
  vec2 nrm = vec2(-dir.y, dir.x);

  // --- palette-knife dabs (3x3 cells, topmost dab wins)
  vec2 px = uv * resolution / scale;          // 720p-normalised pixels
  float D = 38.0;
  vec2 cell0 = floor(px / D);
  float dabH = 0.0;
  float dabZ = -1.0;
  float dabTone = 0.0;
  float dabV = 0.0;
  vec2 dabC = px;
  float dabG = 0.5;
  float dabU = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = cell0 + vec2(float(x), float(y));
      vec2 hh = pp_hash22(cell);
      float hz = pp_hash12(cell + 19.1);
      vec2 c = (cell + hh) * D;
      vec2 d = px - c;
      float u = dot(d, dir);
      float v = dot(d, nrm);
      float len = D * (0.85 + 0.9 * hh.x);
      float wid = D * (0.32 + 0.3 * hh.y);
      // slight curvature + tapered tail
      v += u * u / (len * 3.0) * (hz - 0.5);
      float taper = 1.0 - 0.45 * smoothstep(-len, len, u);
      float ee = (u / len) * (u / len) + (v / (wid * taper)) * (v / (wid * taper));
      if (ee < 1.0 && hz > dabZ) {
        dabZ = hz;
        float av = abs(v) / (wid * taper);
        // knife pushes paint to the sides and piles it up at the end
        dabH = smoothstep(1.0, 0.3, ee) * (0.8 + 0.2 * smoothstep(0.5, 0.95, av)) + 0.2 * smoothstep(0.55, 1.0, u / len) * smoothstep(1.0, 0.6, ee);
        // bristle grooves in the dab's own frame (straight, parallel to the stroke)
        dabG = pp_vnoise(vec2(u / 14.0, v / 1.7 + hz * 91.0)) * 0.7 + pp_vnoise(vec2(u / 6.0, v / 0.8 + hz * 37.0)) * 0.3;
        dabTone = pp_hash12(cell + 7.7) - 0.5;
        dabV = v / wid;
        dabC = c;
        dabU = u / len;
      }
    }
  }

  // bristle LIC: value noise averaged along the stroke direction
  vec2 bp = px / 1.6;
  float lic = 0.0;
  for (int i = -LIC_TAPS; i <= LIC_TAPS; i++) {
    lic += pp_vnoise(bp + dir * (float(i) * 1.8));
  }
  lic /= float(2 * LIC_TAPS + 1);
  lic = clamp((lic - 0.5) * 2.8, -1.0, 1.0);

  // stroke colour transport: a dab carries the paint picked up at its start,
  // but only where that paint is similar (object silhouettes stay put)
  if (dabZ >= 0.0 && dabK > 0.001) {
    vec2 src = (px - dir * (dabU * 0.6 + 0.25) * D * 0.6) * scale / resolution;
    vec3 sc = pp_rt(src);
    vec3 dd = pp_perc(sc) - pp_perc(col);
    float sim = exp(-dot(dd, dd) * 60.0);
    col = mix(col, sc, 0.7 * sim * dabK);
  }

  // blank pale canvas: thin paint, no tone breakup and little shading (never grey)
  float yl = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float chroma = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  float blank = smoothstep(0.55, 0.85, yl) * (1.0 - smoothstep(0.05, 0.22, chroma));
  dabK *= 1.0 - 0.9 * blank;

  // tone breakup: each dab carries a slightly different mix of paint
  float lum = pp_plum(col);
  float lv = 6.0;
  float lq = (floor(lum * lv + 0.5 + dabTone * 0.9) ) / lv;
  float tone = mix(1.0, clamp((lq + 0.02) / (lum + 0.02), 0.75, 1.3), 0.55 * dabK * step(0.0, dabZ));
  col *= tone * (1.0 + dabTone * 0.08 * dabK);

  float groove = mix(lic * 0.5, dabZ >= 0.0 ? (dabG - 0.5) * 2.0 : lic, farK);
  float h = dabH * 0.22 * farK + groove * 0.12 * uBristle * mix(0.35, 1.0, farK) + lum * mix(0.1, 0.3, farK);
  vec3 n = normalize(vec3(-dFdx(h) * 4.0 * relK, -dFdy(h) * 4.0 * relK, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.65, 0.75));
  float diff = dot(n, L) / L.z;
  // blank pale canvas carries thin paint: barely shaded, so it never turns grey
  float shadeK = mix(0.3, 0.6, farK) * mix(1.0, 0.25, blank);
  col *= mix(1.0, clamp(diff, 0.6, 1.35), shadeK);
  // wet gloss on ridges (broad, not sparkly)
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 18.0);
  float wet = smoothstep(0.3, 0.8, pp_vnoise(q * 5.0 + 2.0));
  col += smoothstep(0.55, 1.0, spec) * relK * (0.05 + 0.14 * wet) * vec3(1.0, 0.97, 0.92) * (0.5 + lum);

  // canvas weave (shows most in thin paint between dabs)
  vec2 cw = px / 2.4;
  float wx = sin(cw.x * 3.14159 + pp_vnoise(cw * 0.15) * 2.0);
  float wy = sin(cw.y * 3.14159 + pp_vnoise(cw.yx * 0.15) * 2.0);
  float weave = 0.5 + 0.25 * (wx * step(0.0, wy) + wy * step(wy, 0.0)) + 0.15 * (pp_hash12(floor(cw)) - 0.5);
  float thin = dabZ < 0.0 ? 1.0 : 0.45;
  col *= 1.0 - uCanvas * thin * ((0.5 - weave) * mix(0.2, 0.12, blank) + 0.012);

  // ink edge where depth / colour jump
  vec2 de = texelSize * 1.5 * scale;
  float zl = pp_lz(uv - vec2(de.x, 0.0));
  float zr = pp_lz(uv + vec2(de.x, 0.0));
  float zd = pp_lz(uv - vec2(0.0, de.y));
  float zu = pp_lz(uv + vec2(0.0, de.y));
  float dz = max(max(abs(zl - z0), abs(zr - z0)), max(abs(zd - z0), abs(zu - z0))) / max(z0, 1e-3);
  float edgeD = smoothstep(0.03, 0.12, dz);
  float edgeC = smoothstep(0.1, 0.25, gm);
  float wob = 0.5 + 0.5 * pp_vnoise(px * 0.06 + dir * 3.0);
  float ink = clamp(max(edgeD, edgeC * 0.45 * farK) * wob * uInk * mix(0.45, 1.0, farK), 0.0, 1.0);
  col = mix(col, uInkColor * (0.6 + 0.4 * col), ink * 0.8);

  outputColor = vec4(max(col, 0.0), inputColor.a);
}
