import { PortfolioPage } from '@/components/portfolio/portfolio-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedPortfolio({
  searchParams,
}: {
  searchParams: Promise<{ claimable?: string }>;
}) {
  const locale = await getDisplayLocale();
  const params = await searchParams;
  return <PortfolioPage locale={locale} claimable={params.claimable} />;
}
