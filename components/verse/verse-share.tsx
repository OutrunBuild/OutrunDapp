'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Gift, Link2, X } from 'lucide-react'

import type { FixtureVerse, Locale } from '@/lib/data/fixture-repository'

import { XIcon } from '../global/brand-icons'
import { getCopy } from '../global/copy'
import { useCopy } from '../global/use-copy'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Verse share group: the hero's top-right single gift button=is the share button itself —
 * 1.5s looping wiggle (stops under reduced-motion),
 * hover shows a random promotional bubble, click opens the share dialog.
 * The random copy is only fixed at open time (onOpenChange swaps the index): SSR/hydration do
 * not participate,
 * no mismatch; the dialog's manual trigger source=general — no intro congratulation section,
 * auto-open after execution is not wired
 * (the CTA does not fake execution, same as PolMintDialog).
 */
export function VerseShare({ locale, verse }: { locale: Locale; verse: FixtureVerse }) {
  const copy = getCopy(locale).verse
  const common = getCopy(locale).common
  const [hintIndex, setHintIndex] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [tweetIndex, setTweetIndex] = useState(0)
  const { copied, copy: copyToClipboard, reset: resetCopied } = useCopy()

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href
  const tweet = copy.shareTweets[tweetIndex]?.replaceAll('{symbol}', verse.symbol) ?? ''

  return (
    <div className="verse-share">
      <Dialog
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open)
          if (open) {
            setTweetIndex(Math.floor(Math.random() * copy.shareTweets.length))
            resetCopied()
          }
        }}
      >
        {/* Single gift button=is the share button itself — hover shows a random
            promotional bubble, click opens the share dialog; TooltipTrigger is draped directly
            onto DialogTrigger via render
            (base-ui composition pattern, two triggers merged into one button) */}
        <Tooltip
          onOpenChange={(open) => {
            if (open) setHintIndex(Math.floor(Math.random() * copy.shareHints.length))
          }}
        >
          <TooltipTrigger render={<DialogTrigger className="verse-share__button" aria-label={copy.shareLabel} />}>
            <Gift size={16} aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="top">{copy.shareHints[hintIndex]}</TooltipContent>
        </Tooltip>
        <DialogContent className="verse-share-pop" data-stage={verse.stage}>
          {/* Shell reuses .pol-mint (same as the DAO/Liquidity dialogs): surface/stroke glow/padding all live on this layer */}
          <div className="pol-mint">
            <header className="pol-mint__head">
              <DialogTitle className="pol-mint__title verse-share-card__title">
                {copy.shareTitle}
                {/* The hint glyph=is the gift graphic itself: the gift icon doubles as the
                    tooltip trigger, hover shows the referral note */}
                <Tooltip>
                  <TooltipTrigger
                    className="verse-share-card__gift"
                    aria-label={copy.shareReferralLabel}
                  >
                    <Gift size={18} aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="top">{copy.shareReferralNote}</TooltipContent>
                </Tooltip>
              </DialogTitle>
              <div className="pol-mint__controls">
                <DialogClose
                  render={<button type="button" className="pol-mint__close" aria-label={common.close} />}
                >
                  <X aria-hidden="true" size={16} />
                </DialogClose>
              </div>
            </header>
            <div className="verse-share-card">
              <span className="verse-share-card__thumb" aria-hidden="true">
                {verse.symbol.slice(0, 2)}
              </span>
              <div className="verse-share-card__meta">
                <Image
                  className="verse-share-card__logo"
                  src="/brand/BRAND-01-wordmark-transparent-480.png"
                  width={480}
                  height={123}
                  alt="Outrun"
                />
                {/* symbol+name on one line: baseline aligned */}
                <span className="verse-share-card__idrow">
                  <strong className="verse-share-card__symbol" data-numeric>
                    {verse.symbol}
                  </strong>
                  <em className="verse-share-card__name">{verse.name}</em>
                </span>
                {verse.description ? (
                  <p className="verse-share-card__desc">{verse.description}</p>
                ) : null}
                <span className="verse-share-card__cta">{copy.shareCardCta}</span>
              </div>
            </div>
            <div className="verse-share-card__actions">
              <Button
                className="verse-share-card__copy"
                variant="outline"
                onClick={() => copyToClipboard(shareUrl)}
              >
                {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                {copied ? copy.shareCopied : copy.shareCopyLink}
              </Button>
              {/* The yellow non-solid button=the site-wide standard ax-ghost-cta
                  (reuse the existing ghost-CTA pattern instead of hand-rolled styles) */}
              <Button
                className="verse-share-card__x ax-ghost-cta"
                onClick={() => {
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl)}`,
                    '_blank',
                  )
                }}
              >
                {copy.shareOnX}
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
