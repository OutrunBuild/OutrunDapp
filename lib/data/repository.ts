// 生产数据 repository（阶段 2 步骤 10 契约层）。
// 只返回真实数据来源或结构化 unavailable 状态；永不回退到原型数据（runbook 步骤 10）。
// 阶段 4–6 在此实现真实 RPC/Graph 装配；禁词清单由 scripts/check-fixture-boundary.mjs 的
// production-resolver-token 规则以字面量强制（本文件不得出现清单内词汇）。

export type DataUnavailable =
  | { reason: 'undeployed'; detail: string } // 结构化未部署（禁零地址/占位符，architecture §8）
  | { reason: 'rpc-error'; detail: string }
  | { reason: 'not-configured'; detail: string };

export type DataResult<T> =
  { status: 'ok'; data: T } | ({ status: 'unavailable' } & DataUnavailable);

export interface ProductionRepository {
  /** 六链实时余额/授权/回执（RPC；索引降级永不覆盖，§9/§16） */
  getBalances(address: string, chainId: number): Promise<DataResult<unknown>>;
  /** Graph 聚合列表（服务端 repository 查询，短缓存+去重，§9） */
  getVerseSummaries(chainId: number): Promise<DataResult<unknown>>;
}

class NotWiredRepository implements ProductionRepository {
  async getBalances(): Promise<DataResult<unknown>> {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      detail: '阶段 4–6 接入真实 RPC（生产 resolver 永不回退 fixture）',
    };
  }
  async getVerseSummaries(): Promise<DataResult<unknown>> {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      detail: '阶段 4–6 接入 Graph（服务端查询+短缓存）',
    };
  }
}

export function getProductionRepository(): ProductionRepository {
  return new NotWiredRepository();
}
