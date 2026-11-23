// three-text bootstrap shared by every <Type3D>. Nothing here imports three-text
// statically: the shaper (~290 kB js + ~310 kB wasm) is fetched on first use.
import hbWasmUrl from 'harfbuzzjs/dist/harfbuzz.wasm?url';
import kablammoUrl from '@fontsource/kablammo/files/kablammo-latin-400-normal.woff2?url';
import londrinaUrl from '@fontsource/londrina-solid/files/londrina-solid-latin-900-normal.woff2?url';
import hyperUrl from '../../assets/fonts/Hypermonosaturation.ttf?url';

export const TYPE3D_FONTS = {
  kablammo: { url: kablammoUrl },
  londrina: { url: londrinaUrl },
  // Hypermonosaturation has no capitals.
  hyper: { url: hyperUrl, lowercase: true },
};

/** Font key or URL -> { url, lowercase? }. */
export function resolveType3DFont(font) {
  return TYPE3D_FONTS[font] ?? { url: font };
}

// Triangle budgets. Kablammo (the heaviest face) at depth > 0 costs roughly
// low ~550, med ~770, high ~2500 triangles per glyph; flat text is about a third of that.
export const TYPE3D_DETAIL = {
  low: { curveSteps: 2, geometryOptimization: { areaThreshold: 150 } },
  med: { curveSteps: 3, geometryOptimization: { areaThreshold: 60 } },
  high: { curveSteps: 6, geometryOptimization: { areaThreshold: 8 } },
};

let enginePromise;

/** Resolves to three-text's `Text` class with HarfBuzz and WOFF2 decoding wired up. */
export function loadType3DEngine() {
  enginePromise ??= (async () => {
    const [{ Text }, { woff2Decode }] = await Promise.all([import('three-text'), import('woff-lib/woff2/decode')]);
    Text.setHarfBuzzPath(hbWasmUrl);
    Text.enableWoff2(woff2Decode);
    await Text.init();
    return Text;
  })().catch((error) => {
    enginePromise = undefined; // allow a retry on the next mount
    throw error;
  });
  return enginePromise;
}

/**
 * Warm the shaper and (optionally) the fonts so the first <Type3D> appears without a hitch.
 * Never rejects; resolves to `true` when everything loaded.
 * @param {string[]} [fonts] font keys or URLs; defaults to all built-in faces
 */
export async function preloadType3D(fonts = Object.keys(TYPE3D_FONTS)) {
  try {
    const Text = await loadType3DEngine();
    await Promise.all(
      fonts.map(async (font) => {
        const { url } = resolveType3DFont(font);
        const warm = await Text.create({ text: 'a', font: url, size: 1, depth: 0, curveSteps: 1 });
        warm.dispose();
      }),
    );
    return true;
  } catch (error) {
    console.warn('[Type3D] preload failed:', error);
    return false;
  }
}
