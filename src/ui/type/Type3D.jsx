import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TONES } from './tones.js';
import { TYPE3D_DETAIL, loadType3DEngine, resolveType3DFont } from './type3dEngine.js';

const VERTEX = /* glsl */ `
  attribute vec3 glyphCenter;
  attribute float glyphIndex;
  attribute float glyphProgress;

  uniform float uTime;
  uniform float uChaos;
  uniform float uSize;

  varying float vProgress;
  varying float vSeed;
  varying float vSide;
  varying vec3 vLocal;
  varying vec3 vViewNormal;

  float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453123); }

  mat3 rotateAxis(vec3 axis, float angle) {
    float s = sin(angle), c = cos(angle), t = 1.0 - c;
    return mat3(
      t * axis.x * axis.x + c,          t * axis.x * axis.y + s * axis.z, t * axis.x * axis.z - s * axis.y,
      t * axis.x * axis.y - s * axis.z, t * axis.y * axis.y + c,          t * axis.y * axis.z + s * axis.x,
      t * axis.x * axis.z + s * axis.y, t * axis.y * axis.z - s * axis.x, t * axis.z * axis.z + c
    );
  }

  void main() {
    float s1 = hash(glyphIndex + 1.0);
    float s2 = hash(glyphIndex * 1.7 + 4.2);
    float s3 = hash(glyphIndex * 2.3 + 9.1);
    float chaos = clamp(uChaos, 0.0, 1.0);
    float burst = chaos * chaos * (3.0 - 2.0 * chaos);

    // Slow per-glyph wobble: always on, a little wilder as order dissolves.
    float sway = sin(uTime * 0.9 + s1 * 6.2831853);
    float bob = sin(uTime * 0.7 + s2 * 6.2831853);

    vec3 tumbleAxis = normalize(vec3(s1 - 0.5, s2 - 0.5, s3 - 0.5) + vec3(0.0, 0.0, 0.001));
    vec3 axis = normalize(mix(vec3(0.0, 0.0, 1.0), tumbleAxis, clamp(chaos * 1.6, 0.0, 1.0)));
    float angle = sway * 0.055 * (1.0 + 3.0 * chaos)
      + burst * ((s2 * 2.0 - 1.0) * 4.2 + uTime * 0.35 * (s3 - 0.5));
    mat3 spin = rotateAxis(axis, angle);

    vec3 local = spin * (position - glyphCenter);
    vec3 direction = normalize(vec3(s1 * 2.0 - 1.0, s2 * 2.0 - 1.0, (s3 * 2.0 - 1.0) * 0.8) + vec3(0.0, 0.0001, 0.0));
    vec3 scatter = direction * (0.7 + 2.1 * s3) * uSize * 1.9 * burst;
    scatter += vec3(
      sin(uTime * 0.35 + s1 * 20.0),
      cos(uTime * 0.31 + s2 * 20.0),
      sin(uTime * 0.27 + s3 * 20.0)
    ) * 0.4 * uSize * burst;

    vec3 moved = glyphCenter + local + scatter;
    moved.y += bob * 0.03 * uSize;

    vProgress = glyphProgress;
    vSeed = s1;
    vSide = 1.0 - abs(normal.z);
    vLocal = (position - glyphCenter) / max(uSize, 0.0001);
    vViewNormal = normalize(normalMatrix * (spin * normal));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uEdge;
  uniform float uOpacity;

  varying float vProgress;
  varying float vSeed;
  varying float vSide;
  varying vec3 vLocal;
  varying vec3 vViewNormal;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
               mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    // Painterly gradient: each glyph takes its place along the run, then the
    // boundary is smeared by brush-scale noise so it never reads as a clean ramp.
    vec2 brush = vLocal.xy * vec2(3.2, 5.5) + vSeed * 17.0;
    float smear = noise(brush) * 0.6 + noise(brush * 2.7) * 0.4;
    float t = clamp(vProgress + (smear - 0.5) * 0.55 + vLocal.y * 0.22, 0.0, 1.0);
    vec3 paint = mix(uColorA, uColorB, smoothstep(0.08, 0.92, t));

    // Dry-brush streaks along the stroke direction.
    float streak = noise(vec2(vLocal.x * 2.0 + vSeed * 9.0, vLocal.y * 42.0));
    paint *= 0.9 + 0.14 * streak;

    vec3 n = normalize(vViewNormal);
    if (!gl_FrontFacing) n = -n;
    float light = 0.74 + 0.26 * clamp(dot(n, normalize(vec3(0.35, 0.6, 0.72))), 0.0, 1.0);
    vec3 color = paint * light;

    // Extrusion walls read as an ink outline.
    color = mix(color, uEdge, smoothstep(0.35, 0.8, vSide) * 0.82);

    gl_FragColor = vec4(color, uOpacity);
    #include <colorspace_fragment>
  }
`;

function anchorOffset(bounds, anchor, depth) {
  const tokens = String(anchor ?? 'center').toLowerCase().split(/[\s-]+/);
  const { min, max } = bounds;
  const x = tokens.includes('left') ? -min.x : tokens.includes('right') ? -max.x : -(min.x + max.x) / 2;
  const y = tokens.includes('top')
    ? -max.y
    : tokens.includes('bottom')
      ? -min.y
      : tokens.includes('baseline')
        ? 0
        : -(min.y + max.y) / 2;
  const z = tokens.includes('front') ? -depth : tokens.includes('back') ? 0 : -depth / 2;
  return [x, y, z];
}

let warned = false;
function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn('[Type3D] text geometry unavailable, rendering nothing:', error);
}

/**
 * Extruded, per-glyph animated 3D type (three-text mesh + classic GLSL ShaderMaterial).
 * Must be rendered inside an R3F <Canvas>. Never throws into React: on any failure it renders nothing.
 *
 * @param {object} props
 * @param {string} props.text
 * @param {'kablammo'|'londrina'|'hyper'|string} [props.font='kablammo'] built-in key or a font URL (ttf/otf/woff/woff2)
 * @param {number} [props.size=1] em size in scene units
 * @param {number} [props.depth=0.2] extrusion in scene units (0 = flat, ~3x fewer triangles)
 * @param {'left'|'center'|'right'|'justify'} [props.align='center']
 * @param {number} [props.maxWidth] wrap width in scene units
 * @param {number} [props.chaos=0] 0 = set type, 1 = exploded cloud (eased)
 * @param {string} [props.color] gradient start (tone hex / any THREE color)
 * @param {string} [props.colorB] gradient end
 * @param {string} [props.anchor='center'] any of left|right|top|bottom|baseline|front|back, space separated
 * @param {'low'|'med'|'high'} [props.detail='med'] tessellation budget
 * @param {(info: {width:number,height:number,depth:number,glyphCount:number,triangles:number,bounds:object}) => void} [props.onReady]
 */
export function Type3D({
  text,
  font = 'kablammo',
  size = 1,
  depth = 0.2,
  align = 'center',
  maxWidth,
  chaos = 0,
  color = TONES.magenta,
  colorB = TONES.ultra,
  edgeColor = TONES.ink,
  opacity = 1,
  anchor = 'center',
  detail = 'med',
  lineHeight = 1,
  letterSpacing = 0,
  onReady,
  ...groupProps
}) {
  const [built, setBuilt] = useState(null);
  const firstRun = useRef(true);
  const chaosRef = useRef(chaos);
  chaosRef.current = chaos;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const { url, lowercase } = resolveType3DFont(font);
  const content = typeof text === 'string' ? (lowercase ? text.toLowerCase() : text) : '';

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uChaos: { value: chaosRef.current },
          uSize: { value: 1 },
          uOpacity: { value: 1 },
          uColorA: { value: new THREE.Color() },
          uColorB: { value: new THREE.Color() },
          uEdge: { value: new THREE.Color() },
        },
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const u = material.uniforms;
    try {
      u.uColorA.value.set(color);
      u.uColorB.value.set(colorB);
      u.uEdge.value.set(edgeColor);
    } catch {
      /* unparsable color: keep the previous one */
    }
    u.uSize.value = size;
    u.uOpacity.value = opacity;
    material.transparent = opacity < 1;
  }, [material, color, colorB, edgeColor, size, opacity]);

  // Build (debounced after the first run) whenever anything that changes geometry changes.
  useEffect(() => {
    let cancelled = false;
    if (!content.trim() || !url) {
      setBuilt(null);
      return undefined;
    }
    const build = async () => {
      try {
        const Text = await loadType3DEngine();
        if (cancelled) return;
        const result = await Text.create({
          text: content,
          font: url,
          size,
          depth,
          lineHeight,
          letterSpacing,
          perGlyphAttributes: true,
          ...(TYPE3D_DETAIL[detail] ?? TYPE3D_DETAIL.med),
          layout: {
            align,
            hyphenate: false, // otherwise three-text tries to fetch /patterns/en-us.js
            ...(maxWidth > 0 ? { width: maxWidth } : {}),
          },
        });
        if (cancelled) {
          result.dispose();
          return;
        }
        const { min, max } = result.planeBounds;
        setBuilt({
          geometry: result.geometry,
          position: anchorOffset(result.planeBounds, anchor, depth),
          dispose: () => result.dispose(),
          info: {
            width: max.x - min.x,
            height: max.y - min.y,
            depth,
            glyphCount: result.glyphs.length,
            triangles: result.stats.trianglesGenerated,
            bounds: result.planeBounds,
          },
        });
      } catch (error) {
        warnOnce(error);
        if (!cancelled) setBuilt(null);
      }
    };
    const timer = setTimeout(build, firstRun.current ? 0 : 140);
    firstRun.current = false;
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, url, size, depth, align, maxWidth, anchor, detail, lineHeight, letterSpacing]);

  // Free the previous geometry once its replacement is committed, and the last one on unmount.
  useEffect(() => {
    if (!built) return undefined;
    try {
      onReadyRef.current?.(built.info);
    } catch (error) {
      console.error(error);
    }
    return () => {
      try {
        built.dispose();
      } catch {
        /* already gone */
      }
    };
  }, [built]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const target = Math.min(1, Math.max(0, Number(chaosRef.current) || 0));
    u.uChaos.value = THREE.MathUtils.damp(u.uChaos.value, target, 3.2, Math.min(delta, 0.1));
  });

  return (
    <group {...groupProps}>
      {built && (
        // Glyphs are displaced in the vertex shader, so the static bounds are meaningless.
        <mesh geometry={built.geometry} material={material} position={built.position} frustumCulled={false} />
      )}
    </group>
  );
}

export default Type3D;
