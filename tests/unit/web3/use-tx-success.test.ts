// @vitest-environment jsdom
// use-tx-success gate tests: the confirmed → success-dialog transition must capture the
// receipt link BEFORE reset clears the tx context, open the success dialog exactly once,
// and never reopen it behind the receipt (single-direction gate).
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TxContext, TxDisplay } from '../../../lib/web3/tx-center';
import { useTxSuccessGate } from '../../../components/global/use-tx-success';

type HarnessTx = {
  display: TxDisplay;
  reset: () => void;
  context: TxContext;
  reviewing: boolean;
  active: boolean;
  executeDirect: () => void;
  executeSession: () => void;
  running: boolean;
};

/**
 * Stateful flow harness: reset() really clears the context back to idle (like the real
 * use-tx-center reset), so a mutant that resets BEFORE capturing the receipt observes a
 * null receipt instead of the landed hash — the ordering is pinned, not just the calls.
 */
function makeFlow(context: Partial<TxContext> = {}) {
  let tx!: HarnessTx;
  let setContext!: React.Dispatch<React.SetStateAction<TxContext>>;
  let setDisplay!: React.Dispatch<React.SetStateAction<TxDisplay>>;
  const reset = vi.fn(() => {
    setContext({
      state: 'Preparing…',
      review: null,
      gasGate: 'ok',
      txHash: null,
      crossChain: null,
      errorKind: null,
    });
    setDisplay('idle');
  });
  function FlowHarness({ children }: { children: (flow: HarnessTx) => React.ReactNode }) {
    const [display, setDisplayState] = useState<TxDisplay>('confirmed');
    const [flowContext, setFlowContext] = useState<TxContext>({
      state: 'Confirmed',
      review: null,
      gasGate: 'ok',
      txHash: null,
      crossChain: null,
      errorKind: null,
      ...context,
    });
    setContext = setFlowContext;
    setDisplay = setDisplayState;
    tx = {
      display,
      reset,
      context: flowContext,
      reviewing: false,
      active: display !== 'idle',
      executeDirect: () => {},
      executeSession: () => {},
      running: false,
    };
    return createElement('div', { 'data-testid': 'flow' }, children(tx));
  }
  return { FlowHarness, getTx: () => tx, reset };
}

function GateProbe({ tx }: { tx: HarnessTx }) {
  const gate = useTxSuccessGate(tx as never);
  return createElement('div', {
    'data-testid': 'state',
    'data-open': gate.successOpen ? 'open' : 'closed',
    'data-receipt': gate.receipt
      ? `${gate.receipt.hash ?? 'null'}@${gate.receipt.chainId ?? 'null'}`
      : 'none',
  });
}

function renderGate(flow: ReturnType<typeof makeFlow>) {
  return render(
    createElement(flow.FlowHarness, {
      children: (tx: HarnessTx) => createElement(GateProbe, { tx }),
    }),
  );
}

describe('useTxSuccessGate: confirmed captures the receipt before reset', () => {
  afterEach(cleanup);

  it('opens the dialog once with the landed hash and chain, then resets the flow', async () => {
    const flow = makeFlow({
      txHash: '0xabc',
      review: { chainId: 97 } as TxContext['review'],
    });
    const view = renderGate(flow);
    // The gate fires on the confirmed frame: capture first, then reset so the progress
    // dialog never re-opens behind the receipt.
    await waitFor(() => expect(flow.reset).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('state').getAttribute('data-open')).toBe('open');
    expect(view.getByTestId('state').getAttribute('data-receipt')).toBe('0xabc@97');
    // The reset really cleared the flow behind the open dialog.
    expect(flow.getTx().display).toBe('idle');
    expect(flow.getTx().context.txHash).toBeNull();
    view.unmount();
  });

  it('pins a null receipt instead of fabricating a link when the hash is missing', async () => {
    // Doubles as the order-inversion killer: a reset-first mutant presents a cleared
    // context to the gate, which must then capture null — never the landed hash.
    const flow = makeFlow({ txHash: null });
    const view = renderGate(flow);
    await waitFor(() => expect(flow.reset).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('state').getAttribute('data-receipt')).toBe('null@null');
    view.unmount();
  });

  it('stays shut on non-confirmed displays and never resets', async () => {
    const flow = makeFlow();
    const view = render(
      createElement(flow.FlowHarness, {
        children: (_tx: HarnessTx) => createElement('div', { 'data-testid': 'state' }, 'idle'),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(flow.reset).not.toHaveBeenCalled();
    view.unmount();
  });

  it('does not reopen after the flow resets back to idle', async () => {
    function Dismissable({ tx }: { tx: HarnessTx }) {
      const gate = useTxSuccessGate(tx as never);
      return createElement('div', {
        'data-testid': 'state',
        'data-open': gate.successOpen ? 'open' : 'closed',
        onClick: () => gate.setSuccessOpen(false),
      });
    }
    const flow = makeFlow({
      txHash: '0xabc',
      review: { chainId: 97 } as TxContext['review'],
    });
    const view = render(
      createElement(flow.FlowHarness, {
        children: (tx: HarnessTx) => createElement(Dismissable, { tx }),
      }),
    );
    await waitFor(() => expect(flow.reset).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('state').getAttribute('data-open')).toBe('open');
    // The user dismisses the receipt; the reset flow must not reopen it behind them.
    act(() => {
      view.getByTestId('state').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(view.getByTestId('state').getAttribute('data-open')).toBe('closed');
    expect(flow.reset).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('pins a null receipt instead of fabricating a link when the hash is missing', async () => {
    const flow = makeFlow({ txHash: null });
    const view = renderGate(flow);
    await waitFor(() => expect(flow.reset).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('state').getAttribute('data-receipt')).toBe('null@null');
    view.unmount();
  });

  it('lets the caller close the success dialog without touching the flow', async () => {
    function Closable({ tx }: { tx: HarnessTx }) {
      const gate = useTxSuccessGate(tx as never);
      const [clicks, setClicks] = useState(0);
      return createElement('div', {
        'data-testid': 'state',
        'data-open': gate.successOpen ? 'open' : 'closed',
        onClick: () => {
          gate.setSuccessOpen(false);
          setClicks(clicks + 1);
        },
      });
    }
    const flow = makeFlow({
      txHash: '0xabc',
      review: { chainId: 97 } as TxContext['review'],
    });
    const view = render(
      createElement(flow.FlowHarness, {
        children: (tx: HarnessTx) => createElement(Closable, { tx }),
      }),
    );
    await waitFor(() => expect(flow.reset).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('state').getAttribute('data-open')).toBe('open');
    const resetsBefore = flow.reset.mock.calls.length;
    act(() => {
      view.getByTestId('state').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(view.getByTestId('state').getAttribute('data-open')).toBe('closed');
    expect(flow.reset.mock.calls.length).toBe(resetsBefore);
    view.unmount();
  });
});
