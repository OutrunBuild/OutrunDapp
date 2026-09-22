'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import { ChainLogoMark } from '@/components/prototype/chain-icons'

import type { Locale, PrototypeChain } from '@/lib/data/prototype-repository'

import { getCopy } from '@/components/prototype/copy'

/**
 * GS-2 查看链选择器（弹窗版）：header 触发器显示当前链，弹窗列六链、背景虚化。
 * 选择写 URL ?chain={chainId}——discovery 页读取该参数过滤数据（真实联动），其余页仅记忆视图链。
 */
export function ChainSelectorDialog({ locale, chains }: { locale: Locale; chains: PrototypeChain[] }) {
  const copy = getCopy(locale)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<number>(chains[0]?.chainId ?? 0)

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = Number(params.get('chain'))
    if (chains.some((c) => c.chainId === fromUrl)) setActiveId(fromUrl)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, chains])

  const active = chains.find((c) => c.chainId === activeId) ?? chains[0]

  const select = (chainId: number) => {
    setActiveId(chainId)
    setOpen(false)
    const params = new URLSearchParams(window.location.search)
    if (chainId === chains[0]?.chainId) params.delete('chain')
    else params.set('chain', String(chainId))
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false })
  }

  return (
    <>
      <button
        type="button"
        className="chain-dialog__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChainLogoMark chainId={activeId} />
        <span className="chain-dialog__trigger-current">{active?.name ?? '—'}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>

      {open
        ? createPortal(
            <div
              className="chain-dialog__overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false)
              }}
            >
              <div className="chain-dialog__panel" role="dialog" aria-modal="true" aria-label={copy.common.viewChain}>
                <ul className="chain-dialog__list">
                  {chains.map((c) => (
                    <li key={c.chainId}>
                      <button
                        type="button"
                        className="chain-dialog__option"
                        data-active={c.chainId === activeId ? 'true' : undefined}
                        onClick={() => select(c.chainId)}
                      >
                        <span className="chain-dialog__option-name">
                          <ChainLogoMark chainId={c.chainId} size={18} />
                          {c.name}
                        </span>
                        {c.chainId === activeId ? <Check aria-hidden="true" className="size-3.5" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
