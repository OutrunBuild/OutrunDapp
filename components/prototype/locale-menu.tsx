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
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  // 菜单常驻顶栏：挂载即预取对端语言链接。下拉项打开菜单才挂载、
  // 预取始于彼时——初开即点会因预取未就绪回退整页刷新，清空全部会话状态
  //（2026-09-26 语言切换零副作用：提前预取消除该竞速窗口）。
  useEffect(() => {
    const other: Locale = locale === 'zh' ? 'en' : 'zh'
    const href = hrefForLocale(other, pathname, search)
    // 首页对端 href（'/' 或 '/zh'）不预取：'/' 依 cookie 307，预取跟随重定向
    // 会把偏移载荷挂进缓存；首页切换走整页跳转，无需预取
    if (href === '/' || href === '/zh') return
    router.prefetch(href)
  }, [router, locale, pathname, search])

  // 返回/前进对账：切换语言后按返回键，popstate 恢复的是共享段缓存（= 切换后
  // 的语言），会出现 URL 前缀与渲染语言不一致——比对 URL 口径与壳层 lang 属性，
  // 不一致则 refresh 重取正确语言载荷（refresh 保留组件状态）。
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

  // 语言切换导航（2026-09-26 零副作用）：/zh/** 与无前缀形态在 proxy 内共用
  // /en/** 路由树（软导航不重挂载、组件状态全保），代价是客户端路由树两侧
  // 无差异时 push 拿不到新语言载荷——紧跟 refresh 强制重取当前路由并应用，
  // refresh 本身保留 React state，两者叠加 = 仅换语言、零状态影响。
  // 例外：首页整页跳转。proxy 对 '/' 依 cookie 307 到 /zh，push+refresh 与
  // 预取缓存交错时落点会漂到内部 canonical /en；首页无会话内状态可保，
  // 整页跳转换确定性。
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
