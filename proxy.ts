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

function localeRouting(request: NextRequest, requestHeaders: Headers): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  // zh 前缀路径原样；旧 /en/** 地址暂保持可达，上线前补 301 收敛
  if (
    pathname === '/zh' ||
    pathname.startsWith('/zh/') ||
    pathname === '/en' ||
    pathname.startsWith('/en/')
  ) {
    return null;
  }

  if (pathname === '/' && request.cookies.get(LOCALE_COOKIE)?.value === 'zh') {
    return NextResponse.redirect(new URL(`/zh${search}`, request.url));
  }

  // 其余页面路径 = 英文内容：内部 rewrite 到 /en/**，URL 栏保持无前缀
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)'],
};
