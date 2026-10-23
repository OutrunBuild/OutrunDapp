// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { TxStatus } from '../../components/global/tx-status';

function render(state: 'signing' | 'confirming' | 'confirmed'): string {
  return renderToString(createElement(TxStatus, { locale: 'en', state }));
}

describe('TxStatus terminal rendering', () => {
  it('confirmed shows all steps done with no spinner (never spins on settled state)', () => {
    const html = render('confirmed');
    expect(html).not.toContain('tx-status__spinner');
    expect(html.match(/data-state="done"/g)).toHaveLength(3);
  });

  it('confirming still spins only on the in-progress step', () => {
    const html = render('confirming');
    expect(html.match(/tx-status__spinner/g)).toHaveLength(1);
    expect(html).toContain('data-state="active"');
    expect(html).toContain('data-state="pending"');
  });
});
