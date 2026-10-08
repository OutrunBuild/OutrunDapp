'use client'

import { useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { TokenIconMark, hasTokenIcon } from '../global/token-icons'
import { formatAmount } from '../global/signal-ui'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** 可选代币行模型（SwapPanel 组装——价格/路由在面板算，弹窗只管选择） */
export type SwapTokenOption = {
  id: string
  symbol: string
  name: string
  /** 行内余额样本；null=fixture 缺失→'--' 槽位 */
  balance: number | null
}

/**
 * Swap 代币选择弹窗（2026-09-27：输入/输出侧代币可点开选择，参照图=标题+✕+搜索+行列表，
 * 皮肤走本仓设计系统不照抄配色）。可选集用户裁定：稳定侧=uAsset+其 PSM 配对储备、
 * Meme 侧=memecoin/POL/PT/YT——集合由 SwapPanel 按侧注入，弹窗本身不限。
 * 壳复用 .pol-mint（同 4 个 POL/Liquidity 弹窗）；键盘契约 §2 AssetSelector：
 * Enter/Space 选中（button 原生）、Esc 关闭（Dialog 原生）、↑↓ 在行间移动焦点。
 */
export function SwapTokenSelectDialog({
  locale,
  selectedId,
  options,
  onSelect,
}: {
  locale: Locale
  /** 当前选中代币 id（行 data-selected 高亮 + aria-selected） */
  selectedId: string
  options: SwapTokenOption[]
  onSelect: (id: string) => void
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const [query, setQuery] = useState('')

  const normalized = query.trim().toLowerCase()
  const filtered = options.filter(
    (option) =>
      !normalized ||
      option.symbol.toLowerCase().includes(normalized) ||
      option.name.toLowerCase().includes(normalized),
  )
  const selected = options.find((option) => option.id === selectedId)
  // 品类前缀符号取段（POL-MOON→POL），裸符号取前两位（UETH→UE）
  const badgeOf = (symbol: string) =>
    symbol.includes('-') ? symbol.split('-')[0] : symbol.slice(0, 2).toUpperCase()

  return (
    <Dialog>
      <DialogTrigger
        className="swap-panel__token swap-panel__token--select"
        aria-label={`${copy.selectTokenTitle} · ${selected?.symbol ?? ''}`}
        render={<button type="button" />}
      >
        <strong>{selected?.symbol}</strong>
        <ChevronDown aria-hidden="true" size={14} />
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.selectTokenTitle}</DialogTitle>
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
          {/* 搜索行走全局 input 桥皮肤（[data-slot='input'] 带 !important，外框叠加会双框打架），
              左图标=覆盖式绝对定位（同 .create-suffix 先例） */}
          <div className="token-select__search">
            <Input
              value={query}
              placeholder={copy.tokenSearchPlaceholder}
              aria-label={copy.tokenSearchPlaceholder}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            <Search aria-hidden="true" size={14} />
          </div>
          {/* ↑↓ 焦点在行钮间循环（契约 §2）；option 的 aria-selected 跟选中态 */}
          <ul
            className="token-select__list"
            role="listbox"
            aria-label={copy.selectTokenTitle}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const rows = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('.token-select__row'),
              )
              const index = rows.indexOf(document.activeElement as HTMLButtonElement)
              const next =
                event.key === 'ArrowDown'
                  ? rows[(index + 1 + rows.length) % rows.length]
                  : rows[(index - 1 + rows.length) % rows.length]
              next?.focus()
            }}
          >
            {filtered.map((option) => (
              <li key={option.id} role="option" aria-selected={option.id === selectedId}>
                <DialogClose
                  render={
                    <button
                      type="button"
                      className="token-select__row"
                      data-selected={option.id === selectedId || undefined}
                      onClick={() => onSelect(option.id)}
                    />
                  }
                >
                  {hasTokenIcon(option.symbol) ? (
                    <TokenIconMark symbol={option.symbol} size={28} aria-hidden="true" />
                  ) : (
                    <span className="token-select__badge" aria-hidden="true">
                      {badgeOf(option.symbol)}
                    </span>
                  )}
                  <span className="token-select__id">
                    <strong>{option.symbol}</strong>
                    <span>{option.name}</span>
                  </span>
                  <span className="token-select__balance" data-numeric>
                    {option.balance != null ? formatAmount(option.balance, locale) : '--'}
                  </span>
                </DialogClose>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? <p className="token-select__empty">{copy.tokenNoResults}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
