// Standalone vitest config: node environment, no browser-only vite plugins (vite.config.js is not loaded).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
  },
});
