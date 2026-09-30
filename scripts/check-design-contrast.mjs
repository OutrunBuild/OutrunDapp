#!/usr/bin/env node
// check-design-contrast.mjs — token 对比度闸门（把 DESIGN.md §2 的「实测入档」变成可回归验证）
// 用法：
//   node scripts/check-design-contrast.mjs              解析 tokens.css，按配对表算 WCAG 对比度
//   node scripts/check-design-contrast.mjs --self-test   内置已知值校验（黑白 21:1、#767676/白 ≈4.54:1）
// 双闸门：
//   1) 回归闸：计算值 < 最低阈值（正文 4.5:1；大字/图形 3:1）→ FAIL
//   2) 漂移闸：与 DESIGN.md §2 登记的实测值差 > 0.05 → FAIL（token 变了没同步文档，或文档错了没同步 token）
// 配对表口径：文档值全部为「on --color-surface」实测（DESIGN.md §2 表头）；disabled 配对单独注明。
// 新增/修改 token 颜色时：先改 DESIGN.md §2 + tokens.css 注释（必要时走 decision-log 决议），再同步本表 doc 值。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { argv, cwd, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = cwd();
const TOKENS_PATH = join(ROOT, 'components/design-system/tokens.css');

// ---- WCAG 相对亮度与对比度 ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}
function channelLum(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelLum);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---- tokens.css 解析：--name: #hex / --name: var(--other)（一层解析） ----
function parseTokens(css) {
  const map = {};
  for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    map[m[1]] = m[2].trim();
  }
  // 解析 var() 引用到最终 hex（--color-bg → --site-black → #0A0A10）
  const resolve = (name, seen = new Set()) => {
    const v = map[name];
    if (!v || seen.has(name)) return null;
    seen.add(name);
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v.slice(0, 7) === v || v.length <= 7 ? v : v;
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref ? resolve(ref[1], seen) : null;
  };
  for (const name of Object.keys(map)) map[name] = resolve(name) ?? map[name];
  return map;
}

// ---- 配对表：fg / bg 为 token 名；doc=DESIGN.md §2 实测值（null=文档未登记，仅回归闸）；min=WCAG 下限 ----
const PAIRS = [
  // on --color-surface（文档口径）
  { fg: '--color-text', bg: '--color-surface', doc: 15.14, min: 4.5, why: '正文 AAA' },
  { fg: '--color-text-secondary', bg: '--color-surface', doc: 7.25, min: 4.5, why: '次级 AAA' },
  { fg: '--color-text-tertiary', bg: '--color-surface', doc: 5.8, min: 4.5, why: '三级 AA' },
  {
    fg: '--accent-primary',
    bg: '--color-surface',
    doc: 15.22,
    min: 3.0,
    why: 'CTA/KPI 读数（≥20px 大字档）',
  },
  { fg: '--color-success', bg: '--color-surface', doc: 10.69, min: 4.5, why: '状态文 AAA' },
  { fg: '--color-danger', bg: '--color-surface', doc: 5.89, min: 4.5, why: '状态文 AA' },
  {
    fg: '--color-warning',
    bg: '--color-surface',
    doc: 10.27,
    min: 4.5,
    why: '状态文（AA 档预警色）',
  },
  { fg: '--accent-link', bg: '--color-surface', doc: 13.06, min: 4.5, why: '链接正文尺寸' },
  {
    fg: '--accent-echo',
    bg: '--color-surface',
    doc: 5.21,
    min: 3.0,
    why: '品红仅 ≥20px 大字/图形（决议 015）',
  },
  // on --color-bg（页面底；文档未单列，回归闸兜底）
  { fg: '--color-text', bg: '--color-bg', doc: null, min: 4.5, why: '正文 on 页面底' },
  { fg: '--color-text-secondary', bg: '--color-bg', doc: null, min: 4.5, why: '次级 on 页面底' },
  { fg: '--color-text-tertiary', bg: '--color-bg', doc: null, min: 4.5, why: '三级 on 页面底' },
  { fg: '--accent-link', bg: '--color-bg', doc: null, min: 4.5, why: '链接 on 页面底' },
  // disabled（文档口径：次级文 on disabled 底）
  {
    fg: '--color-text-secondary',
    bg: '--color-disabled-bg',
    doc: 5.32,
    min: 4.5,
    why: 'disabled 控件内次级文',
  },
];

function run() {
  const tokens = parseTokens(readFileSync(TOKENS_PATH, 'utf8'));
  const failures = [];
  const rows = [];
  for (const p of PAIRS) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !/^#[0-9a-fA-F]{3,8}$/.test(fg) || !bg || !/^#[0-9a-fA-F]{3,8}$/.test(bg)) {
      failures.push(`${p.fg} on ${p.bg}：token 缺失或不可解析为 hex（fg=${fg} bg=${bg}）`);
      continue;
    }
    const ratio = contrast(fg, bg);
    const drift = p.doc !== null && Math.abs(ratio - p.doc) > 0.05;
    const below = ratio < p.min;
    if (drift) {
      failures.push(
        `${p.fg} on ${p.bg}：计算 ${ratio.toFixed(2)}:1 与 DESIGN.md §2 登记 ${p.doc}:1 漂移 >0.05 —— token 与文档需同步（改色走 decision-log 决议）`,
      );
    }
    if (below) {
      failures.push(
        `${p.fg} on ${p.bg}：${ratio.toFixed(2)}:1 低于 WCAG 下限 ${p.min}:1（${p.why}）`,
      );
    }
    rows.push({
      pair: `${p.fg.replace('--', '')} on ${p.bg.replace('--color-', '')}`,
      ratio: ratio.toFixed(2),
      doc: p.doc === null ? '—' : p.doc.toFixed(2),
      min: p.min.toFixed(1),
      ok: !drift && !below,
      why: p.why,
    });
  }
  const w = Math.max(...rows.map((r) => r.pair.length));
  console.log(`对比度闸门（源：components/design-system/tokens.css）\n`);
  for (const r of rows) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.pair.padEnd(w)}  ${r.ratio.padStart(6)}:1  doc ${r.doc.padStart(6)}  min ${r.min.padStart(4)}  ${r.why}`,
    );
  }
  console.log('');
  if (failures.length > 0) {
    console.log(`FAIL：${failures.length} 项\n`);
    for (const f of failures) console.log(`  - ${f}`);
    exit(1);
  }
  console.log('全部配对通过双闸门（回归 + 文档防漂移）✓');
}

function selfTest() {
  const cases = [
    { fg: '#FFFFFF', bg: '#000000', expect: 21 },
    { fg: '#000000', bg: '#FFFFFF', expect: 21 },
    { fg: '#767676', bg: '#FFFFFF', expect: 4.54 },
    { fg: '#E6E9F0', bg: '#12141B', expect: 15.14 },
    { fg: '#FCEE0A', bg: '#12141B', expect: 15.22 },
  ];
  let pass = true;
  for (const c of cases) {
    const got = contrast(c.fg, c.bg);
    const ok = Math.abs(got - c.expect) <= 0.01;
    if (!ok) pass = false;
    console.log(`  ${ok ? '✓' : '✗'} ${c.fg} on ${c.bg} = ${got.toFixed(2)}（期望 ${c.expect}）`);
  }
  // 3 位缩写 hex 解析
  const short = contrast('#fff', '#000');
  const okShort = Math.abs(short - 21) < 0.01;
  if (!okShort) pass = false;
  console.log(`  ${okShort ? '✓' : '✗'} 3 位缩写 #fff 解析 = ${short.toFixed(2)}`);
  if (!pass) exit(1);
  console.log('self-test 通过 ✓');
}

if (args.has('--self-test')) {
  selfTest();
  exit(0);
}
run();
