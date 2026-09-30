// 一次性数据扩展脚本（2026-09-28 用户裁定造数看原型效果）：为 pol-positions.json 的
// locked 记录补 ytRedeemUAssetPerUnit——YT 结算 uAsset 腿预估样本。机制上该腿=结算回收
// 剩余池派生（锁定期不可推导，yt-flash-swap/pol-splitter.md），此处按用户裁定落样本；
// 量级锚=unlocked 已有样本 ≈ uAssetPerPol 的 3–5%（如 verse-003 0.0231/0.58≈4%）。
// 只补缺失记录（locked），不动 unlocked 结算派生真值；mulberry32 种子取记录 id，重跑幂等。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const positionsPath = join(root, 'fixtures/data/pol-positions.json');

function mulberry32(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 0.03;
const MAX = 0.05;

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
let written = 0;
for (const record of data.items) {
  if (record.ytRedeemUAssetPerUnit) continue;
  const rnd = mulberry32(`${record.id}:yt-uasset-leg`);
  const perPol = Number(record.uAssetPerPol.raw);
  const leg = perPol * (MIN + rnd() * (MAX - MIN));
  record.ytRedeemUAssetPerUnit = { raw: leg.toFixed(4), unit: 'ratio', scale: 18 };
  written += 1;
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `ytRedeemUAssetPerUnit written: ${written} rows (skipped ${data.items.length - written} existing)`,
);
