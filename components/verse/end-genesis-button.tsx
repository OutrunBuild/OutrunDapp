'use client'

/**
 * Genesis-stage stage-advance CTA (CurrentAction 卡): anyone may call the launcher's
 * changeStage(verseId) once triggerable — Fast Genesis the moment either threshold is met,
 * and any verse (Fast or not, thresholds met or not) once the deadline has passed
 * (lifecycle.md:51-55; met→Locked, missed→Refund, so the
 * trigger always ends Genesis). §29 direct write (faucet precedent): no allowance, no
 * amount, no review panel — the click's only round trip is the eth_chainId gate, then the
 * wallet popup. Confirming carries writeScope, so the central refresh (subgraph-freshness
 * gated invalidation + router.refresh) flips the whole page out of the genesis workbench.
 * Signed-out on onchain builds opens the login selector instead (faucet gate); the harness
 * build keeps the inert disabled look so recorded baselines stay meaningful.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Hex } from 'viem'

import type { Locale } from '@/lib/data/fixture-repository'
import {
  executionChainId,
  getClientChainConfig,
  verseExecutionChains,
  verseSwitchChainId,
} from '@/lib/web3/chains'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'
import { changeStageCall } from '@/lib/web3/session-actions'

import { getCopy } from '../global/copy'
import { formatCountdown } from '../global/signal-ui'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { useAccountCenter } from '../global/use-account-center'
import { probeVerseChain } from '../global/write-session'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'

export function EndGenesisButton({
  locale,
  verseIdParam,
  governanceChain,
  governanceChainName,
  deployedChainIds,
  fastGenesis,
  thresholdMet,
  endsAt,
  initialNow,
}: {
  locale: Locale
  /** Numeric on-chain verse id (URL segment, already normalized by the page) */
  verseIdParam: string
  governanceChain: number
  governanceChainName: string
  deployedChainIds: number[] | null
  fastGenesis: boolean
  /** Either threshold independently ≥ the minimum success amount (server-computed) */
  thresholdMet: boolean
  /** ISO timestamp; the non-Fast gate is wall clock against it. null = unrepresentable
   *  source timestamp (dirty row): no countdown, the on-chain gate still decides */
  endsAt: string | null
  /** Server render clock (RSC-supplied): the first client render reuses it verbatim, so the
   *  countdown text hydrated from the server HTML never disagrees with it. The tick adopts
   *  the client's own clock right after mount. */
  initialNow: number
}) {
  const copy = getCopy(locale)
  const common = copy.common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  const activeProvider = useActiveEip1193Provider()
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  // Deadline tick: the button unlocks the second the wall clock passes endsAt — a
  // display-only tick, no network read (faucet countdown semantics). Only runs while the
  // button is still gated (a Fast verse already met thresholds needs no countdown).
  const [now, setNow] = useState(initialNow)
  const endsAtMs = useMemo(() => (endsAt != null ? Date.parse(endsAt) : Number.NaN), [endsAt])
  const deadlinePending = Number.isFinite(endsAtMs) && now < endsAtMs
  // Triggerable = Fast with either threshold met (early), or the deadline passed — after the
  // deadline anyone triggers regardless of the thresholds (met→Locked, missed→Refund,
  // lifecycle.md:51-55); non-Fast waits for the deadline even when met early.
  const canTrigger = !deadlinePending || (fastGenesis && thresholdMet)
  useEffect(() => {
    // Adopt the browser's clock once mounted, before the gate is read again: the server value
    // may be seconds old, and a client clock running behind it must be able to flip the button
    // back to gated (the tick below only starts while gated, so it cannot correct this itself).
    setNow(Date.now())
    if (canTrigger) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [canTrigger])
  // Countdown label runs only while the button is actually GATED — a Fast verse that met
  // a threshold is triggerable before the deadline and shows the action text, not a
  // countdown. The date just left the stats card, so the gated button is the only place
  // the deadline still surfaces. Urgency follows the shared <72h warning / <24h danger
  // bands; tone is data (the date is near), never glow.
  const remainingMs = canTrigger ? null : endsAtMs - now
  const deadlineTone =
    remainingMs == null ? null : remainingMs < 24 * 3_600_000 ? 'danger' : remainingMs < 72 * 3_600_000 ? 'warning' : null
  // Whenever the button is triggerable the outcome is determined (met→Locked, missed→
  // Refund), so the plain label — and the dialog title — name the stage being entered;
  // while gated the outcome is still open, so the hover title stays generic.
  const actionLabel = !canTrigger
    ? copy.verse.advanceGatedTitle
    : thresholdMet
      ? copy.verse.advanceToLocked
      : copy.verse.advanceToRefund

  // Participation gate: every landed chain runs genesis locally (per-chain settlement), so
  // the executable set is the landed set; a wallet outside it gets the switch CTA.
  const execChains = useMemo(
    () => verseExecutionChains(governanceChain, deployedChainIds),
    [governanceChain, deployedChainIds],
  )
  const chainInVerse = center.chainId != null && execChains.includes(center.chainId)
  const wrongChain = center.source === 'real' && connected && (center.chainId == null || !chainInVerse)
  const switchChainId = verseSwitchChainId(governanceChain, deployedChainIds)
  const switchChainName =
    switchChainId === executionChainId(governanceChain)
      ? governanceChainName
      : (() => {
          const config = getClientChainConfig(switchChainId)
          return config.status === 'ok' ? config.config.viemChain.name : String(switchChainId)
        })()

  async function startAdvance(): Promise<void> {
    if (center.source !== 'real' || !connected || resolving) {
      setResolveFailed(true)
      return
    }
    const provider = activeProvider ?? getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    if (!provider || eoa == null) {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      // The click path's only round trip: the live chain gate doubles as execution-chain
      // selection (whichever landed chain the wallet sits on is where the advance runs).
      const chainId = await probeVerseChain(provider, execChains)
      const resolved = getClientChainConfig(chainId)
      if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') {
        setResolveFailed(true)
        return
      }
      const launcher = resolved.config.contracts.addresses.MemeverseLauncher as Hex | undefined
      if (launcher == null) {
        setResolveFailed(true)
        return
      }
      const { target, callData } = changeStageCall(launcher, BigInt(verseIdParam))
      // The review object is a state-machine anchor only (never rendered — §29).
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName: 'changeStage',
          inputs: `verse ${verseIdParam}`,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        expectedChainId: chainId,
        batchCallData: callData,
        direct: { to: target, data: callData },
        quoteId: `changeStage:${chainId}:${verseIdParam}:${Date.now()}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId: verseIdParam },
      }
      await tx.executeDirect(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      {center.source === 'real' && connected ? (
        wrongChain ? (
          <SwitchChainCta
            locale={locale}
            execChain={switchChainId}
            chainName={switchChainName}
            onSwitch={center.switchChainAction}
            variant="outline"
          />
        ) : (
          <Button
            variant="outline"
            className="advance-countdown"
            data-tone={deadlineTone ?? undefined}
            disabled={!canTrigger || resolving || tx.running}
            onClick={() => void startAdvance()}
            title={actionLabel}
          >
            {remainingMs != null ? (
              <span data-numeric>
                {copy.verse.advanceCountdown.replace('{t}', formatCountdown(remainingMs, locale))}
              </span>
            ) : (
              actionLabel
            )}
          </Button>
        )
      ) : (
        <Button
          variant="outline"
          className="advance-countdown"
          data-tone={deadlineTone ?? undefined}
          disabled={center.source !== 'real'}
          onClick={center.source === 'real' ? toggle : undefined}
          title={actionLabel}
        >
          {remainingMs != null ? (
            <span data-numeric>
              {copy.verse.advanceCountdown.replace('{t}', formatCountdown(remainingMs, locale))}
            </span>
          ) : (
            actionLabel
          )}
        </Button>
      )}
      {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      {/* Feedback pair (2026-10-26 弹窗序列纪律): progress = its own button-less dialog
          (always second-to-last); confirmed yields to the generic receipt dialog, the last
          one. A stage advance has no receipt legs — the receipt carries the ✓ and hash. */}
      <TxProgressDialog
        locale={locale}
        title={actionLabel}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.verse.advanceDoneTitle}
        lead={copy.verse.advanceDoneLead}
        accent={copy.verse.advanceDoneAccent}
        rows={[]}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </>
  )
}
