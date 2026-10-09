import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { productFontClassName } from '@/components/design-system/fonts';
import { FontPreloadLinks } from '@/components/design-system/font-preload';
import { PaintSkin } from '@/components/design-system/paint-skin';
import { getCopy } from '@/components/global/copy';
import { getDisplayLocale } from '@/lib/locale';

import './globals.css';

// 预水合画皮装载（刷新闪变修复，2026-10-09 用户裁定）：原 PaintSkin 在 useEffect
// 里 addModule，首帧到水合之间 paint() 光栅化为空——按钮裸奔后补描边即「闪一下」。
// 此内联脚本随 HTML 解析同步执行（nonce 取自 proxy.ts 的 x-nonce，CSP
// strict-dynamic 下无 nonce 的内联会被拦），把 --dpr 与 worklet 注册抢到首帧前；
// 语义与 PaintSkin 完全一致（__paintBooted 先置再注册、resolve/reject 都打
// data-paint-ready），组件侧见 __paintBooted 守卫。
const PAINT_BOOT_JS = [
  '(function(){',
  'var r=document.documentElement;',
  "r.style.setProperty('--dpr',String(window.devicePixelRatio||1));",
  'var pw=window.CSS&&window.CSS.paintWorklet;',
  "if(!pw){r.dataset.paintReady='1';return}",
  'window.__paintBooted=true;',
  "pw.addModule('/paint/chamfer-border.js').then(",
  "function(){r.dataset.paintReady='1'},",
  "function(e){console.error('[paint-skin] worklet 注册失败',e);r.dataset.paintReady='1'}",
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
  // x-nonce 由 proxy.ts 逐请求注入（architecture §14）；全站本就动态渲染，此处
  // 读 headers 不引入新的渲染降级。缺失时内联脚本无 nonce 会被 CSP 拦，
  // PaintSkin 的 __paintBooted 守卫兜底回 useEffect 注册路径
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={productFontClassName}>
        <FontPreloadLinks />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PAINT_BOOT_JS }} />
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
        {/* 全站 CRT 扫描线（023 补充 10 提升至 body 级）：单一横纹组件——原挂壳层末尾
            时 dialog portal（body 直挂、z-50）绘制于其上吃不到膜；body 级 z-overlay
            盖住包括弹窗在内的全部内容，页面与弹窗同一张膜 */}
        <div className="ax-scanlines" aria-hidden="true" />
      </body>
    </html>
  );
}
