'use client'

/**
 * /faucet 水龙头面板（2026-10-09 五轮：一键领取与 Get UUSD 换位、删 1:1 读数——批量
 * 领取留在数据组尾行，UUSD 兑换移页脚作漏斗出口）。三 mock 币台账行（图标/徽章 + 日限
 * + 冷却状态 + Claim）+ hairline 分隔的一键领推行（全部代币 + 一笔交易语义）+ 页脚
 * UUSD 兑换入口（品牌章 + 由 USDC 兑换 + Get UUSD 黄色弹窗触发器——页内唯一黄）。
 * 冷却=fixture remainingMs 快照按墙钟每秒递减（vault RedeemCountdown 同口径纯展示
 * tick 非链上写），到 0 转 Ready；机制=每币 24h 一次（Faucet.sol:43）。行内 Claim 与
 * 已连接 Batch Claim 恒禁用——原型不伪造链上成交；未连接一键领推行=Connect Wallet
 * 可点切换模拟连接（mock-wallet 全站共享开关）。
 */
import { useEffect, useState } from 'react'

import type { FixtureFaucet, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { TokenIconMark, hasTokenIcon } from '../global/token-icons'
import { Button } from '@/components/ui/button'

import { FaucetSwapDialog } from './faucet-swap-dialog'

/** 冷却剩余（域 ≤24h）：en `21h 25m`、zh `21 小时 25 分`（staticDuration 日粒度不适合冷却档） */
function cooldownText(remainingMs: number, locale: Locale) {
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return locale === 'zh' ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`
}

export function FaucetClaims({ locale, faucet }: { locale: Locale; faucet: FixtureFaucet }) {
  const copy = getCopy(locale).faucet
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [elapsedMs, setElapsedMs] = useState(0)
  const hasCooldown = faucet.tokens.some((token) => token.cooldownRemainingMs > 0)

  useEffect(() => {
    if (!hasCooldown) return
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [hasCooldown])

  // swapFrom 的 {a} 占位拆解（en 'Swap from {a}' 尾空、zh '由 {a} 兑换' 双侧）
  const [swapFromBefore, swapFromAfter] = copy.swapFrom.split('{a}')

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
          const remaining = Math.max(0, token.cooldownRemainingMs - elapsedMs)
          const ready = remaining <= 0
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
                {connected ? (
                  ready ? (
                    <span className="fc-claims__ready">{copy.ready}</span>
                  ) : (
                    <span className="fc-claims__cooling" data-numeric>
                      {copy.readyIn.replace('{t}', cooldownText(remaining, locale))}
                    </span>
                  )
                ) : null}
              </div>
              <div className="pf-claim-row__actions">
                <Button variant="outline" size="sm" disabled>
                  {copy.claim}
                </Button>
              </div>
            </div>
          )
        })}

        {/* 一键领推行（hairline 与领取组分隔）：全部代币 + 一笔交易语义（2026-10-09
            用户裁定与 Get UUSD 换位——批量留在数据组，UUSD 移页脚作漏斗出口） */}
        <div className="fc-claims__batch">
          <div className="pf-claim-row__id">
            <strong>{copy.allTokens}</strong>
            <span>{copy.batchNote}</span>
          </div>
          {connected ? (
            <Button variant="outline" size="sm" disabled>
              {copy.batchClaim}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={toggle}>
              {common.connect}
            </Button>
          )}
        </div>
      </div>
      <footer className="fc-claims__foot">
        {/* UUSD 兑换入口（页脚主行动）：身份 + Get UUSD 黄色弹窗触发器，细节收进弹窗。
            swapFrom 的 {a} 占位=「USDC 图标+符号」内联节点（2026-10-09 用户裁定） */}
        <span className="fc-claims__uusd">
          <TokenIconMark symbol={faucet.swap.uAssetSymbol} size={18} aria-hidden="true" />
          <strong>{faucet.swap.uAssetSymbol}</strong>
          <span className="fc-claims__from">
            {swapFromBefore}
            <span className="fc-claims__asset">
              <TokenIconMark symbol={faucet.swap.reserveSymbol} size={18} aria-hidden="true" />
              {faucet.swap.reserveSymbol}
            </span>
            {swapFromAfter}
          </span>
        </span>
        <FaucetSwapDialog locale={locale} swap={faucet.swap} />
      </footer>
    </section>
  )
}
