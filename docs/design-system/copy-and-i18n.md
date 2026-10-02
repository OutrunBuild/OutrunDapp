# 文案与双语（Copy & i18n）

> 决议 001-A（消费化语言）与 001-B（单语言渲染 + `/{locale}` 切换，默认 `en`）的可执行版本。

## 1. 机制

- 路由：`/[locale]/...`，`locale ∈ 'en' | 'zh'`；`/` → `/en`。校验用 `isLocale()`（`components/global/copy.ts`）。
- 文案字典：`getCopy(locale)` 返回按页面分组的对象（`common` / `home` / `discovery` / `verse` …）。**所有用户可见字符串都从字典取**，组件内禁止硬编码文案。
- 新增字符串：同时在 `en` 与 `zh` 两个分支添加，保持键名一致；缺一即视为未完成。
- 壳层 `lang` 属性由 `OutrunShell` 设置（`zh-CN` / `en`），中文 `h1` 有独立缩放规则（`.outrun-site[lang='zh-CN'] .home-hero h1`）。

## 2. 语气

- 日常消费产品的人话：短句、动词开头的按钮、说明只说用户能得到什么。
- 禁极客符号与命令式：`KERNEL V3.3`、`DELEGATED ✓`、小写等宽导航。
- 机制词（SY、PT/YT、PSM、CDP、Genesis、POL）只在必要处出现，首次出现给一句解释或 tooltip；阶段名固定用 `copy.common.stages`。
- 错误信息 = 原因 + 恢复动作：`Amount exceeds your balance · Use max`。不出现堆栈、错误码作为主文案。
- 授权类文案用"这会让 X 访问 Y"措辞，不用"approve token"。
- 文案禁用分号（2026-09-26 用户裁定：分号全是 AI 味）——长句拆成两句或改逗号/破折号，除非该分号有具体必要性。

## 3. 数字、日期、时长

| 类型 | 函数 | 输出示例（en / zh） |
|---|---|---|
| 金额 | `formatAmount(v, locale, compact?)` | `12,400.5` / `12,400.5`；compact `1.2M` / `120万` |
| 百分比 | `formatPercent(v, locale)` + `%` | `64.2%` |
| 日期时间 | `formatDate(iso, locale)` | `Sep 18, 2026, 14:00` / `2026年9月18日 14:00` |
| 时长 | `formatDuration(from, to, locale)` | `2d 4h` / `2 天 4 小时` |

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
- 交易状态区 `aria-live="assertive"`；审阅区 `aria-live="polite"`。
- `aria-busy` 于加载容器，不用 `role="status"` 的空 spinner 代替文字。

## 6. 溢出测试

中文更短、英文更长：标签容器 `min-inline-size: 0`；按钮 `white-space: nowrap` 时要保证父容器可换行；表头允许两行。每个新组件两语言各截一次图。
