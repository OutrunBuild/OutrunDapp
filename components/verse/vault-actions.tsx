'use client'

import { useEffect, useRef, useState } from 'react'
import { Info, Zap } from 'lucide-react'

import type { Locale, Staking } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog, type TxSuccessRow } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import { useVerseBalances } from './trade-balances'
import {
  readAllowances,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  vaultDepositCall,
  vaultRequestRedeemCall,
  vaultWithdrawCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { parseVerseIdParam } from '../global/routes'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { formatUnits, type Hex } from 'viem'
import { estimateBaseUnitsFloor, toBaseUnits } from '@/lib/web3/base-units'
import { formatAmount, formatDay, formatMarketCap } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount, trimFractionZeros } from '../global/amount-input'
import { fmtTokenAmount, fmtTokenAmountExact } from '../global/amount-format'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type RedeemMode = 'redeem' | 'pending' | 'withdraw'

/** Chain-environment mapping (testnet stand-in shim, not domain values): the fixture
 * governance chain=mainnet ids (1/8453/56),
 * the header chain selector only exposes testnets — the "connected on the governance chain"
 * check uses the governance chain's corresponding testnet
 * (same-name mainnet/testnet family: Ethereum/Base/BNB each with their Sepolia series) */
const GOVERNANCE_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }

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
 * permanent Stake + a right column toggling Redeem/Pending/Withdraw
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
 * (no in-card chip), driven by the account-center chainId;
 * - Stake with connected chain≠governance chain → cross-chain mode (LayerZero banner +
 * cross-chain fee row + Cross-chain Stake CTA);
 * - Redeem/Withdraw with ≠governance chain → the CTA switches chain first (switchChainAction,
 * not an on-chain write).
 * Status lists live inside the card's tabs: Pending (waiting entries only: amount +
 * Redeemed on {date} + seconds countdown, capped at a compact scroll window) sits between
 * Redeem and Withdraw; the Withdraw tab's head=Ready to Withdraw (matured entries only:
 * amount + Ready since {maturity date} + ✓ Ready), empty state '--'.
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
  /** Matured withdrawable total; null=accountless (wallet probe overrides when connected) */
  claimableTotal: number | null
  /** Account shares (source of Redeem's Balance/Max); null=accountless (probe overrides) */
  myShares: number | null
  /** Sample account's this-verse memecoin balance (source of Stake's Balance/Max, null=slot state) */
  myMemecoin: number | null
  /** Two-step async redemption entries (including the ready split and the remainingMs countdown start; the display layer filters by tab); null=accountless */
  pendingRedeems: Staking['pendingRedeems']
  delegatee: string | null
  /** Governance chain chainId (the chain hosting the vault) */
  governanceChain: number
  governanceChainName: string
  /** ?action=withdraw deep-link initial value: landing from the portfolio table's Withdraw shows the Ready to Withdraw list directly; redeem is the default state, no prop preset needed */
  initialRedeemMode?: 'withdraw'
}) {
  const copy = getCopy(locale).verseDesk
  const center = useAccountCenter()
  const { connected, chainId, connectAction: toggle, switchChainAction: switchChain } = center
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Receipt legs snapshotted at the click (the amount fields clear on landing).
  const [vaultRows, setVaultRows] = useState<TxSuccessRow[]>([])
  /** Which vault write the receipt belongs to: stake has its own done-title, redeem/withdraw keep the generic one. */
  const [doneKind, setDoneKind] = useState<'stake' | 'redeem' | 'withdraw'>('stake')
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [redeemMode, setRedeemMode] = useState<RedeemMode>(initialRedeemMode ?? 'redeem')
  /** Two cards on screen: left/right column amounts are independent (sharing would bleed values between the two cards) */
  const [stakeAmount, setStakeAmount] = useState('')
  const [redeemAmount, setRedeemAmount] = useState('')
  const [delegateSelf, setDelegateSelf] = useState(true)
  const [delegateAddress, setDelegateAddress] = useState('')
  useClearOnConfirmed(tx.display, () => {
    setStakeAmount('')
    setRedeemAmount('')
  })

  // Wallet-provider account probe (onchain builds): fills the vault's account half — shares,
  // redeem queue, delegate, stake-side memecoin balance. Re-reads when a vault write confirms
  // here. Fixture builds keep the SSR samples (probe returns null).
  const [settleTick, setSettleTick] = useState(0)
  const prevDisplayRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettleTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  const live = useVerseBalances({ verseId, governanceChain, refreshKey: settleTick })
  const mySharesLive = live?.vault?.shares ?? myShares
  const claimableLive = live?.vault?.claimableTotal ?? claimableTotal
  const pendingLive = live?.vault?.pending ?? pendingRedeems
  const myMemecoinLive = live?.memecoin ?? myMemecoin
  // Exact wallet reads win over the float aliases whenever the probe landed: float64 can
  // represent a real balance only approximately, and a Max prefill re-parsed from a rounded
  // float can exceed the true balance — tripping the insufficient-balance gate on the very
  // value it prefilled.
  const stakeExact = live?.exact.memecoin ?? null
  const redeemExact = live?.exact.vault?.shares ?? null
  const withdrawExact = live?.exact.vault?.claimableTotal ?? null

  const governanceWalletChain = GOVERNANCE_TESTNET[governanceChain] ?? governanceChain
  const wrongChain = connected && chainId !== governanceWalletChain
  // Execution chain uses the current §26 chainset (the display mapping above predates it and
  // stays untouched); custom delegate addresses block execution (no silent drop of intent).
  const MAINNET_TO_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }
  const execChain = MAINNET_TO_TESTNET[governanceChain] ?? governanceChain
  const customDelegate = !delegateSelf || delegateAddress !== ''
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId === execChain &&
    center.address != null &&
    verseId != null

  async function startVaultReview(
    kind: 'stake' | 'redeem' | 'withdraw',
  ): Promise<void> {
    if (!executionReady || resolving) return
    if (kind === 'stake' && (!stakeValid || stakeOver || customDelegate)) return
    if (kind === 'redeem' && (!redeemValid || redeemOver)) return
    if (kind === 'withdraw' && (claimableLive == null || claimableLive <= 0)) return
    setDoneKind(kind)
    setVaultRows(
      kind === 'stake'
        ? [
            {
              label: getCopy(locale).common.txYouStaked,
              value: formatAmount(Number(stakeAmount), locale),
              symbol,
            },
          ]
        : kind === 'redeem'
          ? [
              {
                label: getCopy(locale).common.txYouRedeemed,
                value: formatAmount(Number(redeemAmount), locale),
                symbol: shareSymbol,
              },
            ]
          : [
              {
                label: getCopy(locale).common.txYouWithdrew,
                value: claimableLive != null ? formatAmount(claimableLive, locale) : '—',
                symbol,
              },
            ],
    )
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      // 静态半命中页面预热缓存（0 往返），点击链路只剩一轮并行 allowance 读
      // One executable chain: a provider answering another chain is refused (VerseChainError),
      // never silently read — these dialogs' figures are loaded for this chain only.
      const session = await getVerseSession({
        provider,
        chains: [chainId],
        eoa,
        verseId: BigInt(verseId),
      })
      const vault = session.verse.yieldVault
      const reader = session.reader
      const [memeDecimals, shareDecimals] = await Promise.all([
        getTokenDecimals(reader, chainId, session.verse.memecoin),
        getTokenDecimals(reader, chainId, vault),
      ])
      let action
      let functionName: string
      let inputs: string
      let approval
      if (kind === 'stake') {
        // Parse the raw input string — never the float re-stringified (String(Number()));
        // toBaseUnits truncates, matching the gate (viem parseUnits rounds over-precision
        // input, which could send 1 wei past the gated amount)
        const assets = toBaseUnits(stakeAmount, memeDecimals)
        const [allowance] = await readAllowances(reader, eoa, [
          { token: session.verse.memecoin, spender: vault },
        ])
        approval =
          allowance < assets
            ? approvalCall(session.verse.memecoin, vault, assets)
            : undefined
        action = vaultDepositCall(vault, assets, eoa)
        functionName = 'deposit'
        inputs = `${formatUnits(assets, memeDecimals)} ${symbol}`
      } else if (kind === 'redeem') {
        const shares = toBaseUnits(redeemAmount, shareDecimals)
        action = vaultRequestRedeemCall(vault, { shares, controller: eoa, owner: eoa })
        functionName = 'requestRedeem'
        inputs = `${formatUnits(shares, shareDecimals)} ${shareSymbol}`
        approval = undefined
      } else {
        // The exact claimable base wins when the probe landed; the float alias is the
        // fixture-fallback only, floored — a withdraw amount above the real claimable
        // would revert on-chain
        const assets =
          withdrawExact != null
            ? withdrawExact.base
            : estimateBaseUnitsFloor(claimableLive ?? 0, memeDecimals)
        action = vaultWithdrawCall(vault, { assets, receiver: eoa, owner: eoa })
        functionName = 'withdraw'
        inputs = `${formatUnits(assets, memeDecimals)} ${symbol}`
        approval = undefined
      }
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: vault,
          functionName,
          inputs,
          minOutput: kind === 'stake' && stakeOut != null ? `${stakeOut} ${shareSymbol}` : '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange:
            approval != null
              ? `${inputs}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `vault:${verseId}:${kind}:${inputs}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: session.manifestVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId },
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }
  const stakeParsed = Number(stakeAmount)
  const stakeValid = Number.isFinite(stakeParsed) && stakeParsed > 0
  const stakeOut = stakeValid ? stakeParsed / assetsPerShare : null
  const redeemParsed = Number(redeemAmount)
  const redeemValid = Number.isFinite(redeemParsed) && redeemParsed > 0
  const redeemOut = redeemValid ? redeemParsed * assetsPerShare : null
  const stakeOver =
    stakeExact != null
      ? stakeValid && toBaseUnits(stakeAmount, stakeExact.decimals) > stakeExact.base
      : myMemecoinLive != null && stakeParsed > myMemecoinLive
  const redeemOver =
    redeemExact != null
      ? redeemValid && toBaseUnits(redeemAmount, redeemExact.decimals) > redeemExact.base
      : mySharesLive != null && redeemParsed > mySharesLive
  const delegateInvalid =
    !delegateSelf && delegateAddress !== '' && !EVM_ADDRESS_RE.test(delegateAddress)
  const waitingRedeems = (pendingLive ?? []).filter((entry) => !entry.ready)
  const readyRedeems = (pendingLive ?? []).filter((entry) => entry.ready)
  /** Queue rows stay exact below one million; from there the panel's KPI compact convention
   * (M/B, two decimals) keeps a long column from forcing the row wider than the card */
  const formatPendingAmount = (value: number) =>
    value >= 1_000_000 ? formatMarketCap(value) : formatAmount(value, locale)

  const connectCta = (
    <Button className="swap-panel__cta" onClick={toggle}>
      {getCopy(locale).common.connect}
    </Button>
  )
  /* Outline channel for the right column's same CTAs (the yellow channel is reserved for the
     left column's Stake — one primary CTA per screen) */
  const switchCtaAlt = (
    <SwitchChainCta
      locale={locale}
      execChain={governanceWalletChain}
      chainName={governanceChainName}
      onSwitch={switchChain}
      variant="outline"
      className="swap-panel__cta"
    />
  )
  const connectCtaAlt = (
    <Button variant="outline" className="swap-panel__cta" onClick={toggle}>
      {getCopy(locale).common.connect}
    </Button>
  )
  const done = {
    stake: { title: copy.stakeDoneTitle, lead: copy.stakeDoneLead, accent: copy.stakeDoneAccent },
    redeem: {
      title: copy.redeemDoneTitle,
      lead: copy.redeemDoneLead,
      accent: copy.redeemDoneAccent,
    },
    withdraw: {
      title: copy.withdrawDoneTitle,
      lead: copy.withdrawDoneLead,
      accent: copy.withdrawDoneAccent,
    },
  }[doneKind]

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
              {stakeExact != null ? (
                <span data-numeric>{fmtTokenAmountExact(stakeExact.base, stakeExact.decimals, locale)}</span>
              ) : myMemecoinLive == null ? (
                '--'
              ) : (
                <span data-numeric>{formatAmount(myMemecoinLive, locale)}</span>
              )}
              <button
                type="button"
                className="swap-panel__max"
                disabled={
                  stakeExact != null
                    ? stakeExact.base === 0n
                    : myMemecoinLive == null || myMemecoinLive <= 0
                }
                onClick={() =>
                  setStakeAmount(
                    stakeExact != null
                      ? trimFractionZeros(formatUnits(stakeExact.base, stakeExact.decimals))
                      : amountToInputString(myMemecoinLive ?? 0),
                  )
                }
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
          <Button
            className="swap-panel__cta"
            disabled={!stakeValid || stakeOver || customDelegate || !executionReady || resolving || tx.running}
            onClick={() => void startVaultReview('stake')}
          >
            {copy.stakeCta.replace('{symbol}', symbol)}
          </Button>
        )}
        {wrongChain ? <p className="panel-note">{copy.crossNote}</p> : null}
        {resolveFailed ? <FieldError>{getCopy(locale).common.degrade.errorBody}</FieldError> : null}
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
            <ToggleGroupItem value="pending">{copy.pendingTab}</ToggleGroupItem>
            <ToggleGroupItem value="withdraw">{copy.withdrawTab}</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {redeemMode === 'redeem' ? (
          <>
            <div className="swap-panel__field">
              <div className="swap-panel__field-head">
                <span>{copy.amount}</span>
                <span className="swap-panel__balance">
                  {copy.balance}:{' '}
                  {redeemExact != null ? (
                    <span data-numeric>{fmtTokenAmountExact(redeemExact.base, redeemExact.decimals, locale)}</span>
                  ) : mySharesLive != null ? (
                    <span data-numeric>{formatAmount(mySharesLive, locale)}</span>
                  ) : (
                    '--'
                  )}
                  <button
                    type="button"
                    className="swap-panel__max"
                    disabled={
                      redeemExact != null
                        ? redeemExact.base === 0n
                        : mySharesLive == null || mySharesLive <= 0
                    }
                    onClick={() =>
                      setRedeemAmount(
                        redeemExact != null
                          ? trimFractionZeros(formatUnits(redeemExact.base, redeemExact.decimals))
                          : amountToInputString(mySharesLive ?? 0),
                      )
                    }
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
              <Button
                variant="outline"
                className="swap-panel__cta"
                disabled={!redeemValid || redeemOver || !executionReady || resolving || tx.running}
                onClick={() => void startVaultReview('redeem')}
              >
                {copy.redeemCta.replace('{share}', shareSymbol)}
              </Button>
            )}
          </>
        ) : redeemMode === 'pending' ? (
          <section>
            <div className="vault-card__status-head">
              <h4 className="panel-subtitle">{copy.pendingRedeems}</h4>
              <span className="vault-card__status-count" data-numeric>
                {waitingRedeems.length}
              </span>
            </div>
            <ul className="vault-card__list vault-card__list--scroll">
              {waitingRedeems.length === 0 ? (
                <li className="panel-note">--</li>
              ) : (
                waitingRedeems.map((entry) => (
                  <li key={entry.requestedAt}>
                    <div className="vault-card__list-main">
                      <strong data-numeric>
                        {formatPendingAmount(entry.lockedAssets)} {symbol}
                      </strong>
                      <span>{formatDay(entry.requestedAt, locale)}</span>
                    </div>
                    <RedeemCountdown remainingMs={entry.remainingMs} template={copy.remaining} />
                  </li>
                ))
              )}
            </ul>
          </section>
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
                          {formatPendingAmount(entry.lockedAssets)} {symbol}
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
                  {claimableLive != null ? `${formatAmount(claimableLive, locale)} ${symbol}` : '--'}
                </dd>
              </div>
            </dl>
            {!connected ? connectCtaAlt : wrongChain ? switchCtaAlt : (
              <Button
                variant="outline"
                className="swap-panel__cta"
                disabled={(claimableLive ?? 0) <= 0 || !executionReady || resolving || tx.running}
                onClick={() => void startVaultReview('withdraw')}
              >
                {copy.withdrawAll.replace('{symbol}', symbol)}
              </Button>
            )}
          </>
        )}
      </div>
      {/* Feedback pair (2026-10-26 弹窗序列纪律): progress = its own button-less dialog
          (second-to-last), confirmed yields to the generic receipt dialog (last). */}
      <TxProgressDialog
        locale={locale}
        title={copy.vaultTitle.replace('{symbol}', symbol)}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={done.title}
        lead={done.lead}
        accent={done.accent}
        rows={vaultRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </div>
  )
}
