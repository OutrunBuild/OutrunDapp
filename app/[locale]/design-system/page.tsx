import type { Metadata } from 'next';

import { DesignSystemShowcase } from '@/components/design-system/showcase';
import { getCopy } from '@/components/global/copy';
import { getDisplayLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return {
    title: copy.meta.designSystem,
    robots: { index: false, follow: false },
  };
}

export default async function DesignSystemPage() {
  const locale = await getDisplayLocale();
  return <DesignSystemShowcase locale={locale} />;
}
