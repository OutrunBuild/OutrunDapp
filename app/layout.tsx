import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { productFontClassName } from '@/components/design-system/fonts';
import { FontPreloadLinks } from '@/components/design-system/font-preload';
import { PaintSkin } from '@/components/design-system/paint-skin';
import { getCopy } from '@/components/global/copy';
import { Web3Providers } from '@/components/global/web3-providers';
import { getDisplayLocale } from '@/lib/locale';

import './globals.css';

// Pre-hydration paint skin boot: a worklet registered only in PaintSkin's useEffect leaves the frames before
// hydration unpainted — paint() rasterizes to nothing between the first frame and hydration, so buttons run
// bare and get their strokes back a beat later (the "flash"). This inline script runs synchronously during HTML
// parsing (nonce taken from proxy.ts's x-nonce; under CSP strict-dynamic, inline scripts without a nonce are blocked),
// sets --dpr and registers the worklet before the first frame. Semantics are identical to PaintSkin
// (__paintBooted set before registering, both resolve/reject set data-paint-ready); see the __paintBooted guard on the component side.
const PAINT_BOOT_JS = [
  '(function(){',
  'var r=document.documentElement;',
  "r.style.setProperty('--dpr',String(window.devicePixelRatio||1));",
  'var pw=window.CSS&&window.CSS.paintWorklet;',
  "if(!pw){r.dataset.paintReady='1';return}",
  'window.__paintBooted=true;',
  "pw.addModule('/paint/chamfer-border.js').then(",
  "function(){r.dataset.paintReady='1'},",
  "function(e){console.error('[paint-skin] worklet registration failed',e);r.dataset.paintReady='1'}",
  ');',
  '})()',
].join('');

export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return {
    title: {
      default: copy.meta.rootTitle,
      template: copy.meta.titleTemplate,
    },
    description: copy.meta.homeDescription,
    icons: {
      icon: '/brand/BRAND-04-symbol-color-512.png',
    },
    generator: 'v0.app',
  };
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A10',
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // x-nonce is injected per request by proxy.ts; the site is already fully dynamically rendered,
  // so reading headers here changes nothing about the rendering mode. When missing, the inline script has no nonce and is
  // blocked by CSP; PaintSkin's __paintBooted guard falls back to the useEffect registration path
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={productFontClassName}>
        <FontPreloadLinks />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PAINT_BOOT_JS }} />
        <PaintSkin />
        {/* Turbulence filters for the title signal distortion (referenced by .ax-fault-title glitch burst frames, globals.css):
              x frequency ≈ 0 → each scanline shifts horizontally as a whole = signal-tear texture; baseFrequency x
              staying 0 is the shape signature */}
        <svg aria-hidden="true" focusable="false" className="ax-fault-defs">
          <defs>
            <filter id="fault-turb-a" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0 0.55" numOctaves="1" seed="7" />
              <feDisplacementMap
                in="SourceGraphic"
                scale="7"
                xChannelSelector="R"
                yChannelSelector="R"
              />
            </filter>
            <filter id="fault-turb-b" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0 0.8" numOctaves="1" seed="2" />
              <feDisplacementMap
                in="SourceGraphic"
                scale="3.5"
                xChannelSelector="R"
                yChannelSelector="R"
              />
            </filter>
          </defs>
        </svg>
        <Web3Providers>{children}</Web3Providers>
        {/* Site-wide CRT scanlines, mounted at body level: a single horizontal-stripe component — when it
            hung at the end of the shell, dialog portals (mounted on body, z-50) painted above it and missed the film; at body level
            z-overlay covers all content including dialogs, so pages and dialogs share one film */}
        <div className="ax-scanlines" aria-hidden="true" />
      </body>
    </html>
  );
}
