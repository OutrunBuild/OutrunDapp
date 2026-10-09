// 契约闸门单测：四 checker 包进 vitest（与 boundary.test.ts 的 fixture-boundary 同口径），
// `pnpm test` 一条命令覆盖全闸门，pre-push 与 CI 复用本套件。checker 均只读，失败即非零退出。
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (script: string) =>
  execFileSync(process.argv[0], [join(repo, 'scripts', script)], { encoding: 'utf8' });

describe('契约闸门（设计裸值/对比度/架构合规/CJK 字体子集）', () => {
  it('check-design-bare-values：产品代码零裸值', () => {
    expect(run('check-design-bare-values.mjs')).toContain('0 命中');
  });
  it('check-design-contrast：tokens.css 对比度全配对通过', () => {
    expect(run('check-design-contrast.mjs')).toContain('全部配对通过');
  });
  it('check-architecture-compliance：架构合规 OK', () => {
    expect(run('check-architecture-compliance.mjs')).toContain('compliance OK');
  });
  it('check-cjk-subset：全站文案字符均在字体子集覆盖内（决议 029 补充 2）', () => {
    // 文案改了没跑 pnpm build:cjk-font 重切子集 → 新汉字退系统字体 → 此闸红
    expect(run('check-cjk-subset.mjs')).toContain('对账通过');
  });
});
