// Seat ring instances: local disc coords out, per-seat state through instanced attributes.
attribute vec3 aTone;      // occupant aspect tint (display sRGB)
attribute vec4 aData;      // tol 0..1, charge 0..1, hover 0..1, invite 0..1
attribute vec4 aMisc;      // occupied 0..1, seed, selected-self 0..1, fight 0..1
varying vec2 vP; varying vec3 vTone; varying vec4 vData; varying vec4 vMisc;
void main() {
  vP = position.xy; vTone = aTone; vData = aData; vMisc = aMisc;
  vec4 w = vec4(position, 1.0);
#ifdef USE_INSTANCING
  w = instanceMatrix * w;
#endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * w;
}
