import { X } from 'lucide-react'

import type { Locale, FixtureGovernanceAsset } from '@/lib/data/fixture-repository'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { getCopy } from '../global/copy'
import { formatAmount, formatPercent } from '../global/signal-ui'

/** >>> 动态符（青色功能信号徽章；三 chevron 流动动画——标示可点开资金明细，参照 demo）。
 *  单 SVG 三 path 方案（2026-09-26 七次微调定参）：间距由 path 坐标几何定义
 *  （advance 9、字宽 6 → 笔画间隙 3 单位 ≈2.6px），viewBox 紧贴描边边界，
 *  渲染 19.25×11（chevron 实高 ~8.25px）；cap/join=butt/miter 尖角棱线、描边 2；
 *  颜色=--or-cyan（可点明细=功能信号——品红回声改青，用户裁定）。
 *  沿革：字符 >（顶角太尖）→ 三独立 SVG（假间距）→ 单 SVG round 2.5（太圆润）
 *  → butt/miter 2.2 品红 → 本版 */
export function DaoDots() {
  return (
    <svg className="dao-dots" viewBox="7 4 28 16" fill="none" aria-hidden="true" focusable="false">
      {[0, 1, 2].map((index) => (
        <path
          key={index}
          d="m9 18 6-6-6-6"
          transform={`translate(${index * 9} 0)`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  )
}

/**
 * DAO 资金明细弹窗（参照 demo.outrun.build/memeverse/26：Total Value + 多资产行）。
 * 触发 = 带 >>> 动态符的可点数据卡（当期/上期国库、未领取奖励）；
 * 构成 = governance fixture 资产样本（S 级，总额锚 treasuryUAsset/remainingRewards）。
 * 触发器渲染为原芯片 div（DialogTrigger render 范式）；布局随档位：>640px=KPI 芯片网格、
 * ≤640px=hairline 行（globals.css 移动端重构块，2026-10-05）。
 * actionLabel=底部主 CTA（可领明细弹窗领取钮，参照图同款；点击关闭弹窗——原型模拟）。
 * triggerButton=按钮触发变体（2026-10-05 用户裁定：可领行触发面积收回按钮本身，
 * 整行不再触发；>>> 移入按钮文案后）——传此参时忽略 children，渲染
 * outline 钮（label + DaoDots）作触发器，dialog 内容不变。
 */
export function DaoFundDialog({
  locale,
  title,
  totalUsd,
  assets,
  actionLabel,
  triggerButton,
  showRegisteredNote = true,
  children,
}: {
  locale: Locale
  title: string
  totalUsd: number
  assets: FixtureGovernanceAsset[]
  actionLabel?: string
  triggerButton?: string
  showRegisteredNote?: boolean
  children?: React.ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  return (
    <Dialog>
      {triggerButton ? (
        <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
          {triggerButton}
          <DaoDots />
        </DialogTrigger>
      ) : (
        /* className 必须走 prop 通道：包装件自带 className 时 base-ui 合并会丢弃 render
           元素上的 className（cycle-card__hit 静默失效=桌面 hover 亮边/青描边与移动端
           整行按压反馈全不生效，2026-10-05 修） */
        <DialogTrigger nativeButton={false} render={<div />} className="cycle-card__hit">
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="dao-fund-pop">
        {/* 壳复用 .pol-mint（同 POL/Liquidity/Swap 弹窗）：底色/描边光/padding 都在这层，
            缺了它弹窗只剩虚化遮罩、内容透底（2026-09-30 修复） */}
        <div className="pol-mint">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{title}</DialogTitle>
            <div className="pol-mint__controls">
              <DialogClose
                render={
                  <button type="button" className="pol-mint__close" aria-label={common.close} />
                }
              >
                <X aria-hidden="true" size={16} />
              </DialogClose>
            </div>
          </header>
          <div className="dao-fund-pop__hero" data-numeric>
            <div className="dao-fund-pop__hero-main">
              <span>{copy.totalValue}</span>
              <strong>${formatAmount(totalUsd, locale)}</strong>
            </div>
            <span className="dao-fund-pop__hero-meta">
              {formatAmount(assets.length, locale)} {copy.assetsLabel}
            </span>
          </div>
          <ul className="dao-fund-pop__list" data-numeric>
            {assets.map((asset) => {
              const share = totalUsd > 0 ? asset.usdValue / totalUsd : 0
              return (
                <li key={asset.symbol}>
                  <div className="dao-fund-pop__row">
                    <span className="dao-fund-pop__glyph" aria-hidden="true">
                      {asset.symbol.slice(0, 1)}
                    </span>
                    <span className="dao-fund-pop__token">
                      <strong>{asset.symbol}</strong>
                      <em>{asset.name}</em>
                    </span>
                    <span className="dao-fund-pop__qty">
                      <strong>{formatAmount(asset.amount, locale)}</strong>
                      <em>${formatAmount(asset.usdValue, locale)}</em>
                    </span>
                  </div>
                  <div className="dao-fund-pop__share" aria-hidden="true">
                    <span className="dao-fund-pop__track">
                      <span style={{ inlineSize: `${Math.min(share * 100, 100)}%` }} />
                    </span>
                    <em>{formatPercent(share * 100, locale)}%</em>
                  </div>
                </li>
              )
            })}
          </ul>
          {/* CTA 恒 disabled：原型不伪造链上成交（同 PolMintDialog 契约）；本仓 Button disabled
              渲染与 enabled 一致——参照图的通栏主钮观感保留，交互门控 */}
          {actionLabel ? (
            <Button className="swap-panel__cta" disabled>
              {actionLabel}
            </Button>
          ) : null}
          {/* 白名单口径注脚（2026-09-30 源码对账）：明细只覆盖治理注册的代币注册表——
              getTreasuryBalances→treasuryTokenList、getClaimableReward→rewardTokenList
              （GovernanceCycleIncentivizerUpgradeable.sol:266/:199）；Governor 持有的
              未注册代币不入账本不显示。原四弹窗统一一条（用户裁定）；
              2026-10-06 裁定：未领取/可领两弹窗不再显示，仅国库两弹窗保留 */}
          {showRegisteredNote ? (
            <p className="dao-fund-pop__note">{copy.registeredAssetsNote}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
