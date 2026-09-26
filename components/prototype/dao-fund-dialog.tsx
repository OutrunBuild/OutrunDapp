import type { Locale, PrototypeGovernanceAsset } from '@/lib/data/prototype-repository'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

import { getCopy } from './copy'
import { formatAmount } from './signal-ui'

/** >>> 动态符（青色功能信号徽章；三 chevron 流动动画——标示可点开资金明细，参照 demo）。
 *  单 SVG 三 path 方案（2026-09-26 七次微调定参）：间距由 path 坐标几何定义
 *  （advance 9、字宽 6 → 笔画间隙 3 单位 ≈2.6px），viewBox 紧贴描边边界，
 *  渲染 24.5×14（chevron 实高 ~10px）；cap/join=butt/miter 尖角棱线、描边 2；
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
 * 触发 = 带 >>> 动态符的可点数据卡（当期/上期国库、未领取滚存）；
 * 构成 = governance fixture 资产样本（S 级，总额锚 treasuryUAsset/remainingRewards）。
 * 触发器渲染为原芯片 div，保持 KPI 芯片网格布局不变（DialogTrigger render 范式）。
 */
export function DaoFundDialog({
  locale,
  title,
  totalUsd,
  assets,
  children,
}: {
  locale: Locale
  title: string
  totalUsd: number
  assets: PrototypeGovernanceAsset[]
  children: React.ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  return (
    <Dialog>
      <DialogTrigger nativeButton={false} render={<div className="cycle-card__hit" />}>
        {children}
      </DialogTrigger>
      <DialogContent className="dao-fund-pop">
        <DialogTitle className="panel-subtitle">{title}</DialogTitle>
        <div className="dao-fund-pop__total" data-numeric>
          <span>{copy.totalValue}</span>
          <strong>${formatAmount(totalUsd, locale)}</strong>
        </div>
        <ul className="dao-fund-pop__list" data-numeric>
          {assets.map((asset) => (
            <li key={asset.symbol}>
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
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
