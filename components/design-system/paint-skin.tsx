'use client'

import { useEffect } from 'react'

/**
 * Paint Worklet 画皮装载器（2026-09-26 用户裁定，实验室 F 区验收通过）：
 * - 注册 public/paint/chamfer-border.js（按钮家族描边+切角绘制，机制见该文件头注释）；
 * - 同步 --dpr 到 :root（worklet 量化网格用；缩放/页面 zoom 变化时重建 resolution MQ 监听）。
 * 挂在根 layout，全站（产品页/showcase/弹窗）生效。
 */
export function PaintSkin() {
  useEffect(() => {
    const root = document.documentElement
    const setDpr = () => root.style.setProperty('--dpr', String(window.devicePixelRatio || 1))
    setDpr()

    let mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const onChange = () => {
      setDpr()
      mq.removeEventListener('change', onChange)
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mq.addEventListener('change', onChange)
    }
    mq.addEventListener('change', onChange)

    const paintCss = window.CSS as unknown as {
      paintWorklet?: { addModule(url: string): Promise<void> }
    }
    // 注册完成打标记：paint() 在 worklet 就位前光栅化为空（按钮只剩文字），
    // e2e 视觉基线的 stabilize() 等此标记避免把「无描边」竞态写进基线（2026-10-07）；
    // 不支持 worklet 的浏览器走 @supports CSS 回落，无需等待、直接标记
    if (!paintCss.paintWorklet) {
      root.dataset.paintReady = '1'
      return () => mq.removeEventListener('change', onChange)
    }
    // 预水合内联装载（app/layout.tsx 的 nonce 内联脚本）已抢跑 addModule 时不再
    // 重复注册——本组件只保留 --dpr / resolution MQ 追踪；内联脚本被 CSP 拦截
    // （nonce 缺失等）时 __paintBooted 不在，本组件兜底走原注册路径
    if (!(window as unknown as { __paintBooted?: boolean }).__paintBooted) {
      paintCss.paintWorklet.addModule('/paint/chamfer-border.js').then(
        () => {
          root.dataset.paintReady = '1'
        },
        (error: unknown) => {
          console.error('[paint-skin] worklet 注册失败', error)
          root.dataset.paintReady = '1'
        },
      )
    }

    return () => mq.removeEventListener('change', onChange)
  }, [])

  return null
}
