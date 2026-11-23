// 3. Colour: filmic shoulder, saturation lift, ragged paper-white vignette.
// Input is linear HDR, output is linear 0..1 (final pass encodes to sRGB).

uniform float uExposure;
uniform float uSaturation;
uniform float uVignette;
uniform float uTime;
uniform vec3 uPaper;     // stage ground, in the pipeline's colour space
uniform float uDisplay;  // 1: input is already display sRGB (Canvas linear/flat): no tone map

vec3 pp_aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float asp = resolution.x / resolution.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  // hue-preserving shoulder: tone-map the max channel, keep ratios
  vec3 x = max(inputColor.rgb * uExposure, 0.0);
  vec3 c;
  if (uDisplay > 0.5) {
    c = clamp(x, 0.0, 1.0);
  } else {
    float mx = max(max(x.r, x.g), x.b);
    c = mx > 1e-5 ? x * (pp_aces(vec3(mx * 0.8)).r / mx) : x;
    c = mix(c, pp_aces(x * 0.8), 0.25);
  }

  // saturation lift in a gamma-ish space so mid-tones get the push
  vec3 g = uDisplay > 0.5 ? c : sqrt(c);
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  float chroma = max(max(g.r, g.g), g.b) - min(min(g.r, g.g), g.b);
  float sat = uSaturation * (1.0 + 0.25 * (1.0 - chroma));   // vibrance
  g = max(vec3(l) + (g - vec3(l)) * sat, 0.0);
  c = uDisplay > 0.5 ? g : g * g;

  // warm the whites a touch toward paper
  float hi = smoothstep(0.7, 1.0, l);
  c = mix(c, c * uPaper, hi * 0.5);

  // paper-white vignette with a hand-torn edge
  vec2 d = (uv - 0.5) * vec2(asp, 1.0);
  float rr = length(d * vec2(0.82, 1.0));
  float rag = (pp_fbm(q * 4.0 + 3.0) - 0.5) * 0.16 + (pp_vnoise(q * 40.0) - 0.5) * 0.025;
  float v = smoothstep(0.52, 0.92, rr + rag) * uVignette;
  c = mix(c, uPaper, clamp(v, 0.0, 1.0));

  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
