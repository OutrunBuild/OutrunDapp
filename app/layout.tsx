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
        {children}
      </body>
    </html>
  );
}
