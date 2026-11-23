// Everything that touches @pmndrs/glyph or three/webgpu lives here and is only ever
// reached through `import('./glyphTickerRuntime.js')` from GlyphTicker.jsx, so the
// WebGPU build of three (~2 MB) and the glyph shaper wasm (~1.4 MB) stay out of the main bundle.
//
// glyph renders TSL NodeMaterials only, so it cannot draw into the game's classic
// WebGLRenderer; each ticker owns a tiny WebGPURenderer running on its WebGL2 backend.
import * as THREE from 'three/webgpu';
import { glyph, msdf } from '@pmndrs/glyph';
import { ThreeConfig } from '@pmndrs/glyph/three';

// Must match the `--msdf em-size=…` used in scripts/bake-fonts.mjs: a different size is a
// different raster, and glyph would then try (and fail) to generate it at runtime.
const MSDF_EM_SIZE = 32;

let initPromise;
let facePromise;
let nextId = 1;

function ensureGlyph() {
  initPromise ??= glyph.init().catch((error) => {
    initPromise = undefined;
    throw error;
  });
  return initPromise;
}

function ensureFace(fontUrl) {
  // A `.font.glb` URL is a baked-only source: no runtime bake, no worker, no font-baker wasm.
  facePromise ??= Promise.resolve()
    .then(() => glyph.fontFace(fontUrl, { family: 'Hypermonosaturation', format: msdf({ emSize: MSDF_EM_SIZE }) }).load())
    .catch((error) => {
      facePromise = undefined;
      throw error;
    });
  return facePromise;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ text: string, color: string, fontUrl: string, onError?: (error: unknown) => void }} options
 */
export async function mountGlyphTicker(canvas, { text, color, fontUrl, onError }) {
  const renderer = new THREE.WebGPURenderer({ canvas, forceWebGL: true, alpha: true, antialias: true });
  let handle;
  let disposed = false;
  let raf = 0;
  let line = null; // { text: glyph Text, glyphs, base, centers }
  let width = 1;
  let height = 1;
  let current = { text, color };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  const stage = new THREE.Group();
  scene.add(stage);

  const fail = (error) => {
    if (disposed) return;
    dispose();
    onError?.(error);
  };

  const scratch = {
    shift: new THREE.Matrix4(),
    spin: new THREE.Matrix4(),
    back: new THREE.Matrix4(),
    out: new THREE.Matrix4(),
  };

  function clearLine() {
    if (!line) return;
    const { glyphs, source } = line;
    line = null;
    for (const object of [glyphs, source]) {
      try {
        object?.removeFromParent();
        object?.dispose();
      } catch {
        /* disposal is best effort */
      }
    }
  }

  function setLine(face) {
    clearLine();
    const content = (current.text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!content) return;
    const fontSize = Math.max(8, height * 0.62);
    const source = handle.createText({
      font: face,
      text: content,
      style: { fontSize, color: current.color },
      layout: { wrap: 'none' },
    });
    source.onError = fail;
    stage.add(source);

    const { contentWidth, height: textHeight } = source.measure();
    // Text-local space: origin at the paragraph's top-left, x right, y up (so the text hangs below 0).
    const fit = Math.min(1, (width - fontSize * 0.5) / Math.max(contentWidth, 1));
    stage.scale.setScalar(fit);
    stage.position.set((-contentWidth / 2) * fit, (textHeight / 2) * fit, 0);

    // breakApart() needs one committed frame of the live paragraph.
    renderer.render(scene, camera);
    const state = source.commitState();
    if (state.status === 'failed') throw state.error ?? new Error('glyph text failed to commit');
    const [glyphs] = source.breakApart();
    source.visible = false;
    stage.add(glyphs);

    const base = [];
    const centers = [];
    for (let i = 0; i < glyphs.count; i += 1) {
      const matrix = new THREE.Matrix4();
      glyphs.getMatrixAt(i, matrix);
      base.push(matrix);
      centers.push(glyphs.measurements[i].anchorPoint({ x: 'center', y: 'center' }, 'ink'));
    }
    line = { source, glyphs, base, centers, fontSize };
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    try {
      if (line) {
        const t = now / 1000;
        const { glyphs, base, centers, fontSize } = line;
        for (let i = 0; i < base.length; i += 1) {
          const phase = t * 2.4 - i * 0.55;
          const lift = Math.sin(phase) * fontSize * 0.11;
          const tilt = Math.sin(phase * 0.8 + 1.3) * 0.16;
          const pulse = 1 + Math.max(0, Math.sin(phase)) * 0.09;
          const c = centers[i];
          scratch.shift.makeTranslation(c.x, c.y + lift, 0);
          scratch.spin.makeRotationZ(tilt).scale({ x: pulse, y: pulse, z: 1 });
          scratch.back.makeTranslation(-c.x, -c.y, 0);
          scratch.out.copy(scratch.shift).multiply(scratch.spin).multiply(scratch.back).multiply(base[i]);
          glyphs.setMatrixAt(i, scratch.out);
        }
      }
      renderer.render(scene, camera);
    } catch (error) {
      fail(error);
    }
  }

  function resize(w, h, dpr = window.devicePixelRatio || 1) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    clearLine();
    for (const step of [() => handle?.dispose(), () => renderer.dispose()]) {
      try {
        step();
      } catch {
        /* best effort */
      }
    }
  }

  const onContextLost = () => fail(new Error('WebGL context lost'));
  canvas.addEventListener('webglcontextlost', onContextLost);

  let face;
  try {
    await renderer.init();
    if (!renderer.backend?.isWebGLBackend) throw new Error('expected the WebGL2 backend');
    renderer.setClearColor(0x000000, 0);
    await ensureGlyph();
    face = await ensureFace(fontUrl);
    handle = glyph.handle(`non-mind/ticker/${nextId++}`, ThreeConfig);
    resize(canvas.clientWidth, canvas.clientHeight);
    setLine(face);
    renderer.render(scene, camera);
  } catch (error) {
    dispose();
    throw error;
  }
  raf = requestAnimationFrame(frame);

  const rebuild = () => {
    if (disposed) return;
    try {
      setLine(face);
    } catch (error) {
      fail(error);
    }
  };

  return {
    update(next) {
      const merged = { ...current, ...next };
      if (merged.text === current.text && merged.color === current.color) return;
      current = merged;
      rebuild();
    },
    resize(w, h, dpr) {
      if (disposed) return;
      const changed = Math.round(w) !== Math.round(width) || Math.round(h) !== Math.round(height);
      resize(w, h, dpr);
      if (changed) rebuild();
    },
    dispose,
  };
}
