// fixture repository —— fixtures 的唯一合法消费方（阶段 2 步骤 10建立；2026-10-02 按域分桶时由
// prototype-repository 改名）。允许的 import 图：fixtures/** → 本文件 → components/**（ui/design-system
// 通用层除外）或 fixtures/inspector/**。生产代码（app/features/entities/lib(非本文件) 及通用层）禁止
// 直接或间接导入：由 scripts/check-fixture-boundary.mjs --source / --graph production 强制。
import { OUTRUN_FIXTURE_ONLY_v1, fixtureData } from '../../fixtures/index';

export const FIXTURE_ONLY_SENTINEL = OUTRUN_FIXTURE_ONLY_v1;

export const fixtureRepository = {
  sentinel: FIXTURE_ONLY_SENTINEL,
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

export type FixtureChain = {
  chainId: number;
  name: string;
  env: 'mainnet' | 'testnet';
  nativeSymbol: string;
  sourceRef: string;
};

export type Locale = 'zh' | 'en';
export type VerseStage = 'genesis' | 'locked' | 'unlocked' | 'refund';

export type SourceRecord = { id: string; sourceRef: string };

export type FixtureMarket = SourceRecord & {
  verseId: string;
  pool: 'main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol';
  tvl: number;
  feeState: string;
  /** 池动态费率（markets feeRate bps→比率，如 0.008=0.8%——OB:memeverse/hook.md 动态费样本）；null=槽位 */
  feeRate: number | null;
  /** 24h 成交量快照；null=fixture 缺失→UI 显「以链上读值为准」槽位 */
  volume24h: number | null;
  /** 近 7 日费率年化样本（展示推导值）；null=槽位 */
  apr7d: number | null;
  /** LP 铸得率样本：每供给 1 quote 侧铸得 LP 数量（Add Liquidity 弹窗输出推导）；null=槽位 */
  lpPerQuote: number | null;
};

export type FixtureSocial = {
  kind: 'website' | 'x' | 'telegram' | 'discord';
  url: string;
};

/** 社交展示顺序（用户裁定 2026-09-22：website, x, discord, telegram） */
const SOCIAL_ORDER: FixtureSocial['kind'][] = ['website', 'x', 'discord', 'telegram'];

export type FixtureVerse = SourceRecord & {
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
  socials: FixtureSocial[];
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
  /** Memecoin CA（markets 主池 tokenStats 样本）；null=未部署/无样本 → 地址搜索不命中（创世成功后才部署） */
  memecoinAddress: string | null;
  markets: FixtureMarket[];
};

export type FixtureAsset = SourceRecord & {
  symbol: string;
  /** 代币本名（assets.json name；缺失=组件回退 symbol） */
  name?: string;
  anchorNote?: string;
  /** sy 资产折算锚资产样本率（1 枚 sy ≈ N 锚资产→N uAsset，实时变动；缺失=null 语义——审阅屏显槽位） */
  anchorValue?: number;
};

export type FixtureSnapshot = {
  timeAnchor: string;
  verses: FixtureVerse[];
  assets: FixtureAsset[];
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

function getSnapshot(): FixtureSnapshot {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const marketsByVerse = new Map<string, FixtureMarket[]>();

  for (const market of fixtureData.markets.items) {
    const normalizedMarket: FixtureMarket = {
      id: market.id,
      sourceRef: market.sourceRef,
      verseId: market.verseId,
      pool: market.pool as FixtureMarket['pool'],
      tvl: amount(market.tvl.raw),
      feeState: market.feeState,
      feeRate: market.feeRate ? Number(market.feeRate.raw) / 1e4 : null,
      volume24h: market.volume24h ? amount(market.volume24h.raw) : null,
      apr7d: market.apr7d ? Number(market.apr7d.raw) : null,
      lpPerQuote: market.lpPerQuote ? Number(market.lpPerQuote.raw) : null,
    };
    const current = marketsByVerse.get(market.verseId) ?? [];
    current.push(normalizedMarket);
    marketsByVerse.set(market.verseId, current);
  }

  const verses = fixtureData.verses.items.map<FixtureVerse>((verse) => {
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
          kind: social.kind as FixtureSocial['kind'],
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
      memecoinAddress: mainMarket?.tokenStats?.tokenAddress.value ?? null,
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
  // 累计参与地址样本：各 verse participants（地址级去重样本）求和；跨 verse 重叠未扣减，
  // 量级样本、以链上读值为准。勿用 accounts.items 计数——那是组合页 persona 钱包，非全网样本。
  const participantTotal = verses.reduce((sum, verse) => sum + verse.participantCount, 0);
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
      participantCount: participantTotal,
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

export function getFixtureSnapshot() {
  return getSnapshot();
}

/** 详情页 URL 段解析：接受数字（/memeverse/21，= 链上 uint256 verseId 口径）与旧版 verse-021 形态 */
export function getFixtureVerse(verseId: string) {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  const numeric = Number(match[1]);
  return (
    getSnapshot().verses.find((verse) => Number(verse.id.replace(/^verse-/, '')) === numeric) ??
    null
  );
}

export type FixtureParticipation = {
  verseId: string;
  owner: string;
  kind: 'normal' | 'leverage' | 'preorder';
  /** 参与路径（仅 kind=normal；null=杠杆/预购等无路径维记录） */
  route: 'direct' | 'stake' | null;
  amount: number;
  sourceRef: string;
};

export type FixtureYieldSource = {
  /** 来源 id（fixtures yield-sources.json，ysrc 前缀） */
  id: string;
  sourceRef: string;
  /** 来源名（Lido/Aave…；OutrunBook vision.md 协议清单口径） */
  name: string;
  /** 该来源下可参与的资产组（选来源后才确定，用户裁定 2026-09-22） */
  assets: FixtureAsset[];
};

export type FixtureParticipationOptions = {
  /** 本 Verse 募集 uAsset（创建时指定，直付/预购唯一计价资产；null=fixture 白名单缺失） */
  raiseAsset: FixtureAsset | null;
  /** 面值直兑路径可付储备资产（PSM 配对读 fixture，不预设项目关联） */
  reserves: FixtureAsset[];
  /** 质押路径来源 registry（来源→资产组，读 fixture，不预设项目关联） */
  yieldSourceRegistry: FixtureYieldSource[];
  /** 杠杆利息 Credit 直付资产（kind=credit 且 pairedUAssetId=本 Verse 募集 uAsset；null=无配对 Credit） */
  creditAsset: FixtureAsset | null;
};

/** 参与路径 → 支付资产选项解析（asset-flows §0：路径决定支付资产；直付限本 Verse 募集 uAsset） */
export function getFixtureParticipationOptions(
  raiseAssetSymbol: string,
): FixtureParticipationOptions {
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
    name: asset.name,
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
      // Credit 与 uAsset 一对一（OB:genesis-credit.md:17；合约 creditOf(uAsset)）：
      // 只取配对本 Verse 募集 uAsset 的 Credit，其余 Credit 不能代付本 Verse 利息
      const credit = fixtureData.assets.items.find(
        (asset) => asset.kind === 'credit' && raiseAsset && asset.pairedUAssetId === raiseAsset.id,
      );
      return credit ? { id: credit.id, sourceRef: credit.sourceRef, symbol: credit.symbol } : null;
    })(),
  };
}

/** 样本账户的创世参与记录（Portfolio 退款/凭证区数据源；金额换算同 ViewModel 口径） */
export function getFixtureParticipations(): FixtureParticipation[] {
  return fixtureRepository.participations().map((p) => ({
    verseId: p.verseId,
    owner: p.owner.value,
    kind: p.kind as FixtureParticipation['kind'],
    route: (p as { route?: 'direct' | 'stake' }).route ?? null,
    amount: amount(p.amount.raw),
    sourceRef: p.sourceRef,
  }));
}

export type FixtureCreateConfig = {
  /** 创世时长允许区间（center min/maxDurationDays 读值样本） */
  minDurationDays: number;
  maxDurationDays: number;
  /** 固定锁定期：unlockTime = endTime + 365 days（FIXED_LOCKUP_DURATION 合约常量，非注册参数） */
  lockupDays: number;
  /** 每条异链跨链 fan-out 费样本（治理链原生资产计；中心链目标 fee=0——SPEC-M8 §9）；无注册费 */
  remoteDeployFee: number;
  /** 异链发起注册时 发起链→注册中心链 的 LayerZero 发送费样本（RegistrarOmnichain quoteRegister；
   *  同链发起=0）；样本场景假设=治理链即注册中心链（deployment.md §8 中心链归属[未知]） */
  remoteSendFee: number;
  sourceRef: string;
};

/** 创建表单读链参数快照（R-04 表单机制主源=SPEC-M8；缺省文件时 UI 走「以链上读值为准」槽位） */
export function getFixtureCreateConfig(): FixtureCreateConfig | null {
  const config = fixtureData.createConfig.items[0];
  if (!config) return null;
  return {
    minDurationDays: config.minDurationDays,
    maxDurationDays: config.maxDurationDays,
    lockupDays: config.lockupDays,
    remoteDeployFee: amount(config.remoteDeployFee.raw),
    remoteSendFee: amount(config.remoteSendFee.raw),
    sourceRef: config.sourceRef,
  };
}

/** Symbol 占用检测样本：同 symbol 的上一 verse 创世窗口未结束即不可复用
 *  （MemeverseRegistrationCenterUpgradeable.sol:178 SymbolNotUnlock；endTime=注册+durationDays×DAY
 *  :186=创世截止——MemeverseLaunchImpl.sol:311-322；创世结束 nonce+1→新 uniqueId 即可复用 :189-195）。
 *  样本口径：快照 stage='genesis' 的 verse=创世窗口内=锁定中。合约映射键为原始字节串——
 *  匹配必须大小写敏感、不 trim。生产=previewRegistration+symbolRegistry 链上读值（以链上读值为准） */
export function getFixtureOccupiedSymbols(): string[] {
  return fixtureRepository
    .verses()
    .filter((verse) => verse.stage === 'genesis')
    .map((verse) => verse.symbol);
}

/** 壳层链选择器数据（GS-2）：六链视图，函数式出口避免 sentinel 对象进入生产 bundle */
export function getFixtureChains() {
  return fixtureRepository.chains().map((c) => ({
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

export type FixtureCandle = { t: string; o: number; h: number; l: number; c: number; v: number };

export type FixtureFineCandles = {
  '1m': FixtureCandle[];
  '5m': FixtureCandle[];
  '15m': FixtureCandle[];
};

export type FixtureVerseTrade = {
  /** 主池蜡烛（1h 原始粒度）；空=无样本（B3 降级提示） */
  candles: FixtureCandle[];
  /** 细粒度蜡烛样本（2026-09-23 用户裁定：全部粒度可选）；null=fixture 缺失 */
  fineCandles: FixtureFineCandles | null;
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
    FixtureMarket & {
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
function extendHourlyHistory(candles: FixtureCandle[], seedKey: string): FixtureCandle[] {
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
  const older: FixtureCandle[] = [];
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

export function getFixtureVerseTrade(verseId: string): FixtureVerseTrade | null {
  const verse = getSnapshot().verses.find((item) => item.id === verseId);
  if (!verse) return null;
  const rawMarkets = fixtureData.markets.items.filter((market) => market.verseId === verseId);
  const mainRaw = rawMarkets.find((market) => market.pool === 'main');
  const candles: FixtureCandle[] =
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
    const pair: Record<FixtureMarket['pool'], [string, string]> = {
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

export type FixtureStaking = {
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
export function getFixtureAssetUsdSample(symbol: string): number | null {
  const asset = fixtureData.assets.items.find((item) => item.symbol === symbol);
  return asset?.usdSample ?? null;
}

/** Memecoin 质押收益库样本（locked/unlocked verse；null=该 verse 无样本→面板整体走槽位态） */
export function getFixtureStaking(verseId: string): FixtureStaking | null {
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

export type FixturePolPosition = {
  polAddress: string;
  polSupply: number;
  /** 每 1 POL 对应主池 uAsset 侧数量 */
  uAssetPerPol: number;
  /** 名义价值 = 2 × uAssetPerPol（全范围简化——pt-yt-splitter.md §4；推导值） */
  nominalValuePerPol: number;
  /** POL/uAsset 池市场价 */
  marketPricePerPol: number;
  /** 每 1 PT 的 PT/POL 池市场价（YT 隐含价=1−此值——yt-flash-swap.md「1 POL=1 PT+1 YT」） */
  ptPricePerPol: number;
  /** Flash Swap 用户手续费率样本（相对支付额，谱系 <1%–极高——见 fixture 注释）；null=槽位 */
  flashUserFeeRate: number;
  myPol: number;
  myPt: number;
  myYt: number;
  /** 样本账户本 verse memecoin 余额（Mint POL 供给侧样本） */
  myMemecoin: number;
  /** 样本账户 uAsset 余额（钱包级资产；Mint POL 供给侧样本） */
  myUAsset: number;
  /** 样本账户本 verse PSM 配对储备余额（钱包级；Swap 储备侧供给样本） */
  myReserve: number;
  /** 四池 LP 代币余额样本（Remove Liquidity 供给侧；键=池标识） */
  myLp: { main: number; 'pol-uasset': number; 'pt-uasset': number; 'pt-pol': number };
  /** 创世结束后可领 YT（claimNormalYT 一次性按出资比例——MemeverseSettlementImpl.sol:88） */
  claimableYt: number;
  /** 每 1 YT 赎回摊得 uAsset（结算后剩余池×份额/流通 YT——POLSplitterUpgradeable.sol:404；null=无样本槽位态） */
  ytRedeemUAssetPerUnit: number | null;
  /** 每 1 YT 赎回摊得 memecoin（settlementMemecoin×份额/流通 YT——POLSplitterUpgradeable.sol:405；null=无样本槽位态） */
  ytRedeemMemecoinPerUnit: number | null;
};

/** POL/PT/YT 持仓与估值样本（locked/unlocked verse；null=槽位态） */
export function getFixturePolPosition(verseId: string): FixturePolPosition | null {
  const record = fixtureData.polPositions.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const uAssetPerPol = Number(record.uAssetPerPol.raw);
  return {
    polAddress: record.polAddress.value,
    polSupply: amount(record.polSupply.raw),
    uAssetPerPol,
    nominalValuePerPol: uAssetPerPol * 2,
    marketPricePerPol: Number(record.marketPricePerPol.raw),
    ptPricePerPol: Number(record.ptPricePerPol.raw),
    flashUserFeeRate: Number(record.flashUserFeeRate.raw),
    myPol: amount(record.myPol.raw),
    myPt: amount(record.myPt.raw),
    myYt: amount(record.myYt.raw),
    myMemecoin: amount(record.myMemecoin.raw),
    myUAsset: amount(record.myUAsset.raw),
    myReserve: amount(record.myReserve.raw),
    myLp: {
      main: amount(record.myLp.main.raw),
      'pol-uasset': amount(record.myLp['pol-uasset'].raw),
      'pt-uasset': amount(record.myLp['pt-uasset'].raw),
      'pt-pol': amount(record.myLp['pt-pol'].raw),
    },
    claimableYt: amount(record.claimableYt.raw),
    ytRedeemUAssetPerUnit: record.ytRedeemUAssetPerUnit
      ? Number(record.ytRedeemUAssetPerUnit.raw)
      : null,
    ytRedeemMemecoinPerUnit: record.ytRedeemMemecoinPerUnit
      ? Number(record.ytRedeemMemecoinPerUnit.raw)
      : null,
  };
}

/** 资金明细构成行（governance.json treasuryAssets/unclaimedAssets 样本） */
export type FixtureGovernanceAsset = {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
};

export type FixtureGovernanceState = {
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
  treasuryAssets: FixtureGovernanceAsset[] | null;
  currentCycleVotes: { total: number; mine: number } | null;
  /** 若当前已投票，按票占比推算的本期可领估计（推导值；Q7/H7 口径） */
  estimatedClaimable: number | null;
  lastCycle: {
    number: string;
    treasuryUAsset: number;
    /** 上期期末国库构成样本（null=无样本→明细入口不渲染） */
    treasuryAssets: FixtureGovernanceAsset[] | null;
    remainingRewards: number;
    totalVotes: number;
    myVotes: number;
    myClaimable: number;
    /** 可领奖励构成样本（多 token 按票权份额；null=无样本→明细入口不渲染） */
    claimableAssets: FixtureGovernanceAsset[] | null;
    /** 未领取奖励构成样本（null=无样本→明细入口不渲染） */
    unclaimedAssets: FixtureGovernanceAsset[] | null;
  } | null;
  proposalCount: { total: number; active: number } | null;
};

/** DAO 治理周期状态样本（locked/unlocked verse；null=该 verse 无治理样本→DAO 标签槽位态） */
export function getFixtureGovernanceState(verseId: string): FixtureGovernanceState | null {
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
  ): FixtureGovernanceAsset[] | null =>
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
          claimableAssets: mapAssets(record.lastCycle.claimableAssets),
          unclaimedAssets: mapAssets(record.lastCycle.unclaimedAssets),
        }
      : null,
    proposalCount: {
      total: record.proposals.length,
      active: record.proposals.filter((proposal) => proposal.state === 'active').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Portfolio 页 ViewModel（2026-10-02 用户裁定四分区：①待办 ②资产与跨链 ③仓位与储蓄
// ④参与凭证）。口径与裁定：跨链功能并入本页（v1 无 /bridge 独立页）、「1:1 转换」=PSM
// par swap 用户面命名（不与交易台「兑换/Swap」撞词）、待办区只收「逾期有后果」项且同类
// 跨 Verse 聚合（无截止的可领收益沉到④区筛选）。时间全部锚定 FIXTURE_TIME_ANCHOR。
// ---------------------------------------------------------------------------

const ANCHOR_MS = Date.parse(FIXTURE_TIME_ANCHOR);

/** 24 小时流动性保护窗（genesis.md:43——锚定实际解锁交易时刻非 unlockTime） */
const PROTECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 样本账户钱包余额视图（②区资产行）：资产 → 链分布聚合（产品资产=uAsset 族+创世积分；
 *  储备/原生余额与本产品无关，不出表——2026-10-02 用户裁定） */
export type FixtureWalletAsset = {
  assetId: string;
  symbol: string;
  kind: 'uasset' | 'credit';
  /** uAsset 美元样本价（fixture 样本）；null=隐藏换算 */
  usdSample: number | null;
  total: number;
  chains: Array<{ chainId: number; chainName: string; amount: number }>;
  /** 可经协议 OFT 跨链（uAsset 族 + GenesisCredit——genesis-credit.md；储备/原生只读） */
  bridgeable: boolean;
};

export function getFixtureWalletAssets(): FixtureWalletAsset[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const byAsset = new Map<string, Array<{ chainId: number; amount: number }>>();
  for (const row of fixtureData.balances.items) {
    const current = byAsset.get(row.assetId) ?? [];
    current.push({ chainId: row.chainId, amount: amount(row.amount.raw) });
    byAsset.set(row.assetId, current);
  }
  const rows: FixtureWalletAsset[] = [];
  for (const [assetId, chains] of byAsset) {
    const asset = assetMeta.get(assetId);
    if (!asset || asset.kind === 'reserve') continue;
    rows.push({
      assetId,
      symbol: asset.symbol,
      kind: asset.kind as FixtureWalletAsset['kind'],
      // Credit 无独立报价：与配对 uAsset 1:1 同份额兑换（OB:genesis-credit.md:19），
      // 美元样本价=配对 uAsset 样本价；无配对=隐藏换算
      usdSample:
        asset.usdSample ??
        (asset.kind === 'credit' && asset.pairedUAssetId
          ? (assetMeta.get(asset.pairedUAssetId)?.usdSample ?? null)
          : null),
      total: chains.reduce((sum, row) => sum + row.amount, 0),
      chains: chains.map((row) => ({
        chainId: row.chainId,
        chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
        amount: row.amount,
      })),
      bridgeable: asset.kind === 'uasset' || asset.kind === 'credit',
    });
  }
  // uAsset 族在前（参与货币），其后创世积分；族内按符号排序
  const kindOrder: Record<FixtureWalletAsset['kind'], number> = {
    uasset: 0,
    credit: 1,
  };
  return rows.sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.symbol.localeCompare(b.symbol),
  );
}

/** 储备资产余额表（PSM Convert 弹窗 Redeem 侧 Max 来源；储备不作为资产出表） */
export function getFixtureReserveBalances(): Record<string, number> {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const balances: Record<string, number> = {};
  for (const row of fixtureData.balances.items) {
    const asset = assetMeta.get(row.assetId);
    if (asset && asset.kind === 'reserve') {
      balances[asset.symbol] = (balances[asset.symbol] ?? 0) + amount(row.amount.raw);
    }
  }
  return balances;
}

/** 全币种钱包余额表（按符号跨链合计；创世参与表单 Balance/Max 来源）。
 *  快照无行的符号不出现在表内（→槽位态 -- + Max 禁用，swap-panel 同款） */
export function getFixtureWalletBalances(): Record<string, number> {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const balances: Record<string, number> = {};
  for (const row of fixtureData.balances.items) {
    const asset = assetMeta.get(row.assetId);
    if (asset) {
      balances[asset.symbol] = (balances[asset.symbol] ?? 0) + amount(row.amount.raw);
    }
  }
  return balances;
}

/** PSM 1:1 转换对（②区转换弹窗）：按 uAsset 符号取配对 */
export type FixturePsmPair = {
  chainId: number;
  reserveSymbol: string;
  /** mint 费 / redeem 费（bps→比率） */
  feeIn: number;
  feeOut: number;
  /** 剩余可铸额度 = stockCap − netMinted（SPEC-S8 §3 headroom） */
  headroom: number;
  /** 储备可兑余量 */
  reserveAvailable: number;
};

export function getFixturePsmPair(uAssetSymbol: string): FixturePsmPair | null {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const uAsset = fixtureData.assets.items.find(
    (asset) => asset.kind === 'uasset' && asset.symbol === uAssetSymbol,
  );
  if (!uAsset) return null;
  const pair = fixtureData.psm.items.find((item) => item.uAssetId === uAsset.id);
  if (!pair) return null;
  return {
    chainId: pair.chainId,
    reserveSymbol: assetMeta.get(pair.reserveId)?.symbol ?? '',
    feeIn: Number(pair.tin.raw) / 1e4,
    feeOut: Number(pair.tout.raw) / 1e4,
    headroom: amount(pair.stockCap.raw) - amount(pair.netMinted.raw),
    reserveAvailable: amount(pair.reserveAvailable.raw),
  };
}

/** 跨链消息视图（②区在途/滞留；历史不展示——PD-02 删跨链历史 + M4 否决持久历史） */
export type FixtureBridgeMessageView = {
  id: string;
  fromChainId: number;
  fromChainName: string;
  toChainId: number;
  toChainName: string;
  assetSymbol: string;
  amount: number;
  sentAt: string;
  stage: 'sent' | 'delivered' | 'settled' | 'stranded';
  /** 6 位小数余数留源链（OutrunOFTInit.sol:70）；null=无余数 */
  remainder: number | null;
};

export function getFixtureBridgeMessages(): FixtureBridgeMessageView[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  return fixtureData.bridgeMessages.items.map((row) => ({
    id: row.id,
    fromChainId: row.fromChain,
    fromChainName: chainMeta.get(row.fromChain)?.name ?? String(row.fromChain),
    toChainId: row.toChain,
    toChainName: chainMeta.get(row.toChain)?.name ?? String(row.toChain),
    assetSymbol: assetMeta.get(row.assetId)?.symbol ?? '',
    amount: amount(row.amount.raw),
    sentAt: row.sentAt,
    stage: row.stage as FixtureBridgeMessageView['stage'],
    remainder: row.remainderOnSource ? amount(row.remainderOnSource.raw) : null,
  }));
}

/** CDP 仓位视图（③区）：债务单位经 yield-sources registry 锚族推导（Lido→ETH→UETH） */
export type FixtureCdpPosition = {
  id: string;
  chainId: number;
  chainName: string;
  collateralSymbol: string;
  collateralAmount: number;
  /** 未偿 uAsset 债务（v1 面值平价 = 抵押数值） */
  debt: number;
  uAssetSymbol: string;
  yieldSource: string;
};

export function getFixtureCdpPositions(): FixtureCdpPosition[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const anchorBySource = new Map(
    fixtureData.yieldSources.items.map((source) => [source.name, source.anchor]),
  );
  return fixtureData.positions.items.map((row) => {
    const collateral = assetMeta.get(row.collateral.assetId);
    const anchor = anchorBySource.get(row.yieldSource);
    return {
      id: row.id,
      chainId: row.chainId,
      chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
      collateralSymbol: collateral?.symbol ?? '',
      collateralAmount: amount(row.collateral.amount.raw),
      debt: amount(row.debt.raw),
      uAssetSymbol: anchor ? `U${anchor}` : 'UAsset',
      yieldSource: row.yieldSource,
    };
  });
}

/** USR 储蓄视图（③区）：suETH→UETH 族映射；存款价值 = 份额 × accrualIndex/1e18 */
export type FixtureUsrSavings = {
  id: string;
  /** 份额符号（suETH/suUSD/suBNB） */
  shareSymbol: string;
  /** 底层 uAsset 符号（UETH/UUSD/UBNB） */
  uAssetSymbol: string;
  chainId: number;
  chainName: string;
  /** 利率（ratio→百分比由展示层处理）；0=未激活（PD-04 未激活态照常显示） */
  rate: number;
  rateActive: boolean;
  /** 封顶钳制标记（SPEC-S9 capped） */
  capped: boolean;
  myShares: number;
  /** 存款价值（推导值） */
  myAssets: number;
  /** uAsset 美元样本价（fixture 假数据；缺失为 null → UI 隐藏美元换算） */
  usdSample: number | null;
  lastSettledAt: string;
};

export function getFixtureUsrSavings(): FixtureUsrSavings[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  // 美元样本价挂在底层 uAsset 上（su* 份额代币无价），按符号反查
  const assetBySymbol = new Map(fixtureData.assets.items.map((asset) => [asset.symbol, asset]));
  return fixtureData.usrVaults.items
    .map((row) => {
      const asset = assetMeta.get(row.assetId);
      if (!asset) return null;
      const rate = Number(row.usrRate.raw);
      const myShares = row.myShares ? amount(row.myShares.raw) : 0;
      const uAssetSymbol = `U${asset.symbol.replace(/^su/, '')}`;
      return {
        id: row.id,
        shareSymbol: asset.symbol,
        uAssetSymbol,
        chainId: row.chainId,
        chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
        rate,
        rateActive: rate > 0,
        capped: row.capped,
        myShares,
        myAssets: (myShares * Number(row.accrualIndexRaw)) / 1e18,
        usdSample: assetBySymbol.get(uAssetSymbol)?.usdSample ?? null,
        lastSettledAt: row.lastSettledAt,
      } satisfies FixtureUsrSavings;
    })
    .filter((row): row is FixtureUsrSavings => row !== null);
}

/** 收益库存单行（③区紧凑表）：staking + governance 按 verse 联结 */
export type FixtureVaultRow = {
  verse: { id: string; symbol: string; name: string };
  shareSymbol: string;
  myShares: number;
  apy7d: number;
  /** 等待中赎回锁定的代币合计（requestRedeem→REDEEM_DELAY，MemecoinYieldVault.sol:334） */
  waitingTotal: number;
  /** 已成熟可取出合计（claimableRedeemRequest 口径——MemecoinYieldVault.sol:500） */
  readyTotal: number;
  /** 待领美元折算（017 组合页净值 hero：readyTotal × verse.currentPrice；无样本价=null） */
  readyUsd: number | null;
};

export function getFixtureVaultRows(): FixtureVaultRow[] {
  const verseMeta = new Map(getSnapshot().verses.map((verse) => [verse.id, verse]));
  const rows: FixtureVaultRow[] = [];
  for (const record of fixtureData.staking.items) {
    const verse = verseMeta.get(record.verseId);
    if (!verse) continue;
    const staking = getFixtureStaking(record.verseId);
    rows.push({
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
      },
      shareSymbol: `s${verse.symbol}`,
      myShares: staking?.myShares ?? 0,
      apy7d: staking ? staking.apy7d * 100 : 0,
      waitingTotal: staking
        ? staking.pendingRedeems
            .filter((entry) => !entry.ready)
            .reduce((sum, entry) => sum + entry.lockedAssets, 0)
        : 0,
      readyTotal: staking?.claimableTotal ?? 0,
      readyUsd:
        verse.currentPrice != null ? (staking?.claimableTotal ?? 0) * verse.currentPrice : null,
    });
  }
  // 库存单只列实际持仓：myShares=0 的 verse 不进组合（金库样本仍服务 verse 页签，
  // 2026-10-04 用户裁定：组合假数据减量——持仓集中到 10 个 verse，其余 myShares=0）
  return rows
    .filter((row) => row.myShares > 0)
    .sort((a, b) => a.verse.id.localeCompare(b.verse.id));
}

/** ①待办区聚合（2026-10-02 裁定：只收「逾期有后果」项；同类跨 Verse 聚合、聚合卡显最近截止；
 *  窗口已过的激励不展示——逾期已并入国库、无动作可做（dao-governance.md:51）；
 *  跨链滞留项已删（2026-10-05 用户裁定）——stranded 消息不再进待办与页级信号） */
export type PortfolioActionKind = 'protection' | 'incentive' | 'vault-ready' | 'refund';

export type FixturePortfolioAction = {
  kind: PortfolioActionKind;
  /** 单 verse 目标（聚合卡=null） */
  verse: { id: string; symbol: string; name: string; raiseAsset: string } | null;
  /** 聚合卡的焦点 verse（如激励聚合卡=最近截止的 verse，深链落点）；null=无 */
  focusVerseId: string | null;
  /** 聚合计数（null=单卡） */
  count: number | null;
  /** 截止 ISO（null=无截止；聚合卡=最近截止） */
  deadline: string | null;
  /** 快照锚点距截止剩余毫秒（null=无截止；剩余 ms 有值=限时窗项，null=随时可办项） */
  remainingMs: number | null;
  /**
   * 金额锚（样本口径）：refund=合计参与额（uAsset）；protection=在场本金
   * （myPt + myPol×uAssetPerPol，genesis.md 本位权利构成）；incentive=native myClaimable
   */
  amount: number | null;
  /** 美元样本折算（激励=myClaimable×verse 样本价；金库=Σ readyUsd；null=无样本价） */
  amountUsd: number | null;
  bridgeMessageId: string | null;
};

const KIND_ORDER: Record<PortfolioActionKind, number> = {
  protection: 0,
  incentive: 1,
  'vault-ready': 2,
  refund: 3,
};

export function getFixturePortfolioActions(): FixturePortfolioAction[] {
  const snapshot = getSnapshot();
  const actions: FixturePortfolioAction[] = [];

  // 24h 保护窗（解锁后未满 24h——锚定 unlockedAtTx，genesis.md:43）；金额=在场本金
  // （PT 1:1 本位 + POL 按 uAssetPerPol 折 uAsset 侧，genesis.md:58-65 全额退出权利构成）
  for (const verse of snapshot.verses) {
    if (verse.stage !== 'unlocked' || !verse.unlockedAt) continue;
    const remainingMs = Date.parse(verse.unlockedAt) + PROTECTION_WINDOW_MS - ANCHOR_MS;
    if (remainingMs <= 0) continue;
    const pol = getFixturePolPosition(verse.id);
    const principal = pol ? pol.myPt + pol.myPol * pol.uAssetPerPol : null;
    actions.push({
      kind: 'protection',
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
        raiseAsset: verse.raiseAsset,
      },
      count: null,
      deadline: new Date(Date.parse(verse.unlockedAt) + PROTECTION_WINDOW_MS).toISOString(),
      remainingMs,
      amount: principal,
      amountUsd: null,
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // 周期激励可领（窗口未过；2026-10-05 用户裁定弃聚合卡——逐 verse 行进领取面板，
  // 行动跳 verse 页；金额=native myClaimable + 样本价美元折算，017 hero readyUsd 同口径）
  for (const gov of fixtureData.governance.items) {
    const verse = snapshot.verses.find((candidate) => candidate.id === gov.verseId);
    const claimable = gov.lastCycle ? amount(gov.lastCycle.myClaimable.raw) : 0;
    if (!verse || claimable <= 0 || !gov.claimWindowEndsAt) continue;
    const remainingMs = Date.parse(gov.claimWindowEndsAt) - ANCHOR_MS;
    if (remainingMs <= 0) continue;
    actions.push({
      kind: 'incentive',
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
        raiseAsset: verse.raiseAsset,
      },
      count: null,
      deadline: gov.claimWindowEndsAt,
      remainingMs,
      amount: claimable,
      amountUsd: verse.currentPrice != null ? claimable * verse.currentPrice : null,
      focusVerseId: verse.id,
      bridgeMessageId: null,
    });
  }

  // 收益库待执行赎回（已成熟第二步；2026-10-05 用户裁定升独立卡——CTA 页内锚点 #pf-vault，
  // 跨 verse 币种不同不求和，美元样本价折算合计）
  const readyVerses = getFixtureVaultRows().filter((row) => row.readyTotal > 0);
  if (readyVerses.length > 0) {
    actions.push({
      kind: 'vault-ready',
      verse: null,
      count: readyVerses.length,
      deadline: null,
      remainingMs: null,
      amount: null,
      amountUsd: readyVerses.some((row) => row.readyUsd == null)
        ? null
        : readyVerses.reduce((sum, row) => sum + (row.readyUsd ?? 0), 0),
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // 创世退款（每地址一次；无截止——refund 态随时可领）
  const refundRows = [...new Set(getFixtureParticipations().map((p) => p.verseId))]
    .map((verseId) => {
      const verse = snapshot.verses.find((candidate) => candidate.id === verseId);
      const rows = getFixtureParticipations().filter((p) => p.verseId === verseId);
      return verse && verse.stage === 'refund'
        ? {
            verse: {
              id: verse.id,
              symbol: verse.symbol,
              name: verse.name,
              raiseAsset: verse.raiseAsset,
            },
            total: rows.reduce((sum, row) => sum + row.amount, 0),
          }
        : null;
    })
    .filter(
      (
        row,
      ): row is {
        verse: { id: string; symbol: string; name: string; raiseAsset: string };
        total: number;
      } => row !== null,
    );
  for (const row of refundRows) {
    actions.push({
      kind: 'refund',
      verse: row.verse,
      count: null,
      deadline: null,
      remainingMs: null,
      amount: row.total,
      amountUsd: null,
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // 排序：有截止者按剩余时间升序（最紧急置顶）；无截止者按类别序殿后
  return actions.sort((a, b) => {
    if (a.remainingMs != null && b.remainingMs != null) return a.remainingMs - b.remainingMs;
    if (a.remainingMs != null) return -1;
    if (b.remainingMs != null) return 1;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}

/** ④参与凭证行：创世中=参与记录（未来凭证）；锁定/已解锁=POL/PT/YT/LP 持仓 */
export type FixtureVoucherRow = {
  verse: {
    id: string;
    symbol: string;
    name: string;
    stage: VerseStage;
    raiseAsset: string;
    endsAt: string;
    /** 创世截止 + 365d 固定锁期（MemeverseRegistrationLib.sol:14 合约常量）= 锁定行预计解锁日 */
    unlockAt: string;
    unlockedAt: string | null;
  };
  /** 创世中参与合计（按 kind 分列）+ 质押参与路径标记（PD-01） */
  genesis: {
    total: number;
    normal: number;
    leverage: number;
    preorder: number;
    /** 存在质押参与的普通创世记录=true → 显示「质押参与」徽章 + ③区仓位互链 */
    stakeRoute: boolean;
  } | null;
  /** POL/PT/YT/LP 持仓（锁定中/已解锁）；null=创世中无凭证 */
  holdings: {
    pol: number;
    pt: number;
    yt: number;
    /** 可领 YT（Stage≥Locked 一次性按出资比例） */
    claimableYt: number;
  } | null;
};

export function getFixtureVoucherRows(): FixtureVoucherRow[] {
  const snapshot = getSnapshot();
  const participations = getFixtureParticipations();
  const rows: FixtureVoucherRow[] = [];

  for (const verse of snapshot.verses) {
    const mine = participations.filter((p) => p.verseId === verse.id);
    const pol = getFixturePolPosition(verse.id);
    const head = {
      id: verse.id,
      symbol: verse.symbol,
      name: verse.name,
      stage: verse.stage,
      raiseAsset: verse.raiseAsset,
      endsAt: verse.endsAt,
      unlockAt: verse.unlockTimeAt,
      unlockedAt: verse.unlockedAt,
    };
    if (verse.stage === 'genesis' && mine.length > 0) {
      rows.push({
        verse: head,
        genesis: {
          total: mine.reduce((sum, row) => sum + row.amount, 0),
          normal: mine
            .filter((row) => row.kind === 'normal')
            .reduce((sum, row) => sum + row.amount, 0),
          leverage: mine
            .filter((row) => row.kind === 'leverage')
            .reduce((sum, row) => sum + row.amount, 0),
          preorder: mine
            .filter((row) => row.kind === 'preorder')
            .reduce((sum, row) => sum + row.amount, 0),
          stakeRoute: mine.some((row) => row.kind === 'normal' && row.route === 'stake'),
        },
        holdings: null,
      });
    } else if ((verse.stage === 'locked' || verse.stage === 'unlocked') && pol) {
      rows.push({
        verse: head,
        genesis: null,
        holdings: {
          pol: pol.myPol,
          pt: pol.myPt,
          yt: pol.myYt,
          claimableYt: pol.claimableYt,
        },
      });
    }
  }

  // 分组序 = 生命周期方向（创世中 → 锁定中 → 已解锁；refund 由①待办承接）
  const stageOrder: Record<VerseStage, number> = { genesis: 0, locked: 1, unlocked: 2, refund: 3 };
  return rows.sort(
    (a, b) =>
      stageOrder[a.verse.stage] - stageOrder[b.verse.stage] || a.verse.id.localeCompare(b.verse.id),
  );
}

/** ①待办区/状态行共用：页级信号计数（待办/可领/滞留） */
export function getFixturePortfolioSignals() {
  const actions = getFixturePortfolioActions();
  const claimableVerses = getFixtureVoucherRows().filter(
    (row) => (row.holdings?.claimableYt ?? 0) > 0,
  ).length;
  return {
    actionCount: actions.length,
    claimableVerses,
  };
}

/** /referral（R-12，2026-10-07 用户裁定四项）：Memeverse swap 返佣样本视图。
 *  机制 G 源 = source-map M5/M14/M15：返佣从协议 35% 份额切出（默认 rate=1000bps
 *  即总手续费 10%，owner 可调 0–3500）、in-kind 逐币 pending/claim（无批量）、
 *  单层无绑定自推荐合法、按链独立（pending 行=链×币种）。
 *  friends 明细与 referralCode 短码为 S 级样本（链上事件不含被推荐人、无 code
 *  注册表）；≈$ 折算沿用 assets usdSample 样本价。 */
export type FixtureReferralAssetAmount = {
  assetId: string;
  symbol: string;
  chainId: number;
  chainName: string;
  amount: number;
  /** 样本价折算；无样本价=null（不渲染 ≈$ 行） */
  usd: number | null;
};

export type FixtureReferralTransaction = {
  txId: string;
  friendAddress: string;
  chainId: number;
  chainName: string;
  rebate: { symbol: string; amount: number; usd: number | null };
  at: string;
};

export type FixtureReferralFriend = {
  address: string;
  joinedAt: string;
  volumeUsd: number;
  earnedUsd: number;
};

export type FixtureReferral = {
  /** 链接属主=样本账户（owner 不入 referral.json，从 accounts 派生防两处漂移） */
  owner: string;
  referralCode: string;
  /** 返佣率（占总手续费百分比；生产读 hook referrerRebateBps()） */
  ratePercent: number;
  /** 累计已赚 USD（earned × usdSample 求和，无样本价行计 0） */
  totalEarnedUsd: number;
  /** 待领 USD（同口径） */
  pendingUsd: number;
  friendsCount: number;
  earned: FixtureReferralAssetAmount[];
  pending: FixtureReferralAssetAmount[];
  transactions: FixtureReferralTransaction[];
  friends: FixtureReferralFriend[];
};

export function getFixtureReferral(): FixtureReferral | null {
  const record = fixtureData.referral.items[0];
  if (!record) return null;
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const viewAmount = (row: (typeof record.earned)[number]): FixtureReferralAssetAmount => {
    const asset = assetMeta.get(row.assetId);
    const value = amount(row.amount.raw);
    return {
      assetId: row.assetId,
      symbol: asset?.symbol ?? row.assetId,
      chainId: row.chainId,
      chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
      amount: value,
      usd: asset?.usdSample != null ? value * asset.usdSample : null,
    };
  };
  const earned = record.earned.map(viewAmount);
  const pending = record.pending.map(viewAmount);
  const sumUsd = (rows: FixtureReferralAssetAmount[]) =>
    rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
  return {
    owner: getSnapshot().sampleAccount.address,
    referralCode: record.referralCode,
    ratePercent: Number(record.rate.raw) / 100,
    totalEarnedUsd: sumUsd(earned),
    pendingUsd: sumUsd(pending),
    friendsCount: record.friendsCount,
    earned,
    pending,
    transactions: record.transactions.map((tx) => ({
      txId: tx.txId.value,
      friendAddress: tx.friend.value,
      chainId: tx.chainId,
      chainName: chainMeta.get(tx.chainId)?.name ?? String(tx.chainId),
      rebate: {
        symbol: assetMeta.get(tx.rebate.assetId)?.symbol ?? tx.rebate.assetId,
        amount: amount(tx.rebate.amount.raw),
        usd: (() => {
          const asset = assetMeta.get(tx.rebate.assetId);
          const value = amount(tx.rebate.amount.raw);
          return asset?.usdSample != null ? value * asset.usdSample : null;
        })(),
      },
      at: tx.at,
    })),
    friends: record.friends.map((friend) => ({
      address: friend.address.value,
      joinedAt: friend.joinedAt,
      volumeUsd: friend.volumeUsd,
      earnedUsd: friend.earnedUsd,
    })),
  };
}
