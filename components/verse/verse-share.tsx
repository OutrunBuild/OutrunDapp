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
 * Verse 分享组（参照 jasonrale/Outrun-Frontend 同名功能，决议 023）：
 * hero 右上角单礼物钮=分享按钮本体（2026-10-06 用户裁定 Share2 退役）——
 * 1.5s 循环抖动（reduced-motion 停抖；motion 契约 infinite 例外已登记），
 * 悬停出随机一条促销语气泡，点击开分享弹窗。
 * 随机文案在开启瞬间才定值（onOpenChange 换 index）：SSR/水合不参与，
 * 无 mismatch；弹窗手动触发源=general——无 intro 祝贺段，成交后自动弹
 * 不接线（原型 CTA 恒 disabled 不伪造成交，同 PolMintDialog 契约）。
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
        {/* 单礼物钮=分享按钮本体（2026-10-06 用户裁定：Share2 退役）——悬停出随机
            促销语气泡、点击开分享弹窗；TooltipTrigger 经 render 直接披在 DialogTrigger
            上（base-ui 组合范式，两个触发器合一颗钮） */}
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
          {/* 壳复用 .pol-mint（同 DAO/Liquidity 弹窗）：底色/描边光/padding 都在这层 */}
          <div className="pol-mint">
            <header className="pol-mint__head">
              <DialogTitle className="pol-mint__title verse-share-card__title">
                {copy.shareTitle}
                {/* 提示符=礼物图形本体（2026-10-06 用户裁定：info 符号退役，
                    礼物图标兼任 tooltip 触发器，悬停出返佣说明） */}
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
                {/* symbol+name 同行（023 补充 14 用户裁定）：基线对齐 */}
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
              {/* 黄色非实心钮=全站标准 ax-ghost-cta（023 补充 19：复用既有范式，
                  撤补充 18 的手搓 important 块） */}
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
