import { headers } from 'next/headers';

import { ReferralPage } from '@/components/referral/referral-page';
import { getDisplayLocale } from '@/lib/locale';

/** /referral: the host header is only used to assemble the invite-link URL (SSR-determined value, no hydration flicker) */
export default async function LocalizedReferral() {
  const locale = await getDisplayLocale();
  const host = (await headers()).get('host');
  return <ReferralPage locale={locale} host={host} />;
}
