// Proxy for the raymarched drift solids: an icosphere that bounds the unit SDF sphere.
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
