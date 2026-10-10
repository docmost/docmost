import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@docmost/editor-ext': path.resolve(
        __dirname,
        '../../packages/editor-ext/src/index.ts',
      ),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
