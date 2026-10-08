// proxy x-locale 头语义单测（P0-1 修复护栏）：URL 前缀是语言唯一真源，
// x-locale 只能由 proxy 按 URL 口径写入——无前缀分支必须无条件覆写客户端
// 预置值（内部 rewrite 目标恒为 /en/**，不会重入该分支）；旧 /en/** 直达
// 307 收敛到无前缀（入口消失 = 伪造面消失）；LEGACY_PATHS 旧地址 307 收敛。
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { proxy } from '../../proxy';

function requestFor(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), { headers });
}

/** proxy 修改后的请求头经 x-middleware-request-* 暴露在响应上（next/server 桥接语义） */
function forwardedLocale(res: Response): string | null {
  return res.headers.get('x-middleware-request-x-locale');
}

describe('proxy x-locale（URL 前缀 = 语言唯一真源）', () => {
  it('无前缀：客户端预置 x-locale: zh 被覆写为 en（伪造面封死）', () => {
    const res = proxy(requestFor('/', { 'x-locale': 'zh' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en');
    expect(forwardedLocale(res)).toBe('en');
  });

  it('无前缀：无头默认 en', () => {
    const res = proxy(requestFor('/memeverse/explore'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/memeverse/explore');
    expect(forwardedLocale(res)).toBe('en');
  });

  it('/zh：无条件写 zh，预置 en 头不生效', () => {
    const res = proxy(requestFor('/zh/memeverse/21', { 'x-locale': 'en' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/memeverse/21');
    expect(forwardedLocale(res)).toBe('zh');
  });

  it('/en 直达：307 收敛到无前缀 canonical，伪造头不再有渲染面', () => {
    const res = proxy(requestFor('/en/portfolio', { 'x-locale': 'zh' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/portfolio');
  });

  it('/en 根路径与 query 收敛保真', () => {
    expect(proxy(requestFor('/en')).headers.get('location')).toBe('http://localhost/');
    expect(proxy(requestFor('/en/memeverse/launch?tab=pol')).headers.get('location')).toBe(
      'http://localhost/memeverse/launch?tab=pol',
    );
  });

  it('旧地址收敛（LEGACY_PATHS）：307 到新域，locale 前缀与 query 保真', () => {
    const res = proxy(requestFor('/launch'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/memeverse/launch');
    expect(proxy(requestFor('/memeverse')).headers.get('location')).toBe(
      'http://localhost/memeverse/explore',
    );
    // /en/launch 整链第一跳：legacyRedirect 保留 /en 前缀（第二跳由上一用例覆盖）
    expect(proxy(requestFor('/en/launch?tab=pol')).headers.get('location')).toBe(
      'http://localhost/en/memeverse/launch?tab=pol',
    );
    expect(proxy(requestFor('/zh/memeverse')).headers.get('location')).toBe(
      'http://localhost/zh/memeverse/explore',
    );
  });
});
