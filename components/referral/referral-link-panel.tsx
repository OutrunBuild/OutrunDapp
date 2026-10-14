'use client'

import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useCopy } from '../global/use-copy'

/**
 * Invite link panel: a single-line link well + an embedded copy icon button at the right end —
 * yellow icon, hover energizes to pure yellow-on-black, the only
 * yellow primary action on the page:
 * - The link URL is computed by the RSC via the host header and passed in (complete at SSR, no
 *   hydration flicker)
 * - On copy success, swaps to ✓ for 1.6s (copying goes through useCopy, the single shared
 *   implementation with CopyAddress/VerseShare; the aria-label stays the Copy link label in both
 *   states)
 * - Mobile (≤54rem): the action takes center stage —
 *   the well degrades to a frameless evidence line (monospace 14px muted, always the full URL
 *   incl. scheme), and a full-width solid yellow cut-corner CTA below (Button default channel)
 *   takes over copying; on desktop the well's embedded icon button stays as-is, one trigger shown
 *   per breakpoint (display:none removes it from the a11y tree)
 * - The URL display splits into three segments: scheme / host (shrinks into an ellipsis) / path
 *   (/ref/shortcode never truncated) — the middle segment truncates so the shortcode is not
 *   squeezed out at narrow viewports; copying always writes the full url
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
