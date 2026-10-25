import { redirect } from 'next/navigation';

import { localePath } from '@/components/global/routes';
import { getDisplayLocale } from '@/lib/locale';

/** Memeverse section root: the domain has no page of its own — detail is
 *  /memeverse/<verseId>, discovery /memeverse/explore, create /memeverse/launch.
 *  A bare /memeverse used to fall through to 404, which also broke same-origin
 *  fetches of the current URL (wallet SDKs read the COOP header from it), so the
 *  section root converges on the listing the nav entry points at. */
export default async function LocalizedMemeverseIndex() {
  const locale = await getDisplayLocale();
  redirect(localePath(locale, '/memeverse/explore'));
}
