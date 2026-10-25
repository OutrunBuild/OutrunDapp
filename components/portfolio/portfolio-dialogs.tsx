'use client'

/**
 * Portfolio action dialog family: bridge send / PSM convert / CDP redeem / USR deposit-withdraw.
 * The shell and field primitives (ActionDialogShell/AmountField/DetailRows/
 * DialogCta) live in components/global/action-dialogs.tsx, shared with the verse tx dialog
 * family (CSS language unchanged); CTAs follow the same semantics as VaultActions: disconnected =
 * a clickable Connect Wallet toggles connection, connected = the action button is
 * disabled, no faked on-chain success.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { usePsmSwap } from '../global/use-psm-swap'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  readAllowances,
  readErc20Meta,
  type ContractReader,
} from '../global/execution-reads'
import { getClientChainConfig } from '@/lib/web3/chains'
import { stakingPositionAbi, uAssetOftAbi, usrVaultAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  oftSendCall,
  stakingRedeemCall,
  usrDepositCall,
  usrRedeemCall,
} from '@/lib/web3/session-actions'
import { createPublicClient, custom, formatUnits, padHex, parseUnits, type Hex } from 'viem'
import { ChainLogoMark } from '../global/chain-icons'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

// ---------------------------------------------------------------------------
// Bridge send (a pure transfer in two phases: send → arrival; send ≠ done, the done color
// belongs only to the arrival terminal state)
// ---------------------------------------------------------------------------

export function BridgeDialog({
  locale,
  triggerLabel,
  assetSymbol,
  chains,
  balancesByChain,
}: {
  locale: Locale
  triggerLabel: string
  assetSymbol: string
  /** Selectable chains (mainnet family) */
  chains: Array<{ chainId: number; name: string }>;
  /** This asset's per-chain balances (source for the From-side Max; chains without balance are
   *  selectable but Max is unavailable) */
  balancesByChain: Array<{ chainId: number; name: string; amount: number }>;
}) {
  const copy = getCopy(locale).portfolio.assets
  const [fromChain, setFromChain] = useState(balancesByChain[0]?.chainId ?? chains[0]?.chainId ?? 1)
  const [toChain, setToChain] = useState(
    chains.find((chain) => chain.chainId !== (balancesByChain[0]?.chainId ?? 1))?.chainId ??
      chains[1]?.chainId ??
      1,
  )
  const [amount, setAmount] = useState('')
  const fromBalance = balancesByChain.find((row) => row.chainId === fromChain)?.amount ?? 0
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))
  // OFT send executes on the wallet chain; the from-chain selector must match it (AC-2-adjacent).
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId != null &&
    center.address != null &&
    center.chainId === fromChain

  async function startBridgeReview(): Promise<void> {
    if (!executionReady || !valid || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    const uAsset = contracts[`UAsset.${assetSymbol}`] as Hex | undefined
    const hook = contracts.MemeverseUniswapHook as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    const dst = getClientChainConfig(toChain)
    if (!uAsset || dst.status !== 'ok') {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      })
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      }
      const { decimals } = await readErc20Meta(reader, uAsset)
      const amountLD = parseUnits(amount, decimals)
      const toBytes32 = padHex(eoa, { size: 32 })
      const sendParam = {
        dstEid: dst.config.layerZeroEid,
        to: toBytes32,
        amountLD,
        minAmountLD: amountLD,
        extraOptions: '0x' as Hex,
        composeMsg: '0x' as Hex,
        oftCmd: '0x' as Hex,
      }
      // OFT approvalRequired() is false (token() = address(this)): no approval leg.
      const [nativeFee] = (await reader.read({
        address: uAsset,
        abi: uAssetOftAbi,
        functionName: 'quoteSend',
        args: [sendParam, false],
      })) as unknown as [bigint, bigint]
      const action = oftSendCall(uAsset, sendParam, nativeFee, eoa, nativeFee)
      const { calls, calldata: batch } = buildSessionWrite({ hook, action })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: uAsset,
          functionName: 'send',
          inputs: `${formatUnits(amountLD, decimals)} ${assetSymbol}`,
          minOutput: `${formatUnits(amountLD, decimals)} ${assetSymbol}`,
          fee: `${formatUnits(nativeFee, 18)} ${resolved.config.viemChain.nativeCurrency.symbol}`,
          gasPayer: eoa,
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        value: nativeFee,
        quoteId: `bridge:${fromChain}:${toChain}:${amountLD}`,
        minOutput: amountLD.toString(),
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: true,
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
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={copy.bridgeTitle} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group" aria-label={copy.bridgeFrom}>
          {chains.map((chain) => (
            <button
              key={chain.chainId}
              type="button"
              data-selected={fromChain === chain.chainId || undefined}
              onClick={() => {
                setFromChain(chain.chainId)
                if (toChain === chain.chainId) {
                  const next = chains.find((item) => item.chainId !== chain.chainId)
                  if (next) setToChain(next.chainId)
                }
              }}
            >
              {`${copy.bridgeFrom} · ${chain.name}`}
            </button>
          ))}
        </div>
        <div className="pf-dialog__chips" role="group" aria-label={copy.bridgeTo}>
          {chains
            .filter((chain) => chain.chainId !== fromChain)
            .map((chain) => (
              <button
                key={chain.chainId}
                type="button"
                data-selected={toChain === chain.chainId || undefined}
                onClick={() => setToChain(chain.chainId)}
              >
                {`${copy.bridgeTo} · ${chain.name}`}
              </button>
            ))}
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={fromBalance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={assetSymbol}
          ariaLabel={`${copy.amount} (${assetSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.bridgeEstimate,
              valid ? (
                <span data-numeric>
                  {formatAmount(parsed, locale)} {assetSymbol}
                </span>
              ) : (
                '--'
              ),
            ],
            [copy.bridgeFee, '--'],
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() => void startBridgeReview()}
          label={copy.bridgeSend}
          disabled={!valid || !executionReady || resolving || tx.running}
        />
        {resolveFailed ? (
          <p role="alert">{getCopy(locale).common.degrade.errorBody}</p>
        ) : null}
        
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// PSM convert (mechanism is a 1:1 swap; the title omits "1:1".
// Arrival is post-fee; the headroom row appears only on the Mint card)
// ---------------------------------------------------------------------------

export function ConvertDialog({
  locale,
  triggerLabel,
  uAssetSymbol,
  reserveSymbol,
  feeIn,
  feeOut,
  headroom,
  uAssetBalance,
  reserveBalance,
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  reserveSymbol: string
  /** Mint fee (ratio); null = no pair sample → the headroom/fee rows fall back to slots */
  feeIn: number | null
  feeOut: number
  headroom: number | null
  uAssetBalance: number | null
  reserveBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.assets
  const psm = usePsmSwap(locale, uAssetSymbol)
  const { connected, toggle } = psm
  const { tx, executionReady, resolving } = psm
  const [mode, setMode] = useState<'mint' | 'redeem'>('mint')
  const [amount, setAmount] = useState('')
  // Each mode pays a different token, so a carried-over amount would be read against the
  // other side's balance and fee; switching direction clears the field.
  const switchMode = (next: 'mint' | 'redeem') => {
    if (next === mode) return
    setMode(next)
    setAmount('')
  }
  useClearOnConfirmed(tx.display, () => setAmount(''))
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'mint' ? feeIn : feeOut
  const balance = mode === 'mint' ? reserveBalance : uAssetBalance
  const balanceSymbol = mode === 'mint' ? reserveSymbol : uAssetSymbol
  const mintBlocked = mode === 'mint' && headroom != null && headroom <= 0
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.convertTitle} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'mint' || undefined} onClick={() => switchMode('mint')}>
            {copy.convertIn.replace('{u}', uAssetSymbol)}
          </button>
          <button type="button" data-selected={mode === 'redeem' || undefined} onClick={() => switchMode('redeem')}>
            {copy.convertOut.replace('{r}', reserveSymbol)}
          </button>
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={balance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={balanceSymbol}
          ariaLabel={`${copy.amount} (${balanceSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.convertRate,
              <span key="rate" data-numeric>
                1 {uAssetSymbol} = 1 {reserveSymbol}
              </span>,
            ],
            [
              copy.convertFee,
              fee == null ? (
                '--'
              ) : (
                <span key="fee" data-numeric>
                  {formatPercent(fee * 100, locale)}%
                </span>
              ),
            ],
            // Mint cap headroom constrains only the Mint direction (PSM mint cap); not shown on the
            // Redeem card
            ...(mode === 'mint'
              ? ([
                  [
                    copy.convertHeadroom,
                    headroom == null ? (
                      '--'
                    ) : (
                      <span key="headroom" data-numeric>
                        {formatAmount(headroom, locale)} {uAssetSymbol}
                      </span>
                    ),
                  ],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() =>
            void psm.start(mode === 'mint' ? 'mint' : 'redeem', amount, {
              paySymbol: balanceSymbol,
              outSymbol: mode === 'mint' ? uAssetSymbol : reserveSymbol,
              feeText: fee != null ? `${formatPercent(fee * 100, locale)}%` : '—',
            })
          }
          label={copy.convertSubmit}
          disabled={!valid || mintBlocked || overBalance || !executionReady || resolving || tx.running}
        />
        {psm.resolveFailed ? (
          <p role="alert">{getCopy(locale).common.degrade.errorBody}</p>
        ) : null}
        
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// CDP redeem (the only debt-reducing path; returns the borrowed uAsset, collateral
// goes back to the wallet)
// ---------------------------------------------------------------------------

export function CdpRedeemDialog({
  locale,
  triggerLabel,
  uAssetSymbol,
  collateralSymbol,
  collateralAmount,
  debt,
  uAssetBalance,
  positionId,
  spAddress,
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  collateralSymbol: string
  collateralAmount: number
  debt: number
  uAssetBalance: number | null
  /** Onchain position id (uint256): unresolved until user-position plumbing lands — none onchain. */
  positionId?: number
  /** Staking-position contract for this row: same plumbing gate as positionId. */
  spAddress?: Hex
}) {
  const copy = getCopy(locale).portfolio.positions
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= debt
  // Position identity is still unplumbed (no onchain enumeration; needs graph user-positions
  // → adapter → zone). The dialog builds and executes the moment both props arrive.
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId != null &&
    center.address != null &&
    positionId != null &&
    spAddress != null

  async function startCdpRedeemReview(): Promise<void> {
    if (!executionReady || !valid || resolving || positionId == null || spAddress == null) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    const hook = contracts.MemeverseUniswapHook as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    const uAsset = contracts[`UAsset.${uAssetSymbol}`] as Hex | undefined
    if (!uAsset) {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      })
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      }
      const position = (await reader.read({
        address: spAddress,
        abi: stakingPositionAbi,
        functionName: 'positions',
        args: [BigInt(positionId)],
      })) as unknown as {
        syStaked: bigint
        principalDebt: bigint
        accruedInterest: bigint
      }
      const totalDebt = position.principalDebt + position.accruedInterest
      if (totalDebt <= 0n) throw new Error('outrun: empty position')
      const { decimals } = await readErc20Meta(reader, uAsset)
      const full = parseUnits(String(debt), decimals) <= totalDebt
      // Partial legs pro-rate ceil per the state machine (§3); full takes the whole standing.
      const syRedeemed = full
        ? position.syStaked
        : (parseUnits(String(parsed), decimals) * position.syStaked + totalDebt - 1n) / totalDebt
      // tokenOut = SY direct (no oracle, no slippage leg); minTokenOut = exact passes §4.
      const sy = (await reader.read({
        address: spAddress,
        abi: stakingPositionAbi,
        functionName: 'SY',
      })) as Hex
      const [principalPortion, interestPortion] = (await reader.read({
        address: spAddress,
        abi: stakingPositionAbi,
        functionName: 'previewRedeem',
        args: [BigInt(positionId), syRedeemed, sy],
      })) as unknown as [bigint, bigint]
      const pullAmount = principalPortion + interestPortion
      const [allowance] = await readAllowances(reader, eoa, [{ token: uAsset, spender: spAddress }])
      const approval =
        allowance < pullAmount
          ? approvalCall(uAsset, spAddress, pullAmount)
          : undefined
      const action = stakingRedeemCall(spAddress, {
        positionId: BigInt(positionId),
        syRedeemed,
        receiver: eoa,
        tokenOut: sy,
        minTokenOut: syRedeemed,
      })
      const { calls, calldata: batch } = buildSessionWrite({ hook, action, approval })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: spAddress,
          functionName: 'redeem',
          inputs: `${formatUnits(pullAmount, decimals)} ${uAssetSymbol}`,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(pullAmount, decimals)} ${uAssetSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `cdp-redeem:${positionId}:${syRedeemed}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
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
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.cdpRedeem} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={uAssetBalance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={uAssetSymbol}
          ariaLabel={`${copy.amount} (${uAssetSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.cdpBorrowed,
              <span key="debt" data-numeric>
                {formatAmount(debt, locale)} {uAssetSymbol}
              </span>,
            ],
            [
              copy.cdpCollateral,
              <span key="collateral" data-numeric>
                {formatAmount(collateralAmount, locale)} {collateralSymbol}
              </span>,
            ],
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() => void startCdpRedeemReview()}
          label={copy.cdpRedeem}
          disabled={!valid || !executionReady || resolving || tx.running}
        />
        {resolveFailed ? (
          <p role="alert">{getCopy(locale).common.degrade.errorBody}</p>
        ) : null}
        
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// USR deposit/withdraw (share-index conversion: deposit uAsset to get shares; withdraw shares to
// get uAsset)
// ---------------------------------------------------------------------------

export function UsrSavingsDialog({
  locale,
  triggerLabel,
  mode,
  vault,
  uAssetBalance,
}: {
  locale: Locale
  triggerLabel: string
  mode: 'deposit' | 'withdraw'
  vault: {
    shareSymbol: string
    uAssetSymbol: string
    rate: number
    rateActive: boolean
    myShares: number
    myAssets: number
  }
  uAssetBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.savings
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const index = vault.myShares > 0 ? vault.myAssets / vault.myShares : 1
  const vaultKey = `OutrunUSRVault.${vault.uAssetSymbol}`
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId != null &&
    center.address != null

  async function startUsrReview(): Promise<void> {
    if (!executionReady || !valid || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    const vaultAddr = contracts[vaultKey] as Hex | undefined
    const uAssetAddr = contracts[`UAsset.${vault.uAssetSymbol}`] as Hex | undefined
    const hook = contracts.MemeverseUniswapHook as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    if (!vaultAddr || !uAssetAddr) {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      })
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      }
      const [uAssetDecimals, shareDecimals] = await Promise.all([
        readErc20Meta(reader, uAssetAddr).then((meta) => meta.decimals),
        reader
          .read({ address: vaultAddr, abi: usrVaultAbi, functionName: 'decimals' })
          .then((value) => Number(value)),
      ])
      const amountBase =
        mode === 'deposit' ? parseUnits(amount, uAssetDecimals) : parseUnits(amount, shareDecimals)
      const allowance =
        mode === 'deposit'
          ? ((await readAllowances(reader, eoa, [{ token: uAssetAddr, spender: vaultAddr }]))[0] ??
            0n)
          : 0n
      const approval =
        mode === 'deposit' && allowance < amountBase
          ? approvalCall(uAssetAddr, vaultAddr, amountBase)
          : undefined
      const action =
        mode === 'deposit'
          ? usrDepositCall(vaultAddr, amountBase, eoa)
          : usrRedeemCall(vaultAddr, amountBase, eoa, eoa)
      const { calls, calldata: batch } = buildSessionWrite({ hook, action, approval })
      const tokenSymbol = mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: vaultAddr,
          functionName: mode === 'deposit' ? 'deposit' : 'redeem',
          inputs: `${formatUnits(amountBase, mode === 'deposit' ? uAssetDecimals : shareDecimals)} ${tokenSymbol}`,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange:
            mode === 'deposit'
              ? approval
                  ? `${formatUnits(amountBase, uAssetDecimals)} ${vault.uAssetSymbol}`
                  : '—'
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `usr:${vault.uAssetSymbol}:${mode}:${amountBase}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
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
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={`${copy.badge} · ${vault.uAssetSymbol}`}
        closeLabel={getCopy(locale).common.close}
      >
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={mode === 'deposit' ? uAssetBalance : vault.myShares}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol}
          ariaLabel={`${copy.amount} (${mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.apy,
              <span key="rate" data-numeric data-state={vault.rateActive ? 'active' : 'inactive'}>
                {formatPercent(vault.rate * 100, locale)}%
              </span>,
            ],
            [
              copy.myDeposit,
              <span key="deposit" data-numeric>
                {formatAmount(vault.myAssets, locale)} {vault.uAssetSymbol}
              </span>,
            ],
          ]}
        />
        {valid ? (
          <p className="panel-note" data-numeric>
            {mode === 'deposit'
              ? `≈ ${formatAmount(parsed / index, locale)} ${vault.shareSymbol}`
              : `≈ ${formatAmount(parsed * index, locale)} ${vault.uAssetSymbol}`}
          </p>
        ) : null}
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() => void startUsrReview()}
          label={mode === 'deposit' ? copy.depositCta : copy.withdrawCta}
          disabled={!valid || !executionReady || resolving || tx.running}
        />
        {resolveFailed ? (
          <p role="alert">{getCopy(locale).common.degrade.errorBody}</p>
        ) : null}
        
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Asset bottom action panel (mobile asset rows carry no inline buttons): triggered by a full-row
// hit layer, chain distribution detail + CTA row (children = the Convert/Bridge dialog triggers).
// Tapping a CTA does NOT collapse the panel — the nested dialog opens via its own base-ui Portal
// stacked above the panel. Only the ≤54rem hit layer is visible;
// desktop inline buttons work as before (the trigger cannot serve double duty, two independent
// instances open/close independently).
// ---------------------------------------------------------------------------

export function AssetActionsSheet({
  locale,
  title,
  triggerLabel,
  chains,
  children,
}: {
  locale: Locale
  title: string
  /** Hit layer accessible name (symbol + the asset-actions label, joined by a middle dot) */
  triggerLabel: string
  chains: Array<{ chainId: number; name: string; amount: number }>
  /** CTA row (Convert/Bridge dialog triggers) */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        nativeButton={false}
        render={<div className="pf-asset-row__hit" />}
        aria-label={triggerLabel}
      />
      <SheetContent className="pf-asset-sheet">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <SheetTitle className="pol-mint__title">{title}</SheetTitle>
            <div className="pol-mint__controls">
              <SheetClose
                render={<button type="button" className="pol-mint__close" aria-label={getCopy(locale).common.close} />}
              >
                <X aria-hidden="true" size={16} />
              </SheetClose>
            </div>
          </header>
          <ul className="pf-asset-sheet__chains">
            {chains.map((chain) => (
              <li key={chain.chainId}>
                <span className="pf-asset-sheet__chain">
                  <ChainLogoMark chainId={chain.chainId} size={16} aria-hidden="true" />
                  <span>{chain.name}</span>
                </span>
                <span data-numeric>{formatAmount(chain.amount, locale, true)}</span>
              </li>
            ))}
          </ul>
          {/* CTA row = nested dialog triggers: the task dialog's Portal mounts stacked above the
              panel (iOS stack style); the panel keeps carrying the context — the panel must not
              collapse on click, the dialog tree unmounts with the panel content */}
          <div className="pf-asset-sheet__cta">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
