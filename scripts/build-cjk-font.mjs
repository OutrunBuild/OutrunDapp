// CJK 字体子集构建（决议 029 补充 2；补充 4 评审修复：范围扩档+源钉版+哈希校验）
//
// 做什么：抽取全站中文文案字符（components/global/copy.ts + fixtures/**），
// 把 Noto Sans SC 可变字体（wght 100-900）子集化为单个 woff2，按内容哈希命名
// 落 public/fonts/，并同步生成：
//   - public/fonts/noto-sc-subset-chars.json —— 覆盖字符清单+源钉版登记（check 脚本的对账基准）
//   - components/design-system/cjk-subset.ts  —— CJK_SUBSET_HREF（preload 与 @font-face 单一来源）
//
// 为什么子集化：next/font 的 Noto 是 4 字重 × 113 分片 = 452 个不可预载的
// unicode-range face，刷新必输首帧（闪变，决议 029）；子集后 1 个可预载文件
// 覆盖全字重（~363KB），与已验证的拉丁 preload 同构。
//
// 源字体钉版（补充 4）：URL 钉 noto-cjk 具体 commit（字节可复现），缓存与全新
// 下载一律校验 sha256 与 EXPECTED_SOURCE_SHA256 一致；升级源=换 commit 后必须
// 重测并同步更新两常量——杜绝「main 分支漂移→字形静默变化」。
//
// 依赖（仅本脚本需要，产品零依赖）：python3 + fonttools + brotli
//   pip install --user --break-system-packages fonttools brotli
// 源字体 36MB 默认走本地缓存（/tmp/outrun-cjk-cache/，OS 重启会丢，脚本自动
// 重下并校验）。运行：pnpm build:cjk-font（文案变更后必须重跑；漏跑由
// pnpm check:cjk-font 拦——已入 vitest 契约闸 tests/unit/contract-gates.test.ts）

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const COPY_FILE = path.join(ROOT, 'components/global/copy.ts');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');
const OUT_DIR = path.join(ROOT, 'public/fonts');
const CHARS_JSON = path.join(OUT_DIR, 'noto-sc-subset-chars.json');
const TS_OUT = path.join(ROOT, 'components/design-system/cjk-subset.ts');

// ---- 源钉版（升级源=换 commit → sha256sum 重测回填两常量 → 重跑） ----
const NOTO_CJK_COMMIT = 'f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const CJK_FONT_URL = `https://raw.githubusercontent.com/notofonts/noto-cjk/${NOTO_CJK_COMMIT}/Sans/Variable/TTF/NotoSansCJKsc-VF.ttf`;
const EXPECTED_SOURCE_SHA256 = '990c807e79c25662a5a9ecf7f971baeb2bf2eab9a559e5ecf15cdfdb8561d21f';

const CACHE_DIR = process.env.CJK_FONT_CACHE ?? path.join(tmpdir(), 'outrun-cjk-cache');
const SOURCE = process.env.CJK_FONT_SOURCE ?? path.join(CACHE_DIR, 'NotoSansSC-VF.ttf');

/** 与 check-cjk-subset.mjs 同一谓词（check 从本文件 import，单一来源）：
 *  CJK 统一表意 + Ext-A + 中文标点/全角 + 通用标点 + Latin-1 补充 + 箭头 + 数学运算符。
 *  补充 4 扩档：00A0-00FF（§±·×÷——使「非 ASCII ⊆ 子集∪emoji」对账谓词自洽）、
 *  2190-21FF（→←↔）、2200-22FF（≈≠≤≥⊙−）；评审发现原范围漏 7 个 Plex 覆盖
 *  不到的符号字（退系统字体）且旧对账闸与构建共谓词、结构性抓不到这类漏。 */
export function extractCharset(text) {
  const out = new Set();
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3400 && c <= 0x4dbf) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff01 && c <= 0xff60) ||
      (c >= 0x2000 && c <= 0x206f) ||
      (c >= 0x00a0 && c <= 0x00ff) ||
      (c >= 0x2190 && c <= 0x21ff) ||
      (c >= 0x2200 && c <= 0x22ff)
    ) {
      out.add(ch);
    }
  }
  return out;
}

function collectProjectCharset() {
  const files = [COPY_FILE];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) files.push(p);
    }
  };
  walk(FIXTURES_DIR);

  const chars = new Set();
  for (const file of files) {
    for (const ch of extractCharset(readFileSync(file, 'utf8'))) chars.add(ch);
  }
  // ASCII 保底：中英混排极少数走不到 Plex 的场合（+~6KB，换取栈序变化零风险）
  for (let c = 0x20; c <= 0x7e; c += 1) chars.add(String.fromCodePoint(c));
  return chars;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function ensureSourceFont() {
  const verify = (label) => {
    const actual = sha256(readFileSync(SOURCE));
    if (actual !== EXPECTED_SOURCE_SHA256) {
      throw new Error(
        `${label} sha256 不符钉版常量（得 ${actual.slice(0, 16)}… 期望 ${EXPECTED_SOURCE_SHA256.slice(0, 16)}…）。` +
          '刚升级了 NOTO_CJK_COMMIT 就重测回填 EXPECTED_SOURCE_SHA256；否则本地缓存/下载源被篡改，勿使用。',
      );
    }
  };

  if (existsSync(SOURCE)) {
    verify('缓存源字体');
    return;
  }
  mkdirSync(path.dirname(SOURCE), { recursive: true });
  console.log(`[build-cjk-font] 本地无源字体，下载钉版源（commit ${NOTO_CJK_COMMIT.slice(0, 8)}）`);
  const res = spawnSync('curl', ['-sL', '-o', SOURCE, CJK_FONT_URL], { stdio: 'inherit' });
  if (res.status !== 0 || !existsSync(SOURCE)) {
    throw new Error('源字体下载失败（可手动放置后重试，或设 CJK_FONT_SOURCE 指向本地文件）');
  }
  verify('新下载源字体');
}

function main() {
  const chars = [...collectProjectCharset()].sort().join('');
  console.log(`[build-cjk-font] 全站中文字符（含标点/符号/ASCII 保底）：${chars.length}`);

  ensureSourceFont();
  const sourceSha = sha256(readFileSync(SOURCE));

  const work = path.join(tmpdir(), `outrun-cjk-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const textFile = path.join(work, 'chars.txt');
  const woff2 = path.join(work, 'subset.woff2');
  writeFileSync(textFile, chars, 'utf8');

  // --no-hinting：Noto SC 无有意义 hint；--desubroutinize 对 CFF 系变体子集更稳
  const subset = spawnSync(
    'python3',
    [
      '-m',
      'fontTools.subset',
      SOURCE,
      `--text-file=${textFile}`,
      '--flavor=woff2',
      `--output-file=${woff2}`,
      '--layout-features=*',
      '--no-hinting',
      '--desubroutinize',
    ],
    { stdio: 'inherit' },
  );
  if (subset.status !== 0)
    throw new Error(
      'pyftsubset 失败（依赖：pip install --user --break-system-packages fonttools brotli）',
    );

  const woff2Bytes = readFileSync(woff2);
  const sha8 = createHash('sha1').update(woff2Bytes).digest('hex').slice(0, 8);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const old of readdirSync(OUT_DIR)) {
    if (/^noto-sc-subset\..*\.woff2$/.test(old) && old !== `noto-sc-subset.${sha8}.woff2`) {
      rmSync(path.join(OUT_DIR, old));
    }
  }
  const fontName = `noto-sc-subset.${sha8}.woff2`;
  writeFileSync(path.join(OUT_DIR, fontName), woff2Bytes);

  writeFileSync(
    CHARS_JSON,
    JSON.stringify(
      {
        chars,
        source: CJK_FONT_URL,
        sourceCommit: NOTO_CJK_COMMIT,
        sourceSha256: sourceSha,
        sha: sha8,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    TS_OUT,
    [
      '// 由 scripts/build-cjk-font.mjs 生成——勿手改；文案变更后跑 pnpm build:cjk-font',
      `// 覆盖字符清单与源钉版登记见 public/fonts/noto-sc-subset-chars.json（决议 029 补充 2/4）`,
      `export const CJK_SUBSET_HREF = '/fonts/${fontName}';`,
      '',
    ].join('\n'),
  );

  console.log(
    `[build-cjk-font] 产物 public/fonts/${fontName}（${Math.round(woff2Bytes.length / 1024)}KB）`,
  );
  console.log('[build-cjk-font] 校验：pnpm check:cjk-font');
}

// 直跑才构建：被 check-cjk-subset.mjs 以模块导入（复用 extractCharset）时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
