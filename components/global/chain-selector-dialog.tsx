'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import { ChainLogoMark } from './chain-icons'

import type { Locale, FixtureChain } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/**
 * GS-2 查看链选择器（弹窗版）：header 触发器显示当前链，弹窗列六链、背景虚化。
 * 选择写 URL ?chain={chainId}——discovery 页读取该参数过滤数据（真实联动），其余页仅记忆视图链。
 * 2026-09-24 用户裁定：本选择器=链切换唯一入口——当前链状态存 mock 钱包 chainId
 * （Yield Vault 链感知消费；卡内网络芯片已删），弹窗打开时仍从 URL 深链同步。
 * 2026-10-08 迁 ui/dialog（base-ui）：Esc/焦点圈闭/焦点还原触发器由原语内置
 * （component-contract.md 附则弹层契约）；背景虚化走全局 [data-slot='dialog-backdrop'] 皮肤。
 */
export function ChainSelectorDialog({ locale, chains }: { locale: Locale; chains: FixtureChain[] }) {
  const copy = getCopy(locale)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { chainId: activeId, switchChain } = useMockWallet()

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = Number(params.get('chain'))
    if (chains.some((c) => c.chainId === fromUrl)) switchChain(fromUrl)
  }, [open, chains, switchChain])

  const active = chains.find((c) => c.chainId === activeId) ?? chains[0]

  const select = (chainId: number) => {
    switchChain(chainId)
    setOpen(false)
    const params = new URLSearchParams(window.location.search)
    if (chainId === chains[0]?.chainId) params.delete('chain')
    else params.set('chain', String(chainId))
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="chain-dialog__trigger" render={<button type="button" />}>
        <ChainLogoMark chainId={activeId} />
        <span className="chain-dialog__trigger-current">{active?.name ?? '—'}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="chain-dialog__panel">
        <DialogTitle className="sr-only">{copy.common.viewChain}</DialogTitle>
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
      </DialogContent>
    </Dialog>
  )
}
