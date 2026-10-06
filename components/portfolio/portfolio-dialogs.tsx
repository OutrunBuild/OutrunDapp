'use client'

/**
 * Portfolio 操作弹窗族（2026-10-02 四分区裁定）：跨链发送 / PSM 转换 / CDP 赎回 /
 * USR 存取 / 收益库执行 / 滞留恢复。壳与字段原语全部复用 verse 页既有语言
 * （.pol-mint 卡壳 + .swap-panel__* 字段族）；CTA 走 VaultActions 同款原型口径：
 * 未连接=Connect Wallet 可点切换模拟连接，已连接=动作钮禁用、不伪造链上成功。
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { ChainLogoMark } from '../global/chain-icons'
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
import { Sheet, SheetClose, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

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
  balanceLabel,
  maxLabel,
  value,
  onValue,
  tokenSymbol,
  ariaLabel,
}: {
  locale: Locale
  label: string
  balance: number | null
  balanceLabel: string
  maxLabel: string
  value: string
  onValue: (next: string) => void
  tokenSymbol: string
  ariaLabel: string
}) {
  const errorId = useId()
  // 余额不足：balance 已知且输入>余额（2026-10-04 用户裁定文案一行短句、不带数值）
  const parsed = Number(value)
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance
  return (
    <div className="swap-panel__field">
      <div className="swap-panel__field-head">
        <span>{label}</span>
        <span className="swap-panel__balance">
          {/* 代币符号已在输入框右侧展示，余额行不重复（2026-10-04 用户裁定） */}
          {`${balanceLabel}: ${balance == null ? '--' : formatAmount(balance, locale)}`}
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
          aria-invalid={overBalance || undefined}
          aria-describedby={overBalance ? errorId : undefined}
          onChange={(event) => onValue(sanitizeAmount(event.target.value))}
        />
        <div className="swap-panel__token">
          <strong>{tokenSymbol}</strong>
        </div>
      </div>
      {overBalance ? (
        <FieldError id={errorId}>{getCopy(locale).common.insufficientBalance}</FieldError>
      ) : null}
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
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
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
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.bridgeSend} />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// PSM 转换（机制仍 1:1 兑换；标题去 1:1——2026-10-04 用户裁定。费后到账、额度余量仅 Mint 卡）
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
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
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
            // 铸造上限余量只约束 Mint 方向（PSM 铸造 cap），Redeem 卡不显示（2026-10-04 用户裁定）
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
        {connected ? (
          <Button className="swap-panel__cta" disabled={!valid || mintBlocked || overBalance}>
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
  appearance = 'button',
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  collateralSymbol: string
  collateralAmount: number
  debt: number
  uAssetBalance: number | null
  /** 表格行内用 link（pf-table__link 语法），卡片布局用 button（默认） */
  appearance?: 'button' | 'link'
}) {
  const copy = getCopy(locale).portfolio.positions
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= debt

  return (
    <Dialog>
      <DialogTrigger
        data-slot="button"
        render={
          appearance === 'link' ? (
            <button type="button" className="pf-table__link" />
          ) : (
            <Button variant="outline" />
          )
        }
      >
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
  const copy = getCopy(locale).portfolio.savings
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const index = vault.myShares > 0 ? vault.myAssets / vault.myShares : 1

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
          label={mode === 'deposit' ? copy.depositCta : copy.withdrawCta}
        />
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
  triggerClassName,
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
  /** 静态行动链接触发器（①待办随时可办行）：传类名即按朴素 button 文本链渲染
   *  （绕开 [data-slot='button'] 全局画皮——!important 钮壳会压掉文本链形态） */
  triggerClassName?: string
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()

  return (
    <Dialog>
      <DialogTrigger
        data-slot={triggerClassName ? undefined : 'button'}
        render={
          triggerClassName ? (
            <button type="button" className={triggerClassName} />
          ) : (
            <Button variant="outline" />
          )
        }
      >
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

// ---------------------------------------------------------------------------
// 资产底部操作面板（决议 018 补充：移动端资产行去按钮化）：整行 hit 层触发，
// 链分布明细 + CTA 行（children=Convert/Bridge 弹窗触发器）。点 CTA 同时收起
// 面板——嵌套弹窗随后接管（base-ui Portal 后挂在上层）。仅 ≤54rem hit 层可见，
// 桌面行内按钮照旧（触发器不可双栖，两套实例各自独立开合）。
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
  /** hit 层可访问名（「{symbol} · 资产操作」） */
  triggerLabel: string
  chains: Array<{ chainId: number; name: string; amount: number }>
  /** CTA 行（Convert/Bridge 弹窗触发器） */
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
          {/* CTA 行=嵌套弹窗触发器：任务弹窗 Portal 后挂叠在面板之上（iOS 栈式），
              面板保持承载上下文——不可在点击时收起面板，弹窗树随面板内容卸载 */}
          <div className="pf-asset-sheet__cta">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
