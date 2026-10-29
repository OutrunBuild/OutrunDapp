import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { narrowVerseQuery, verseHref } from '@/components/global/routes';
import { getVerseTitle } from '@/components/verse/verse-metadata';
import { VersePage } from '@/components/verse/verse-page';
import { getDisplayLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; verseId: string }>;
}): Promise<Metadata> {
  const { verseId } = await params;
  const title = await getVerseTitle(verseId);
  // Unknown id keeps the root default: the page body owns the notFound() surface
  if (!title) return {};

  return { title };
}

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
  // Legacy verse-021 shape converges to the numeric segment (canonical = /memeverse/<numeric verseId>; 307 so browsers must not cache the redirect while the legacy paths still resolve)
  const legacy = /^verse-(\d+)$/i.exec(verseId);
  if (legacy) {
    const { tab, action } = narrowVerseQuery(search);
    redirect(verseHref(locale, verseId, tab, action));
  }
  return <VersePage locale={locale} verseId={verseId} tab={search.tab} action={search.action} />;
}
