// URL scheme（2026-09-22 用户裁定，方案 C）：语言状态仍在 URL——en 无前缀
// （由 proxy 内部 rewrite 到 /en/** 提供），zh 携带 /zh 前缀；memeverse 详情页
// 用数字段（= 链上 uint256 verseId 口径），fixture 行 id（verse-021）留在数据层。
// 2026-09-23 用户裁定：创建页与发现页并入 /memeverse/* 域——
// /memeverse/launch（原 /launch）、/memeverse/explore（原 /memeverse）；
// 旧地址由 proxy.ts 307 收敛。
// 2026-09-26 语言切换零副作用：/zh/** 在 proxy 内部同样 rewrite 到 /en/**，
// 跨语言导航共用同一棵路由树（软导航不重挂载、组件状态全保）；
// 展示语言由 proxy 写入 x-locale 请求头，页面经 lib/locale.ts getDisplayLocale() 取。
import type { Locale } from '@/lib/data/fixture-repository'

/** 按 locale 拼路径：en 无前缀（home='/'),zh 加 /zh 前缀（home='/zh'） */
export function localePath(locale: Locale, path: string): string {
  if (locale === 'zh') return path === '' || path === '/' ? '/zh' : `/zh${path}`
  return path === '' || path === '/' ? '/' : path
}

/** fixture 行 id（verse-021）→ 数字 URL 段（21）；解析失败原样返回 */
export function versePathSegment(verseId: string): string {
  const match = /^verse-0*(\d+)$/i.exec(verseId)
  return match ? match[1] : verseId
}

/** 交易台四页签 key（?tab= 深链白名单——与 VerseTabs 的 ToggleGroupItem value 一致） */
export const VERSE_TAB_KEYS = ['liquidity', 'pol', 'vault', 'dao'] as const

/** URL ?tab=/?action= 原始值 → 白名单窄化（未知值与大小写变体丢弃；action 仅认 withdraw——与 VersePage 消费端同口径） */
export function narrowVerseQuery(
  search: { tab?: string; action?: string },
): { tab?: (typeof VERSE_TAB_KEYS)[number]; action?: 'withdraw' } {
  const tab = VERSE_TAB_KEYS.find((key) => key === search.tab)
  const action = search.action === 'withdraw' ? 'withdraw' : undefined
  return { tab, action }
}

export function verseHref(
  locale: Locale,
  verseId: string,
  /** 交易台页签深链（?tab=；liquidity=默认不带 query——VersePage 白名单校验） */
  tab?: (typeof VERSE_TAB_KEYS)[number],
  /** 页签内视图深链（?action=，当前仅 vault 页签接受 withdraw——VersePage 白名单校验） */
  action?: 'withdraw',
): string {
  const params = new URLSearchParams()
  if (tab && tab !== 'liquidity') params.set('tab', tab)
  if (action) params.set('action', action)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return localePath(locale, `/memeverse/${versePathSegment(verseId)}${query}`)
}
