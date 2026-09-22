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
  unlockedAt: string | null;
  currentPrice: number | null;
  change24h: number | null;
  markets: PrototypeMarket[];
};

export type PrototypeAsset = SourceRecord & {
  symbol: string;
  anchorNote?: string;
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
    const change24h =
      firstCandle && lastCandle
        ? ((Number(lastCandle.c) - Number(firstCandle.o)) / Number(firstCandle.o)) * 100
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
