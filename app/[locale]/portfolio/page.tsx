import type { Metadata } from 'next';

import { getCopy } from '@/components/global/copy';
import { PortfolioPage } from '@/components/portfolio/portfolio-page';
import { getDisplayLocale } from '@/lib/locale';

// Page-level title only: the root layout's '%s · Outrun' template turns it into 'Portfolio · Outrun'
export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return { title: copy.portfolio.title };
}

export default async function LocalizedPortfolio() {
  const locale = await getDisplayLocale();
  return <PortfolioPage locale={locale} />;
}
