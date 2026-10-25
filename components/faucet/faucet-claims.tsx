'use client'

/**
 * /faucet faucet panel: three testnet-token ledger rows (icon/badge + daily limit + cooldown
 * status + Claim) + a hairline-separated batch claim row (all tokens + one-transaction
 * semantics) + footer UUSD swap entry (brand mark + Swap from USDC + the Get UUSD yellow dialog
 * trigger — the only yellow on the page). Cooldown = the fixture remainingMs snapshot decremented
 * every second by wall clock (same semantics as the vault RedeemCountdown: a display-only tick,
 * not an on-chain write), flips to Ready at 0; mechanism = once per 24h per token.
 * In-row Claim and the connected Batch Claim are real writes on onchain
 * builds: a connected tap goes straight to the wallet popup (`executeDirect`
 * direct EOA call — Faucet.claim / batchClaim; no review panel), and per-row claimability comes from lastClaimed storage-slot reads
 * (pure eth_getStorageAt, no wallet simulation); a claim re-reads only the rows it
 * touched, so untouched countdowns never flash or re-fetch.
 * Signed-out gate: the page keeps its normal anatomy — no
 * Connect/Login entry — and every action button instead opens the login
 * selector on click (onchain builds only; the harness keeps the old
 * inert-disabled look so recorded baselines stay meaningful).
 */
import { useEffect, useRef, useState } from 'react'

import type { Faucet, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { formatAmount } from '../global/signal-ui'
import { txErrorText } from '../global/tx-copy'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'
import { faucetBatchClaimCall, faucetClaimCall } from '@/lib/web3/session-actions'
import { createPublicClient, custom, keccak256, pad, toHex, type Hex } from 'viem'
import { FieldError } from '@/components/ui/field'
import { TokenIconMark, hasTokenIcon } from '../global/token-icons'
import { Button } from '@/components/ui/button'

import { FaucetSwapDialog } from './faucet-swap-dialog'
import { ActionDialogShell } from '../global/action-dialogs'
import { TxStatus } from '../global/tx-status'
import { Dialog } from '@/components/ui/dialog'

/** Cooldown remaining (domain ≤24h): en compact hour/minute form, zh CJK unit words with
 *  spaces (staticDuration's day granularity does not fit the cooldown range) */
function cooldownText(remainingMs: number, locale: Locale) {
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return locale === 'zh' ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`
}

/** Faucet.tokenInfos mapping base slot (forge inspect storage-layout: _owner=0, tokenInfos=1) */
const FAUCET_TOKEN_INFOS_SLOT = 1n
/** claim() cooldown: block.timestamp < lastClaimed + 1 days reverts ClaimTooSoon */
const FAUCET_COOLDOWN_S = 24 * 60 * 60

/** Solidity mapping slot: keccak256(abi.encode(key, slot)) */
function mappingSlot(key: Hex, slot: bigint): Hex {
  const keyPadded = pad(key.toLowerCase() as Hex, { size: 32 })
  const slotPadded = pad(toHex(slot), { size: 32 })
  return keccak256(`0x${keyPadded.slice(2)}${slotPadded.slice(2)}` as Hex)
}

/**
 * tokenInfos[token].lastClaimed[user] storage slot. TokenInfo = { dailyLimit @base+0,
 * lastClaimed mapping @base+1 } where base = keccak256(token . 1).
 */
function faucetLastClaimedSlot(tokenAddr: Hex, user: Hex): Hex {
  const tokenBase = BigInt(mappingSlot(tokenAddr, FAUCET_TOKEN_INFOS_SLOT))
  return mappingSlot(user, tokenBase + 1n)
}

export function FaucetClaims({ locale, faucet }: { locale: Locale; faucet: Faucet }) {
  const copy = getCopy(locale).faucet
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  // Per-token cooldown end (epoch ms) from lastClaimed storage reads: undefined =
  // unprobed, null = never claimed (ready now), number = ready at that time. Absolute
  // deadlines let a post-claim refresh re-read only the touched rows without rebasing
  // every other row's countdown.
  const [readyAt, setReadyAt] = useState<Record<string, number | null>>({})
  // Rows whose post-claim re-read is still in flight: keep them non-clickable without
  // blanking their last value.
  const [refreshing, setRefreshing] = useState<ReadonlySet<string>>(() => new Set())
  // Installed by the probe effect below: re-reads the given symbols through the provider
  // captured for the current account/chain.
  const probeRef = useRef<((symbols: readonly string[]) => Promise<void>) | null>(null)

  // Fixture symbols → test-token deployment keys (faucet rows carry fixtureOnly addresses).
  const tokenKey = (symbol: string): string | null => {
    if (symbol === 'USDC') return 'MockUSDC'
    if (symbol === 'sUSDS') return 'MockSUSDS'
    if (symbol === 'aUSDC') return 'MockAUSDC'
    return null
  }

  // Read lastClaimed for every mapped token once connected (pure eth_getStorageAt reads:
  // no wallet simulation, so a claimed row returns data instead of a -32603 RPC error).
  // Account/chain/provider changes reset every row and re-read all of them; a completed
  // claim instead calls probeRef with just the claimed symbols, so untouched rows keep
  // their countdown and never flash. Subscribed to the provider revision: a late
  // connector.getProvider() registration re-reads instead of leaving rows unprobed.
  const activeProvider = useActiveEip1193Provider()
  useEffect(() => {
    if (center.source !== 'real' || !connected || center.chainId == null || center.address == null) {
      setReadyAt({})
      probeRef.current = null
      return
    }
    const provider = activeProvider ?? getActiveEip1193Provider()
    if (!provider) {
      setReadyAt({})
      probeRef.current = null
      return
    }
    const chainId = center.chainId
    const eoa = center.address as Hex
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') {
      setReadyAt({})
      probeRef.current = null
      return
    }
    const contracts = resolved.config.contracts.addresses
    const faucetAddr = contracts.Faucet as Hex | undefined
    if (!faucetAddr) {
      setReadyAt({})
      probeRef.current = null
      return
    }
    let cancelled = false
    const client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: custom({ request: provider.request }),
    })
    const tokenAddresses = new Map<string, Hex | undefined>(
      faucet.tokens.map((token) => {
        const key = tokenKey(token.symbol)
        return [token.symbol, key != null ? (contracts[key] as Hex | undefined) : undefined]
      }),
    )
    const withTimeout = async <T,>(run: Promise<T>): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return (await Promise.race([
          run,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 8000)
          }),
        ])) as T | null
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    }
    const read = async (symbols: readonly string[]): Promise<void> => {
      if (cancelled || symbols.length === 0) return
      // lastClaimed is a block timestamp (seconds), so the deadline is directly
      // comparable to Date.now(): no extra latest-block round trip per probe.
      const probed = await Promise.all(
        symbols.map(async (symbol) => {
          const tokenAddr = tokenAddresses.get(symbol)
          if (!tokenAddr) return null
          try {
            const raw = await withTimeout(
              client.getStorageAt({
                address: faucetAddr,
                slot: faucetLastClaimedSlot(tokenAddr, eoa),
              }),
            )
            if (raw == null) return null
            const lastClaimedSec = Number(BigInt(raw))
            const ready =
              lastClaimedSec === 0 ? null : (lastClaimedSec + FAUCET_COOLDOWN_S) * 1000
            return { symbol, ready }
          } catch {
            // Unreadable row keeps its previous value (never blanked into "unprobed").
            return null
          }
        }),
      )
      const updated = probed.filter(
        (entry): entry is { symbol: string; ready: number | null } => entry !== null,
      )
      if (cancelled || updated.length === 0) return
      setReadyAt((prev) => {
        const next = { ...prev }
        for (const { symbol, ready } of updated) next[symbol] = ready
        return next
      })
    }
    probeRef.current = read
    // Full reset + full read: no stale clickable row survives an account/chain/provider change.
    setReadyAt({})
    void read(faucet.tokens.map((token) => token.symbol))
    return () => {
      cancelled = true
      probeRef.current = null
    }
  }, [center.source, connected, center.chainId, center.address, faucet.tokens, activeProvider])
  const hasCooldown = faucet.tokens.some(
    (token) => token.cooldownRemainingMs != null && token.cooldownRemainingMs > 0,
  )
  const hasOnchainCooldown = Object.values(readyAt).some((v) => v != null && v > Date.now())

  useEffect(() => {
    if (!hasCooldown && !hasOnchainCooldown) return
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [hasCooldown, hasOnchainCooldown])

  // Splitting swapFrom's {a} placeholder; parts are trimmed because every gap around the
  // inline USDC unit comes from .fc-claims__from's flex gap — the copy's own typographic
  // spaces render at different widths across platforms and sat unevenly next to the icon
  const [swapFromBefore, swapFromAfter] = copy.swapFrom.split('{a}').map((part) => part.trim())

  // Row claimability derived from the absolute deadline: the one-second tick re-renders and
  // flips a row to Ready at 0 without another network read.
  const canClaim = (symbol: string): boolean => {
    const ready = readyAt[symbol]
    return ready === null || (ready != null && ready <= Date.now())
  }

  async function startClaim(symbols: string[]): Promise<void> {
    if (center.source !== 'real' || !connected || center.chainId == null || resolving) {
      setResolveFailed(true)
      return;
    }
    const provider = activeProvider ?? getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) {
      setResolveFailed(true)
      return;
    }
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') {
      setResolveFailed(true)
      return;
    }
    const contracts = resolved.config.contracts.addresses
    const faucetAddr = contracts.Faucet as Hex | undefined
    const tokens = symbols
      .map((symbol) => {
        const key = tokenKey(symbol)
        const addr = key != null ? (contracts[key] as Hex | undefined) : undefined
        return addr != null ? { symbol, addr } : null
      })
      .filter((entry): entry is { symbol: string; addr: Hex } => entry !== null)
    if (!faucetAddr || tokens.length === 0) {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      // No review panel (§29): faucet claims fire straight at the wallet popup.
      // The review object below is a state-machine anchor only (never rendered).
      const { target, callData } =
        tokens.length === 1
          ? faucetClaimCall(faucetAddr, tokens[0]!.addr)
          : faucetBatchClaimCall(faucetAddr, tokens.map(({ addr }) => addr))
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: faucetAddr,
          functionName: tokens.length === 1 ? 'claim' : 'batchClaim',
          inputs: tokens.map((entry) => entry.symbol).join(', '),
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
        quoteId: `faucet:${symbols.join(',')}:${Date.now()}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
      }
      await tx.executeDirect(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
      // Re-read ONLY the rows this attempt touched: untouched rows keep their countdown,
      // and the touched rows stay locked while their read is in flight (no double-tap).
      setRefreshing((prev) => {
        const next = new Set(prev)
        for (const symbol of symbols) next.add(symbol)
        return next
      })
      const releaseRefresh = () =>
        setRefreshing((prev) => {
          const next = new Set(prev)
          for (const symbol of symbols) next.delete(symbol)
          return next
        })
      const probe = probeRef.current
      if (probe) void probe(symbols).catch(() => undefined).finally(releaseRefresh)
      else releaseRefresh()
    }
  }

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
          // Onchain build: absolute deadline minus wall clock (the interval above re-renders
          // every second while any window is open). undefined = unprobed → render nothing.
          const ready = token.cooldownRemainingMs == null ? readyAt[token.symbol] : undefined
          const liveMs = ready != null ? Math.max(0, ready - Date.now()) : undefined
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
                    ? ready === undefined
                      ? null
                      : liveMs != null && liveMs > 0
                        ? (
                            <span className="fc-claims__cooling" data-numeric>
                              {copy.readyIn.replace('{t}', cooldownText(liveMs, locale))}
                            </span>
                          )
                        : <span className="fc-claims__ready">{copy.ready}</span>
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
                {connected && center.source === 'real' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !canClaim(token.symbol) ||
                      resolving ||
                      tx.running ||
                      refreshing.has(token.symbol)
                    }
                    onClick={() => void startClaim([token.symbol])}
                  >
                    {copy.claim}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={center.source !== 'real'}
                    onClick={center.source === 'real' ? toggle : undefined}
                  >
                    {copy.claim}
                  </Button>
                )}
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
          {connected && center.source === 'real' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={
                !faucet.tokens.some((token) => canClaim(token.symbol)) ||
                resolving ||
                tx.running
              }
              onClick={() =>
                void startClaim(
                  faucet.tokens.filter((token) => canClaim(token.symbol)).map((token) => token.symbol),
                )
              }
            >
              {copy.batchClaim}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={center.source !== 'real'}
              onClick={center.source === 'real' ? toggle : undefined}
            >
              {copy.batchClaim}
            </Button>
          )}
        </div>
      </div>
      {tx.context.errorKind ? (
        <div className="fc-claims__status">
          <p role="alert">
            <strong>{txErrorText(locale, tx.context.errorKind)}</strong>
          </p>
        </div>
      ) : null}
      {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      {/* Claim progress: embedded signing is silent, so the three-step strip is the only
          feedback; it also carries the cancelled/reverted outcome. */}
      <Dialog
        open={tx.active}
        onOpenChange={(open) => {
          if (!open) tx.reset()
        }}
      >
        <ActionDialogShell title={copy.claim} closeLabel={common.close}>
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
      <footer className="fc-claims__foot">
        {/* UUSD swap entry (footer primary action): identity + the Get UUSD yellow dialog trigger,
            details live in the dialog. swapFrom's {a} placeholder = an inline "USDC icon + symbol"
            node. The literal spaces keep words off the icon when only the stylesheet is stale
            (flex collapses them: end-of-item/start-of-item white space is dropped, so the live
            spacing stays the 4px --space-1 gap on both sides of the icon) */}
        <span className="fc-claims__uusd">
          <TokenIconMark symbol={faucet.swap.uAssetSymbol} size={18} aria-hidden="true" />
          <strong>{faucet.swap.uAssetSymbol}</strong>
          <span className="fc-claims__from">
            {swapFromBefore}
            {' '}
            <span className="fc-claims__asset">
              <TokenIconMark symbol={faucet.swap.reserveSymbol} size={18} aria-hidden="true" />
              {faucet.swap.reserveSymbol}
            </span>
            {swapFromAfter ? ` ${swapFromAfter}` : ''}
          </span>
        </span>
        <FaucetSwapDialog locale={locale} swap={faucet.swap} />
      </footer>
    </section>
  )
}
