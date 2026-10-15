'use client'

/**
 * /faucet faucet panel: three mock-token ledger rows (icon/badge + daily limit + cooldown
 * status + Claim) + a hairline-separated batch claim row (all tokens + one-transaction
 * semantics) + footer UUSD swap entry (brand mark + Swap from USDC + the Get UUSD yellow dialog
 * trigger — the only yellow on the page). Cooldown = the fixture remainingMs snapshot decremented
 * every second by wall clock (same semantics as the vault RedeemCountdown: a display-only tick,
 * not an on-chain write), flips to Ready at 0; mechanism = once per 24h per token.
 * In-row Claim and the connected Batch Claim are permanently disabled — the
 * prototype does not fake on-chain settlement; when disconnected, the batch row shows a clickable
 * Connect Wallet that toggles the mock connection (mock-wallet site-wide shared switch).
 */
import { useEffect, useState } from 'react'

import type { FixtureFaucet, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { TokenIconMark, hasTokenIcon } from '../global/token-icons'
import { Button } from '@/components/ui/button'

import { FaucetSwapDialog } from './faucet-swap-dialog'

/** Cooldown remaining (domain ≤24h): en compact hour/minute form, zh CJK unit words with
 *  spaces (staticDuration's day granularity does not fit the cooldown range) */
function cooldownText(remainingMs: number, locale: Locale) {
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return locale === 'zh' ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`
}

export function FaucetClaims({ locale, faucet }: { locale: Locale; faucet: FixtureFaucet }) {
  const copy = getCopy(locale).faucet
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [elapsedMs, setElapsedMs] = useState(0)
  const hasCooldown = faucet.tokens.some(
    (token) => token.cooldownRemainingMs != null && token.cooldownRemainingMs > 0,
  )

  useEffect(() => {
    if (!hasCooldown) return
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [hasCooldown])

  // Splitting swapFrom's {a} placeholder (en leaves a trailing space after it, zh wraps it with
  // spaces on both sides)
  const [swapFromBefore, swapFromAfter] = copy.swapFrom.split('{a}')

  return (
    <section className="pf-panel fc-claims" aria-labelledby="fc-claims-title">
      <header className="pf-panel__bar">
        <h2 className="ref-nameplate" id="fc-claims-title">
          {copy.tokensTitle}
        </h2>
        <span>{copy.claimsNote}</span>
      </header>
      <div className="pf-panel__body">
        {faucet.tokens.map((token) => {
          return (
            <div className="pf-claim-row" key={token.symbol}>
              {hasTokenIcon(token.symbol) ? (
                <TokenIconMark symbol={token.symbol} size={28} aria-hidden="true" />
              ) : (
                <span className="token-select__badge" aria-hidden="true">
                  {token.symbol.slice(0, 2)}
                </span>
              )}
              <div className="pf-claim-row__id">
                <strong>{token.symbol}</strong>
                <span>{token.name}</span>
              </div>
              <div className="pf-claim-row__amount">
                <strong data-numeric>
                  {formatAmount(token.dailyLimit, locale)} {token.symbol}
                </strong>
                {connected
                  ? token.cooldownRemainingMs == null
                    ? // no on-chain source for per-user cooldown (2026-10-14 ruling): slot not rendered
                      null
                    : Math.max(0, token.cooldownRemainingMs - elapsedMs) <= 0
                      ? <span className="fc-claims__ready">{copy.ready}</span>
                      : (
                          <span className="fc-claims__cooling" data-numeric>
                            {copy.readyIn.replace(
                              '{t}',
                              cooldownText(Math.max(0, token.cooldownRemainingMs - elapsedMs), locale),
                            )}
                          </span>
                        )
                  : null}
              </div>
              <div className="pf-claim-row__actions">
                <Button variant="outline" size="sm" disabled>
                  {copy.claim}
                </Button>
              </div>
            </div>
          )
        })}

        {/* Batch claim row (hairline separates it from the claim group): all tokens + one-transaction
            semantics */}
        <div className="fc-claims__batch">
          <div className="pf-claim-row__id">
            <strong>{copy.allTokens}</strong>
            <span>{copy.batchNote}</span>
          </div>
          {connected ? (
            <Button variant="outline" size="sm" disabled>
              {copy.batchClaim}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={toggle}>
              {common.connect}
            </Button>
          )}
        </div>
      </div>
      <footer className="fc-claims__foot">
        {/* UUSD swap entry (footer primary action): identity + the Get UUSD yellow dialog trigger,
            details live in the dialog. swapFrom's {a} placeholder = an inline "USDC icon + symbol"
            node */}
        <span className="fc-claims__uusd">
          <TokenIconMark symbol={faucet.swap.uAssetSymbol} size={18} aria-hidden="true" />
          <strong>{faucet.swap.uAssetSymbol}</strong>
          <span className="fc-claims__from">
            {swapFromBefore}
            <span className="fc-claims__asset">
              <TokenIconMark symbol={faucet.swap.reserveSymbol} size={18} aria-hidden="true" />
              {faucet.swap.reserveSymbol}
            </span>
            {swapFromAfter}
          </span>
        </span>
        <FaucetSwapDialog locale={locale} swap={faucet.swap} />
      </footer>
    </section>
  )
}
