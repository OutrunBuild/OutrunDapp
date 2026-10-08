// 三层共用基础类型源（2026-10-08 边界修复）：Locale/VerseStage/FixtureChain 是全站共享词汇，
// 不是 fixture 样本数据；先前寄居 lib/data/fixture-repository.ts，迫使 design-system 基座
// （showcase）与 lib/locale 越界引数据桥取类型。本模块必须保持零数据层依赖：
// 禁止 import fixtures/** 与 lib/data/fixture-repository（check-fixture-boundary 的
// direct-fixture-import / illegal-bridge-consumer 规则管辖）；其余任何层可引本模块。
export type FixtureChain = {
  chainId: number;
  name: string;
  env: 'mainnet' | 'testnet';
  nativeSymbol: string;
  sourceRef: string;
};

export type Locale = 'zh' | 'en';
export type VerseStage = 'genesis' | 'locked' | 'unlocked' | 'refund';
