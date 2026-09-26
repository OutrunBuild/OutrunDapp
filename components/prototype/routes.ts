// URL scheme（2026-09-22 用户裁定，方案 C）：语言状态仍在 URL——en 无前缀
// （由 proxy 内部 rewrite 到 /en/** 提供），zh 携带 /zh 前缀；memeverse 详情页
// 用数字段（= 链上 uint256 verseId 口径），fixture 行 id（verse-021）留在数据层。
// 2026-09-23 用户裁定：创建页与发现页并入 /memeverse/* 域——
// /memeverse/launch（原 /launch）、/memeverse/explore（原 /memeverse）；
// 旧地址由 proxy.ts 307 收敛。
// 2026-09-26 语言切换零副作用：/zh/** 在 proxy 内部同样 rewrite 到 /en/**，
// 跨语言导航共用同一棵路由树（软导航不重挂载、组件状态全保）；
// 展示语言由 proxy 写入 x-locale 请求头，页面经 lib/locale.ts getDisplayLocale() 取。
import type { Locale } from '@/lib/data/prototype-repository'

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

export function verseHref(locale: Locale, verseId: string): string {
  return localePath(locale, `/memeverse/${versePathSegment(verseId)}`)
}
