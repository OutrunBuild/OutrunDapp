import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests are pinned to tests/unit: *.spec.ts under e2e/ belongs to Playwright (pnpm test:e2e);
// without pinning, vitest's default include (**/*.spec.ts) would pick them up and they would fail under jsdom
export default defineConfig({
  resolve: {
    // Mirrors tsconfig paths (@/* → ./*): required when component-level tests import product modules containing @/ imports
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
