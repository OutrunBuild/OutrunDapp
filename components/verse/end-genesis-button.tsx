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

import { ActionDialogShell } from '../global/action-dialogs'
import { getCopy } from '../global/copy'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { useAccountCenter } from '../global/use-account-center'
import { probeVerseChain } from '../global/write-session'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
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
  /** ISO timestamp; the non-Fast gate is wall clock against it */
  endsAt: string
}) {
  const copy = getCopy(locale)
  const common = copy.common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const activeProvider = useActiveEip1193Provider()
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  // Deadline tick: the button unlocks the second the wall clock passes endsAt — a
  // display-only tick, no network read (faucet countdown semantics). Only runs while the
  // button is still gated (a Fast verse already met thresholds needs no countdown).
  const [now, setNow] = useState(() => Date.now())
  const endsAtMs = useMemo(() => Date.parse(endsAt), [endsAt])
  const deadlinePending = Number.isFinite(endsAtMs) && now < endsAtMs
  // Triggerable = Fast with either threshold met (early), or the deadline passed — after the
  // deadline anyone triggers regardless of the thresholds (met→Locked, missed→Refund,
  // lifecycle.md:51-55); non-Fast waits for the deadline even when met early.
  const canTrigger = !deadlinePending || (fastGenesis && thresholdMet)
  useEffect(() => {
    if (canTrigger) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [canTrigger])

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
            disabled={!canTrigger || resolving || tx.running}
            onClick={() => void startAdvance()}
          >
            {copy.verse.advance}
          </Button>
        )
      ) : (
        <Button
          variant="outline"
          disabled={center.source !== 'real'}
          onClick={center.source === 'real' ? toggle : undefined}
        >
          {copy.verse.advance}
        </Button>
      )}
      {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      {/* Advance progress: the three-step strip is the only feedback (embedded signing is
          silent); it also carries the cancelled/reverted outcome. */}
      <Dialog
        open={tx.active}
        onOpenChange={(open) => {
          if (!open) tx.reset()
        }}
      >
        <ActionDialogShell title={copy.verse.advance} closeLabel={common.close}>
          <div className="fc-claim-status">
            <TxStatus locale={locale} state={tx.display} />
            {tx.display === 'confirmed' ||
            tx.display === 'cancelled' ||
            tx.display === 'reverted' ? (
              <Button className="ax-ghost-cta" size="lg" onClick={() => tx.reset()}>
                {common.close}
              </Button>
            ) : null}
          </div>
        </ActionDialogShell>
      </Dialog>
    </>
  )
}
