# Outrun uAsset 代币图标 — UUSD / UETH / UBNB

基于 USDC / ETH / BNB 官方图标几何重绘的 Outrun 品牌代币图标族（v3.1 印章制式）。
生成器：`script/token-icons/build.mjs`（改几何后重跑即可复现全部资产 + preview）。

状态：**v3.1 已定稿（2026-10-07 用户裁定）并接入产品**——生产资产 `public/tokens/<t>.svg` + `<t>-256.png`（Trust Wallet 上架格式），组件 `components/global/token-icons.tsx`（`TokenIconMark`/`hasTokenIcon`，契约见 component-contract.md）；接入位=Portfolio 资产行 tile + Swap 选币器行（uAsset=品牌章；BNB/ETH/USDC/USDT 储备/原生=官方代币图标（CoinGecko/Trust Wallet 代币资产源，落 public/tokens/；ETH=蓝圆代币图标，非 chains/ 链徽——2026-10-07 用户二次纠错定源））。

---

## 版本史（均为 2026-10-07，用户逐轮质询驱动）

| 版本 | 设计 | 结局 |
|---|---|---|
| v1 | OR monogram 三色级联回声（黄+品红+青错位） | 毙：小尺寸成泥、读作重影；八边形容器无市场先例 |
| v2 | 落日渐变地（品红羽化径向 #B11884→#760F57）+ 黄字 / 级联 | 毙：三色渐变小尺寸发花、整体观感差（用户裁定） |
| v3 | 印章制式：品牌黄平涂圆 + site black 字形，纯双色 | 字色被换 |
| v3.1 | **黄地 + 品红字；UBNB 换 BNB Chain 现行标；比例配平 60–67%** | 当前 |

## 市场调研（2026-10-07，v3 立项依据）

**样本**：15 枚——USD 类 7（USDC/USDT/DAI/TUSD/FRAX/FDUSD/USDe）、ETH 类 4（ETH/WETH/rETH/cbETH）、BNB 类 2（BNB/WBNB）+ 母资产参照。来源：cryptocurrency-icons、CoinGecko 官方图、[Coinbase cbETH spec](https://github.com/coinbase/wrapped-tokens-os)、[Trust Wallet 资产规范](https://developer.trustwallet.com/developer/new-asset/requirements.md)。

**方法**：128px 渲染 → 程序化统计（地色环采样明度方差=渐变度、色相计数、字形-地明度关系）+ 接触表目检。

**结论（v3 全部采纳）**：

| 维度 | 市场主流（样本命中） |
|---|---|
| 地色 | 纯色平涂 13/15（渐变仅 2 枚且极轻）；单一色相 |
| 字形色 | 白字 12/15；黄地两枚（DAI/BNB）均配深字 |
| 色相数 | 一枚一色相为主，max 2，零枚 ≥3 |
| 衍生代币 | **100% 保留母资产字形**（weth/cbeth/wbnb/reth 实证），包装方身份=地色（cbETH spec 同构） |
| 装饰 | 无边框无角标；选中环属 UI 层 |
| 尺寸 | cbETH spec：16/20/24/32 精调；Trust Wallet：256×256 透明底 |

## v3 制式

- **地**：品牌黄 `#FCEE0A`（--logo-yellow）纯平涂圆 r250——字标字身色即地色，图标=品牌的一枚印章；黄地深字有 DAI/BNB 市场先例
- **字形**：`#0A0A10`（site black）单色，对比度 15.3:1（AAA 级）；与字标构成双色反转（黑底黄字 ↔ 黄地黑字）
- **字形几何**：锚定资产官方比例重绘——UUSD=经典 $（S 旋转对称+中心单竖线）、UETH=腰缝菱形（w/h 0.625）、UBNB=双 chevron+东西菱形+中心菱形
- **严格 2 色、无渐变、无描边、无角标**；三枚唯一差异=字形，唯一身份=黄地

## 细节台账（2026-10-07，v3.1）

| 项 | 态 | 出处 |
|---|---|---|
| 黄 #FCEE0A 地 / 品红 #FF06B5 字 | G | logo-spec §2（logo-yellow / logo-magenta-bright）；bright 档「仅大字号与图形」，图形合法；字色=用户裁定试品红 |
| 品红字对比 2.9:1（high 档 3.2:1 / ink 15.3:1） | G | 实测；图形非正文，市场图标普遍低于文字对比（BNB 官方白/黄 1.4:1）；对比行在 preview |
| 圆形、平涂、无装饰、保留母字形 | G | 市场调研 + [cbETH spec](https://github.com/coinbase/wrapped-tokens-os) + [Trust Wallet 规范](https://developer.trustwallet.com/developer/new-asset/requirements.md) |
| UETH/UBNB 字形 = 本仓在用官方图轮廓追踪 | G | 用户指误 2026-10-07（直线多边形版丢失 ETH 内凹侧边曲线/双风筝结构与 BNB 全套圆角曲边）；`extract-glyphs.py` 管线：2048 LANCZOS → 掩膜 → approxDP eps1.4 → 512 坐标；复刻保真 IoU UETH 0.99 / UBNB 0.97（对本仓 `public/chains/*.png` 实测） |
| UUSD=$ 单竖线（笔画 12.3% 墨高、终端 ~8° 斜切、旋转对称） | S | 用户裁定（双竖线读作 8）；量化对标：笔画重原 14.2% 偏重 → 对标 USDC ~12% 调轻（PYUSD 10%/USDC 12% 实测参照）；w/h 0.56 经典区间（PYUSD 0.95 为 PayPal 特宽异形不跟）；S 曲线 C1 连续逐段验证 |
| 比例配平：墨迹高 h/d uusd 64% / ueth 68% / ubnb 61% | S | 用户裁定「不能太大不能太小」；实测 bbox 核验 + 墨迹面积级平衡 |
| seal-inverse 深底变体保不保留 | Q | 未拍板（未接入任何界面，仅 svg/ 存档） |
| ~~集成位置与 PNG 导出~~ | 已落 | 2026-10-07 定稿：资产行 tile + 选币器 uAsset 行接入；PSM/Convert 弹窗纯文本符号无图标槽（不动）；256×256 透明底 PNG 已导出 `public/tokens/` |

## 深度 Review 审计记录（2026-10-07，v3.1 终轮）

- **形状 IoU vs 本仓官方图**：ueth 0.99 / ubnb 0.97（轮廓追踪法终值；此前直线多边形版 0.81/0.83——用户目检否决，教训：直线化重绘不适用于曲边官方标，改用测量重印）
- **墨迹密度对齐**：ueth 47.3% vs 官方 47.4%（配平）；ubnb 37.8% vs 45.1%（官方 PNG 软边缘 + 多边形简化固有，非结构性）
- **中心配准**：三币墨迹中心偏差 ≤0.5px（512 画布）
- **小尺寸部件存活**：ubnb 20px 保 4 部件群 / 16px 2 群（与官方图同尺寸行为一致）；ueth 腰缝 24px 档 0.94px→ 加宽至 7.5% 后 1.2px 可辨
- **uusd 无官方单竖 $ 参照**（USDC 官方为双侧笔画记号），以市场惯例 + 用户裁定为基准，S 曲线 C1 连续性逐段验证通过（6 段控制点方向全对齐）

## 文件矩阵

| 文件 | 构造 | 用途 |
|---|---|---|
| `svg/<t>-seal.svg` | 黄圆 r250 + 品红字 | **主形** |
| `svg/<t>-seal-high.svg` | 黄圆 + 品红高亮档 #EE17AE 字 | 对比备选（3.2:1） |
| `svg/<t>-seal-ink.svg` | 黄圆 + site black 字 | v3 原案备选（15.3:1） |
| `svg/<t>-seal-inverse.svg` | 黑圆 + 黄字 | 深底 UI 备用 |
| `svg/<t>-ink.svg` | 品红字透明底 | 已有圆形容器的场景 |
| `svg/<t>-ink-currentcolor.svg` | 同上 currentColor | 内联随色（须内联，`<img>` 进不去变量） |

`t ∈ uusd, ueth, ubnb`，均 512 viewBox。

## 使用规则

- 产品位（资产行/选币器/弹窗）：seal；浅底同用 seal（黄地圆自成对比）
- 禁改色值/拉伸/旋转/加投影/加边框角标/加渐变
- 修改几何一律改 `build.mjs` 重跑，不手改 SVG（复现管线纪律）

## 已知边界

- 纯双色，无已知小尺寸塌缩问题（px ladder 验证）
- 已删变体（级联/渐变/八边形/币安四菱形 BNB）构造可溯 git 历史

## 第三方官方图标登记（2026-10-09，/faucet 领取行接入）

| 资产 | 文件 | 来源 | 备注 |
|---|---|---|---|
| sUSDS | `public/tokens/susds.png`（250×250 RGBA） | Sky 官方 CoinGecko 收录资产：assets.coingecko.com/coins/images/52721（sUSDS_Coin） | 绿币白 Sky S（savings 变体色）；沙箱内 trustwallet/Uniswap assets/官方站均不可达，CoinGecko assets 域可达且为项目方提交资产 |
| aUSDC | `public/tokens/ausdc.svg`（256 viewBox） | Aave 官方 `@aave/aave-ui-kit@0.1.29` 内嵌 base64 组合标（`aIcons.ausdc`） | Aave 自家 aToken 图标=底层资产+Aave 徽标客户端合成（aave-ui 工程口径）；npm 拆包提取，未改一字节 |

同轮：页脚 UUSD 品牌章光学配平（flex 盒心对齐下墨迹中心偏高 1.5px，scoped `translate: 0 -1.5px`，实测配平）。
