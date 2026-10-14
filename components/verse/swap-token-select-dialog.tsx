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

/** Selectable token row model (assembled by SwapPanel — price/route computed in the panel, the dialog only handles selection) */
export type SwapTokenOption = {
  id: string
  symbol: string
  name: string
  /** Row balance sample; null=fixture missing → '--' slot */
  balance: number | null
}

/**
 * Swap token select dialog: input/output side tokens open a selection; shell=title+✕+search+row
 * list, skin follows this repo's design system. Selectable set: stable side=uAsset + its
 * PSM-paired reserves,
 * Meme side=memecoin/POL/PT (YT excluded — use the Flash Swap dialog) — the set is injected
 * per side by SwapPanel; the dialog itself is not limited.
 * Shell reuses .pol-mint (same shell as the other POL/Liquidity dialogs); keyboard behavior:
 * Enter/Space select (native button), Esc closes (native Dialog), ↑↓ move focus between rows.
 */
export function SwapTokenSelectDialog({
  locale,
  selectedId,
  options,
  onSelect,
}: {
  locale: Locale
  /** Currently selected token id (row data-selected highlight + aria-selected) */
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
  // Category-prefixed symbols take the segment (POL-MOON→POL); bare symbols take the first two letters (UETH→UE)
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
          {/* The search row uses the global input bridge skin ([data-slot='input'] carries
              !important; an outer box overlay would clash as a double box),
              left icon=overlay absolute positioning (same technique as .create-suffix) */}
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
          {/* ↑↓ focus cycles between row buttons; the option's aria-selected follows the selected state */}
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
