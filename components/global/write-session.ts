// 交易弹窗的点击链路预算（AGENTS.md 性能纪律 · 点击链路 RPC 预算）＋ 执行链选址。
//
// 一次写操作需要的链上数据分两半：
// - 静态半：部署表、launcher 的 verse 元组、token decimals —— 创世后不再变化；
// - 易变半：allowance、gas 行情 —— 必须在点击那一刻现查。
// 只有易变半属于点击链路。静态半在首次交互时预热，经本模块在页面内所有弹窗之间共享
// （同 chain+verse+account 只有一个在途请求）。钱包 RPC 是扩展 → 节点的整轮往返，点击链路上
// 每多一次串行读就是几百毫秒，这正是「点确认后要等几秒才弹窗」的来源。
//
// 链的真相只有 provider 的 `eth_chainId`：wagmi 缓存的 chainId 在钱包内切链后会陈旧，而创世
// 按链独立结算——钱包在 verse 落地集内的哪条链，这次写就在哪条链执行（不换链）；落地集之外
// 才是换链钮的事。所以解析会话时先探链、按探测到的链缓存，缓存键因此永远等于数据来源链。
import type { Hex } from 'viem';

import type { Eip1193ProviderLike, Eip1193Request } from '@/lib/web3/active-provider';

import {
  readErc20Meta,
  resolveVerseSession,
  type ContractReader,
  type VerseSession,
} from './execution-reads';

/** 写会话：`resolveVerseSession` 的全部内容 + 随会话一起读到的 uAsset decimals（chain raw）。 */
export type VerseWriteContext = VerseSession & {
  /** raise uAsset 精度：随会话读一次，点击链路不再 readErc20Meta */
  uAssetDecimals: number;
};

export type VerseSessionInput = {
  /** 钱包 provider（身份参与缓存校验：重新注册 provider = 新连接，旧读取器作废） */
  provider: Eip1193ProviderLike;
  /** 本次写允许执行的链集：verse 落地集（参与面板）或唯一执行链（其余弹窗）。实链不在集内即拒绝 */
  chains: readonly number[];
  eoa: Hex;
  verseId: bigint;
};

/** 钱包所在链不是这次写能执行的链：调用方的动作是换成链钮，不是报错文案。 */
export class VerseChainError extends Error {
  constructor(message = 'outrun: wallet is not on a chain this write can execute on') {
    super(message);
    this.name = 'VerseChainError';
  }
}

type SessionResolveInput = {
  request: Eip1193Request;
  chainId: number;
  eoa: Hex;
  verseId: bigint;
};

type SessionResolver = (input: SessionResolveInput) => Promise<VerseSession>;

type SessionEntry = {
  promise: Promise<VerseWriteContext>;
  /** Resolve-time provider request: a re-registered provider must not be served the old one */
  request: Eip1193Request;
};

/** 页面内并存的上限（多 verse 浏览 + 多账号 + 多落地链），超出按插入顺序淘汰最旧一条。 */
const MAX_SESSIONS = 32;
/** 同一链上 token 的精度恒定（ERC20 部署后不可变），按 chain+token 缓存即可。 */
const MAX_DECIMALS = 64;

const sessions = new Map<string, SessionEntry>();
/** 在途解析：两个弹窗（或预热与点击）同时到达时共用一个探测 + 元组读。 */
const inflight = new Map<string, Promise<VerseWriteContext>>();
const decimalsCache = new Map<string, Promise<number>>();

/**
 * `eth_chainId` 是唯一的链真相读：返回钱包当前所在的链，并断言它是这次写允许执行的链之一。
 * 调用方需要单独刷新「是否错链」时用它；组包路径由 `getVerseSession` 内部调用。
 */
export async function probeVerseChain(
  provider: Eip1193ProviderLike,
  chains: readonly number[],
): Promise<number> {
  const live = Number.parseInt(String(await provider.request({ method: 'eth_chainId' })), 16);
  if (!chains.includes(live)) throw new VerseChainError();
  return live;
}

/**
 * 解析（或复用）这次写操作需要的静态半。
 *
 * 每次调用都先探链（点击链路上唯一不可避免的往返，也是错链闸门）；探到的链在允许集内时，
 * 按 `链:verse:账号` 复用缓存——预热过的会话因此是「一次探测 + 零读」。
 * 传入的 resolver 仅供无链单测注入；生产调用不传，走 `resolveVerseSession`。
 */
export function getVerseSession(
  input: VerseSessionInput,
  resolve: SessionResolver = resolveVerseSession,
): Promise<VerseWriteContext> {
  const request = input.provider.request;
  // 允许集参与在途合并：同一批链 + same verse/account 的并发调用只探一次链。
  const flightKey = `${input.chains.join(',')}:${input.verseId}:${input.eoa.toLowerCase()}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending;

  const promise = (async () => {
    const live = await probeVerseChain(input.provider, input.chains);
    const key = `${live}:${input.verseId}:${input.eoa.toLowerCase()}`;
    const cached = sessions.get(key);
    if (cached && cached.request === request) return cached.promise;
    const entry: SessionEntry = {
      request,
      promise: (async () => {
        const session = await resolve({
          request,
          chainId: live,
          eoa: input.eoa,
          verseId: input.verseId,
        });
        const { decimals } = await readErc20Meta(session.reader, session.verse.uAsset);
        return { ...session, uAssetDecimals: decimals };
      })(),
    };
    // 失败不缓存：下一次点击重新读，而不是把一次瞬时的 RPC 失败固化成一个死会话。
    void entry.promise.catch(() => {
      if (sessions.get(key) === entry) sessions.delete(key);
    });
    sessions.set(key, entry);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = sessions.keys().next();
      if (!oldest.done && oldest.value !== key) sessions.delete(oldest.value);
    }
    return entry.promise;
  })().finally(() => {
    if (inflight.get(flightKey) === promise) inflight.delete(flightKey);
  });
  inflight.set(flightKey, promise);
  return promise;
}

/**
 * 首次交互时的预热：把点击链路上的静态读挪到用户输入期间。
 * 失败静默 —— 预热只是优化，点击时 `getVerseSession` 会按需重读并处理错链。
 */
export function prefetchVerseSession(input: VerseSessionInput): void {
  void getVerseSession(input).catch(() => {
    // 预热失败不打扰用户：点击路径自己会重试并显示降级/换链
  });
}

/**
 * token 精度（chain+token 缓存）：精度是部署常量，但读一次就是一次钱包往返，
 * 弹窗每次打开都重读等于把静态读放回点击链路。只允许用已验证链的 reader 调用
 * （`getVerseSession` 的会话 reader 或探测过链后的客户端）。
 */
export function getTokenDecimals(
  reader: ContractReader,
  chainId: number,
  token: Hex,
): Promise<number> {
  const key = `${chainId}:${token.toLowerCase()}`;
  const cached = decimalsCache.get(key);
  if (cached) return cached;
  const promise = readErc20Meta(reader, token).then((meta) => meta.decimals);
  decimalsCache.set(key, promise);
  void promise.catch(() => {
    if (decimalsCache.get(key) === promise) decimalsCache.delete(key);
  });
  if (decimalsCache.size > MAX_DECIMALS) {
    const oldest = decimalsCache.keys().next();
    if (!oldest.done && oldest.value !== key) decimalsCache.delete(oldest.value);
  }
  return promise;
}
