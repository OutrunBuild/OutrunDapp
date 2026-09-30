import { defineConfig } from 'vitest/config';

// 单测目录钉死在 tests/unit：e2e/ 下的 *.spec.ts 属 Playwright（pnpm test:e2e），
// 不钉死会被 vitest 默认 include（**/*.spec.ts）误收并在 jsdom 下跑挂
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
