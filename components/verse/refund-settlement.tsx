'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatUnits, type Hex } from 'viem'

import type { Locale, Participation } from '@/lib/data/fixture-repository'
import { executionChainId } from '@/lib/web3/chains'

import { Button } from '@/components/ui/button'

import { readErc20Meta, readGenesisLedger, readVerseAddresses } from '../global/execution-reads'
import { getCopy } from '../global/copy'
import { parseVerseIdParam } from '../global/routes'
import { formatAmount } from '../global/signal-ui'
import { useAccountCenter } from '../global/use-account-center'
import { useWalletProviderReader } from '../global/wallet-provider-reader'

type RefundLeg = { kind: Participation['kind']; amount: number }

function kindLabel(kind: Participation['kind'], locale: Locale) {
  const copy = getCopy(locale)
  if (kind === 'normal') return copy.verse.standardFunds
  if (kind === 'leverage') return copy.verse.leverageInterest
  return copy.verse.preorderKind
}

/** Refund settlement body (per-kind legs + total + the sample-anchored claim CTA). Same
 *  retired-server-path family as the 「您的参与」 stat: the SSR legs come from the
 *  participations fixture (empty on onchain builds), so a real wallet reads its own ledger
 *  client-side — normal/preorder legs drop out once their one-shot isRefunded flag flips
 *  (the claim keeps the amounts on chain, MemeverseSettlementImpl.sol:61). The interest leg's
 *  claimed state is not exposed by any view (POLend claimFlags is private) — its recorded
 *  amount shows until that lands. */
export function RefundSettlement({
  locale,
  raiseAsset,
  governanceChain,
  sample,
}: {
  locale: Locale
  raiseAsset: string
  governanceChain: number
  /** SSR sample legs (participations fixture; empty on onchain builds) */
  sample: RefundLeg[]
}) {
  const copy = getCopy(locale)
  const center = useAccountCenter()
  const params = useParams()
  const verseId = parseVerseIdParam(params?.verseId)
  const [live, setLive] = useState<RefundLeg[] | null>(null)
  const execChain = executionChainId(governanceChain)
  const real = center.source === 'real'
  const onExecChain = center.chainId === execChain
  const eligible = real && center.connected && center.address != null && onExecChain && verseId != null
  const providerReader = useWalletProviderReader(eligible ? execChain : null)

  useEffect(() => {
    if (!eligible || verseId == null || providerReader == null) return
    const account = center.address as Hex
    const launcher = providerReader.addresses.MemeverseLauncher as Hex | undefined
    const polend = providerReader.addresses.POLend as Hex | undefined
    if (!launcher || !polend) return
    let cancelled = false
    void (async () => {
      try {
        const reader = providerReader.reader
        const { uAsset } = await readVerseAddresses(reader, launcher, BigInt(verseId))
        const [{ decimals }, ledger] = await Promise.all([
          readErc20Meta(reader, uAsset),
          readGenesisLedger(reader, launcher, polend, BigInt(verseId), account),
        ])
        const asAmount = (value: bigint) => Number(formatUnits(value, decimals))
        const legs: RefundLeg[] = []
        if (ledger.normal > 0n && !ledger.normalRefunded) legs.push({ kind: 'normal', amount: asAmount(ledger.normal) })
        if (ledger.interest > 0n) legs.push({ kind: 'leverage', amount: asAmount(ledger.interest) })
        if (ledger.preorder > 0n && !ledger.preorderRefunded) legs.push({ kind: 'preorder', amount: asAmount(ledger.preorder) })
        if (!cancelled) setLive(legs)
      } catch {
        // read failure keeps the '--' body until the next trigger
        if (!cancelled) setLive(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eligible, center.address, providerReader, verseId])

  const legs = !real ? sample : live
  const unknown = real && center.connected && (live == null || !onExecChain)

  if (unknown) {
    return <p className="refund-settle__empty">--</p>
  }
  if (legs == null || legs.length === 0) {
    return <p className="refund-settle__empty">{copy.verse.refundNone}</p>
  }
  return (
    <>
      <dl className="refund-settle__participations">
        {legs.map((leg) => (
          <div key={leg.kind}>
            <dt>{kindLabel(leg.kind, locale)}</dt>
            <dd data-numeric>
              {formatAmount(leg.amount, locale, true)} {raiseAsset}
            </dd>
          </div>
        ))}
        <div className="refund-settle__total">
          <dt>{copy.verse.refundTotal}</dt>
          <dd data-numeric>
            {formatAmount(
              legs.reduce((sum, leg) => sum + leg.amount, 0),
              locale,
              true,
            )}{' '}
            {raiseAsset}
          </dd>
        </div>
      </dl>
      <Button disabled>{copy.verse.claimAllCta}</Button>
    </>
  )
}
