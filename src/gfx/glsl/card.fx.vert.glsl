// Card fx: camera-facing quads. Kind 0: motes shed by the card, falling toward the sea and fading.
// Kind 1: one paper-white ring at the card when it is collected.
attribute vec4 aSeed;
attribute float aIdx;
uniform vec3 uCenter; uniform float uTime; uniform float uCount; uniform float uSize; uniform float uKind;
varying vec2 vQ; varying float vA; varying float vSeed;
void main() {
  vec3 wp = uCenter; float size = uSize; vA = 1.0;
  if (uKind < 0.5) {
    float life = fract(uTime * (0.16 + 0.12 * aSeed.x) + aSeed.y);
    vec3 off = vec3((aSeed.z - 0.5) * 1.4, 0.3 - life * 2.2, (aSeed.w - 0.5) * 1.4);
    off.xz += vec2(sin(uTime * 1.3 + aSeed.x * 6.28), cos(uTime * 1.1 + aSeed.w * 6.28)) * 0.22 * life;
    wp += off;
    size *= (0.55 + 0.8 * aSeed.z) * (1.0 - 0.5 * life);
    vA = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.55, life) * step(aIdx, uCount - 0.5);
  }
  vSeed = aSeed.x;
  vQ = position.xy * 2.0;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}
