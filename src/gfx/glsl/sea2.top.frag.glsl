// ContainedSea top: living paint lit as wet impasto.
// Normals: analytic swell + ripple gradients (from the vertex stage) + analytic tension chop (3 sines)
// + paint relief from screen derivatives of the paint height. No extra noise beyond sea_paint().
#include "./sea2.common.glsl"
#include "./sea2.paint.glsl"
varying vec3 vW; varying vec3 vSw; varying vec4 vRip;

void main() {
  vec2 p = vW.xz;
  float r = length(p);
  // ripples and swell push the paint around (it never dries)
  vec2 pp = p - vRip.yz * 2.2 - vSw.yz * 0.8;
  float hp;
  vec3 alb = sea_paint(pp, hp);

  // tension chop: analytic small sines
  float ct = uT * (2.2 + 2.5 * uTension);
  vec2 c1 = vec2(1.9, 1.1), c2 = vec2(-1.3, 2.3), c3 = vec2(2.7, -1.7);
  float ca = 0.012 + 0.05 * uTension + 0.03 * uOverwhelm;
  vec2 chop = ca * (c1 * cos(dot(c1, p) + ct) + c2 * cos(dot(c2, p) - ct * 1.2) + c3 * 0.6 * cos(dot(c3, p) + ct * 1.5));
  float chopH = ca * (sin(dot(c1, p) + ct) + sin(dot(c2, p) - ct * 1.2) + 0.6 * sin(dot(c3, p) + ct * 1.5));

  vec3 Nw = normalize(vec3(-(vSw.y + vRip.y + chop.x), 1.0, -(vSw.z + vRip.z + chop.y)));
  vec3 P = vW + vec3(0.0, hp * 0.1, 0.0);
  vec3 Np = normalize(cross(dFdy(P), dFdx(P)));
  Np *= sign(Np.y + 1e-5);
  vec3 N = normalize(Nw + (Np - vec3(0.0, 1.0, 0.0)) * 0.85);

  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(-0.45, 0.85, 0.3));
  float ndl = dot(N, L);
  float dif = 0.74 + 0.34 * ndl;
  dif = mix(dif, floor(dif * 4.0 + 0.5) / 4.0, 0.25);            // a little cel quantisation, like the units
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), 60.0);
  float glint = smoothstep(0.25, 0.5, sp) * (0.35 + 0.65 * smoothstep(0.05, 0.35, hp));   // crisp wet glints on ridges
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);

  vec3 col = alb * dif;
  // paper-white crests: swell tops + ridges
  float crest = smoothstep(0.06, 0.16, vSw.x + chopH + vRip.x) * (0.4 + 0.6 * smoothstep(0.1, 0.4, hp));
  col = mix(col, uPaper, crest * 0.55);
  col = mix(col, uPaper, clamp(vRip.w, 0.0, 1.0) * 0.85);         // ripple crests / the flash ring
  col = mix(col, uPaper * 1.02, glint * 0.75);
  col = mix(col, uGround, fres * 0.25);
  // meniscus where the paint meets the glass: bright lip, thin ink shadow just inside it
  float men = smoothstep(uR - 0.28, uR - 0.04, r);
  col = mix(col, uInk, smoothstep(uR - 0.7, uR - 0.35, r) * (1.0 - men) * 0.22);
  col = mix(col, uPaper, men * 0.8);
  col = mix(col, uPaper, uFlash * 0.3);
  gl_FragColor = vec4(col, 1.0);
}
