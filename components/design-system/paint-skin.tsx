'use client'

import { useEffect } from 'react'

/**
 * Paint Worklet skin loader:
 * - registers public/paint/chamfer-border.js (button-family border + chamfer painting;
 *   mechanics documented in that file's header comment);
 * - syncs --dpr to :root (used by the worklet's quantized grid; rebuilds the resolution MQ
 *   listener on display scaling / page zoom changes).
 * Mounted in the root layout; site-wide (product pages / showcase / dialogs).
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
    // Flag when registration completes: paint() rasterizes to empty before the worklet is in
    // place (buttons keep only their text), so the e2e visual baseline's stabilize() waits on
    // this flag to avoid baking the "no border" race into the baseline; browsers
    // without worklet support take the @supports CSS fallback — no waiting, flag immediately
    if (!paintCss.paintWorklet) {
      root.dataset.paintReady = '1'
      return () => mq.removeEventListener('change', onChange)
    }
    // If the pre-hydration inline loader (app/layout.tsx's nonce inline script) already raced
    // ahead with addModule, don't register again — this component keeps only --dpr / resolution
    // MQ tracking; if the inline script was blocked by CSP (missing nonce etc.), __paintBooted
    // is absent and this component falls back to the original registration path
    if (!(window as unknown as { __paintBooted?: boolean }).__paintBooted) {
      paintCss.paintWorklet.addModule('/paint/chamfer-border.js').then(
        () => {
          root.dataset.paintReady = '1'
        },
        (error: unknown) => {
          console.error('[paint-skin] worklet registration failed', error)
          root.dataset.paintReady = '1'
        },
      )
    }

    return () => mq.removeEventListener('change', onChange)
  }, [])

  return null
}
