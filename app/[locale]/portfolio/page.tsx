import { PortfolioPage } from '@/components/prototype/portfolio-page';
import { getDisplayLocale } from '@/lib/locale';

export default async function LocalizedPortfolio() {
  const locale = await getDisplayLocale();
  return <PortfolioPage locale={locale} />;
}
