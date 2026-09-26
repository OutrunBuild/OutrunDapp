// prototype repository —— fixtures 的唯一合法消费方（阶段 2 步骤 10）。
// 允许的 import 图：fixtures/** → 本文件 → components/prototype/** 或 fixtures/inspector/**
// 生产代码（app/features/entities/components(非 prototype)/lib(非本文件)）禁止直接或间接导入：
// 由 scripts/check-fixture-boundary.mjs --source / --graph production 强制。
import { OUTRUN_FIXTURE_ONLY_v1, fixtureData } from '../../fixtures/index';

export const PROTOTYPE_ONLY_SENTINEL = OUTRUN_FIXTURE_ONLY_v1;

export const prototypeRepository = {
  sentinel: PROTOTYPE_ONLY_SENTINEL,
  chains: () => fixtureData.chains.items,
  assets: () => fixtureData.assets.items,
  verses: () => fixtureData.verses.items,
  markets: () => fixtureData.markets.items,
  positions: () => fixtureData.positions.items,
  psm: () => fixtureData.psm.items,
  usrVaults: () => fixtureData.usrVaults.items,
  bridgeMessages: () => fixtureData.bridgeMessages.items,
  transactions: () => fixtureData.transactions.items,
  governance: () => fixtureData.governance.items,
  staking: () => fixtureData.staking.items,
  polPositions: () => fixtureData.polPositions.items,
  accounts: () => fixtureData.accounts.items,
  notifications: () => fixtureData.notifications.items,
  participations: () => fixtureData.participations.items,
  scenarios: () => fixtureData.scenarios.items,
} as const;

// ---------------------------------------------------------------------------
// ViewModel 层（v0 迁移 2026-09-19：决议 011 三代表页产出并入；数据仍全部
// 来自上方 fixture 读取，禁止自造领域数值；价格/涨跌由 candles 推导）。
// ---------------------------------------------------------------------------

export type PrototypeChain = {
  chainId: number;
  name: string;
  env: 'mainnet' | 'testnet';
  nativeSymbol: string;
  sourceRef: string;
};

export type Locale = 'zh' | 'en';
export type VerseStage = 'genesis' | 'locked' | 'unlocked' | 'refund';

export type SourceRecord = { id: string; sourceRef: string };

export type PrototypeMarket = SourceRecord & {
  verseId: string;
  pool: 'main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol';
  tvl: number;
  feeState: string;
  /** 24h 成交量快照；null=fixture 缺失→UI 显「以链上读值为准」槽位 */
  volume24h: number | null;
  /** 近 7 日费率年化样本（展示推导值）；null=槽位 */
  apr7d: number | null;
};

export type PrototypeSocial = {
  kind: 'website' | 'x' | 'telegram' | 'discord';
  url: string;
};

/** 社交展示顺序（用户裁定 2026-09-22：website, x, discord, telegram） */
const SOCIAL_ORDER: PrototypeSocial['kind'][] = ['website', 'x', 'discord', 'telegram'];

export type PrototypeVerse = SourceRecord & {
  name: string;
  symbol: string;
  stage: VerseStage;
  governanceChain: number;
  governanceChainName: string;
  createdAt: string;
  participantCount: number;
  /** 一句话描述（注册期元数据）；fixture 缺失=null→UI 不渲染 */
  description: string | null;
  /** 社交链接（注册期元数据）；fixture 缺失=空数组→UI 不渲染 */
  socials: PrototypeSocial[];
  /** 预计市值快照（uAsset 计，注册参数）；fixture 缺失=null→UI 不渲染 */
  projectedMarketCap: number | null;
  minSuccessThreshold: number;
  normalRaised: number;
  leverageInterest: number;
  preorderRaised: number;
  participationSize: number;
  raiseAsset: string;
  normalProgress: number;
  leverageProgress: number;
  preorderProgress: number;
  endsAt: string;
  /** 预购容量比例快照（容量=(普通资金+杠杆债务本金)×70%×容量比例）；fixture 缺失=null→UI 显「以链上读值为准」槽位 */
  preorderCapacityRatio: number | null;
  /** 杠杆一次性利率快照（注册时锁定、非年化；债务额度=利息÷利率）；fixture 缺失=null→UI 显「以链上读值为准」槽位 */
  leverageInterestRate: number | null;
  /** 杠杆债务上限快照（uAsset 计）；fixture 缺失=null→UI 显「以链上读值为准」槽位 */
  leverageDebtCap: number | null;
  /** Fast Mode：任一门槛达标即提前结束创世（fixture 未标记时为 false） */
  fastGenesis: boolean;
  /** 解锁时间 = 创世截止 + FIXED_LOCKUP_DURATION(365d)（MemeverseRegistrationLib.sol:14、RegistrationCenter.sol:191）；锁定中/已解锁卡片展示 */
  unlockTimeAt: string;
  /** 24h 四池交易量快照（uAsset 计）；fixture 缺失=null→UI 显 unavailable 槽位 */
  volume24h: number | null;
  /** 质押年化快照（百分比数值，5.688 ratio→568.8）；fixture 缺失=null→UI 显 unavailable 槽位 */
  stakingApy: number | null;
  /** DAO 国库余额快照（美元计）；fixture 缺失=null→UI 显 unavailable 槽位 */
  treasuryFundUsd: number | null;
  unlockedAt: string | null;
  currentPrice: number | null;
  change24h: number | null;
  markets: PrototypeMarket[];
};

export type PrototypeAsset = SourceRecord & {
  symbol: string;
  anchorNote?: string;
  /** sy 资产折算锚资产样本率（1 枚 sy ≈ N 锚资产→N uAsset，实时变动；缺失=null 语义——审阅屏显槽位） */
  anchorValue?: number;
};

export type PrototypeSnapshot = {
  timeAnchor: string;
  verses: PrototypeVerse[];
  assets: PrototypeAsset[];
  homeMetrics: {
    totalLocked: number;
    verseCount: number;
    /** 已部署 Memecoin 数（锁定中+已解锁；创世中/退款不计） */
    deployedVerseCount: number;
    participantCount: number;
    sourceRefs: string[];
  };
  sampleAccount: {
    address: string;
    sourceRef: string;
  };
};

const FIXTURE_TIME_ANCHOR = '2026-09-16T12:00:00Z';

/** 固定锁定期：FIXED_LOCKUP_DURATION = 365 days（MemeverseRegistrationLib.sol:14，合约常量非注册参数） */
const FIXED_LOCKUP_MS = 365 * 24 * 60 * 60 * 1000;

function amount(raw: string) {
  return Number(raw);
}

function progress(value: number, threshold: number) {
  if (threshold === 0) return 0;
  return (value / threshold) * 100;
}

function getSnapshot(): PrototypeSnapshot {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const marketsByVerse = new Map<string, PrototypeMarket[]>();

  for (const market of fixtureData.markets.items) {
    const normalizedMarket: PrototypeMarket = {
      id: market.id,
      sourceRef: market.sourceRef,
      verseId: market.verseId,
      pool: market.pool as PrototypeMarket['pool'],
      tvl: amount(market.tvl.raw),
      feeState: market.feeState,
      volume24h: market.volume24h ? amount(market.volume24h.raw) : null,
      apr7d: market.apr7d ? Number(market.apr7d.raw) : null,
    };
    const current = marketsByVerse.get(market.verseId) ?? [];
    current.push(normalizedMarket);
    marketsByVerse.set(market.verseId, current);
  }

  const verses = fixtureData.verses.items.map<PrototypeVerse>((verse) => {
    const threshold = amount(verse.genesis.minSuccessThreshold.raw);
    const normalRaised = amount(verse.genesis.normalRaised.raw);
    const leverageInterest = amount(verse.genesis.leverageInterest.raw);
    const preorderRaised = amount(verse.genesis.preorderRaised.raw);
    const mainMarket = fixtureData.markets.items.find(
      (market) => market.verseId === verse.id && market.pool === 'main',
    );
    const candles = mainMarket && 'candles' in mainMarket ? mainMarket.candles : undefined;
    const firstCandle = candles?.[0];
    const lastCandle = candles?.at(-1);
    const currentPrice = lastCandle ? Number(lastCandle.c) : null;
    // 24h 涨跌：优先取最后 24 根蜡烛窗口（蜡烛充足时）；不足则退回全窗口
    const windowStart =
      candles && candles.length >= 25 ? candles[candles.length - 24] : firstCandle;
    const change24h =
      windowStart && lastCandle
        ? ((Number(lastCandle.c) - Number(windowStart.o)) / Number(windowStart.o)) * 100
        : null;

    return {
      id: verse.id,
      sourceRef: verse.sourceRef,
      name: verse.name,
      symbol: verse.symbol,
      stage: verse.stage as VerseStage,
      governanceChain: verse.governanceChain,
      governanceChainName:
        chainMeta.get(verse.governanceChain)?.name ?? String(verse.governanceChain),
      createdAt: verse.createdAt,
      participantCount: verse.participants,
      description: verse.description ?? null,
      socials: (verse.socials ?? [])
        .map((social) => ({
          // kind 联合类型由 fixture schema（verseSocialSchema）校验兜底
          kind: social.kind as PrototypeSocial['kind'],
          url: social.url,
        }))
        .sort((a, b) => SOCIAL_ORDER.indexOf(a.kind) - SOCIAL_ORDER.indexOf(b.kind)),
      projectedMarketCap: verse.projectedMarketCap ? amount(verse.projectedMarketCap.raw) : null,
      // 募集计价单位：治理链原生符号 → uAsset 族（ETH→UETH、BNB→UBNB，均在 assets 白名单内）
      raiseAsset: `U${chainMeta.get(verse.governanceChain)?.nativeSymbol ?? 'Asset'}`,
      minSuccessThreshold: threshold,
      normalRaised,
      leverageInterest,
      preorderRaised,
      participationSize: normalRaised + leverageInterest + preorderRaised,
      normalProgress: progress(normalRaised, threshold),
      leverageProgress: progress(leverageInterest, threshold),
      preorderProgress: progress(preorderRaised, threshold),
      endsAt: verse.genesis.endsAt,
      preorderCapacityRatio: verse.genesis.preorderCapacityRatio
        ? Number(verse.genesis.preorderCapacityRatio.raw)
        : null,
      leverageInterestRate: verse.genesis.leverageInterestRate
        ? Number(verse.genesis.leverageInterestRate.raw)
        : null,
      leverageDebtCap: verse.genesis.leverageDebtCap
        ? amount(verse.genesis.leverageDebtCap.raw)
        : null,
      fastGenesis: verse.genesis.fastGenesis ?? false,
      unlockTimeAt: new Date(Date.parse(verse.genesis.endsAt) + FIXED_LOCKUP_MS).toISOString(),
      volume24h: verse.livePhase ? amount(verse.livePhase.volume24h.raw) : null,
      stakingApy: verse.livePhase ? Number(verse.livePhase.stakingApy.raw) * 100 : null,
      treasuryFundUsd: verse.livePhase ? amount(verse.livePhase.treasuryFundUsd.raw) : null,
      unlockedAt: verse.unlock?.unlockedAtTx ?? null,
      currentPrice,
      change24h,
      markets: marketsByVerse.get(verse.id) ?? [],
    };
  });

  const genesisLocked = verses
    .filter((verse) => verse.stage === 'genesis')
    .reduce((sum, verse) => sum + verse.participationSize, 0);
  const lockedPools = verses
    .filter((verse) => verse.stage === 'locked')
    .flatMap((verse) => verse.markets)
    .reduce((sum, market) => sum + market.tvl, 0);
  const uniqueAccounts = new Set(
    fixtureData.accounts.items.map((account) => account.address.value.toLowerCase()),
  );
  const sampleAccount = fixtureData.accounts.items[0];

  return {
    timeAnchor: FIXTURE_TIME_ANCHOR,
    verses,
    assets: fixtureData.assets.items
      .filter((asset) => asset.kind === 'uasset')
      .map((asset) => ({
        id: asset.id,
        sourceRef: asset.sourceRef,
        symbol: asset.symbol,
        anchorNote: asset.anchorNote,
      })),
    homeMetrics: {
      totalLocked: genesisLocked + lockedPools,
      verseCount: verses.length,
      deployedVerseCount: verses.filter(
        (verse) => verse.stage === 'locked' || verse.stage === 'unlocked',
      ).length,
      participantCount: uniqueAccounts.size,
      sourceRefs: [
        ...new Set([
          ...fixtureData.verses.items.map((verse) => verse.sourceRef),
          ...fixtureData.markets.items.map((market) => market.sourceRef),
          ...fixtureData.accounts.items.map((account) => account.sourceRef),
        ]),
      ],
    },
    sampleAccount: {
      address: sampleAccount.address.value,
      sourceRef: sampleAccount.sourceRef,
    },
  };
}

export function getPrototypeSnapshot() {
  return getSnapshot();
}

/** 详情页 URL 段解析：接受数字（/memeverse/21，= 链上 uint256 verseId 口径）与旧版 verse-021 形态 */
export function getPrototypeVerse(verseId: string) {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  const numeric = Number(match[1]);
  return (
    getSnapshot().verses.find((verse) => Number(verse.id.replace(/^verse-/, '')) === numeric) ??
    null
  );
}

export type PrototypeParticipation = {
  verseId: string;
  owner: string;
  kind: 'normal' | 'leverage' | 'preorder';
  amount: number;
  sourceRef: string;
};

export type PrototypeYieldSource = {
  /** 来源 id（fixtures yield-sources.json，ysrc 前缀） */
  id: string;
  sourceRef: string;
  /** 来源名（Lido/Aave…；OutrunBook vision.md 协议清单口径） */
  name: string;
  /** 该来源下可参与的资产组（选来源后才确定，用户裁定 2026-09-22） */
  assets: PrototypeAsset[];
};

export type PrototypeParticipationOptions = {
  /** 本 Verse 募集 uAsset（创建时指定，直付/预购唯一计价资产；null=fixture 白名单缺失） */
  raiseAsset: PrototypeAsset | null;
  /** 面值直兑路径可付储备资产（PSM 配对读 fixture，不预设项目关联） */
  reserves: PrototypeAsset[];
  /** 质押路径来源 registry（来源→资产组，读 fixture，不预设项目关联） */
  yieldSourceRegistry: PrototypeYieldSource[];
  /** 杠杆利息创世积分直付资产（kind=credit，跨 Verse 通用；null=fixture 白名单缺失） */
  creditAsset: PrototypeAsset | null;
};

/** 参与路径 → 支付资产选项解析（asset-flows §0：路径决定支付资产；直付限本 Verse 募集 uAsset） */
export function getPrototypeParticipationOptions(
  raiseAssetSymbol: string,
): PrototypeParticipationOptions {
  const raiseAsset = fixtureData.assets.items.find(
    (asset) => asset.kind === 'uasset' && asset.symbol === raiseAssetSymbol,
  );
  const reserveIds = new Set(
    raiseAsset
      ? fixtureData.psm.items
          .filter((pair) => pair.uAssetId === raiseAsset.id)
          .map((pair) => pair.reserveId)
      : [],
  );
  const assetById = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const toAsset = (asset: (typeof fixtureData.assets.items)[number]) => ({
    id: asset.id,
    sourceRef: asset.sourceRef,
    symbol: asset.symbol,
    anchorValue: asset.anchorValue,
  });
  // uAsset 符号约定 = 'U' + 底层族符号（UETH/UUSD/UBNB——glossary A）；来源只对本族 Verse 开放
  // （用户裁定 2026-09-22：UETH verse 不可能出现 sUSDe 类 USD 来源）
  const family = raiseAssetSymbol.slice(1);
  return {
    raiseAsset: raiseAsset
      ? {
          id: raiseAsset.id,
          sourceRef: raiseAsset.sourceRef,
          symbol: raiseAsset.symbol,
          anchorNote: raiseAsset.anchorNote,
        }
      : null,
    reserves: fixtureData.assets.items.filter((asset) => reserveIds.has(asset.id)).map(toAsset),
    yieldSourceRegistry: fixtureData.yieldSources.items
      .filter((source) => source.anchor === family)
      .map((source) => ({
        id: source.id,
        sourceRef: source.sourceRef,
        name: source.name,
        assets: source.assetIds.flatMap((assetId) => {
          const asset = assetById.get(assetId);
          return asset ? [toAsset(asset)] : [];
        }),
      })),
    creditAsset: (() => {
      const credit = fixtureData.assets.items.find((asset) => asset.kind === 'credit');
      return credit ? { id: credit.id, sourceRef: credit.sourceRef, symbol: credit.symbol } : null;
    })(),
  };
}

/** 样本账户的创世参与记录（Portfolio 退款区块数据源；金额换算同 ViewModel 口径） */
export function getPrototypeParticipations(): PrototypeParticipation[] {
  return prototypeRepository.participations().map((p) => ({
    verseId: p.verseId,
    owner: p.owner.value,
    kind: p.kind as PrototypeParticipation['kind'],
    amount: amount(p.amount.raw),
    sourceRef: p.sourceRef,
  }));
}

export type PrototypeCreateConfig = {
  /** 创世时长允许区间（center min/maxDurationDays 读值样本） */
  minDurationDays: number;
  maxDurationDays: number;
  /** 固定锁定期：unlockTime = endTime + 365 days（FIXED_LOCKUP_DURATION 合约常量，非注册参数） */
  lockupDays: number;
  /** 每条异链跨链 fan-out 费样本（治理链原生资产计；本链 fee=0——SPEC-M8 §9）；无注册费 */
  remoteDeployFee: number;
  /** pending-manifest：报价结构以冻结 ABI 后为准，样本仅示意量级 */
  quoteState: 'pending-manifest';
  sourceRef: string;
};

/** 创建表单读链参数快照（R-04 表单机制主源=SPEC-M8；缺省文件时 UI 走「以链上读值为准」槽位） */
export function getPrototypeCreateConfig(): PrototypeCreateConfig | null {
  const config = fixtureData.createConfig.items[0];
  if (!config) return null;
  return {
    minDurationDays: config.minDurationDays,
    maxDurationDays: config.maxDurationDays,
    lockupDays: config.lockupDays,
    remoteDeployFee: amount(config.remoteDeployFee.raw),
    quoteState: config.quoteState as PrototypeCreateConfig['quoteState'],
    sourceRef: config.sourceRef,
  };
}

/** 壳层链选择器数据（GS-2）：六链视图，函数式出口避免 sentinel 对象进入生产 bundle */
export function getPrototypeChains() {
  return prototypeRepository.chains().map((c) => ({
    chainId: c.chainId,
    name: c.name,
    env: c.env as 'mainnet' | 'testnet',
    nativeSymbol: c.nativeSymbol,
    sourceRef: c.sourceRef,
  }));
}

// ---------------------------------------------------------------------------
// 四标签详情页 ViewModel（2026-09-23 用户裁定：Locked/Unlocked 详情页 = 头卡 + 统计条/K线/Swap
// 持久区 + Liquidity/POL/Yield Vault/DAO 四标签；数值口径：四池=four-pools.md、POL 名义价值=
// Memeverse spec polend/pt-yt-splitter.md §4（全范围 2×uAsset 侧）、质押=governance-yield §6、
// 周期激励=M10:332-337。样本数值全部来自 fixtures，缺失字段→null→UI 显「以链上读值为准」槽位。
// ---------------------------------------------------------------------------

export type PrototypeCandle = { t: string; o: number; h: number; l: number; c: number; v: number };

export type PrototypeFineCandles = {
  '1m': PrototypeCandle[];
  '5m': PrototypeCandle[];
  '15m': PrototypeCandle[];
};

export type PrototypeVerseTrade = {
  /** 主池蜡烛（1h 原始粒度）；空=无样本（B3 降级提示） */
  candles: PrototypeCandle[];
  /** 细粒度蜡烛样本（2026-09-23 用户裁定：全部粒度可选）；null=fixture 缺失 */
  fineCandles: PrototypeFineCandles | null;
  tokenStats: {
    price: number | null;
    change24h: number | null;
    /** 市值 = 现价 × 总供应（推导值）；null=任一输入缺失 */
    marketCap: number | null;
    /** 主池 TVL（统计条口径 2026-09-23 用户裁定；四池合计由 Liquidity 标签自算） */
    liquidity: number;
    /** 主池 24h 量；null=主池量缺失 */
    volume24h: number | null;
    holders: number | null;
    totalSupply: number | null;
    /** Memecoin CA（fixture 样本）；null=无样本 */
    tokenAddress: string | null;
  };
  pools: Array<
    PrototypeMarket & {
      /** 池内双边资产符号（展示序：MEME 在前）；uAsset 侧 = verse 募集资产 */
      baseSymbol: string;
      quoteSymbol: string;
    }
  >;
};

/** 无限左滑历史总量（1h 根数 ≈ 1 年；2026-09-23 用户裁定配套） */
const HISTORY_TOTAL_HOURLY = 8760;

/** K 线历史回溯（派生样本）：fixture 只存 168h 真样本，这里锚定接缝（k=1 的 close
 *  === fixture 首根 open）向远古确定性随机游走补齐到 ~1 年——漂移累积在无接缝的远端，
 *  接缝处零跳变（2026-09-23 修复：旧版锚错在最老端，接缝曾现 47% 断崖）；
 *  同 verseId 结果恒定；生产以数据源分页为准 */
function extendHourlyHistory(candles: PrototypeCandle[], seedKey: string): PrototypeCandle[] {
  if (candles.length === 0 || candles.length >= HISTORY_TOTAL_HOURLY) return candles;
  let seed = 2166136261;
  for (const ch of seedKey) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const first = candles[0];
  const firstT = Date.parse(first.t);
  const older: PrototypeCandle[] = [];
  let price = first.o; // 接缝锚点：k=1 的 close === fixture 首根 open，向远古游走
  for (let k = 1; k <= HISTORY_TOTAL_HOURLY - candles.length; k++) {
    const open = price * (1 + (rnd() - 0.5) * 0.011);
    const high = Math.max(open, price) * (1 + rnd() * 0.004);
    const low = Math.min(open, price) * (1 - rnd() * 0.004);
    older.push({
      t: new Date(firstT - k * 3_600_000).toISOString().replace('.000Z', 'Z'),
      o: open,
      h: high,
      l: low,
      c: price,
      v: Math.round(6000 + rnd() * 9000),
    });
    price = open;
  }
  older.reverse();
  return [...older, ...candles];
}

export function getPrototypeVerseTrade(verseId: string): PrototypeVerseTrade | null {
  const verse = getSnapshot().verses.find((item) => item.id === verseId);
  if (!verse) return null;
  const rawMarkets = fixtureData.markets.items.filter((market) => market.verseId === verseId);
  const mainRaw = rawMarkets.find((market) => market.pool === 'main');
  const candles: PrototypeCandle[] =
    mainRaw && 'candles' in mainRaw && mainRaw.candles
      ? mainRaw.candles.map((candle) => ({
          t: candle.t,
          o: Number(candle.o),
          h: Number(candle.h),
          l: Number(candle.l),
          c: Number(candle.c),
          v: candle.v != null ? Number(candle.v) : 0,
        }))
      : [];
  // 回溯派生历史（无限左滑数据池；尾部 fixture 样本不变，统计口径不受影响）
  const historyCandles = extendHourlyHistory(candles, `${verseId}:history`);
  const toCandles = (
    rows: Array<{ t: string; o: string; h: string; l: string; c: string; v?: string }>,
  ) =>
    rows.map((candle) => ({
      t: candle.t,
      o: Number(candle.o),
      h: Number(candle.h),
      l: Number(candle.l),
      c: Number(candle.c),
      v: candle.v != null ? Number(candle.v) : 0,
    }));
  const fineRaw = mainRaw && 'candlesFine' in mainRaw ? mainRaw.candlesFine : undefined;
  const fineCandles =
    fineRaw && fineRaw['1m'] && fineRaw['5m'] && fineRaw['15m']
      ? {
          '1m': toCandles(fineRaw['1m']),
          '5m': toCandles(fineRaw['5m']),
          '15m': toCandles(fineRaw['15m']),
        }
      : null;
  const stats = mainRaw && 'tokenStats' in mainRaw ? mainRaw.tokenStats : undefined;
  const pools = verse.markets.map((market) => {
    // POL/PT 是品类而非独立 symbol：POL-<MEME>（MemeverseLaunchImpl.sol:117-119）、PT-<MEME>（POLSplitterUpgradeable.sol:225）
    const polSymbol = `POL-${verse.symbol}`;
    const ptSymbol = `PT-${verse.symbol}`;
    const pair: Record<PrototypeMarket['pool'], [string, string]> = {
      main: [verse.symbol, verse.raiseAsset],
      'pol-uasset': [polSymbol, verse.raiseAsset],
      'pt-uasset': [ptSymbol, verse.raiseAsset],
      'pt-pol': [ptSymbol, polSymbol],
    };
    return { ...market, baseSymbol: pair[market.pool][0], quoteSymbol: pair[market.pool][1] };
  });
  // 统计条口径（2026-09-23 用户裁定）：Liq/Vol=主池数据（交易对该池），非四池合计
  const mainPool = pools.find((pool) => pool.pool === 'main');
  const liquidity = mainPool?.tvl ?? 0;
  const totalSupply = stats ? amount(stats.totalSupply.raw) : null;
  return {
    candles: historyCandles,
    fineCandles,
    tokenStats: {
      price: verse.currentPrice,
      change24h: verse.change24h,
      marketCap:
        verse.currentPrice != null && totalSupply != null ? verse.currentPrice * totalSupply : null,
      liquidity,
      volume24h: mainPool?.volume24h != null ? mainPool.volume24h : null,
      holders: stats?.holders ?? null,
      totalSupply,
      tokenAddress: stats?.tokenAddress.value ?? null,
    },
    pools,
  };
}

export type PrototypeStaking = {
  vaultAddress: string;
  totalStaked: number;
  /** 1 份额 ≈ N Memecoin（含 virtualAssets 缓冲） */
  assetsPerShare: number;
  /** 近 7 日实绩年化（Q7 口径：链下推导展示值） */
  apy7d: number;
  myShares: number;
  /** 份额价值 = myShares × assetsPerShare（推导值） */
  myShareValue: number;
  delegatee: string;
  pendingRedeems: Array<{
    lockedAssets: number;
    requestedAt: string;
    maturesAt: string;
    /** maturesAt ≤ 快照锚点 → 已成熟可提取（REDEEM_DELAY≈1 天） */
    ready: boolean;
    /** 快照锚点时刻距成熟的剩余毫秒（展示走秒起点；0=已成熟） */
    remainingMs: number;
  }>;
  /** 已成熟合计（Withdraw 子标签 Total Available） */
  claimableTotal: number;
};

/** uAsset 美元样本价（fixture 假数据；缺失返回 null → UI 隐藏美元换算行） */
export function getPrototypeAssetUsdSample(symbol: string): number | null {
  const asset = fixtureData.assets.items.find((item) => item.symbol === symbol);
  return asset?.usdSample ?? null;
}

/** Memecoin 质押收益库样本（locked/unlocked verse；null=该 verse 无样本→面板整体走槽位态） */
export function getPrototypeStaking(verseId: string): PrototypeStaking | null {
  const record = fixtureData.staking.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const anchor = Date.parse(FIXTURE_TIME_ANCHOR);
  const pendingRedeems = record.pendingRedeems.map((entry) => ({
    lockedAssets: amount(entry.lockedAssets.raw),
    requestedAt: entry.requestedAt,
    maturesAt: entry.maturesAt,
    ready: Date.parse(entry.maturesAt) <= anchor,
    remainingMs: Math.max(0, Date.parse(entry.maturesAt) - anchor),
  }));
  const assetsPerShare = Number(record.assetsPerShare.raw);
  const myShares = amount(record.myShares.raw);
  return {
    vaultAddress: record.vaultAddress.value,
    totalStaked: amount(record.totalStaked.raw),
    assetsPerShare,
    apy7d: Number(record.apy7d.raw),
    myShares,
    myShareValue: myShares * assetsPerShare,
    delegatee: record.delegatee.value,
    pendingRedeems,
    claimableTotal: pendingRedeems
      .filter((entry) => entry.ready)
      .reduce((sum, e) => sum + e.lockedAssets, 0),
  };
}

export type PrototypePolPosition = {
  polAddress: string;
  polSupply: number;
  /** 每 1 POL 对应主池 uAsset 侧数量 */
  uAssetPerPol: number;
  /** 名义价值 = 2 × uAssetPerPol（全范围简化——pt-yt-splitter.md §4；推导值） */
  nominalValuePerPol: number;
  /** POL/uAsset 池市场价 */
  marketPricePerPol: number;
  myPol: number;
  myPt: number;
  myYt: number;
  /** 样本账户本 verse memecoin 余额（Mint POL 供给侧样本） */
  myMemecoin: number;
  /** 样本账户 uAsset 余额（钱包级资产；Mint POL 供给侧样本） */
  myUAsset: number;
  /** 创世结束后可领 YT（claimNormalYT 一次性按出资比例——MemeverseSettlementImpl.sol:88） */
  claimableYt: number;
};

/** POL/PT/YT 持仓与估值样本（locked/unlocked verse；null=槽位态） */
export function getPrototypePolPosition(verseId: string): PrototypePolPosition | null {
  const record = fixtureData.polPositions.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const uAssetPerPol = Number(record.uAssetPerPol.raw);
  return {
    polAddress: record.polAddress.value,
    polSupply: amount(record.polSupply.raw),
    uAssetPerPol,
    nominalValuePerPol: uAssetPerPol * 2,
    marketPricePerPol: Number(record.marketPricePerPol.raw),
    myPol: amount(record.myPol.raw),
    myPt: amount(record.myPt.raw),
    myYt: amount(record.myYt.raw),
    myMemecoin: amount(record.myMemecoin.raw),
    myUAsset: amount(record.myUAsset.raw),
    claimableYt: amount(record.claimableYt.raw),
  };
}

/** 资金明细构成行（governance.json treasuryAssets/unclaimedAssets 样本） */
export type PrototypeGovernanceAsset = {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
};

export type PrototypeGovernanceState = {
  cycleNumber: string;
  cycleDurationDays: number;
  cycleEndsAt: string;
  finalized: boolean;
  claimWindowEndsAt: string | null;
  governorAddress: string | null;
  incentivizerAddress: string | null;
  delegates: number | null;
  totalVotingPower: number | null;
  myVotes: number | null;
  treasuryUAsset: number | null;
  /** 划拨比例（bps；初始 2500=25%，治理可改——M10:332-333） */
  rewardRatioBps: number | null;
  cumulativeIncentivePool: number | null;
  /** 当期国库构成样本（null=无样本→明细入口不渲染） */
  treasuryAssets: PrototypeGovernanceAsset[] | null;
  currentCycleVotes: { total: number; mine: number } | null;
  /** 若当前已投票，按票占比推算的本期可领估计（推导值；Q7/H7 口径） */
  estimatedClaimable: number | null;
  lastCycle: {
    number: string;
    treasuryUAsset: number;
    /** 上期期末国库构成样本（null=无样本→明细入口不渲染） */
    treasuryAssets: PrototypeGovernanceAsset[] | null;
    remainingRewards: number;
    totalVotes: number;
    myVotes: number;
    myClaimable: number;
    /** 未领取奖励构成样本（null=无样本→明细入口不渲染） */
    unclaimedAssets: PrototypeGovernanceAsset[] | null;
  } | null;
  proposalCount: { total: number; active: number } | null;
};

/** DAO 治理周期状态样本（locked/unlocked verse；null=该 verse 无治理样本→DAO 标签槽位态） */
export function getPrototypeGovernanceState(verseId: string): PrototypeGovernanceState | null {
  const record = fixtureData.governance.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const currentCycleVotes =
    record.currentCycleVotes && Number(record.currentCycleVotes.total.raw) > 0
      ? {
          total: amount(record.currentCycleVotes.total.raw),
          mine: amount(record.currentCycleVotes.mine.raw),
        }
      : null;
  const cumulativeIncentivePool = record.cumulativeIncentivePool
    ? amount(record.cumulativeIncentivePool.raw)
    : null;
  const mapAssets = (
    list:
      | { symbol: string; name: string; amount: { raw: string }; usdValue: { raw: string } }[]
      | undefined,
  ): PrototypeGovernanceAsset[] | null =>
    list
      ? list.map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          amount: Number(asset.amount.raw),
          usdValue: Number(asset.usdValue.raw),
        }))
      : null;
  return {
    cycleNumber: record.cycleNumber,
    cycleDurationDays: record.cycleDurationDays,
    cycleEndsAt: record.cycleEndsAt,
    finalized: record.finalized,
    claimWindowEndsAt: record.claimWindowEndsAt ?? null,
    governorAddress: record.governorAddress?.value ?? null,
    incentivizerAddress: record.incentivizerAddress?.value ?? null,
    delegates: record.delegates ?? null,
    totalVotingPower: record.totalVotingPower ? amount(record.totalVotingPower.raw) : null,
    myVotes: record.myVotes ? amount(record.myVotes.raw) : null,
    treasuryUAsset: record.treasuryUAsset ? amount(record.treasuryUAsset.raw) : null,
    rewardRatioBps: record.rewardRatio ? Number(record.rewardRatio.raw) : null,
    cumulativeIncentivePool,
    treasuryAssets: mapAssets(record.treasuryAssets),
    currentCycleVotes,
    estimatedClaimable:
      cumulativeIncentivePool != null && currentCycleVotes
        ? (cumulativeIncentivePool * currentCycleVotes.mine) / currentCycleVotes.total
        : null,
    lastCycle: record.lastCycle
      ? {
          number: record.lastCycle.number,
          treasuryUAsset: amount(record.lastCycle.treasuryUAsset.raw),
          treasuryAssets: mapAssets(record.lastCycle.treasuryAssets),
          remainingRewards: amount(record.lastCycle.remainingRewards.raw),
          totalVotes: amount(record.lastCycle.totalVotes.raw),
          myVotes: amount(record.lastCycle.myVotes.raw),
          myClaimable: amount(record.lastCycle.myClaimable.raw),
          unclaimedAssets: mapAssets(record.lastCycle.unclaimedAssets),
        }
      : null,
    proposalCount: {
      total: record.proposals.length,
      active: record.proposals.filter((proposal) => proposal.state === 'active').length,
    },
  };
}
