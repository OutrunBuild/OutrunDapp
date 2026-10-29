// Error boundary retry behavior (previously zero-covered): the fallback CTA must invoke
// the Next 16 `retry` prop — the only recovery path when a route segment or the root
// document crashes. jsdom environment: the click needs a real DOM (the locale arms run
// in route-error-locale.test.ts under node).
// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RouteError from '../../app/error';
import GlobalError from '../../app/global-error';
import { getCopy } from '../../components/global/copy';

vi.mock('@/components/design-system/fonts', () => ({ productFontClassName: 'font-harness' }));

afterEach(cleanup);

describe('error boundary retry wiring', () => {
  it('RouteError CTA invokes the retry prop and reports the error', () => {
    // The reporting hook (the Sentry wiring point in app/error.tsx) fires via effect;
    // the spy both pins that contract and substitutes the sink so the injected error
    // does not flood the run output.
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const retry = vi.fn();
    const error = new Error('render boom') as Error & { digest?: string };
    error.digest = 'dg-1';
    render(createElement(RouteError, { error, retry }));
    fireEvent.click(screen.getByRole('button', { name: getCopy('en').common.routeFallback.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(error);
    reportSpy.mockRestore();
  });

  it('GlobalError renders the document shell with the retry CTA', () => {
    // jsdom has no legal container for an interactive <html> document root, so the shell
    // is asserted on static markup; the retry onClick wiring is the shared RouteFallback
    // + Button pattern exercised interactively above.
    const markup = renderToStaticMarkup(
      createElement(GlobalError, { error: new Error('render boom'), retry: () => undefined }),
    );
    expect(markup).toContain('<html lang="en">');
    expect(markup).toContain('<body');
    expect(markup).toContain(getCopy('en').common.routeFallback.retry);
  });
});
