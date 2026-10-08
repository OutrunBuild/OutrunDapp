import { headers } from 'next/headers';

import { ReferralPage } from '@/components/referral/referral-page';
import { getDisplayLocale } from '@/lib/locale';

/** /referral（R-12）：host 头只用于拼邀请链接 URL（SSR 定值，无水合闪变） */
export default async function LocalizedReferral() {
  const locale = await getDisplayLocale();
  const host = (await headers()).get('host');
  return <ReferralPage locale={locale} host={host} />;
}
