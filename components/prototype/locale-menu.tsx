'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Languages } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { localePath } from './routes'

/** 回访偏好（proxy 读它决定 '/' 是否 302 到 /zh）；语言状态本身仍在 URL */
const LOCALE_COOKIE = 'OUTRUN_LOCALE'

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

function hrefForLocale(locale: Locale, pathname: string, search: string) {
  const rest = pathname.replace(/^\/(?:en|zh)(?=[/]|$)/, '') || '/'
  const href = localePath(locale, rest === '/' ? '' : rest)
  return search ? `${href}?${search}` : href
}

function LocaleMenuInner({ locale }: { locale: Locale }) {
  const copy = getCopy(locale)
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const options = [
    { value: 'en' as Locale, label: copy.common.languageEn },
    { value: 'zh' as Locale, label: copy.common.languageZh },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="locale-menu__trigger" aria-label={copy.common.languageLabel}>
        <Languages aria-hidden="true" className="size-4" />
        <span>{locale === 'zh' ? copy.common.languageZh : 'EN'}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" data-size="14" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="locale-menu__content">
        {options.map((option) => (
          <DropdownMenuLinkItem
            key={option.value}
            className="locale-menu__item"
            data-current={option.value === locale ? 'true' : undefined}
            render={
              <Link
                href={hrefForLocale(option.value, pathname, search)}
                hrefLang={option.value}
                onClick={() => setLocaleCookie(option.value)}
              />
            }
          >
            <span>{option.label}</span>
            {option.value === locale ? <Check aria-hidden="true" className="size-3.5" /> : null}
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 语言切换下拉（保留当前路径与查询参数）。语言状态仍在 URL（GS-7）；
 *  cookie 只记回访偏好供 proxy 在 '/' 做重定向（2026-09-22 方案 C 用户裁定） */
export function LocaleMenu({ locale }: { locale: Locale }) {
  return (
    <Suspense
      fallback={
        <span className="locale-menu__trigger" aria-hidden="true">
          <Languages aria-hidden="true" className="size-4" />
        </span>
      }
    >
      <LocaleMenuInner locale={locale} />
    </Suspense>
  )
}
