'use client'

import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useCopy } from '../global/use-copy'

/**
 * 邀请链接面板（2026-10-07 用户裁定：删 Share on X 与独立 Copy Link 大钮，
 * 参照图改单行链接井 + 右端嵌入式复制图标钮——黄图标、hover 通电纯黄黑图标，
 * 为页内唯一黄主行动）：
 * - 链接 URL 由 RSC 经 host 头算好传入（SSR 即完整值，无水合闪变）
 * - 复制成功 1.6s 内换 ✓（复制行为经 useCopy 与 CopyAddress/VerseShare 共享唯一实现；aria-label 恒为「复制链接」）
 * - 移动端（≤54rem，2026-10-07 用户拍板第二版）：动作主角——井降级为无框
 *   证据行（等宽 14px muted、完整 URL 含 scheme——隐 scheme 曾被用户判
 *   「链接不完整」，撤），下方全宽实心黄切角 CTA（Button default 通道）
 *   接管复制；桌面井内嵌图标钮原样保留，两个触发器每档只显示一个
 *   （display:none 出 a11y 树）
 * - URL 显示拆三段：scheme / host（收缩出省略号）/ 路径（/ref/短码 恒不截）——
 *   中段截断，窄视口下短码不被挤掉；复制恒写完整 url
 */
export function ReferralLinkPanel({ locale, url }: { locale: Locale; url: string }) {
  const copy = getCopy(locale).referral
  const { copied, copy: copyUrl } = useCopy()

  const schemeEnd = url.indexOf('://')
  const pathStart = url.indexOf('/', schemeEnd === -1 ? 0 : schemeEnd + 3)
  const scheme = schemeEnd === -1 ? '' : url.slice(0, schemeEnd + 3)
  const host = url.slice(
    schemeEnd === -1 ? 0 : schemeEnd + 3,
    pathStart === -1 ? url.length : pathStart,
  )
  const path = pathStart === -1 ? '' : url.slice(pathStart)

  const onCopy = () => copyUrl(url)

  return (
    <section className="action-panel ref-link" aria-labelledby="ref-link-title">
      <h2 className="ref-link__title" id="ref-link-title">
        {copy.linkLabel}
      </h2>
      <div className="ref-link__url" data-numeric>
        <span className="ref-link__url-text">
          {scheme ? <span className="ref-link__url-scheme">{scheme}</span> : null}
          <span className="ref-link__url-host">{host}</span>
          {path ? <span className="ref-link__url-tail">{path}</span> : null}
        </span>
        <button
          type="button"
          className="ref-link__copy"
          aria-label={copy.copyLink}
          title={copy.copyLink}
          onClick={onCopy}
        >
          {copied ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Copy size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <Button type="button" variant="default" className="ref-link__cta" onClick={onCopy}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? copy.copied : copy.copyLink}
      </Button>
    </section>
  )
}
