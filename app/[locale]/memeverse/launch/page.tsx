import { notFound } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';
import { CreatePage } from '@/components/prototype/create-page';

export default async function LocalizedCreate({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CreatePage locale={locale} />;
}
