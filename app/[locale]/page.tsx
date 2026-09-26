import type { Metadata } from 'next';

import { HomePage } from '@/components/prototype/home-page';
import { getDisplayLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getDisplayLocale();

  if (locale === 'zh') {
    return {
      title: '社区所有的链上经济体',
      description: '让一次共识成为持续运转的链上经济体，以流动性、收益与社区治理延续共同价值。',
    };
  }

  return {
    title: 'Community-owned Onchain Economies',
    description:
      'Turn shared belief into a living onchain economy with coordinated liquidity, yield and community governance.',
  };
}

export default async function LocalizedHome() {
  const locale = await getDisplayLocale();
  return <HomePage locale={locale} />;
}
