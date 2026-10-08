// 代币图标 PNG 导出（Trust Wallet 上架格式 256×256 透明底）
// 用法：pnpm node script/token-icons/export-png.mjs
// 依赖仓库 Playwright chromium；SVG 源 docs/design/token-icons/svg/<t>-seal.svg
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'docs', 'design', 'token-icons', 'svg');
const OUT = join(ROOT, 'public', 'tokens');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
mkdirSync(OUT, { recursive: true });
for (const t of ['uusd', 'ueth', 'ubnb']) {
  await page.goto(`file://${join(SRC, `${t}-seal.svg`)}`);
  await page.screenshot({ path: join(OUT, `${t}-256.png`), omitBackground: true });
  console.log(`${t}-256.png`);
}
await browser.close();
