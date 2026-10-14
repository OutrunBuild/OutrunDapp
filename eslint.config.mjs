// ESLint 10 flat config; typed lint uses the `typescript` package, which package.json aliases (link:) to
// vendor/typescript-bridge — the dual-compiler bridge: bin/tsc is the TS 7.0.2 CLI, the programmatic API is
// TS 6.0.2. Type checking is owned separately by the TS 7 CLI.
// ignores aligns with the .gitignore surface (ESLint does not read .gitignore): build artifacts (all .next* variants),
// test artifacts (coverage, playwright-report, test-results), evidence binaries/frozen snapshots, local tooling
// dot-directories, the vendor frozen bridge — the lint surface narrows to source code and in-repo scripts.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global excludes must live in their own object (sharing an object with rules changes the semantics to "these rules
  // apply only to these files" — the original single-object form never took effect; node_modules was covered only by
  // ESLint's built-in default ignores)
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
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Function parameters starting with `_` are intentional placeholders (e.g. signal-ui's empty SourceRef/LayoutNotes implementations)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
