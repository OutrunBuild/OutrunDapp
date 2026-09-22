import { notFound, redirect } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';
import { VersePage } from '@/components/prototype/verse-page';

export default async function LocalizedVerse({
  params,
}: {
  params: Promise<{ locale: string; verseId: string }>;
}) {
  const { locale, verseId } = await params;
  if (!isLocale(locale)) notFound();
  // 旧版 verse-021 形态收敛到数字段（canonical = /memeverse/<verseId 数字>；307 避免原型期浏览器缓存）
  const legacy = /^verse-(\d+)$/i.exec(verseId);
  if (legacy) {
    const numeric = String(Number(legacy[1]));
    redirect(locale === 'zh' ? `/zh/memeverse/${numeric}` : `/memeverse/${numeric}`);
  }
  return <VersePage locale={locale} verseId={verseId} />;
}
