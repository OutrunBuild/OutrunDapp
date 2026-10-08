import type { Metadata } from 'next';

import { getCopy } from '@/components/global/copy';
import { HomePage } from '@/components/home/home-page';
import { getDisplayLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return {
    title: copy.meta.homeTitle,
    description: copy.meta.homeDescription,
  };
}

export default async function LocalizedHome() {
  const locale = await getDisplayLocale();
  return <HomePage locale={locale} />;
}
