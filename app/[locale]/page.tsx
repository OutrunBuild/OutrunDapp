import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HomePage } from '@/components/prototype/home-page';
import { isLocale } from '@/components/prototype/copy';

type LocalizedHomeProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LocalizedHomeProps): Promise<Metadata> {
  const { locale } = await params;

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

export default async function LocalizedHome({ params }: LocalizedHomeProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomePage locale={locale} />;
}
