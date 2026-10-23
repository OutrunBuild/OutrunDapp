'use client';

import type { ReactNode } from 'react';

// Route-level fallback composition shared by app/not-found.tsx / error.tsx /
// global-error.tsx: shell-less centered card on the root-layout canvas (scanlines and
// the paint film already live at body level); the .empty-state signal language at page
// scale — misregistered-echo h1, secondary body, one yellow ghost CTA (passed as
// children by each caller), optional digest line (production RSC errors are redacted
// to the digest — the only server-log correlation id the client ever sees).
export function RouteFallback({
  tone,
  title,
  body,
  digestLabel,
  digest,
  children,
}: {
  tone: 'neutral' | 'danger';
  title: string;
  body: string;
  digestLabel?: string;
  digest?: string;
  children: ReactNode;
}) {
  return (
    <div className="route-fallback">
      <div className="route-fallback__card" data-tone={tone}>
        <h1>{title}</h1>
        <p>{body}</p>
        {children}
        {digest ? (
          <p className="route-fallback__digest" data-numeric>
            {`${digestLabel} ${digest}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
