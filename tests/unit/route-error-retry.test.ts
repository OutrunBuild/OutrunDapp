// Error boundary retry behavior (previously zero-covered): the fallback CTA must invoke
// the Next 16 `retry` prop — the only recovery path when a route segment or the root
// document crashes. jsdom environment: the click needs a real DOM (the locale arms run
// in route-error-locale.test.ts under node).
// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RouteError from '../../app/error';
import GlobalError from '../../app/global-error';
import { getCopy } from '../../components/global/copy';

vi.mock('@/components/design-system/fonts', () => ({ productFontClassName: 'font-harness' }));

afterEach(cleanup);

describe('error boundary retry wiring', () => {
  it('RouteError CTA invokes the retry prop', () => {
    const retry = vi.fn();
    const error = new Error('render boom') as Error & { digest?: string };
    error.digest = 'dg-1';
    render(createElement(RouteError, { error, retry }));
    fireEvent.click(screen.getByRole('button', { name: getCopy('en').common.routeFallback.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('GlobalError CTA invokes the retry prop', () => {
    const retry = vi.fn();
    render(createElement(GlobalError, { error: new Error('render boom'), retry }));
    fireEvent.click(screen.getByRole('button', { name: getCopy('en').common.routeFallback.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
