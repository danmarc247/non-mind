// Flat drift pieces (cut paper planes, wire orbits): world position, world normal, uv.
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}
