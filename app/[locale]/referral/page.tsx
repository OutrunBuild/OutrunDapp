import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getCopy } from '@/components/global/copy';
import { ReferralPage } from '@/components/referral/referral-page';
import { getDisplayLocale } from '@/lib/locale';

// Page-level title only: the root layout's '%s · Outrun' template turns it into 'Referral Program · Outrun'
export async function generateMetadata(): Promise<Metadata> {
  const copy = getCopy(await getDisplayLocale());

  return { title: copy.referral.title };
}

/** /referral: the host header is only used to assemble the invite-link URL (SSR-determined value, no hydration flicker) */
export default async function LocalizedReferral() {
  const locale = await getDisplayLocale();
  const host = (await headers()).get('host');
  return <ReferralPage locale={locale} host={host} />;
}
