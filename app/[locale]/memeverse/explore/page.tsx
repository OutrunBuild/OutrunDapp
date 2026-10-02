import { DiscoveryPage } from '@/components/discovery/discovery-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedDiscovery({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, query] = await Promise.all([getDisplayLocale(), searchParams]);
  return <DiscoveryPage locale={locale} searchParams={query} />;
}
