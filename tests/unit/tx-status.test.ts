// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { getCopy } from '../../components/global/copy';
import { TxStatus, type TxState } from '../../components/global/tx-status';

function render(state: TxState): string {
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

  it('tells a broadcast cancel apart from a declined request', () => {
    const copy = getCopy('en').verse;
    const sent = render('cancelled-after-send');
    expect(sent).toContain(copy.txCancelledAfterSendNote);
    expect(sent).not.toContain(copy.txCancelledNote);
    // Style hook + a11y role must stay on the cancelled branch, not the failure one.
    expect(sent).toContain('data-outcome="cancelled"');
    expect(sent).toContain('role="status"');

    const declined = render('cancelled');
    expect(declined).toContain(copy.txCancelledNote);
    expect(declined).not.toContain(copy.txCancelledAfterSendNote);
  });
});
