// ESLint 10 flat config；typed lint 使用 typescript alias（@typescript/typescript6 6.0.2
// 程序化 API，architecture §3 双编译器边界）。类型检查由 typescript7 CLI 独立负责。
import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['node_modules/**', '.next/**', 'docs/prototype/v0-export/**', 'docs/design/review/**'],
  rules: {
    // `_` 开头的函数参数 = 有意占位（如 signal-ui 的 SourceRef/LayoutNotes 空实现）
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
