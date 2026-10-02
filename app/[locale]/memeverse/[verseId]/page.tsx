import { redirect } from 'next/navigation';

import { VersePage } from '@/components/verse/verse-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedVerse({
  params,
}: {
  params: Promise<{ locale: string; verseId: string }>;
}) {
  const [{ verseId }, locale] = await Promise.all([params, getDisplayLocale()]);
  // 旧版 verse-021 形态收敛到数字段（canonical = /memeverse/<verseId 数字>；307 避免原型期浏览器缓存）
  const legacy = /^verse-(\d+)$/i.exec(verseId);
  if (legacy) {
    const numeric = String(Number(legacy[1]));
    redirect(locale === 'zh' ? `/zh/memeverse/${numeric}` : `/memeverse/${numeric}`);
  }
  return <VersePage locale={locale} verseId={verseId} />;
}
