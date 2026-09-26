import { headers } from 'next/headers';

import type { Locale } from '@/lib/data/prototype-repository';

/**
 * 展示语言来源（2026-09-26 语言切换零副作用方案）：
 * URL 前缀仍是语言唯一真源——proxy 把 /zh/** 与无前缀形态统一 rewrite 到
 * /en/** 内部路由（跨语言软导航命中同键缓存、不重挂载页面树），并把
 * URL 口径的语言写入 x-locale 请求头；页面渲染语言一律从这里取，
 * 不再读 params.locale（内部恒为 'en'）。头缺失时回退 'en'。
 */
export async function getDisplayLocale(): Promise<Locale> {
  const headerList = await headers();
  return headerList.get('x-locale') === 'zh' ? 'zh' : 'en';
}
