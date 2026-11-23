#include "./sea2.common.glsl"
varying vec3 vW;     // world position (after displacement)
varying vec3 vSw;    // swell h, grad
varying vec4 vRip;   // ripple h, grad, white
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
#ifdef SEA_WALL
  // cut wall: static; its top row rises with the meniscus so it meets the surface lip
  if (position.y > 0.0) w.y += 0.05;
  vSw = vec3(0.0); vRip = vec4(0.0);
#else
  vec3 s = sea_swell(w.xz);
  vec4 r = sea_ripples(w.xz);
  float rr = length(w.xz);
  w.y += s.x + r.x + 0.05 * smoothstep(uR - 0.45, uR, rr);   // meniscus: paint climbs the glass
  vSw = s; vRip = r;
#endif
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
