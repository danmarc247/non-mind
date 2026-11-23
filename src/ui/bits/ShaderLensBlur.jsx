// Ported from Cult UI "Shader Lens Blur" (cult-ui.com, MIT), restyled for NON-MIND.
// jotai config atom and next-themes removed: configuration is now plain props.
// Owns one WebGL context while mounted; avoid rendering many at once.
import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import * as THREE from 'three';
import { cn } from '../../lib/cn';
import { toneHex } from './tones';

const fragmentShader = `
varying vec2 v_texcoord;

uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_time;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform float u_hoverStrength;
uniform bool u_invertMouse;
uniform bool u_isDarkMode;

#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.2831853071795864769252867665590

vec2 coord(in vec2 p) {
    p = p / u_resolution.xy;
    if (u_resolution.x > u_resolution.y) {
        p.x *= u_resolution.x / u_resolution.y;
        p.x += (u_resolution.y - u_resolution.x) / u_resolution.y / 2.0;
    } else {
        p.y *= u_resolution.y / u_resolution.x;
        p.y += (u_resolution.x - u_resolution.y) / u_resolution.x / 2.0;
    }
    p -= 0.5;
    p *= vec2(-1.0, 1.0);
    return p;
}

#define st0 coord(gl_FragCoord.xy)
#define mx coord(u_mouse * u_pixelRatio)

float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 d = abs(p - 0.5) * 4.2 - b + vec2(r);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

float sdCircle(in vec2 st, in vec2 center) {
    return length(st - center) * 2.0;
}

float sdPoly(in vec2 p, in float w, in int sides) {
    float a = atan(p.x, p.y) + PI;
    float r = TWO_PI / float(sides);
    float d = cos(floor(0.5 + a / r) * r - a) * length(max(abs(p) * 1.0, 0.0));
    return d * 2.0 - w;
}

float aastep(float threshold, float value) {
    float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
    return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

float fill(float x, float size, float edge) {
    return 1.0 - smoothstep(size - edge, size + edge, x);
}

float stroke(float x, float size, float w, float edge) {
    float d = smoothstep(size - edge, size + edge, x + w * 0.5) - smoothstep(size - edge, size + edge, x - w * 0.5);
    return clamp(d, 0.0, 1.0);
}

void main() {
    vec2 st = st0 + 0.5;
    vec2 posMouse = mx + 0.5;
    
    float size = 1.2 + sin(u_time) * 0.1;
    float roundness = 0.4 + sin(u_time * 0.5) * 0.1;
    float borderSize = 0.05 + sin(u_time * 0.7) * 0.02;
    float circleSize = 0.3 + sin(u_time * 0.8) * 0.05;
    float circleEdge = 0.5 + sin(u_time * 0.6) * 0.1;
    
    float sdfCircle = fill(
        sdCircle(st, posMouse),
        circleSize,
        circleEdge
    );
    
    float sdf;
    if (VAR == 0) {
        sdf = sdRoundRect(st, vec2(size), roundness);
        sdf = stroke(sdf, 0.0, borderSize, sdfCircle) * 4.0;
    } else if (VAR == 1) {
        sdf = sdCircle(st, vec2(0.5));
        sdf = fill(sdf, 0.6, sdfCircle) * 1.2;
    } else if (VAR == 2) {
        sdf = sdCircle(st, vec2(0.5));
        sdf = stroke(sdf, 0.58, 0.02, sdfCircle) * 4.0;
    } else if (VAR == 3) {
        sdf = sdPoly(st - vec2(0.5, 0.45), 0.3, 3);
        sdf = fill(sdf, 0.05, sdfCircle) * 1.4;
    }
    
    vec3 gradient = mix(
        mix(u_color1, u_color2, 0.5 + 0.5 * cos(u_time + st.x + 0.0)),
        mix(u_color3, u_color4, 0.5 + 0.5 * cos(u_time + st.y + 2.0)),
        0.5 + 0.5 * cos(u_time + st.x + st.y + 4.0)
    );
    
    vec3 shapeColor = sdf * gradient;
    
    float mouseEffect = u_invertMouse ? 1.0 - sdfCircle : sdfCircle;
    shapeColor = mix(shapeColor, vec3(1.0) - shapeColor, u_hoverStrength * mouseEffect);
    
    if (u_isDarkMode) {
        shapeColor = mix(shapeColor, vec3(1.0), 0.2);
    } else {
        shapeColor = mix(shapeColor, vec3(0.0), 0.1);
    }
    
    gl_FragColor = vec4(shapeColor, sdf);
}
`


export function ShaderLensBlur({
  variation = 3, // 0 round-rect stroke, 1 disc, 2 ring, 3 triangle
  color1 = toneHex('magenta'),
  color2 = toneHex('ultra'),
  color3 = toneHex('yolk'),
  color4 = toneHex('teal'),
  enableHover = true,
  invertMouse = true,
  isDarkMode = false,
  width = '100%',
  height = '400px',
  showHint = true,
  className,
  style,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const materialRef = useRef(null);
  const interactingRef = useRef(false);
  const hoverRef = useRef(enableHover);
  hoverRef.current = enableHover;

  // GL setup: rebuilt only when the shape variation changes.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.z = 1;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 v_texcoord;
        void main() {
          gl_Position = vec4(position, 1.0);
          v_texcoord = uv;
        }
      `,
      fragmentShader,
      uniforms: {
        u_mouse: { value: new THREE.Vector2() },
        u_resolution: { value: new THREE.Vector2() },
        u_pixelRatio: { value: 1 },
        u_time: { value: 0 },
        u_color1: { value: new THREE.Color() },
        u_color2: { value: new THREE.Color() },
        u_color3: { value: new THREE.Color() },
        u_color4: { value: new THREE.Color() },
        u_hoverStrength: { value: 0 },
        u_invertMouse: { value: true },
        u_isDarkMode: { value: false },
      },
      defines: { VAR: variation },
      transparent: true,
      blending: THREE.NormalBlending,
    });
    materialRef.current = material;
    scene.add(new THREE.Mesh(geometry, material));

    let pixelRatio = 1;
    const updateSize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      const aspect = w / h;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      material.uniforms.u_resolution.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2()));
      material.uniforms.u_pixelRatio.value = pixelRatio;
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    let raf = 0;
    const animate = (time) => {
      if (Math.min(window.devicePixelRatio || 1, 2) !== pixelRatio) updateSize();
      material.uniforms.u_time.value = time * 0.001;
      material.uniforms.u_hoverStrength.value = interactingRef.current || hoverRef.current ? 0.3 : 0;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const move = (x, y) => {
      if (!(interactingRef.current || hoverRef.current)) return;
      const rect = container.getBoundingClientRect();
      material.uniforms.u_mouse.value.set(x - rect.left, rect.height - (y - rect.top));
    };
    const onPointerMove = (e) => move(e.clientX, e.clientY);
    const onTouchMove = (e) => e.touches.length > 0 && move(e.touches[0].clientX, e.touches[0].clientY);
    const down = () => (interactingRef.current = true);
    const up = () => (interactingRef.current = false);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('touchmove', onTouchMove);
    container.addEventListener('pointerdown', down);
    container.addEventListener('pointerup', up);
    container.addEventListener('touchstart', down);
    container.addEventListener('touchend', up);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointerup', up);
      container.removeEventListener('touchstart', down);
      container.removeEventListener('touchend', up);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      materialRef.current = null;
    };
  }, [variation]);

  // Cheap uniform updates.
  useEffect(() => {
    const m = materialRef.current;
    if (!m) return;
    m.uniforms.u_color1.value.set(color1);
    m.uniforms.u_color2.value.set(color2);
    m.uniforms.u_color3.value.set(color3);
    m.uniforms.u_color4.value.set(color4);
    m.uniforms.u_invertMouse.value = invertMouse;
    m.uniforms.u_isDarkMode.value = isDarkMode;
  }, [variation, color1, color2, color3, color4, invertMouse, isDarkMode]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn('relative overflow-hidden rounded-[18px] border-[3px] border-ink bg-paper', className)}
      style={{ width, height, ...style }}
    >
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      {showHint && (
        <div className="pointer-events-none absolute bottom-3 left-3 font-body text-xs italic text-ink-2">
          {enableHover ? `${invertMouse ? 'Inverted' : 'Normal'} mouse interaction` : 'Interact with the animation'} using
          mouse or touch
        </div>
      )}
    </motion.div>
  );
}

export default ShaderLensBlur;
