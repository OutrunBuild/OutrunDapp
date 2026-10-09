import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { CJK_SUBSET_HREF } from '@/components/design-system/cjk-subset'
import { getDisplayLocale } from '@/lib/locale'

// 字体装载器（决议 029 + 补充 2，2026-10-09）——两件事，都为「刷新首帧即真值字体」：
//
// ① 拉丁 preload 补发：Next 16.3.3~16.4.0 对动态路由段不随 HTML 下发 next/font
//    的 preload 链接（vanilla 差分实证：静态路由有、动态路由无；本站
//    app/[locale]/** 全中招），字体退化为 CSS 解析后惰性拉取、暖缓存刷新也常
//    输给首帧 → swap 先画后备再换装即用户投诉的闪变。这里读 Next 构建产物
//    next-font-manifest.json（键=路由、值=应预载 woff2，仅拉丁 .p. 文件），
//    取全路由并集以 <link rel="preload"> 补发。哈希 URL 全部来自清单、零硬
//    编码；清单缺失/不可读=静默回退 Next 原生行为。crossorigin 必须带：字体
//    取回按匿名 CORS 模式，无 crossorigin 的 preload 与真实取回不命中等于白发。
//
// ② 中文子集 @font-face + zh 路由预载：next/font 的 Noto 是 4 字重 × 113
//    分片共 452 个不可预载 face（闪变主源），已改为全站文案子集的自托管
//    变体单文件（scripts/build-cjk-font.mjs，wght 100-900 一个 woff2 覆盖
//    全字重）。@font-face 在此内联（href 与 preload 同源单源，产物按内容
//    哈希命名、immutable 缓存，globals.css 写不了动态文件名）；家族名沿用
//    'Noto Sans SC'，tokens.css 字体栈零改动。预载只在 zh 路由发——en 页
//    无 CJK 字形消费，省 362KB。

const DIST_DIR = process.env.NEXT_DIST_DIR || '.next'
// .next 同时被 dev(3000) 与生产预览(4175) 共用：server/=生产构建、dev/server/=dev
// 增量产物，两份清单的字体哈希名不同（生产名带第二段哈希）。按运行模式取对
// 清单，取错会预载到 404 的旧哈希。
const CANDIDATE_PATHS =
  process.env.NODE_ENV === 'development'
    ? [`${DIST_DIR}/dev/server/next-font-manifest.json`, `${DIST_DIR}/server/next-font-manifest.json`]
    : [`${DIST_DIR}/server/next-font-manifest.json`, `${DIST_DIR}/dev/server/next-font-manifest.json`]

let cachedAtMs = -1
let cachedHrefs: string[] = []

async function loadPreloadHrefs(): Promise<string[]> {
  for (const manifestPath of CANDIDATE_PATHS) {
    const absolute = path.resolve(process.cwd(), manifestPath)
    let mtimeMs: number
    try {
      mtimeMs = (await stat(absolute)).mtimeMs
    } catch {
      continue
    }
    if (mtimeMs === cachedAtMs) return cachedHrefs

    try {
      const manifest = JSON.parse(await readFile(absolute, 'utf8')) as {
        app?: Record<string, string[]>
      }
      const files = [...new Set(Object.values(manifest.app ?? {}).flat())]
      cachedHrefs = files.map((file) => `/_next/${file}`)
      cachedAtMs = mtimeMs
      return cachedHrefs
    } catch {
      continue
    }
  }
  return []
}

// 产物按内容哈希命名 → href 与 @font-face 单源（cjk-subset.ts 由构建脚本生成）。
// font-display:fallback（2026-10-09 用户裁定「改」）：冷首访愿意隐身最多 100ms
// 等字体——暖刷新/WiFi·5G 冷访窗口内必到，首帧即 Noto 零闪；4G 冷访先隐
// 0.1s→后备→3s 内换装（比 swap 的「立刻错字体再换」晚出场但对的时机更多）。
// 拉丁侧（next/font，fonts.ts）维持 swap 不动——6 文件仅 94KB 预载后几乎必进窗
// 口，且 fonts.ts 的 display 值历属裁定敏感区（optional 前科）。
const CJK_FACE_CSS = `@font-face{font-family:'Noto Sans SC';font-style:normal;font-weight:100 900;font-display:fallback;src:url(${CJK_SUBSET_HREF}) format('woff2')}`

export async function FontPreloadLinks() {
  const [hrefs, locale] = await Promise.all([loadPreloadHrefs(), getDisplayLocale()])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CJK_FACE_CSS }} />
      {locale === 'zh' && (
        <link rel="preload" href={CJK_SUBSET_HREF} as="font" type="font/woff2" crossOrigin="anonymous" />
      )}
      {hrefs.map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
    </>
  )
}
