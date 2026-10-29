import type { Metadata } from 'next';

import { CreatePage } from '@/components/create/create-page';
import { getCopy } from '@/components/global/copy';
import { getDisplayLocale } from '@/lib/locale';

// Page-level title only: the create h1 renders as one string ('Consensus Launch'), so the title
// reuses that exact composition; the '%s · Outrun' template supplies the suffix.
export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return { title: `${copy.create.titleLead} ${copy.create.titleAccent}` };
}

export default async function LocalizedCreate() {
  const locale = await getDisplayLocale();
  return <CreatePage locale={locale} />;
}
