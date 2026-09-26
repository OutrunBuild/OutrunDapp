import type { Metadata } from 'next';

import { DesignSystemShowcase } from '@/components/design-system/showcase';
import { getDisplayLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'Outrun Design System',
  robots: { index: false, follow: false },
};

export default async function DesignSystemPage() {
  const locale = await getDisplayLocale();
  return <DesignSystemShowcase locale={locale} />;
}
