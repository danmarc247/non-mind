// Drifting card slab: object-space face coordinates (x in -1..1, y in about -1.44..1.44), object normal
// (to tell front, back and edge apart), view-space normal and view direction for the rim and glint.
uniform float uHalfW;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vVN;
varying vec3 vViewDir;
void main() {
  vPos = vec3(position.xy / uHalfW, position.z);
  vN = normal;
  vVN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDir = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
