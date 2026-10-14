'use client'

import { useEffect, useState } from 'react'
import { Info, Zap } from 'lucide-react'

import type { Locale, FixtureStaking } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount, formatDay } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount } from '../global/amount-format'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type RedeemMode = 'redeem' | 'withdraw'

/** Mock chain-environment mapping (mock glue layer, not domain values): the fixture
 * governance chain=mainnet ids (1/8453/56),
 * the header chain selector only exposes testnets — the "connected on the governance chain"
 * check uses the governance chain's corresponding testnet
 * (same-name mainnet/testnet family: Ethereum/Base/BNB each with their Sepolia series) */
const GOVERNANCE_TESTNET: Record<number, number> = { 1: 11155111, 8453: 84532, 56: 97 }

/** EVM address scope (governance chain family = Ethereum/Base/BNB): 0x + 40 hex digits; accepts any casing, no EIP-55 validation */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Redemption waiting countdown (ticking seconds): starts from the
 * snapshot remainingMs given by the repository and decrements each second by wall clock (pure
 * display-layer tick, not an on-chain write), stops at 0; template=copy.remaining ({t} placeholder).
 */
function RedeemCountdown({ remainingMs, template }: { remainingMs: number; template: string }) {
  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, remainingMs - elapsedMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`
  const [before, after] = template.split('{t}')
  return (
    <span data-state="waiting">
      {before}
      <span data-numeric>{time}</span>
      {after}
    </span>
  )
}

/**
 * Yield Vault action cards in two columns: a left column with
 * permanent Stake + a right column toggling Redeem/Withdraw
 * (a full-width bar would stretch the swap narrow-card primitives to the tab card's
 * full ~1100px width, leaving the sparse content stretched;
 * column ratio/breakpoint 1.15:0.85 (same as the POL tab), collapsing to one column
 * below 1024px). Stake/Redeem cards in-card structure: Amount card → Details card → full-width CTA → footnote;
 * reuses the .swap-panel__*
 * primitives. CTA channels: with both cards on screen, to keep "one primary CTA
 * per screen" — the left column Stake keeps the yellow
 * .swap-panel__cta (deposit=primary action), the right column's CTAs are all outline (same as
 * the POL tab action button).
 * Chain awareness (all vault operations go through the
 * governance chain):
 * - Connected network = the header chain selector is the only entry
 * (no in-card chip), driven by the mock wallet's chainId;
 * - Stake with connected chain≠governance chain → cross-chain mode (LayerZero banner +
 * cross-chain fee row + Cross-chain Stake CTA);
 * - Redeem/Withdraw with ≠governance chain → the CTA switches chain first (mock switchChain,
 * not an on-chain write).
 * Status lists live inside the tabs: the Redeem
 * tab's tail=Pending Redemptions
 * (waiting entries only: amount + Redeemed on {date} + seconds countdown); the Withdraw tab's
 * head=Ready to Withdraw
 * (matured entries only: amount + Ready since {maturity date} + ✓ Ready), empty state '--'.
 * Mock layer only demonstrates the ViewModel: write-action CTAs are always disabled, no
 * faked on-chain success.
 */
export function VaultActions({
  locale,
  symbol,
  shareSymbol,
  assetsPerShare,
  claimableTotal,
  myShares,
  myMemecoin,
  pendingRedeems,
  // Contract call parameter (delegate(delegatee) input), not a display field — no display
  // design in the UI;
  // no real transactions; receiving the parameter is pending wiring
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delegatee,
  governanceChain,
  governanceChainName,
  initialRedeemMode,
}: {
  locale: Locale
  symbol: string
  /** Share symbol = s + Memecoin symbol */
  shareSymbol: string
  assetsPerShare: number
  claimableTotal: number
  /** Sample account shares (source of Redeem's Balance/Max) */
  myShares: number
  /** Sample account's this-verse memecoin balance (pol-positions myMemecoin; source of Stake's Balance/Max, null=slot state) */
  myMemecoin: number | null
  /** Two-step async redemption entries (including the ready split and the remainingMs countdown start; the display layer filters by tab) */
  pendingRedeems: FixtureStaking['pendingRedeems']
  delegatee: string
  /** Governance chain chainId (the chain hosting the vault) */
  governanceChain: number
  governanceChainName: string
  /** ?action=withdraw deep-link initial value: landing from the portfolio table's Withdraw shows the Ready to Withdraw list directly; redeem is the default state, no prop preset needed */
  initialRedeemMode?: 'withdraw'
}) {
  const copy = getCopy(locale).verseDesk
  const { connected, chainId, toggle, switchChain } = useMockWallet()
  const [redeemMode, setRedeemMode] = useState<RedeemMode>(initialRedeemMode ?? 'redeem')
  /** Two cards on screen: left/right column amounts are independent (sharing would bleed values between the two cards) */
  const [stakeAmount, setStakeAmount] = useState('')
  const [redeemAmount, setRedeemAmount] = useState('')
  const [delegateSelf, setDelegateSelf] = useState(true)
  const [delegateAddress, setDelegateAddress] = useState('')

  const governanceWalletChain = GOVERNANCE_TESTNET[governanceChain] ?? governanceChain
  const wrongChain = connected && chainId !== governanceWalletChain
  const stakeParsed = Number(stakeAmount)
  const stakeValid = Number.isFinite(stakeParsed) && stakeParsed > 0
  const stakeOut = stakeValid ? stakeParsed / assetsPerShare : null
  const redeemParsed = Number(redeemAmount)
  const redeemValid = Number.isFinite(redeemParsed) && redeemParsed > 0
  const redeemOut = redeemValid ? redeemParsed * assetsPerShare : null
  const stakeOver = myMemecoin != null && stakeParsed > myMemecoin
  const redeemOver = redeemParsed > myShares
  const delegateInvalid =
    !delegateSelf && delegateAddress !== '' && !EVM_ADDRESS_RE.test(delegateAddress)
  const waitingRedeems = pendingRedeems.filter((entry) => !entry.ready)
  const readyRedeems = pendingRedeems.filter((entry) => entry.ready)

  const connectCta = (
    <Button className="swap-panel__cta" onClick={toggle}>
      {getCopy(locale).common.connect}
    </Button>
  )
  /* Outline channel for the right column's same CTAs (the yellow channel is reserved for the
     left column's Stake — one primary CTA per screen) */
  const switchCtaAlt = (
    <Button variant="outline" className="swap-panel__cta" onClick={() => switchChain(governanceWalletChain)}>
      {copy.switchChainCta.replace('{chain}', governanceChainName)}
    </Button>
  )
  const connectCtaAlt = (
    <Button variant="outline" className="swap-panel__cta" onClick={toggle}>
      {getCopy(locale).common.connect}
    </Button>
  )

  return (
    <div className="vault-actions">
      <div className="vault-card">
        <div className="vault-card__bar">
          <span className="vault-card__bar-label">{copy.stakeTab}</span>
        </div>

        {wrongChain ? (
          <div className="vault-card__banner" role="note">
            <p className="vault-card__banner-head">
              <Zap aria-hidden="true" size={14} />
              <strong>{copy.crossBannerTitle}</strong>
              <span>{copy.crossBannerSub}</span>
            </p>
            <p>{copy.crossBannerBody.replace('{symbol}', symbol).replace('{chain}', governanceChainName)}</p>
          </div>
        ) : null}

        <div className="swap-panel__field">
          <div className="swap-panel__field-head">
            <span>{copy.amount}</span>
            <span className="swap-panel__balance">
              {copy.balance}:{' '}
              {myMemecoin == null ? (
                '--'
              ) : (
                <span data-numeric>{formatAmount(myMemecoin, locale)}</span>
              )}
              <button
                type="button"
                className="swap-panel__max"
                disabled={myMemecoin == null || myMemecoin <= 0}
                onClick={() => setStakeAmount(amountToInputString(myMemecoin ?? 0))}
              >
                {copy.max}
              </button>
            </span>
          </div>
          <div className="swap-panel__field-row">
            <Input
              className="numeric-input"
              inputMode="decimal"
              placeholder="0.00"
              value={stakeAmount}
              maxLength={AMOUNT_MAX_CHARS}
              onChange={(event) => setStakeAmount(sanitizeAmount(event.target.value))}
              aria-label={`${copy.amount} (${symbol})`}
              aria-invalid={stakeOver || undefined}
              aria-describedby={stakeOver ? 'vault-stake-balance-error' : undefined}
            />
            <div className="swap-panel__token">
              <strong>{symbol}</strong>
            </div>
          </div>
          {stakeOver ? (
            <FieldError id="vault-stake-balance-error">
              {getCopy(locale).common.insufficientBalance}
            </FieldError>
          ) : null}
        </div>
        <dl className="swap-panel__details">
          <div>
            <dt>{copy.exchangeRate}</dt>
            <dd data-numeric>
              1 {symbol} ≈ {fmtTokenAmount(1 / assetsPerShare, locale)} {shareSymbol}
            </dd>
          </div>
          <div>
            <dt>{copy.youReceive}</dt>
            <dd data-numeric>
              {stakeOut != null ? `${fmtTokenAmount(stakeOut, locale)} ${shareSymbol}` : `0.00 ${shareSymbol}`}
            </dd>
          </div>
          {wrongChain ? (
            <div>
              <dt className="swap-settings__label">
                {copy.crossFee}
                <Tooltip>
                  <TooltipTrigger className="create-info" aria-label={copy.crossFeeNote}>
                    <Info aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>{copy.crossFeeNote}</TooltipContent>
                </Tooltip>
              </dt>
              <dd data-numeric>--</dd>
            </div>
          ) : null}
          <div>
            <dt className="swap-settings__label">
              {copy.delegateTo}
              <Tooltip>
                <TooltipTrigger className="create-info" aria-label={copy.delegateNote}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.delegateNote}</TooltipContent>
              </Tooltip>
            </dt>
            <dd className="vault-card__delegate">
              <button
                type="button"
                className="vault-actions__delegate-option"
                data-selected={delegateSelf}
                onClick={() => setDelegateSelf(true)}
              >
                {copy.delegateSelf}
              </button>
              <button
                type="button"
                className="vault-actions__delegate-option"
                data-selected={!delegateSelf}
                onClick={() => setDelegateSelf(false)}
              >
                {copy.delegateCustom}
              </button>
            </dd>
          </div>
        </dl>
        {!delegateSelf ? (
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.delegateAddressLabel}</span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={42}
                placeholder={copy.delegateAddressPlaceholder}
                value={delegateAddress}
                aria-label={copy.delegateAddressLabel}
                aria-invalid={delegateInvalid || undefined}
                aria-describedby={delegateInvalid ? 'vault-delegate-address-error' : undefined}
                data-numeric
                onChange={(event) => setDelegateAddress(event.target.value.replace(/\s+/g, ''))}
              />
            </div>
            {delegateInvalid ? (
              <FieldError id="vault-delegate-address-error">{copy.delegateAddressError}</FieldError>
            ) : null}
          </div>
        ) : null}
        {!connected ? (
          connectCta
        ) : wrongChain ? (
          <Button className="swap-panel__cta" disabled>
            {copy.stakeCrossCta.replace('{symbol}', symbol)}
          </Button>
        ) : (
          <Button className="swap-panel__cta" disabled>
            {copy.stakeCta.replace('{symbol}', symbol)}
          </Button>
        )}
        {wrongChain ? <p className="panel-note">{copy.crossNote}</p> : null}
      </div>

      <div className="vault-card">
        <div className="vault-card__bar">
          <ToggleGroup
            className="vault-actions__bar"
            value={[redeemMode]}
            onValueChange={(value) => {
              if (value[0]) setRedeemMode(value[0] as RedeemMode)
            }}
          >
            <ToggleGroupItem value="redeem">{copy.redeemTab}</ToggleGroupItem>
            <ToggleGroupItem value="withdraw">{copy.withdrawTab}</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {redeemMode === 'redeem' ? (
          <>
            <div className="swap-panel__field">
              <div className="swap-panel__field-head">
                <span>{copy.amount}</span>
                <span className="swap-panel__balance">
                  {copy.balance}: <span data-numeric>{formatAmount(myShares, locale)}</span>
                  <button
                    type="button"
                    className="swap-panel__max"
                    disabled={myShares <= 0}
                    onClick={() => setRedeemAmount(amountToInputString(myShares))}
                  >
                    {copy.max}
                  </button>
                </span>
              </div>
              <div className="swap-panel__field-row">
                <Input
                  className="numeric-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={redeemAmount}
                  maxLength={AMOUNT_MAX_CHARS}
                  onChange={(event) => setRedeemAmount(sanitizeAmount(event.target.value))}
                  aria-label={`${copy.amount} (${shareSymbol})`}
                  aria-invalid={redeemOver || undefined}
                  aria-describedby={redeemOver ? 'vault-redeem-balance-error' : undefined}
                />
                <div className="swap-panel__token">
                  <strong>{shareSymbol}</strong>
                </div>
              </div>
              {redeemOver ? (
                <FieldError id="vault-redeem-balance-error">
                  {getCopy(locale).common.insufficientBalance}
                </FieldError>
              ) : null}
            </div>
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.exchangeRate}</dt>
                <dd data-numeric>
                  1 {shareSymbol} ≈ {fmtTokenAmount(assetsPerShare, locale)} {symbol}
                </dd>
              </div>
              <div>
                <dt>{copy.youReceiveAfter24h}</dt>
                <dd data-numeric>
                  {redeemOut != null ? `${fmtTokenAmount(redeemOut, locale)} ${symbol}` : `0.00 ${symbol}`}
                </dd>
              </div>
            </dl>
            {!connected ? connectCtaAlt : wrongChain ? switchCtaAlt : (
              <Button variant="outline" className="swap-panel__cta" disabled>
                {copy.redeemCta.replace('{share}', shareSymbol)}
              </Button>
            )}
            <section>
              <h4 className="panel-subtitle">{copy.pendingRedeems}</h4>              <ul className="vault-card__list">
                {waitingRedeems.length === 0 ? (
                  <li className="panel-note">--</li>
                ) : (
                  waitingRedeems.map((entry) => (
                    <li key={entry.requestedAt}>
                      <div className="vault-card__list-main">
                        <strong data-numeric>
                          {formatAmount(entry.lockedAssets, locale)} {symbol}
                        </strong>
                        <span>{copy.redeemedOn.replace('{date}', formatDay(entry.requestedAt, locale))}</span>
                      </div>
                      <RedeemCountdown remainingMs={entry.remainingMs} template={copy.remaining} />
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : (
          <>
            <section>
              <h4 className="panel-subtitle">{copy.readyToWithdraw}</h4>
              <ul className="vault-card__list">
                {readyRedeems.length === 0 ? (
                  <li className="panel-note">--</li>
                ) : (
                  readyRedeems.map((entry) => (
                    <li key={entry.requestedAt}>
                      <div className="vault-card__list-main">
                        <strong data-numeric>
                          {formatAmount(entry.lockedAssets, locale)} {symbol}
                        </strong>
                        <span>{copy.readySince.replace('{date}', formatDay(entry.maturesAt, locale))}</span>
                      </div>
                      <span data-state="ready">
                        ✓ {copy.ready}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.totalAvailable}</dt>
                <dd data-numeric>
                  {formatAmount(claimableTotal, locale)} {symbol}
                </dd>
              </div>
            </dl>
            {!connected ? connectCtaAlt : wrongChain ? switchCtaAlt : (
              <Button variant="outline" className="swap-panel__cta" disabled>
                {copy.withdrawAll.replace('{symbol}', symbol)}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
