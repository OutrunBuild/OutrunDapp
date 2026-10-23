import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FALLBACK_PAGES, PAGES, ZH_PAGES } from './pages';

// axe accessibility regression gate: full WCAG 2.0/2.1
// A+AA scan compared against the e2e/a11y-baseline.json baseline — a new rule
// or node-count increase FAILs; an emptied stock issue prompts baseline
// shrinkage. The intent is a regression gate, not a one-time cleanup; stock
// remediation goes through normal UI tasks.
// Rebuild the baseline (post-remediation shrink / first run):
// UPDATE_A11Y_BASELINE=1 pnpm test:e2e -- e2e/a11y.spec.ts
// Desktop tier only (mobile renders the same DOM; axe rules do not vary by viewport).

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// cwd = repo root where playwright.config.ts lives (do not use import.meta: this
// package has no "type":"module", TS compiles to CJS)
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

// Full-page sweep (19 routes × axe scan): needs more than the 60s default.
test('axe: no new WCAG A/AA violations (baseline comparison)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(testInfo.project.name !== 'desktop-1280', 'axe scan runs on the desktop tier only');

  const baseline = readBaseline();
  const next: Baseline = {};
  const regressions: string[] = [];

  // zh variant pages enter the scan: zh is
  // a different DOM — copy/layout variants can introduce violations invisible to
  // the en scan; the "mobile same DOM" tier-skipping rationale covers viewport
  // only, not language variants.
  for (const { name, path, connectWallet } of [...PAGES, ...ZH_PAGES, ...FALLBACK_PAGES]) {
    await page.goto(path, { waitUntil: 'networkidle' });
    // connectWallet entries scan the connected-state full DOM (same standard as the
    // visual baseline); *-disconnected scans the default state
    if (connectWallet) {
      const control = page.locator('.wallet-control');
      // Fixture builds toggle the harness on the Login button: the click swaps the
      // button for the account-menu trigger. Connected = the swap happened.
      // (Opening the menu itself is covered by unit tests; e2e keeps the menu
      // closed for scans, matching the old baseline.)
      await control.click();
      await expect(control).toHaveAttribute('aria-haspopup', 'menu');
    }
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
        regressions.push(`${name}: new rule ${f.id} x${f.nodes} (${f.help})`);
      } else if (f.nodes > b.nodes) {
        regressions.push(`${name}: ${f.id} node count ${b.nodes} -> ${f.nodes} (${f.help})`);
      }
    }
    for (const b of base) {
      if (!found.some((f) => f.id === b.id)) {
        console.log(
          `  improvement: ${name} ${b.id} cleared to zero — shrink e2e/a11y-baseline.json`,
        );
      }
    }
  }

  if (UPDATE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log('a11y baseline rewritten: e2e/a11y-baseline.json');
  }
  expect(
    regressions,
    `accessibility regressions (remediate stock via UI tasks and shrink the baseline):\n${regressions.join('\n')}`,
  ).toEqual([]);
});
