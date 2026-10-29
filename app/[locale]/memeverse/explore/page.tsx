import type { Metadata } from 'next';

import { DiscoveryPage } from '@/components/discovery/discovery-page';
import { getCopy } from '@/components/global/copy';
import { getDisplayLocale } from '@/lib/locale';

// Page-level title only: the root layout's '%s · Outrun' template turns it into 'Explore Communities · Outrun'
export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return { title: copy.discovery.title };
}

export default async function LocalizedDiscovery({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, query] = await Promise.all([getDisplayLocale(), searchParams]);
  return <DiscoveryPage locale={locale} searchParams={query} />;
}
