'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  estimateSession,
  readErc20Meta,
  readErc20State,
  resolveVerseSession,
} from '../global/execution-reads'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  redeemMemecoinLiquidityCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { parseVerseIdParam } from '../global/routes'
import { SwitchChainCta, useVerseExecChain } from '../global/switch-chain-cta'
import { formatUnits, parseUnits, type Hex } from 'viem'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { formatAmount } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

/**
 * Redeem POL action dialog (the POL asset card's Redeem button).
 * Mechanism: burning POL returns main-pool (memecoin/uAsset)
 * LP tokens 1:1 by main-pool construction
 * (amountInLP=amountInPOL). The unwrap=false direct LP transfer path is not price
 * sensitive → the contract has no slippage/deadline parameters → no settings gear
 * (the unwrap=true split into memecoin+uAsset 6-parameter slippage entry does not belong in
 * this dialog). Gate is unlocked only (locked/unsettled states revert with NotUnlockedStage).
 * The You receive row stays: 1:1 identity, but the input POL and the output LP token are
 * different identities (unlike the Split/Merge dialog, which drops the
 * output area — this is not a restatement of the input); LP display symbol=main-pool pair
 * scope {MEME}/{uAsset} LP (repository main pool pair; consistent with the two pool dialogs'
 * lpSymbol convention — on-chain the ERC20 of every pool statically shares symbol "MLP"/name
 * "Memeverse LP", so pools can only be told apart by the pair scope);
 * opens with empty input; CTA discipline as before:
 * disconnected=Connect Wallet clickable; connected=action button disabled (no faked execution).
 */
export function PolRedeemLpDialog({
  locale,
  verse,
  pol,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(verse.governanceChain)
  const tx = useTxCenter()
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance)
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const balanceErrorId = useId()

  const polSymbol = `POL-${verse.symbol}`
  // Main-pool LP pair scope (repository main pool pair [verse.symbol, verse.raiseAsset])
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const overBalance = parsed > pol.myPol
  // 1:1 identity by main-pool construction (amountInLP=amountInPOL), no sample/slot branch
  const lpOut = valid ? parsed : null
  // POL burn by the launcher proxy spends the holder's allowance (MemePol.burn third-party
  // path), so the approval leg rides along when allowance is short.
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startRedeemReview(): Promise<void> {
    if (!executionReady || !valid || overBalance || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      const session = await resolveVerseSession({
        request: provider.request,
        chainId,
        eoa,
        verseId: BigInt(verseId),
      })
      const launcher = session.contracts.MemeverseLauncher as Hex
      const { decimals } = await readErc20Meta(session.reader, session.verse.pol)
      const amountBase = parseUnits(amount, decimals)
      const { allowance } = await readErc20State(session.reader, session.verse.pol, eoa, launcher)
      const approval =
        allowance < amountBase
          ? approvalCall(session.verse.pol, launcher, amountBase)
          : undefined
      const action = redeemMemecoinLiquidityCall(launcher, { verseId: BigInt(verseId), amountInPOL: amountBase })
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval })
      const { estimatedGas, nativeBalance } = await estimateSession(
        { client: session.client, reader: session.reader, eoa },
        batch,
      )
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName: 'redeemMemecoinLiquidity',
          inputs: `${formatUnits(amountBase, decimals)} ${polSymbol}`,
          minOutput: `${formatUnits(amountBase, decimals)} ${lpSymbol}`,
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(amountBase, decimals)} ${polSymbol}`
              : '—',
          estimatedGas,
          nativeBalance,
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `redeem-lp:${verseId}:${amountBase}`,
        minOutput: amountBase.toString(),
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: session.manifestVersion,
        crossChain: false,
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins on [data-slot='button'] */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.redeemPol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.redeemPolDialogTitle}</DialogTitle>
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

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>POL</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => clean(amountToInputString(pol.myPol))}>
                  {copy.max}
                </button>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => clean(event.target.value)}
                aria-label={`${copy.redeemPol} ${polSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? balanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{polSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          <dl className="swap-panel__details">
            <div>
              <dt>{copy.youReceive}</dt>
              <dd data-numeric>
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'} {lpSymbol}
              </dd>
            </div>
          </dl>

          {connected ? (
            wrongChain ? (
              <SwitchChainCta
                locale={locale}
                execChain={execChain}
                chainName={verse.governanceChainName}
                onSwitch={switchChain}
                className="swap-panel__cta"
              />
            ) : (
              <Button
                className="swap-panel__cta"
                disabled={!valid || overBalance || !executionReady || resolving || tx.running}
                onClick={() => void startRedeemReview()}
              >
                {copy.redeemPol}
              </Button>
            )
          ) : (
            <Button className="swap-panel__cta" onClick={toggle}>
              {copy.swapCta}
            </Button>
          )}
          {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
          
          {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
