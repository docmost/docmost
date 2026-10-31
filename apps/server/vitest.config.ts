import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const baseFormula = resolve(import.meta.dirname, '../../packages/base-formula/src');

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@docmost/base-formula/server': `${baseFormula}/index.server.ts`,
      '@docmost/base-formula/client': `${baseFormula}/index.client.ts`,
    },
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // Match Node's CommonJS interop, or namespace imports that break at runtime pass here.
    deps: { interopDefault: false },
    coverage: { reportsDirectory: './coverage' },
  },
});
