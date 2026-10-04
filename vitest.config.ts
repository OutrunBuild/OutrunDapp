import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// 单测目录钉死在 tests/unit：e2e/ 下的 *.spec.ts 属 Playwright（pnpm test:e2e），
// 不钉死会被 vitest 默认 include（**/*.spec.ts）误收并在 jsdom 下跑挂
export default defineConfig({
  resolve: {
    // 镜像 tsconfig paths（@/* → ./*）：组件级测试引入含 @/ 导入的产品模块时必需
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
