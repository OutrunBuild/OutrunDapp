import { redirect } from 'next/navigation';

import { narrowVerseQuery, verseHref } from '@/components/global/routes';
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
    const { tab, action } = narrowVerseQuery(search);
    redirect(verseHref(locale, verseId, tab, action));
  }
  return <VersePage locale={locale} verseId={verseId} tab={search.tab} action={search.action} />;
}
