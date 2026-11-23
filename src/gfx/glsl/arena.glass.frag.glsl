// Glass vessel wall: fresnel rim, thickness streaks, sliding painted reflections of the sky
// palette, faint caustic lines under the waterline. Transparent, depthWrite off.
// ~4 value-noise taps per pixel. uLip = 1 draws the thick paper lip / foot instead (opaque path).
#include "./arena.common.glsl"
uniform float uTime; uniform float uComplexity; uniform float uOverwhelm; uniform float uTension; uniform float uFlash;
uniform float uLip; uniform float uWaterY; uniform float uBottomY;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uMagenta;
uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; uniform vec3 uP3;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;

vec3 pick(float k) { k = mod(k, 4.0); return k < 1.0 ? uP0 : k < 2.0 ? uP1 : k < 3.0 ? uP2 : uP3; }

void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  if (!gl_FrontFacing) N = -N;
  float ndv = abs(dot(N, V));
  float ang = atan(vW.z, vW.x);
  float t = uTime;

  if (uLip > 0.5) {
    // thick paper lip: cel-banded impasto with a palette reflection fleck
    vec3 L = normalize(vec3(-0.3, 0.9, 0.35));
    float l = ar_cel(clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0));
    float stroke = ar_noise(vec2(ang * 80.0, vUv.y * 6.0));
    vec3 col = uPaper * (0.82 + 0.2 * l) * (0.96 + 0.06 * stroke);
    vec3 R = reflect(-V, N);
    float k = ang * 1.5 + R.y * 2.0 - t * 0.04;
    float fleck = smoothstep(0.86, 0.95, ar_noise(vec2(k * 3.0, R.y * 4.0)));
    col = mix(col, pick(floor(k * 2.0)), fleck * 0.55);
    col = mix(col, uInk, smoothstep(0.2, 0.0, ndv) * 0.25);
    gl_FragColor = vec4(mix(col, uPaper, uFlash * 0.5), 1.0);
    return;
  }

  float fres = pow(1.0 - ndv, 2.5);
  float depth01 = clamp((uWaterY - vW.y) / (uWaterY - uBottomY), 0.0, 1.0);   // 0 at the water, 1 at the floor
  vec3 col = uPaper; float alpha = 0.035;

  // thickness streaks: vertical runs of thicker glass, denser toward the heavy base
  float st = ar_noise(vec2(ang * 38.0, vW.y * 0.35 + 1.7));
  float streak = smoothstep(0.62 - 0.2 * depth01, 0.9, st);
  alpha += streak * (0.05 + 0.08 * depth01);

  // sliding painted reflections of the sky colours (palette-knife bands in reflection space)
  vec3 R = reflect(-V, N);
  float k = atan(R.z, R.x) * 1.6 + R.y * 3.0 + t * 0.03;
  float kid = floor(k);
  float kf = fract(k);
  float edge = (ar_noise(vec2(kid * 3.1, vW.y * 1.4 + t * 0.05)) - 0.5) * 0.35;
  float knife = smoothstep(0.08, 0.16, kf + edge) * smoothstep(0.62, 0.48, kf + edge);
  float dryk = ar_noise(vec2(vW.y * 9.0, kid + ang * 3.0));
  knife *= smoothstep(0.25, 0.4, dryk);
  vec3 refl = pick(kid);
  float reflA = knife * (0.08 + 0.45 * fres) * (0.6 + 0.4 * uComplexity);
  col = mix(col, refl, clamp(reflA * 2.0, 0.0, 1.0));
  alpha += reflA;

  // fresnel rim light
  col = mix(col, uPaper, fres * 0.7);
  alpha += fres * 0.5;

  // faint caustic lines just under the waterline
  float cy = vW.y - uWaterY;
  float c1 = abs(sin(ang * 26.0 + sin(cy * 2.5 + t * 0.8) * 1.6 + t * 0.35));
  float c2 = abs(sin(ang * 17.0 - sin(cy * 3.1 - t * 0.6) * 1.3 - t * 0.27));
  float caus = pow(1.0 - min(c1, c2), 10.0) * smoothstep(-2.8, -0.2, cy) * step(cy, 0.0);
  col = mix(col, mix(uPaper, uP2, 0.35), caus);
  alpha += caus * (0.18 + 0.2 * uComplexity);

  // heavy base and the waterline meniscus
  float base = smoothstep(0.82, 1.0, depth01);
  col = mix(col, uInk, base * 0.4);
  alpha += base * 0.12;
  float meniscus = smoothstep(0.06, 0.0, abs(cy + 0.02)) ;
  alpha += meniscus * 0.35; col = mix(col, uPaper, meniscus);

  col = mix(col, uMagenta, uOverwhelm * 0.3 * smoothstep(0.6, 0.9, st));
  col = mix(col, uPaper, uFlash * 0.4);
  // back faces are the far wall seen through the near one: quieter
  if (!gl_FrontFacing) alpha *= 0.45;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.55));
}
