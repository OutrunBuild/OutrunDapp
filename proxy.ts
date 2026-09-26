// Next.js 16 proxy（architecture §14）：每请求生成 base64 nonce，
// 同一 nonce 写入 request x-nonce、request CSP 与 response CSP；
// 全站动态渲染，禁止 ISR/PPR/静态导出（runbook 步骤 2 CSP/渲染约束）。
import { NextResponse, type NextRequest } from 'next/server';

function buildNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

function cspHeader(nonce: string, dev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https://challenges.cloudflare.com',
    ...(dev ? ["'unsafe-eval'"] : []), // 仅 development
  ].join(' ');

  return [
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

// locale 路由（2026-09-22 方案 C，替代 GS-7 的「en 前缀」形态）：
// 语言状态仍在 URL——en 无前缀（内部 rewrite 到 /en/**）、zh 带 /zh 前缀；
// cookie 仅存回访偏好，用于 '/' 重定向（Googlebot 无 cookie，'/' 的英文规范内容不受影响）。
const LOCALE_COOKIE = 'OUTRUN_LOCALE';

// 旧 URL 收敛（2026-09-23 用户裁定：创建页与发现页并入 /memeverse/* 域）：
// /launch → /memeverse/launch、/memeverse → /memeverse/explore；
// 307 避免原型期浏览器缓存（与 verse-021 形态收敛同口径）。
const LEGACY_PATHS: Record<string, string> = {
  '/launch': '/memeverse/launch',
  '/memeverse': '/memeverse/explore',
};

function legacyRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  const localeMatch = /^\/(?:zh|en)(?=\/|$)/.exec(pathname);
  const rest = localeMatch ? pathname.slice(localeMatch[0].length) : pathname;
  const target = LEGACY_PATHS[rest];
  if (!target) return null;
  const prefix = localeMatch ? localeMatch[0] : '';
  return NextResponse.redirect(new URL(`${prefix}${target}${search}`, request.url), 307);
}

function localeRouting(request: NextRequest, requestHeaders: Headers): NextResponse | null {
  const legacy = legacyRedirect(request);
  if (legacy) return legacy;

  const { pathname, search } = request.nextUrl;

  // zh 前缀（2026-09-26 语言切换零副作用）：内部同样 rewrite 到 /en/**，
  // 与无前缀形态共用同一棵路由树——跨语言软导航命中同键客户端缓存、
  // 页面树不重挂载（表单/图表/弹窗等组件状态全保）。展示语言不走路由段，
  // 由 x-locale 请求头下传（URL 前缀仍是语言唯一真源）。
  if (pathname === '/zh' || pathname.startsWith('/zh/')) {
    requestHeaders.set('x-locale', 'zh');
    const target = new URL(
      `/en${pathname === '/zh' ? '' : pathname.slice(3)}${search}`,
      request.url,
    );
    return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  }

  // 旧 /en/** 地址暂保持可达，上线前补 301 收敛
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    // 生产环境 rewrite 目标会二次进入 proxy：首跳已写入的 x-locale（zh）不得覆写
    if (!requestHeaders.get('x-locale')) requestHeaders.set('x-locale', 'en');
    return null;
  }

  if (pathname === '/' && request.cookies.get(LOCALE_COOKIE)?.value === 'zh') {
    return NextResponse.redirect(new URL(`/zh${search}`, request.url));
  }

  // 其余页面路径 = 英文内容：内部 rewrite 到 /en/**，URL 栏保持无前缀
  if (!requestHeaders.get('x-locale')) requestHeaders.set('x-locale', 'en');
  const target = new URL(`/en${pathname === '/' ? '' : pathname}${search}`, request.url);
  return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest) {
  const nonce = buildNonce();
  const dev = process.env.NODE_ENV === 'development';
  const csp = cspHeader(nonce, dev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const routed = localeRouting(request, requestHeaders);
  if (routed) return routed;

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // paint/ = Paint Worklet 静态资产（public/paint/**，需原样 URL 加载，不走 locale rewrite）
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|paint/).*)'],
};
