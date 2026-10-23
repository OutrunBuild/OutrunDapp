'use client';

import { useEffect } from 'react';

import { getCopy } from '@/components/global/copy';
import { RouteFallback } from '@/components/global/route-fallback';
import { localeFromPathname } from '@/components/global/routes';
import { Button } from '@/components/ui/button';

// Route-segment error boundary (client-only surface; Next 16 recovery prop is `retry` —
// re-fetch and re-render the boundary's children). Rendering language comes from the
// visible URL prefix: the x-locale request header is not readable on the client.
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Error reporting hook — the Sentry wiring point once instrumentation lands
    console.error(error);
  }, [error]);

  const copy = getCopy(
    localeFromPathname(typeof window === 'undefined' ? '/' : window.location.pathname),
  ).common.routeFallback;

  return (
    <RouteFallback
      tone="danger"
      title={copy.errorTitle}
      body={copy.errorBody}
      digestLabel={copy.digestLabel}
      digest={error.digest}
    >
      <Button className="ax-ghost-cta" size="lg" onClick={() => retry()}>
        {copy.retry}
      </Button>
    </RouteFallback>
  );
}
