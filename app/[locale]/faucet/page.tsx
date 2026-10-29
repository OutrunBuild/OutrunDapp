import type { Metadata } from 'next';

import { FaucetPage } from '@/components/faucet/faucet-page';
import { getCopy } from '@/components/global/copy';
import { getDisplayLocale } from '@/lib/locale';

// Page-level title only: the root layout's '%s · Outrun' template turns it into 'Faucet · Outrun'
// (description stays the root default — there is no OG/Twitter surface consuming a page description)
export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return { title: copy.faucet.title };
}

export default async function LocalizedFaucet() {
  const locale = await getDisplayLocale();
  return <FaucetPage locale={locale} />;
}
