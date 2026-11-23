// ContainedSea cut wall: the interior as stacked strata of the same paint.
// Four parallax-shifted sheets (1 snoise each) composited front to back, darker with depth,
// rising plumes (hash), caustic threads near the top, and the surface paint itself in the top band.
#include "./sea2.common.glsl"
#include "./sea2.paint.glsl"
varying vec3 vW; varying vec3 vSw; varying vec4 vRip;

void main() {
  float a = atan(vW.z, vW.x);
  float y = vW.y - uY;                       // 0 at the surface, -5 at the floor
  float dep = clamp(-y / 5.0, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vW);
  vec2 nr = normalize(vW.xz);
  float vt = dot(V.xz, vec2(-nr.y, nr.x)), vn = max(dot(V.xz, nr), 0.25), vy = V.y;
  vec2 uv0 = vec2(a * uR, y);
  vec3 col = vec3(0.0); float tr = 1.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float dk = 0.15 + fk * 0.85;
    vec2 uv = uv0 - vec2(vt, vy) / vn * dk;
    float n = snoise(vec3(uv.x * 0.2, uv.y * 0.5 - uT * 0.03, fk * 3.7 + uT * 0.02));
    float s = uv.y * (1.1 + 0.25 * fk) + n * (0.9 + 0.6 * uComplexity) + fk * 0.37;
    float band = fract(s), id = floor(s);
    vec3 lc = sp_pal(id + fk * 2.0);
    float al = smoothstep(0.0, 0.07, band) * smoothstep(1.0, 0.8, band) * (0.85 - 0.13 * fk);
    float edge = smoothstep(0.1, 0.02, band) * (k == 0 ? 1.0 : 0.4);
    // rising plumes: columns that climb and fade
    float col_id = floor(uv.x * 0.7 + fk * 5.3);
    float pc = smoothstep(0.35, 0.05, abs(fract(uv.x * 0.7 + fk * 5.3) - 0.5 - 0.15 * sin(uv.y * 1.3 + uT * 0.4)));
    float rise = fract(uv.y * 0.18 + uT * 0.05 * (0.6 + sp_h0(col_id)));
    float plume = pc * step(0.62, sp_h0(col_id * 1.7)) * smoothstep(0.0, 0.5, rise) * smoothstep(1.0, 0.6, rise);
    lc = mix(lc, uPal[3], plume * 0.75);
    lc = mix(lc, uPaper, edge * 0.6);
    lc = mix(lc, uInk, clamp(dep * 0.8 + fk * 0.12, 0.0, 0.92));
    col += tr * al * lc; tr *= 1.0 - al;
  }
  col += tr * uInk;
  // caustic threads: thin bright filaments wavering under the surface
  float cn = snoise(vec3(a * 5.0, y * 0.8, uT * 0.12));
  float th = abs(sin(a * uR * 0.9 + cn * 3.0 + y * 1.5)) ;
  float caus = smoothstep(0.97, 1.0, th) * smoothstep(-2.8, -0.3, y);
  col = mix(col, uPal[3], caus * 0.7);
  col = mix(col, uPaper, caus * 0.3);
  // top band: the surface paint itself, continuing over the edge
  if (y > -0.6) {
    float hp;
    vec3 s = sea_paint(vec2(cos(a), sin(a)) * (uR - 0.3), hp);
    col = mix(col, s * 0.9, smoothstep(-0.6, -0.15, y));
  }
  col = mix(col, uPaper, smoothstep(-0.06, 0.03, y) * 0.85);   // meniscus lip
  col = mix(col, uPaper, uFlash * 0.2);
  gl_FragColor = vec4(col, 1.0);
}
