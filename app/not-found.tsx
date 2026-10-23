import Link from 'next/link';

import { getCopy } from '@/components/global/copy';
import { RouteFallback } from '@/components/global/route-fallback';
import { localePath } from '@/components/global/routes';
import { Button } from '@/components/ui/button';
import { getDisplayLocale } from '@/lib/locale';

// Root-level boundary: proxy.ts rewrites every external URL to /en/**, so the [locale]
// tree catches all traffic and unmatched paths bubble up to this single not-found file.
export default async function NotFound() {
  const locale = await getDisplayLocale();
  const copy = getCopy(locale).common.routeFallback;

  return (
    <RouteFallback tone="neutral" title={copy.notFoundTitle} body={copy.notFoundBody}>
      <Button
        className="ax-ghost-cta"
        size="lg"
        nativeButton={false}
        render={<Link href={localePath(locale, '/')} />}
      >
        {copy.backHome}
      </Button>
    </RouteFallback>
  );
}
