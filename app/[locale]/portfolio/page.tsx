import { notFound } from 'next/navigation';

import { isLocale } from '@/components/prototype/copy';
import { PortfolioPage } from '@/components/prototype/portfolio-page';

export default async function LocalizedPortfolio({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PortfolioPage locale={locale} />;
}
