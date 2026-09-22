import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DesignSystemShowcase } from '@/components/design-system/showcase';
import { isLocale } from '@/components/prototype/copy';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: 'Outrun Design System',
  robots: { index: false, follow: false },
};

export default async function DesignSystemPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DesignSystemShowcase locale={locale} />;
}
