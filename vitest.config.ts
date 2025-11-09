/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '**/node_modules/**'],
  },
});
