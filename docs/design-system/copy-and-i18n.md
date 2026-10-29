# 文案与双语（Copy & i18n）

> 决议 001-A（消费化语言）与 001-B（单语言渲染 + `/{locale}` 切换，默认 `en`）的可执行版本。

## 1. 机制

- 路由：`app/[locale]/...` 双语言树（`locale ∈ 'en' | 'zh'`）。对外 URL：en 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`），zh 带 `/zh` 前缀；外部直连 `/en/**` 被 `proxy.ts` 307 收敛到无前缀地址。语言切换一律走 `localePath()`（`components/global/routes.ts`），禁止手拼 `/${locale}`。校验用 `isLocale()`（`components/global/copy.ts`）。
- 文案字典：`getCopy(locale)` 返回按页面分组的对象（`common` / `home` / `discovery` / `verse` …）。**所有用户可见字符串都从字典取**，组件内禁止硬编码文案。执行闸：`pnpm check:cjk-copy`（`scripts/check-cjk-copy.mjs`，入 vitest contract gates 与 CI）扫描 components/app/lib 的组件内 CJK 字面量——注释豁免、`design-system/` 通用层豁免（活体展示页的双语标签表是其自身展示数据）、纯标点不扫。
- 新增字符串：同时在 `en` 与 `zh` 两个分支添加，保持键名一致；缺一即视为未完成。
- 壳层 `lang` 属性由 `OutrunShell` 设置（`zh-CN` / `en`），中文 `h1` 有独立缩放规则（`.outrun-site[lang='zh-CN'] .home-hero h1`）。

## 2. 语气

- 日常消费产品的人话：短句、动词开头的按钮、说明只说用户能得到什么。
- 禁极客符号与命令式：`KERNEL V3.3`、`DELEGATED ✓`、小写等宽导航。
- 机制词（SY、PT/YT、PSM、CDP、Genesis、POL）只在必要处出现，首次出现给一句解释或 tooltip；阶段名固定用 `copy.common.stages`。
- 错误信息 = 原因 + 恢复动作：`Amount exceeds your balance · Use max`。不出现堆栈、错误码作为主文案。
- 授权类文案用"这会让 X 访问 Y"措辞，不用"approve token"。
- 文案禁用分号（分号全是 AI 味）——长句拆成两句或改逗号/破折号，除非该分号有具体必要性。执行闸：`pnpm check:copy-punctuation`（扫 `copy.ts`、`fixtures/data`、`design-system/showcase.tsx`；入 vitest contract gates）。
- 「以链上读值为准 / On-chain value prevails」类文案**全站禁用**（此类文案没有任何受众——用户不会看，开发者不需要从 UI 看；数据完整性是数据层职责，不是界面文案）。`onChainSlot` 及同族键（`lockedTimingUnavailable`「解锁时间以链上确认为准」等）全部废止；值缺失时按「null 不渲染」处理，不显示解释句。存量已扫除（六键删除、约 38 处渲染点改 null 不渲染，登记 component-contract.md）。
- 标题（页面/面板/分区/弹窗标题）一律 Title Case：实词首字母大写，冠词/连词/短介词（a/an/the/and/or/to/of/for）非首尾词保持小写，连字符复合词两段都大写（`Cross-Chain`）——全站统一，en 分支 `*Title` 字段已全量对齐；正文、CTA、标签不受此条管辖。
- zh 第二人称一律用「你」，不用「您」（与 §2 日常消费人话基调一致）。

## 3. 数字、日期、时长

| 类型 | 函数 | 输出示例（en / zh） |
|---|---|---|
| 金额 | `formatAmount(v, locale, compact?)`（通用读数：余额/数量常规量级，无大数分层） | `12,400.5` / `12,400.5`；compact `1.20M` / `120.00万` |
| 百分比 | `formatPercent(v, locale)` + `%` | `64.2%` |
| 日期时间 | `formatDate(iso, locale)` | `Sep 18, 2026, 14:00` / `2026年9月18日 14:00` |
| 时长 | `formatCountdown(remainingMs, locale)`（`components/global/signal-ui.tsx`，三档共享：天+时/时+分/仅分；单元模板 = `copy.common.countdownDh/Hm/M`，组件内联由 `check:cjk-copy` 拦截；待办区徽章=天+小时档 `staticDuration`，faucet 冷却行=小时+分钟档，见 `component-contract.md` §领取行） | `2d 4h` / `2 天 4 小时` |
| 交易台派生金额（到账/保护价/汇率） | `fmtUsd(v, locale)` / `fmtTokenAmount(v, locale)`（`components/global/amount-format.ts`，大数分层降级；规格与射程真相源=`component-contract.md` §1 大数边界行） | `fmtUsd` 常态 `1,234.57`、`fmtTokenAmount` 常态 `1,234.57`（<1e4 六位有效数字裁尾零）、小值 `<0.00001`、大数 `83,079,910.22T`（国际 K/M/B/T 符号，zh 不再出万亿）、`4.36E40` |
| 代币单价（token-strip / 蜡烛图图例） | `fmtPrice(v)`（同文件，决议 019 市场口径，中英同形） | `$1.20`、`$0.0042`；极小价 `0.0₄42` |

- 输出一律放在 `data-numeric` 容器里。
- 单位跟在数字后并用普通字体：`<span data-numeric>12.4</span> USDC`。
- 倒计时 <72h 切 `--color-warning`；到期后显示阶段变化而不是负数。
- 地址/hash 截断 `0x1234…abcd`，`title` 全值，配复制按钮。

## 4. 标签与徽章

- 大写小标签（`__signal-label`、表头）用 `--text-sm` + `--label-tracking`，仅英文场景大写；中文不大写、不加字距。
- 徽章文本化，不靠颜色单独传达（`Testnet`、`Current`、`Ends in 2d 4h`）。
- 计数与状态：`Live data · Mainnet`，用 `·` 分隔。

## 5. 无障碍文案

- 图标按钮 `aria-label` 来自字典；装饰图标 `aria-hidden`。
- 进度条 `aria-label` + 文本并行输出（`ProgressMeter` 已实现）。
- 交易状态区 `aria-live="assertive"`。
- `aria-busy` 于加载容器，不用 `role="status"` 的空 spinner 代替文字。

## 6. 溢出测试

中文更短、英文更长：标签容器 `min-inline-size: 0`；按钮 `white-space: nowrap` 时要保证父容器可换行；表头允许两行。每个新组件两语言各截一次图。
