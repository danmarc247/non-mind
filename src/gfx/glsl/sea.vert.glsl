uniform float uTime; uniform float uSide; uniform float uComplexity; uniform float uOverwhelm; uniform float uR;
varying vec3 vW; varying float vH;
float wave(vec2 p, float t) {
  float a = 0.06 + 0.1 * uComplexity + 0.25 * uOverwhelm;
  return a * (sin(p.x * 0.9 + t * 1.1) * cos(p.y * 0.7 - t * 0.8) + 0.5 * sin(dot(p, vec2(0.6, 1.3)) * 1.7 + t * 1.9) + 0.25 * sin(length(p) * 3.0 - t * 2.4));
}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float edge = smoothstep(uR, uR - 2.5, length(w.xz));
  float h = wave(w.xz, uTime) * (uSide > 0.5 ? step(0.0, position.y) : edge);
  if (uSide > 0.5) { if (position.y > 0.0) w.y += wave(w.xz, uTime) * 0.0; } else w.y += h;
  vW = w.xyz; vH = h;
  gl_Position = projectionMatrix * viewMatrix * w;
}
