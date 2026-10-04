'use client'

/**
 * Portfolio 操作弹窗族（2026-10-02 四分区裁定）：跨链发送 / PSM 1:1 转换 / CDP 赎回 /
 * USR 存取 / 收益库执行 / 滞留恢复。壳与字段原语全部复用 verse 页既有语言
 * （.pol-mint 卡壳 + .swap-panel__* 字段族）；CTA 走 VaultActions 同款原型口径：
 * 未连接=Connect Wallet 可点切换模拟连接，已连接=动作钮禁用、不伪造链上成功。
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** 弹窗壳：标题 + ✕ + 内容（复用 .pol-mint 卡签名） */
function ActionDialogShell({
  title,
  closeLabel,
  children,
}: {
  title: string
  closeLabel: string
  children: React.ReactNode
}) {
  return (
    <DialogContent className="pol-mint-pop">
      <div className="pol-mint ax-glow-card">
        <header className="pol-mint__head">
          <DialogTitle className="pol-mint__title">{title}</DialogTitle>
          <div className="pol-mint__controls">
            <DialogClose render={<button type="button" className="pol-mint__close" aria-label={closeLabel} />}>
              <X aria-hidden="true" size={16} />
            </DialogClose>
          </div>
        </header>
        {children}
      </div>
    </DialogContent>
  )
}

/** 金额字段（.swap-panel__field 族）：标签 + 余额/Max + 输入 + 右侧代币符号 */
function AmountField({
  locale,
  label,
  balance,
  balanceSymbol,
  maxLabel,
  value,
  onValue,
  tokenSymbol,
  ariaLabel,
}: {
  locale: Locale
  label: string
  balance: number | null
  balanceSymbol: string
  maxLabel: string
  value: string
  onValue: (next: string) => void
  tokenSymbol: string
  ariaLabel: string
}) {
  return (
    <div className="swap-panel__field">
      <div className="swap-panel__field-head">
        <span>{label}</span>
        <span className="swap-panel__balance">
          {`${balanceSymbol} ${balance == null ? '--' : formatAmount(balance, locale)}`}
          {balance != null && balance > 0 ? (
            <button
              type="button"
              className="swap-panel__max"
              onClick={() => onValue(amountToInputString(balance))}
            >
              {maxLabel}
            </button>
          ) : null}
        </span>
      </div>
      <div className="swap-panel__field-row">
        <Input
          className="numeric-input"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          maxLength={AMOUNT_MAX_CHARS}
          aria-label={ariaLabel}
          onChange={(event) => onValue(sanitizeAmount(event.target.value))}
        />
        <div className="swap-panel__token">
          <strong>{tokenSymbol}</strong>
        </div>
      </div>
    </div>
  )
}

/** 详情行组（.swap-panel__details） */
function DetailRows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="swap-panel__details">
      {rows.map(([term, data]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{data}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 主 CTA：未连接=Connect（可点）；已连接=动作钮禁用（原型 ViewModel，不伪造链上成交） */
function DialogCta({
  locale,
  connected,
  onConnect,
  label,
}: {
  locale: Locale
  connected: boolean
  onConnect: () => void
  label: string
}) {
  return connected ? (
    <Button className="swap-panel__cta" disabled>
      {label}
    </Button>
  ) : (
    <Button className="swap-panel__cta" onClick={onConnect}>
      {getCopy(locale).common.connect}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// 跨链发送（纯转账两阶段：发送→到账；发送≠完成，完成色只归到账终态）
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
  /** 可选链（主网族） */
  chains: Array<{ chainId: number; name: string }>;
  /** 该资产各链余额（From 侧 Max 来源；无余额链可选但 Max 不可用） */
  balancesByChain: Array<{ chainId: number; name: string; amount: number }>;
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()
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

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
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
          balanceSymbol={copy.balance}
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
        <p className="panel-note">{copy.bridgeDust}</p>
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.bridgeSend} />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// PSM 1:1 转换（2026-10-02 用户裁定命名；无市场价参与、费后到账、额度余量）
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
  /** mint 费率（比率）；null=无配对样本 → 额度/费率行走槽位 */
  feeIn: number | null
  feeOut: number
  headroom: number | null
  uAssetBalance: number | null
  reserveBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()
  const [mode, setMode] = useState<'mint' | 'redeem'>('mint')
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'mint' ? feeIn : feeOut
  const balance = mode === 'mint' ? reserveBalance : uAssetBalance
  const balanceSymbol = mode === 'mint' ? reserveSymbol : uAssetSymbol
  const mintBlocked = mode === 'mint' && headroom != null && headroom <= 0

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.convertTitle} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'mint' || undefined} onClick={() => setMode('mint')}>
            {copy.convertIn.replace('{u}', uAssetSymbol)}
          </button>
          <button type="button" data-selected={mode === 'redeem' || undefined} onClick={() => setMode('redeem')}>
            {copy.convertOut.replace('{r}', reserveSymbol)}
          </button>
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={balance}
          balanceSymbol={`${copy.balance} ${balanceSymbol}`}
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
                  {formatPercent(fee * 100, locale)}
                </span>
              ),
            ],
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
          ]}
        />
        <p className="panel-note">{copy.convertNote.replace('{u}', uAssetSymbol).replace('{r}', reserveSymbol)}</p>
        {connected ? (
          <Button className="swap-panel__cta" disabled={!valid || mintBlocked}>
            {copy.convertSubmit}
          </Button>
        ) : (
          <Button className="swap-panel__cta" onClick={toggle}>
            {getCopy(locale).common.connect}
          </Button>
        )}
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// CDP 赎回（唯一减借——SPEC-S2 L50；返还借入 uAsset、抵押物回钱包）
// ---------------------------------------------------------------------------

export function CdpRedeemDialog({
  locale,
  triggerLabel,
  uAssetSymbol,
  collateralSymbol,
  collateralAmount,
  debt,
  uAssetBalance,
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  collateralSymbol: string
  collateralAmount: number
  debt: number
  uAssetBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.positions
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= debt

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.cdpRedeem} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={uAssetBalance}
          balanceSymbol={copy.balance}
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
        <p className="panel-note">{copy.cdpPlainFull.replace('{u}', uAssetSymbol)}</p>
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.cdpRedeem} />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// USR 存取（份额指数折算：存入 uAsset 得份额；取出份额得 uAsset）
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
  const copy = getCopy(locale).portfolio.positions
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const index = vault.myShares > 0 ? vault.myAssets / vault.myShares : 1

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={`${copy.usrBadge} · ${vault.uAssetSymbol}`}
        closeLabel={getCopy(locale).common.close}
      >
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={mode === 'deposit' ? uAssetBalance : vault.myShares}
          balanceSymbol={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol}
          ariaLabel={`${copy.amount} (${mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.usrRate,
              vault.rateActive ? (
                <span key="rate" data-numeric data-state="active">
                  {formatPercent(vault.rate * 100, locale)}
                </span>
              ) : (
                <span key="rate" data-state="inactive">
                  {copy.usrStateInactive}
                </span>
              ),
            ],
            [
              copy.usrMyDeposit,
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
          label={mode === 'deposit' ? copy.usrDepositCta : copy.usrWithdrawCta}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 收益库待执行赎回（第二步：等待期已过的成熟条目，执行后资金回钱包）
// ---------------------------------------------------------------------------

export function VaultExecuteDialog({
  locale,
  triggerLabel,
  verseSymbol,
  shareSymbol,
  readyTotal,
  waitingCount,
}: {
  locale: Locale
  triggerLabel: string
  verseSymbol: string
  shareSymbol: string
  readyTotal: number
  waitingCount: number
}) {
  const copy = getCopy(locale).portfolio.positions
  const { connected, toggle } = useMockWallet()

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={`${copy.vaultExecute} · ${shareSymbol}`}
        closeLabel={getCopy(locale).common.close}
      >
        <DetailRows
          rows={[
            [
              copy.vaultPending,
              <span key="ready" data-numeric data-state="ready">
                {formatAmount(readyTotal, locale)} {verseSymbol}
              </span>,
            ],
            [
              copy.vaultShares,
              <span key="waiting" data-numeric>
                {copy.vaultWaiting.replace('{n}', String(waitingCount))}
              </span>,
            ],
          ]}
        />
        <p className="panel-note">{getCopy(locale).portfolio.action.vaultReadyBody.replace('{n}', '1')}</p>
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.vaultExecute} />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// 滞留恢复（纯转账=LayerZero 消息重试；资金不丢失）
// ---------------------------------------------------------------------------

export function StrandedDialog({
  locale,
  triggerLabel,
  message,
}: {
  locale: Locale
  triggerLabel: string
  message: {
    assetSymbol: string
    amount: number
    fromChainName: string
    toChainName: string
    sentAt: string
  };
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={copy.recoverTitle} closeLabel={getCopy(locale).common.close}>
        <DetailRows
          rows={[
            [
              copy.amount,
              <span key="amount" data-numeric>
                {formatAmount(message.amount, locale)} {message.assetSymbol}
              </span>,
            ],
            [
              `${copy.bridgeFrom} → ${copy.bridgeTo}`,
              `${message.fromChainName} → ${message.toChainName}`,
            ],
          ]}
        />
        <p className="panel-note">{copy.inTransitSafe}</p>
        <p className="panel-note">{copy.recoverBody}</p>
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.recoverCta} />
      </ActionDialogShell>
    </Dialog>
  )
}
