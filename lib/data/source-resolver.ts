// build-mode resolver —— 生产数据源的唯一选择点（阶段 2 步骤 10）。
// 规则（fixture-boundary-contract.md）：
//  1) 生产构建/生产代码只经本文件拿数据；本文件只指向生产 repository。
//  2) 原型模式由 components/<域>/** 直接引 fixtures 数据源（不经本文件）——
//     因此生产 import 图在静态检查下永不可达 fixtures/**。
//  3) 本文件与生产 repository 禁含：原型仓库名、场景选择器、fixture 哨兵常量名
//     （scripts/check-fixture-boundary.mjs 与 source-resolver.test.ts 以字面量清单强制）。
export { getProductionRepository, type ProductionRepository, type DataResult } from './repository';

import { getProductionRepository } from './repository';

let cached: ReturnType<typeof getProductionRepository> | null = null;

/** 每请求/每模块复用同一生产 repository 实例（React cache 的装配点，§9） */
export function resolveDataSource() {
  return (cached ??= getProductionRepository());
}
