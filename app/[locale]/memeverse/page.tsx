import { notFound } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';
import { DiscoveryPage } from '@/components/prototype/discovery-page';

export default async function LocalizedDiscovery({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  return <DiscoveryPage locale={locale} searchParams={query} />;
}
