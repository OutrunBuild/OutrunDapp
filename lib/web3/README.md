# 钱包双轨（MetaMask 与 Privy）

从根 `AGENTS.md` §2.3 拆出的完整机制与约束；红线速览（品牌分支禁令）留在 `AGENTS.md` §2.3。链交互问题默认先调 `viem-integration` Skill（`AGENTS.md` §5.2）。

两种连接方式、一条执行面；业务代码不得按钱包品牌分支（红线级）。

- **MetaMask（注入轨）**：EIP-6963 发现（`components/global/wallet-selector-dialog.tsx` 的 `useMetamaskProvider`）→ wagmi `injected` connector。
  - 持久化用第一方 marker `outrun:wallet-link`（`lib/web3/session-hint.ts`）；页面加载由 `components/global/injected-session-restore.tsx` 按 marker 重连（reconnect 先查 isAuthorized，不弹窗）。
  - 不用 wagmi 自带持久化的原因：Privy 的 wagmi 封装在 config 创建时即清空 wagmi 持久化连接，store 跨页不可用。
- **Privy（OAuth+内嵌轨）**：Google/X OAuth（headless `initOAuth`，`?privy_oauth_*` 回调由常挂的 `components/global/login-session-restore.tsx` 消费）→ 内嵌钱包经 `setActiveWallet` 链入 wagmi；会话存 Privy 自家 storage，不吃第一方 marker。
  - 硬规则：OAuth 跳转前必须写 `privy:headless_oauth` marker（SDK 回流 effect 的门；跳转会使弹窗内组件卸载）。
- **统一执行面**：两轨连接后 `use-account-center` 把 `connector.getProvider()` 注册进 `setActiveEip1193Provider`（`lib/web3/active-provider.ts`）；一切客户端链上读/写只走 `getActiveEip1193Provider()`，不感知品牌。
  - 能力差异（type-4/7702 签名）走 `lib/web3/account.ts` 的 ProviderCapability 判定，禁止写品牌 if。
  - 存引用时必须绑定 request：Privy 内嵌 provider 的 request 在原型上读 this，解构即 TypeError。
- **登出竞态**：`leave()` 先 `beginDisconnect()`（`lib/web3/disconnect-guard.ts`）再断全部 wagmi 连接 + Privy logout；两个自动回链 effect 都以该守卫为闸，否则断开会被旧会话「弹回」。Privy logout 仅在 `authenticated` 时调（MetaMask-only 会话调它会 400）。
- **换链**：`switchProviderChain` 走 provider-direct `wallet_switchEthereumChain`，4902 时补 `wallet_addEthereumChain`。不走 connector 的原因：wagmi 缓存的 chainId 在钱包内切链后陈旧，connector 路径不可信。
- **无 App ID 退化**：`NEXT_PUBLIC_PRIVY_APP_ID` 缺失（fixture/e2e 构建）时 `PrivyProvider` 整层不挂载，wagmi hooks 停在 Disconnected，钱包 UI 走 harness 路径——fixture 视觉基线因此不受钱包层影响。
