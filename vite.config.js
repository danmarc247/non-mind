import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';
import { fileURLToPath } from 'node:url';

// Vendor chunks (rolldown codeSplitting groups). Higher priority wins when a module matches two groups.
const nm = (names) => new RegExp(`[\\\\/]node_modules[\\\\/](${names.join('|')})[\\\\/]`);
const vendorGroups = [
  { name: 'vendor-react', test: nm(['react', 'react-dom', 'scheduler']), priority: 50 },
  { name: 'vendor-shader-park', test: nm(['shader-park-core']), priority: 40 },
  { name: 'vendor-r3f', test: nm(['@react-three', 'postprocessing', 'three-stdlib', 'camera-controls', 'maath', 'react-reconciler', 'its-fine', 'suspend-react', 'troika-[^\\\\/]+', 'meshline', 'stats-gl', 'detect-gpu', 'tunnel-rat', 'n8ao']), priority: 30 },
  { name: 'vendor-three', test: nm(['three']), priority: 35 },
  { name: 'vendor-motion', test: nm(['motion', 'framer-motion', 'motion-dom', 'motion-utils']), priority: 10 },
];

export default defineConfig({
  base: './',
  cacheDir: process.env.NM_CACHE_DIR || 'node_modules/.vite',
  plugins: [react(), tailwindcss(), glsl({ root: '/node_modules/', compress: false })],
  resolve: {
    alias: [
      // shader-park-core's "browser" field points at a 2.9 MB UMD build (non-tree-shakeable, direct eval, its own three r155).
      // The ESM build is tree-shakeable: only sculptToThreeJSShaderSource (string generation) is kept, its bundled three is dropped.
      { find: /^shader-park-core$/, replacement: fileURLToPath(new URL('./node_modules/shader-park-core/dist/shader-park-core.esm.js', import.meta.url)) },
    ],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    rolldownOptions: { output: { codeSplitting: { groups: vendorGroups } } },
  },
  server: { host: true, port: 5173 },
});
