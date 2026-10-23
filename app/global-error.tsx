'use client';

import { useEffect } from 'react';

import { productFontClassName } from '@/components/design-system/fonts';
import { getCopy } from '@/components/global/copy';
import { RouteFallback } from '@/components/global/route-fallback';
import { localeFromPathname } from '@/components/global/routes';
import { Button } from '@/components/ui/button';

import './globals.css';

// Root-layout crash boundary: replaces the whole document, so it must be
// self-contained (own globals import, own html/body, font class). The paint film and
// scanlines from the root layout are absent here by design — this surface only needs
// to stay legible and offer Retry (Next 16 `retry` prop).
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const locale = localeFromPathname(typeof window === 'undefined' ? '/' : window.location.pathname);
  const copy = getCopy(locale).common.routeFallback;

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body className={productFontClassName}>
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
      </body>
    </html>
  );
}
