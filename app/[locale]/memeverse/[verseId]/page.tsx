import { redirect } from 'next/navigation';

import { VersePage } from '@/components/verse/verse-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedVerse({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; verseId: string }>;
  searchParams: Promise<{ tab?: string; action?: string }>;
}) {
  const [{ verseId }, search, locale] = await Promise.all([
    params,
    searchParams,
    getDisplayLocale(),
  ]);
  // 旧版 verse-021 形态收敛到数字段（canonical = /memeverse/<verseId 数字>；307 避免原型期浏览器缓存）
  const legacy = /^verse-(\d+)$/i.exec(verseId);
  if (legacy) {
    const numeric = String(Number(legacy[1]));
    const query = new URLSearchParams();
    if (search.tab) query.set('tab', search.tab);
    if (search.action) query.set('action', search.action);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    redirect(
      locale === 'zh' ? `/zh/memeverse/${numeric}${suffix}` : `/memeverse/${numeric}${suffix}`,
    );
  }
  return <VersePage locale={locale} verseId={verseId} tab={search.tab} action={search.action} />;
}
