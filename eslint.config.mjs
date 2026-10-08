// ESLint 10 flat config；typed lint 使用 typescript alias（@typescript/typescript6 6.0.2
// 程序化 API，architecture §3 双编译器边界）。类型检查由 typescript7 CLI 独立负责。
// ignores 对齐 .gitignore 面（ESLint 不读 .gitignore）：构建产物（.next* 全系）、
// 证据二进制/冻结快照、本地工具点目录、vendor 冻结桥——lint 面收敛为源码与仓内脚本。
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 全局排除必须独占对象（与 rules 同对象时语义变为「该规则只作用于这些文件」——原单对象写法
  // 自始未生效，node_modules 全靠 ESLint 内建默认排除撑着）
  {
    ignores: [
      'node_modules/**',
      '.next*/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.agents/**',
      '.claude/**',
      '.dsh/**',
      '.pi/**',
      '.pi-glla/**',
      '.zcode/**',
      '.impeccable/**',
      '.worktrees/**',
      'vendor/**',
      'docs/prototype/v0-export/**',
      'docs/prototype/v0-input/**',
      'docs/design/review/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_` 开头的函数参数 = 有意占位（如 signal-ui 的 SourceRef/LayoutNotes 空实现）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
