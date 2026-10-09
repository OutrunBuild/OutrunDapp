// CJK 字体子集对账闸（决议 029 补充 2；补充 4 评审修复：双谓词消除共谓词盲区）：
//   谓词一：全站文案抽出字符 ⊆ 已部署子集覆盖清单——拦「文案改了没重切」；
//   谓词二：全站文案的全部非 ASCII 字符 ⊆ 子集 ∪ emoji 白名单——拦「字符落在
//           抽取范围之外、谓词一结构性看不见」的漏（评审实证：→ ≈ ≤ ≥ ⊙ 等
//           7 字曾退系统字体而旧闸哑火）。emoji 走系统 emoji 字体是正确行为
//           （Noto Sans SC 本就不含），故入白名单。
// 两个谓词都 fail 时逐条给修复指引。运行：pnpm check:cjk-font（vitest 契约闸
// 第四项亦跑本脚本）。自测：pnpm check:cjk-font -- --self-test——注入「瘸」（谓词一）
// 与「✓」（谓词二）各一枚，期望本闸报错（验证闸本身两根线都通电）。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARS_JSON = path.join(ROOT, 'public/fonts/noto-sc-subset-chars.json');
const TS_REF = path.join(ROOT, 'components/design-system/cjk-subset.ts');
const OUT_DIR = path.join(ROOT, 'public/fonts');

const { extractCharset } = await import('./build-cjk-font.mjs');

/** emoji 白名单（谓词二放行区）：emoji 主区+补充区 + 杂项符号区 + 变体选择符/零宽连接符 */
const isEmoji = (c) =>
  (c >= 0x1f000 && c <= 0x1faff) || (c >= 0x2600 && c <= 0x26ff) || c === 0xfe0f || c === 0x200d;

function collectProjectText() {
  const files = [path.join(ROOT, 'components/global/copy.ts')];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'fixtures'));
  return files.map((f) => readFileSync(f, 'utf8'));
}

const selfTest = process.argv.includes('--self-test');
const failures = [];

if (!existsSync(CHARS_JSON)) {
  failures.push('public/fonts/noto-sc-subset-chars.json 缺失——先跑 pnpm build:cjk-font');
} else {
  const manifest = JSON.parse(readFileSync(CHARS_JSON, 'utf8'));
  const covered = new Set(manifest.chars);

  // 产物文件与 href 引用一致性
  const woff2s = readdirSync(OUT_DIR).filter((f) => /^noto-sc-subset\.[0-9a-f]{8}\.woff2$/.test(f));
  if (woff2s.length !== 1) {
    failures.push(`public/fonts 应恰有 1 个哈希产物，实得 ${woff2s.length}：${woff2s.join(', ')}`);
  }
  const ts = existsSync(TS_REF) ? readFileSync(TS_REF, 'utf8') : '';
  const href = ts.match(/CJK_SUBSET_HREF = '([^']+)'/)?.[1];
  if (!href) {
    failures.push(
      'components/design-system/cjk-subset.ts 缺 CJK_SUBSET_HREF——重跑 pnpm build:cjk-font',
    );
  } else if (!existsSync(path.join(ROOT, 'public', href.slice(1)))) {
    failures.push(`CJK_SUBSET_HREF 指向的 ${href} 不存在`);
  }

  const texts = collectProjectText();

  // 谓词一：范围内抽出的字符 ⊆ 子集覆盖（文案变更→重切）
  const extracted = new Set();
  for (const text of texts) {
    for (const ch of extractCharset(text)) extracted.add(ch);
  }
  const missing = [...extracted].filter((ch) => !covered.has(ch));
  if (selfTest) missing.push('瘸'); // 自测线一：范围外的生僻汉字，必不在子集
  if (missing.length > 0) {
    failures.push(
      `谓词一：子集未覆盖 ${missing.length} 字（将退回系统字体）：${missing.join('')} —— 跑 pnpm build:cjk-font 重切`,
    );
  }

  // 谓词二：全部非 ASCII ⊆ 子集 ∪ emoji 白名单（范围外字符，谓词一结构性看不见）
  const nonAsciiOutside = new Set();
  for (const text of texts) {
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (
        c > 0x7e &&
        ch !== '\n' &&
        ch !== '\r' &&
        ch !== '\t' &&
        !isEmoji(c) &&
        !covered.has(ch)
      ) {
        nonAsciiOutside.add(ch);
      }
    }
  }
  if (selfTest) nonAsciiOutside.add('✓'); // 自测线二：U+2713 非 ASCII 非 emoji，范围∪子集之外
  if (nonAsciiOutside.size > 0) {
    failures.push(
      `谓词二：${nonAsciiOutside.size} 个非 ASCII 字符在抽取范围与子集之外（将退系统字体且谓词一看不见）：` +
        `${[...nonAsciiOutside].join('')} —— 在 scripts/build-cjk-font.mjs 的 extractCharset 扩档后跑 pnpm build:cjk-font`,
    );
  }
}

if (failures.length > 0) {
  console.error(selfTest ? '✓ 自测符合预期（闸在未覆盖字符上正确报错）：' : '✗ CJK 子集对账失败：');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(selfTest ? 0 : 1);
}

if (selfTest) {
  console.error('✗ 自测态未触发报错：闸本身有 bug');
  process.exit(1);
}
console.log('✓ CJK 子集对账通过：全站文案字符均在子集覆盖内（双谓词），产物与 href 引用一致');
