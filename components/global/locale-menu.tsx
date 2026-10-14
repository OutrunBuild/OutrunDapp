'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Languages } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { localePath } from './routes'

/** Returning-visitor preference (the proxy reads it to decide whether '/' 307-redirects
 *  to /zh); the language state itself still lives in the URL */
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
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  // The menu is permanent in the top bar: prefetch the other-language link on mount.
  // Dropdown items only mount once the menu opens, and prefetching starts then —
  // clicking immediately on first open would fall back to a full page load because the
  // prefetch is not ready, wiping all session state — prefetching early removes this
  // race window.
  useEffect(() => {
    const other: Locale = locale === 'zh' ? 'en' : 'zh'
    const href = hrefForLocale(other, pathname, search)
    // Do not prefetch the home counterpart href ('/' or '/zh'): '/' follows the cookie
    // 307, and a prefetch following the redirect would cache the mis-targeted payload;
    // home switching uses a full page jump, so no prefetch is needed
    if (href === '/' || href === '/zh') return
    router.prefetch(href)
  }, [router, locale, pathname, search])

  // Back/forward reconciliation: after a language switch, pressing back restores the
  // shared-segment cache via popstate (= the post-switch language), so the URL prefix
  // and the rendered language can disagree — compare the URL against the shell's lang
  // attribute and refresh to re-fetch the correct language payload on mismatch
  // (refresh preserves component state).
  useEffect(() => {
    function reconcile() {
      window.setTimeout(() => {
        const rendered = document.querySelector('.outrun-site')?.getAttribute('lang')?.startsWith('zh')
          ? 'zh'
          : 'en'
        const urlLocale = location.pathname === '/zh' || location.pathname.startsWith('/zh/') ? 'zh' : 'en'
        if (rendered !== urlLocale) router.refresh()
      }, 100)
    }
    window.addEventListener('popstate', reconcile)
    return () => window.removeEventListener('popstate', reconcile)
  }, [router])

  // Language-switch navigation: /zh/** and the
  // prefix-less form share the /en/** route tree inside the proxy (soft navigation does
  // not remount, component state fully preserved); the cost is that when the client
  // route tree sees no difference between the two sides, push cannot obtain the new
  // language payload — a follow-up refresh force-refetches the current route and
  // applies it. refresh itself keeps React state, so the combination = a language-only
  // change with zero state impact.
  // Exception: the home page does a full page jump. The proxy 307s '/' to /zh by
  // cookie; when push+refresh interleaves with the prefetch cache, the landing can
  // drift to the internal canonical /en; the home page has no in-session state to
  // keep, so a full page jump buys determinism.
  function switchLocale(next: Locale, href: string) {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      setLocaleCookie(next)
      if (href === '/' || href === '/zh') {
        window.location.assign(href)
        return
      }
      router.push(href)
      router.refresh()
    }
  }

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
              <a
                href={hrefForLocale(option.value, pathname, search)}
                hrefLang={option.value}
                onClick={switchLocale(option.value, hrefForLocale(option.value, pathname, search))}
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

/** Language-switch dropdown (keeps the current path and query params). Language state
 *  still lives in the URL;
 *  the cookie only records the returning-visitor preference for the proxy's '/'
 *  redirect */
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
