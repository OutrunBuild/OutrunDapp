// URL scheme（2026-09-22 用户裁定，方案 C）：语言状态仍在 URL——en 无前缀
// （由 proxy 内部 rewrite 到 /en/** 提供），zh 携带 /zh 前缀；memeverse 详情页
// 用数字段（= 链上 uint256 verseId 口径），fixture 行 id（verse-021）留在数据层。
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
