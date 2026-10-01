import type { Metadata, Viewport } from 'next';

import { productFontClassName } from '@/components/design-system/fonts';
import { PaintSkin } from '@/components/design-system/paint-skin';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Outrun · Community-owned Onchain Economies',
    template: '%s · Outrun',
  },
  description:
    'Turn shared belief into a living onchain economy with coordinated liquidity, yield and community governance.',
  icons: {
    icon: '/brand/BRAND-04-symbol-color-512.png',
  },
  generator: 'v0.app',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A10',
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={productFontClassName}>
        <PaintSkin />
        {/* 标题信号失真的湍流滤镜（.ax-fault-title 爆窗帧引用，globals.css）：x 频率≈0
              → 每条扫描线整体水平位移 = 信号撕裂质感；baseFrequency x 保持 0 是形征 */}
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
        {children}
      </body>
    </html>
  );
}
