import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES } from './pages';

// axe 无障碍回归闸门（agent-workflow.md §3.2）：WCAG 2.0/2.1 A+AA 全量扫描，
// 与 e2e/a11y-baseline.json 基线比对——新增规则或节点数上涨即 FAIL；
// 存量清零会提示收缩基线。基调是回归闸而非一次性清零，存量治理走正常 UI 任务。
// 重建基线（治理后收缩 / 首次）：UPDATE_A11Y_BASELINE=1 pnpm test:e2e -- e2e/a11y.spec.ts
// 仅桌面档跑（移动端渲染同 DOM，axe 规则不随视口变化）。

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// cwd = playwright.config.ts 所在仓库根（勿用 import.meta：本包未开 "type":"module"，TS 编译为 CJS）
const BASELINE_PATH = join(process.cwd(), 'e2e', 'a11y-baseline.json');
const UPDATE = process.env.UPDATE_A11Y_BASELINE === '1';

type Entry = { id: string; impact: string; help: string; nodes: number };
type Baseline = Record<string, Entry[]>;

function readBaseline(): Baseline {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

test('axe: 无新增 WCAG A/AA 违规（基线比对）', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'axe 扫描仅桌面档');

  const baseline = readBaseline();
  const next: Baseline = {};
  const regressions: string[] = [];

  for (const { name, path } of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const found: Entry[] = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? '-',
      help: v.help,
      nodes: v.nodes.length,
    }));
    next[name] = found;

    const base = baseline[name] ?? [];
    for (const f of found) {
      const b = base.find((x) => x.id === f.id);
      if (!b) {
        regressions.push(`${name}: 新增规则 ${f.id} ×${f.nodes}（${f.help}）`);
      } else if (f.nodes > b.nodes) {
        regressions.push(`${name}: ${f.id} 节点数 ${b.nodes} → ${f.nodes}（${f.help}）`);
      }
    }
    for (const b of base) {
      if (!found.some((f) => f.id === b.id)) {
        console.log(`  改善：${name} 的 ${b.id} 已清零——请收缩 e2e/a11y-baseline.json`);
      }
    }
  }

  if (UPDATE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log('a11y 基线已重写：e2e/a11y-baseline.json');
  }
  expect(
    regressions,
    `无障碍回归（治理存量请走 UI 任务并收缩基线）:\n${regressions.join('\n')}`,
  ).toEqual([]);
});
