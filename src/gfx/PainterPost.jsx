// NON-MIND painter post-processing stack.
// Turns any rendered scene into wet acrylic paint, and lets it fall apart as the
// player is overwhelmed. Place <PainterPost /> inside an R3F <Canvas>.
//
// Chain (one EffectPass each, mergeMode="none" so every convolution sees the
// previous stage's output):
//   1. KuwaharaEffect   anisotropic generalized Kuwahara (4 sectors, structure tensor)
//   2. ReliefEffect     impasto height + bristle LIC lighting, canvas weave, ink edges (reads depth)
//   3. BloomEffect      library mipmap bloom, low; flash pumps it
//   4. GradeEffect      filmic shoulder, saturation/vibrance, torn paper-white vignette
//   5. OverwhelmEffect  wobble, chroma smear, tension streaks, posterise, splashes/drips, whiteout, flash
// Every uniform is refreshed each frame from the shared `mood` object.
import { useEffect, useMemo, useRef } from 'react';
import { EffectComposer } from '@react-three/postprocessing';
import { Effect, EffectAttribute, BlendFunction, BloomEffect } from 'postprocessing';
import { Uniform, Vector2, Vector3, SRGBColorSpace } from 'three';
import { mood, PALETTE } from './mood.js';
import { mixStagePalette, linearToSrgb, srgbToLinear } from './palettes/stages.js';

import commonGlsl from './glsl/post.common.glsl';
import kuwaharaGlsl from './glsl/post.kuwahara.glsl';
import reliefGlsl from './glsl/post.relief.glsl';
import gradeGlsl from './glsl/post.grade.glsl';
import overwhelmGlsl from './glsl/post.overwhelm.glsl';

// Per-quality tap budgets.
//   kuwahara taps = 4 sectors * RINGS * ANGLES + 1 centre (+8 or +16 tensor taps)
export const PAINTER_QUALITY = {
  low: { RINGS: 2, ANGLES: 2, WIDE_TENSOR: 0, LIC_TAPS: 2, SMEAR_TAPS: 3, bloomLevels: 4 },
  med: { RINGS: 3, ANGLES: 3, WIDE_TENSOR: 0, LIC_TAPS: 4, SMEAR_TAPS: 5, bloomLevels: 5 },
  high: { RINGS: 3, ANGLES: 4, WIDE_TENSOR: 1, LIC_TAPS: 6, SMEAR_TAPS: 7, bloomLevels: 6 },
};

// Colour space. The game Canvas is `linear legacy flat`: shaders write display
// sRGB, the renderer does no conversion and the composer must not tone-map or
// re-encode. A colour-managed Canvas (outputColorSpace sRGB) feeds linear HDR;
// then the grade tone-maps and the final pass encodes. Detected per frame.
const isDisplay = (renderer) => !renderer || renderer.outputColorSpace !== SRGBColorSpace;

// Stage look, recomputed once per frame (cached on mood.stage/overwhelm/space).
// Tokens (PALETTE) are sRGB triples; stage palette colours are linear.
const LOOK = { key: '', display: true };
function stageLook(display) {
  const st = Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0));
  const key = `${st.toFixed(4)}|${display}`;
  if (LOOK.key === key) return LOOK;
  const p = mixStagePalette(st);
  const fromLin = (c) => (display ? c.map(linearToSrgb) : c);
  const fromTok = (c) => (display ? c : c.map(srgbToLinear));
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const crimsonTok = [0.55, 0.04, 0.18];
  Object.assign(LOOK, {
    key,
    display,
    stage: st,
    ground: fromLin(p.ground),
    ink: fromLin(p.ink),
    magenta: fromTok(PALETTE.magenta),
    ultra: fromTok(PALETTE.ultra),
    accent: fromLin(mix(p.accent, PALETTE.violet.map(srgbToLinear), 0.35)),
    crimson: fromLin(mix(crimsonTok.map(srgbToLinear), p.ink, 0.4)),
    saturation: p.saturation,
    density: p.strokeDensity,
  });
  return LOOK;
}
const setV3 = (u, c) => u.value.set(c[0], c[1], c[2]);

const DEFAULTS = {
  strength: 1, // kuwahara blend 0..1
  radius: 7, // brush radius (px at 720p)
  relief: 1, // impasto lighting
  bristle: 1, // bristle groove depth
  canvas: 1, // canvas weave
  dab: 1, // palette-knife dab tone breakup (far/sky only)
  near: 50, // view distance below which painting is light (arena)
  far: 80, // view distance beyond which painting is full (sky)
  ink: 0.7, // ink edge lines
  exposure: 1.05,
  saturation: 1.3,
  vignette: 1,
  bloom: 0.35,
};

const frag = (src) => `${commonGlsl}\n${src}`;
const defs = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k, String(v)]));
const unis = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k, new Uniform(v)]));

class KuwaharaEffect extends Effect {
  constructor(q, params) {
    super('PainterKuwahara', frag(kuwaharaGlsl), {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      defines: defs({ RINGS: q.RINGS, ANGLES: q.ANGLES, WIDE_TENSOR: q.WIDE_TENSOR }),
      uniforms: unis({ uStrength: 1, uRadius: 5, uTime: 0, uComplexity: 0, uNearFar: new Vector2(50, 80) }),
    });
    this.params = params;
  }
  update() {
    const p = this.params.current;
    const u = this.uniforms;
    u.get('uStrength').value = p.strength;
    // brushes get a touch broader as complexity accumulates and as overwhelm bites
    u.get('uRadius').value = p.radius * (1 + 0.25 * mood.complexity + 0.35 * mood.overwhelm);
    u.get('uTime').value = mood.time;
    u.get('uComplexity').value = mood.complexity;
    u.get('uNearFar').value.set(p.near, p.far);
  }
}

class ReliefEffect extends Effect {
  constructor(q, params) {
    super('PainterRelief', frag(reliefGlsl), {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      defines: defs({ LIC_TAPS: q.LIC_TAPS }),
      uniforms: unis({
        uRelief: 1, uBristle: 1, uCanvas: 1, uInk: 0.7, uDab: 1, uTime: 0,
        uInkColor: new Vector3(...PALETTE.ink), uNearFar: new Vector2(50, 80),
      }),
    });
    this.params = params;
  }
  update(renderer) {
    const p = this.params.current;
    const u = this.uniforms;
    const look = stageLook(isDisplay(renderer));
    // impasto thickens with progress (stage stroke density 0.05..0.98)
    u.get('uRelief').value = p.relief * (0.7 + 0.6 * look.density) * (1 + 0.3 * mood.tension);
    setV3(u.get('uInkColor'), look.ink);
    u.get('uNearFar').value.set(p.near, p.far);
    u.get('uBristle').value = p.bristle;
    u.get('uCanvas').value = p.canvas;
    u.get('uDab').value = p.dab;
    u.get('uInk').value = p.ink * (1 - 0.6 * mood.overwhelm);
    u.get('uTime').value = mood.time;
  }
}

class GradeEffect extends Effect {
  constructor(params) {
    super('PainterGrade', frag(gradeGlsl), {
      blendFunction: BlendFunction.NORMAL,
      uniforms: unis({ uExposure: 1, uSaturation: 1.3, uVignette: 1, uTime: 0, uDisplay: 1, uPaper: new Vector3(...PALETTE.paper) }),
    });
    this.params = params;
  }
  update(renderer) {
    const p = this.params.current;
    const u = this.uniforms;
    const look = stageLook(isDisplay(renderer));
    u.get('uDisplay').value = look.display ? 1 : 0;
    setV3(u.get('uPaper'), look.ground);
    // display-space input is already graded by the scene: keep the lift gentler
    const base = look.display ? 1 + (p.saturation - 1) * 0.5 : p.saturation;
    const stageSat = 0.92 + 0.14 * Math.min(1.3, look.saturation);   // ~0.95 .. 1.1
    u.get('uExposure').value = (look.display ? 1 : p.exposure) * (1 + 0.6 * mood.flash);
    u.get('uSaturation').value = base * stageSat * (1 + 0.1 * mood.complexity + 0.1 * mood.tension);
    u.get('uVignette').value = p.vignette * (1 + 0.5 * mood.overwhelm);
    u.get('uTime').value = mood.time;
  }
}

class OverwhelmEffect extends Effect {
  constructor(q) {
    super('PainterOverwhelm', frag(overwhelmGlsl), {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      defines: defs({ SMEAR_TAPS: q.SMEAR_TAPS }),
      uniforms: unis({
        uOverwhelm: 0, uTension: 0, uFlash: 0, uTime: 0, uAudio: 0,
        uDisplay: 1,
        uPaper: new Vector3(...PALETTE.paper),
        uMagenta: new Vector3(...PALETTE.magenta),
        uUltra: new Vector3(...PALETTE.ultra),
        uViolet: new Vector3(...PALETTE.violet),
        uCrimson: new Vector3(0.55, 0.04, 0.18),
      }),
    });
  }
  update(renderer) {
    const u = this.uniforms;
    const look = stageLook(isDisplay(renderer));
    u.get('uDisplay').value = look.display ? 1 : 0;
    setV3(u.get('uPaper'), look.ground);
    setV3(u.get('uMagenta'), look.magenta);
    setV3(u.get('uUltra'), look.ultra);
    setV3(u.get('uViolet'), look.accent);
    setV3(u.get('uCrimson'), look.crimson);
    u.get('uOverwhelm').value = mood.overwhelm;
    u.get('uTension').value = mood.tension;
    u.get('uFlash').value = mood.flash;
    u.get('uTime').value = mood.time;
    u.get('uAudio').value = mood.audio ? mood.audio.low || 0 : 0;
  }
}

class PainterBloom extends BloomEffect {
  constructor(q, params) {
    super({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.35,
      intensity: 0.35,
      radius: 0.6,
      levels: q.bloomLevels,
    });
    this.params = params;
  }
  update(renderer, inputBuffer, dt) {
    // display-space paper is ~0.97: only let true highlights (and the flash) bloom
    const display = isDisplay(renderer);
    this.luminanceMaterial.threshold = display ? 0.985 : 0.85;
    this.intensity = this.params.current.bloom * (display ? 0.6 : 1) + 2.5 * mood.flash;
    super.update(renderer, inputBuffer, dt);
  }
}

/**
 * @param {{quality?: 'low'|'med'|'high', enabled?: boolean} & Partial<typeof DEFAULTS>} props
 */
export function PainterPost({ quality = 'med', enabled = true, renderPriority = 1, ...overrides }) {
  const q = PAINTER_QUALITY[quality] || PAINTER_QUALITY.med;
  const params = useRef({ ...DEFAULTS });
  params.current = { ...DEFAULTS, ...overrides };

  const effects = useMemo(
    () => [
      new KuwaharaEffect(q, params),
      new ReliefEffect(q, params),
      new PainterBloom(q, params),
      new GradeEffect(params),
      new OverwhelmEffect(q),
    ],
    [q],
  );
  useEffect(() => () => effects.forEach((e) => e.dispose()), [effects]);

  return (
    <EffectComposer
      key={quality}
      enabled={enabled}
      renderPriority={renderPriority}
      multisampling={0}
      depthBuffer
      mergeMode="none"
    >
      {effects.map((e) => (
        <primitive key={e.name} object={e} dispose={null} />
      ))}
    </EffectComposer>
  );
}

export default PainterPost;
export { KuwaharaEffect, ReliefEffect, GradeEffect, OverwhelmEffect, PainterBloom };
