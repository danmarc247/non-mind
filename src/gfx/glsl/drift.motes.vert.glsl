// Motes: every instance is a quad; its whole life (rise, swirl, wrap) is computed here from a seed,
// so the CPU uploads nothing per frame. Kind: round dab, or a short stroke stretched along its motion.
attribute vec4 aSeed;     // x angle, y radius, z colour/kind, w phase
uniform float uTime; uniform float uCount; uniform float uFlash; uniform float uHigh; uniform float uScatter;
uniform float uYMin; uniform float uYMax; uniform float uRMin; uniform float uRMax; uniform float uSize;
varying vec2 vQ; varying float vKind; varying float vCol; varying float vAlpha; varying float vSeed;

void main() {
  float idx = float(gl_InstanceID);
  vSeed = aSeed.w; vCol = aSeed.z; vKind = step(0.62, fract(aSeed.z * 7.13));
  float H = uYMax - uYMin;
  float speed = 0.35 + 0.5 * fract(aSeed.w * 3.7);
  float life = fract(aSeed.w + uTime * speed / H);
  float y = uYMin + life * H;
  float ang = aSeed.x * 6.2831 + uTime * (0.01 + 0.02 * fract(aSeed.y * 5.1)) + sin(uTime * 0.3 + aSeed.w * 9.0) * 0.05;
  float r = mix(uRMin, uRMax, pow(aSeed.y, 0.8)) * (1.0 + uScatter * 0.6);
  vec3 P = vec3(cos(ang) * r, y, sin(ang) * r);
  P.x += sin(uTime * 0.21 + aSeed.w * 30.0) * 1.2;
  P.z += cos(uTime * 0.17 + aSeed.x * 30.0) * 1.2;
  // velocity direction (rise + swirl) for strokes
  vec3 vel = vec3(-sin(ang), 0.0, cos(ang)) * r * 0.02 + vec3(0.0, speed, 0.0);

  float on = step(idx, uCount);                                       // complexity reveals more
  float edge = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.85, life);
  vAlpha = on * edge * (1.0 + uHigh * 0.35 * sin(uTime * 11.0 + aSeed.w * 50.0));

  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
  vec2 dir = normalize(vv.xy + vec2(1e-4, 0.0));
  float sz = uSize * (0.55 + 0.9 * fract(aSeed.x * 13.7)) * (1.0 + uFlash * 1.4 + uHigh * 0.25);
  vec2 ext = vKind > 0.5 ? vec2(3.2, 0.55) : vec2(1.0, 1.0);
  vec2 off = position.xy * ext * sz;
  off = dir * off.x + vec2(-dir.y, dir.x) * off.y;
  // never closer than a few units: no giant blobs on the lens
  vAlpha *= smoothstep(16.0, 26.0, -mv.z);   // nothing big between the lens and the arena
  mv.xy += off * on;
  vQ = position.xy * 2.0;
  gl_Position = projectionMatrix * mv;
}
