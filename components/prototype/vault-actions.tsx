'use client'

import { useEffect, useState } from 'react'
import { Info, Zap } from 'lucide-react'

import type { Locale, PrototypeStaking } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import { formatAmount, formatDay } from './signal-ui'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type VaultMode = 'stake' | 'redeem' | 'withdraw'

/** 原型链环境映射（模拟粘合层，非领域数值）：fixture 治理链=主网 id（1/8453/56），
 * header 链选择器仅暴露测试网（GS-2 用户裁定）——「连接在治理链」的判定
 * 用治理链的测试网对应链（chains.json 同名族：Ethereum/Base/BNB 各自 Sepolia 系） */
const GOVERNANCE_TESTNET: Record<number, number> = { 1: 11155111, 8453: 84532, 56: 97 }

/** EVM 地址口径（治理链族 = Ethereum/Base/BNB）：0x + 40 位十六进制；大小写均收，不校验 EIP-55 */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * 赎回等待倒计时（2026-09-26 用户裁定：走秒）：从 repository 给的快照剩余 remainingMs
 * 起按墙钟每秒递减（纯展示层 tick，非链上写），到 0 停表；template=copy.remaining（{t} 占位）。
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
 * Yield Vault 操作卡（demo.outrun.build/memeverse 布局，2026-09-24 用户裁定重设计）：
 * Tabs → Amount 卡 → Details 卡 → 全宽 CTA → 脚注；字段/明细/CTA 复用 .swap-panel__* 原语。
 * 链感知（omnichain.md §governance chain——vault 全部操作走治理链）：
 * - 连接网络 = header GS-2 链选择器唯一入口（2026-09-24 用户裁定：卡内芯片删除），经 mock 钱包 chainId 驱动；
 * - Stake 且连接链≠治理链 → 跨链模式（LayerZero 横幅 + 跨链费行 + Cross-chain Stake CTA）；
 * - Redeem/Withdraw 且≠治理链 → CTA 先切链（mock switchChain，非链上写）。
 * 状态列表进标签（2026-09-26 用户裁定，参照 demo 两图）：Redeem 标签尾=Pending Redemptions
 * （仅等待中条目：金额 + Redeemed on {日期} + 走秒倒计时）；Withdraw 标签头=Ready to Withdraw
 * （仅已成熟条目：金额 + Ready since {成熟日} + ✓ Ready），空态 '--'。
 * 原型只演示 ViewModel：写操作 CTA 一律禁用，不伪造链上成功。
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
  delegatee,
  governanceChain,
  governanceChainName,
}: {
  locale: Locale
  symbol: string
  /** 份额符号 = s + Memecoin 符号 */
  shareSymbol: string
  assetsPerShare: number
  claimableTotal: number
  /** 样本账户份额（Redeem 的 Balance/Max 来源） */
  myShares: number
  /** 样本账户本 verse memecoin 余额（pol-positions myMemecoin；Stake 的 Balance/Max 来源，null=槽位态） */
  myMemecoin: number | null
  /** 两步异步赎回条目（含 ready 分流与 remainingMs 走秒起点；展示层按标签过滤） */
  pendingRedeems: PrototypeStaking['pendingRedeems']
  delegatee: string
  /** 治理链 chainId（vault 所在链，omnichain.md §The governance chain） */
  governanceChain: number
  governanceChainName: string
}) {
  const copy = getCopy(locale).verseDesk
  const { connected, chainId, toggle, switchChain } = useMockWallet()
  const [mode, setMode] = useState<VaultMode>('stake')
  const [amount, setAmount] = useState('')
  const [delegateSelf, setDelegateSelf] = useState(true)
  const [delegateAddress, setDelegateAddress] = useState('')

  const governanceWalletChain = GOVERNANCE_TESTNET[governanceChain] ?? governanceChain
  const wrongChain = connected && chainId !== governanceWalletChain
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const stakeOut = valid ? parsed / assetsPerShare : null
  const redeemOut = valid ? parsed * assetsPerShare : null
  const delegateInvalid =
    !delegateSelf && delegateAddress !== '' && !EVM_ADDRESS_RE.test(delegateAddress)
  const waitingRedeems = pendingRedeems.filter((entry) => !entry.ready)
  const readyRedeems = pendingRedeems.filter((entry) => entry.ready)

  const switchCta = (
    <Button className="swap-panel__cta" onClick={() => switchChain(governanceWalletChain)}>
      {copy.switchChainCta.replace('{chain}', governanceChainName)}
    </Button>
  )
  const connectCta = (
    <Button className="swap-panel__cta" onClick={toggle}>
      {getCopy(locale).common.connect}
    </Button>
  )

  return (
    <div className="vault-card">
      <div className="vault-card__bar">
        <ToggleGroup
          className="vault-actions__bar"
          value={[mode]}
          onValueChange={(value) => {
            if (value[0]) setMode(value[0] as VaultMode)
          }}
        >
          <ToggleGroupItem value="stake">{copy.stakeTab}</ToggleGroupItem>
          <ToggleGroupItem value="redeem">{copy.redeemTab}</ToggleGroupItem>
          <ToggleGroupItem value="withdraw">{copy.withdrawTab}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === 'stake' && wrongChain ? (
        <div className="vault-card__banner" role="note">
          <p className="vault-card__banner-head">
            <Zap aria-hidden="true" size={14} />
            <strong>{copy.crossBannerTitle}</strong>
            <span>{copy.crossBannerSub}</span>
          </p>
          <p>{copy.crossBannerBody.replace('{symbol}', symbol).replace('{chain}', governanceChainName)}</p>
        </div>
      ) : null}

      {mode === 'stake' ? (
        <>
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
                  onClick={() => setAmount(String(myMemecoin ?? 0))}
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
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.amount} (${symbol})`}
              />
              <div className="swap-panel__token">
                <strong>{symbol}</strong>
              </div>
            </div>
          </div>
          <dl className="swap-panel__details">
            <div>
              <dt>{copy.exchangeRate}</dt>
              <dd data-numeric>
                1 {symbol} ≈ {(1 / assetsPerShare).toFixed(4)} {shareSymbol}
              </dd>
            </div>
            <div>
              <dt>{copy.youReceive}</dt>
              <dd data-numeric>
                {stakeOut != null ? `${stakeOut.toFixed(6)} ${shareSymbol}` : `0.00 ${shareSymbol}`}
              </dd>
            </div>
            {wrongChain ? (
              <div>
                <dt className="swap-settings__label">
                  {copy.crossFee}
                  <Tooltip>
                    <TooltipTrigger render={<span className="create-info" aria-label={copy.crossFeeNote} />}>
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
                  <TooltipTrigger render={<span className="create-info" aria-label={copy.delegateNote} />}>
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
            <Button className="swap-panel__cta" disabled title={copy.onChainSlot}>
              {copy.stakeCrossCta.replace('{symbol}', symbol)}
            </Button>
          ) : (
            <Button className="swap-panel__cta" disabled title={copy.onChainSlot}>
              {copy.stakeCta.replace('{symbol}', symbol)}
            </Button>
          )}
          {wrongChain ? <p className="panel-note">{copy.crossNote}</p> : null}
        </>
      ) : null}

      {mode === 'redeem' ? (
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
                  onClick={() => setAmount(String(myShares))}
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
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.amount} (${shareSymbol})`}
              />
              <div className="swap-panel__token">
                <strong>{shareSymbol}</strong>
              </div>
            </div>
          </div>
          <dl className="swap-panel__details">
            <div>
              <dt>{copy.exchangeRate}</dt>
              <dd data-numeric>
                1 {shareSymbol} ≈ {assetsPerShare.toFixed(4)} {symbol}
              </dd>
            </div>
            <div>
              <dt>{copy.youReceiveAfter24h}</dt>
              <dd data-numeric>
                {redeemOut != null ? `${redeemOut.toFixed(6)} ${symbol}` : `0.00 ${symbol}`}
              </dd>
            </div>
          </dl>
          {!connected ? connectCta : wrongChain ? switchCta : (
            <Button className="swap-panel__cta" disabled title={copy.onChainSlot}>
              {copy.redeemCta.replace('{share}', shareSymbol)}
            </Button>
          )}
          <p className="panel-note">{copy.redeemNote}</p>
          <section>
            <h4 className="panel-subtitle">{copy.pendingRedeems}</h4>
            <ul className="vault-card__list">
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
      ) : null}

      {mode === 'withdraw' ? (
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
                {claimableTotal.toFixed(2)} {symbol}
              </dd>
            </div>
          </dl>
          {!connected ? connectCta : wrongChain ? switchCta : (
            <Button className="swap-panel__cta" disabled title={copy.onChainSlot}>
              {copy.withdrawAll.replace('{symbol}', symbol)}
            </Button>
          )}
        </>
      ) : null}
    </div>
  )
}
