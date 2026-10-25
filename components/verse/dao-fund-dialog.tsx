import { X } from 'lucide-react'

import type { Locale, GovernanceAsset } from '@/lib/data/fixture-repository'

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

/** >>> animated glyph (cyan functional-signal badge; three-chevron flowing animation — marks
 *  tappable fund details). Single SVG with three paths: spacing is defined by path coordinate
 *  geometry (advance 9, glyph width 6 → stroke gap 3 units ≈2.1px = 3 × 19.25/28), viewBox hugging the stroke bounds,
 *  rendered 19.25×11 (actual chevron height ~8.25px); cap/join=butt/miter sharp facets,
 *  stroke 2; color=--or-cyan (tappable details = functional signal) */
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
 * DAO fund breakdown dialog: shows Total Value + multi-asset rows. Trigger = tappable data card
 * with the >>> animated glyph (current/prior
 * treasury, unclaimed rewards). Composition = governance fixture asset samples,
 * totals anchored to treasuryUAsset/remainingRewards. The trigger renders as the original
 * chip div (DialogTrigger render pattern); layout by breakpoint: >640px=KPI chip grid,
 * ≤640px=hairline rows (globals.css).
 * actionLabel=bottom primary CTA (claim button of the claimable-details dialog;
 * clicking closes the dialog — no faked on-chain execution).
 * triggerButton=button-trigger variant: the claimable row's trigger
 * area shrinks back to the button itself, the whole row is not a trigger; >>> lives in
 * the button copy — when passed, children is ignored and an outline button (label + DaoDots)
 * renders as the trigger; dialog content unchanged.
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
  assets: GovernanceAsset[]
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
        /* className must go through the prop channel: when the wrapper carries its own
           className, base-ui merging drops the className on the render element
           (cycle-card__hit silently failing = desktop hover glow/cyan outline and the mobile
           full-row press feedback all dead) */
        <DialogTrigger nativeButton={false} render={<div />} className="cycle-card__hit">
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="dao-fund-pop">
        {/* Shell reuses .pol-mint (same as the POL/Liquidity/Swap dialogs): surface/stroke
            glow/padding all live on this layer; without it the dialog is just a blurred mask
            with content see-through */}
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
          {/* CTA always disabled: no faked on-chain execution (same
              as PolMintDialog); in this repo Button disabled renders identically to enabled —
              the full-width primary button look is kept, interactions gated */}
          {actionLabel ? (
            <Button className="swap-panel__cta" disabled>
              {actionLabel}
            </Button>
          ) : null}
          {/* Whitelist-scope footnote: the breakdown only
              covers the governance-registered token registry —
              treasury balances read treasuryTokenList, claimable rewards read rewardTokenList;
              unregistered tokens held
              by the Governor stay off the ledger and are not shown. Rendered only in the two
              treasury dialogs, not in the unclaimed/claimable dialogs */}
          {showRegisteredNote ? (
            <p className="dao-fund-pop__note">{copy.registeredAssetsNote}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
