import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), glsl({ root: '/node_modules/', compress: false })],
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
  server: { host: true, port: 5173 },
});
