// 场景协议（步骤 5 收缩版，决议 014/015）：仅保留瞬态视图的截图冻结钩子。
// 用途=步骤 8 截图矩阵让页面定格在瞬态；真实用户不可见（生产门控）。
// 数据变体场景（paused/zero-balance 等）已随 11 路由蓝图作废移除——数据状态由
// fixture 数据本身表达（决议 014）。
// 决议 015：index-lag 用户可见横幅撤除——索引落后为静默降级（列表数据稍旧，
// 余额等实时读数照常），无 UI。架构 §383/§476 的降级原则保留、呈现方式改静默。

/** 截图冻结钩子白名单 */
export const SCENARIO_IDS = ['loading', 'empty', 'error'] as const;

export type ScenarioView = (typeof SCENARIO_IDS)[number] | 'normal';

export function isScenarioView(value: string): value is Exclude<ScenarioView, 'normal'> {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

/**
 * 场景参数解析。生产构建（OUTRUN_DATA_SOURCE=production）不解析、不注入——
 * 带该参数的生产访问按默认路径处理。
 */
export function parseScenarioParam(value: string | string[] | undefined): ScenarioView | null {
  if (process.env.OUTRUN_DATA_SOURCE === 'production') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return isScenarioView(raw) ? raw : null;
}

/** 是否渲染横幅/骨架而非数据（empty=清空列表，无横幅） */
export function isDegradeView(view: ScenarioView): view is 'loading' | 'empty' | 'error' {
  return view === 'loading' || view === 'empty' || view === 'error';
}

/**
 * 应用场景到列表：loading/error 清空数据（配合横幅/骨架），其余场景列表照常。
 */
export function applyScenarioToVerses<T>(verses: T[], view: ScenarioView | null): T[] {
  if (!view) return verses;
  if (isDegradeView(view)) return [];
  return verses;
}

export type DegradeTone = 'loading' | 'error';

export function degradeToneFor(view: ScenarioView): DegradeTone | null {
  if (view === 'loading') return 'loading';
  if (view === 'error') return 'error';
  return null;
}
