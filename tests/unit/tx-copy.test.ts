// Transaction error copy contract tests (决议 033): every center/revert kind resolves in
// both locales to a single short line with no interpolated values.
import { describe, expect, it } from 'vitest';

import type { RevertKind } from '../../lib/web3/kernel';
import type { TxErrorKind } from '../../lib/web3/tx-center';
import { txErrorText } from '../../components/global/tx-copy';

const KINDS: (TxErrorKind | RevertKind)[] = [
  'simulation',
  'reverted',
  'replaced',
  'gas',
  'wrong-network',
  'batch-reverted',
  'kernel-error',
  'error-string',
  'panic',
  'claim-too-soon',
  'unknown',
];

// Durations are mechanism facts (the 24h faucet cooldown), not interpolated values.
const KINDS_WITH_DURATION = new Set(['claim-too-soon']);

describe('txErrorText', () => {
  it('covers every kind in both locales with single lines and no values', () => {
    for (const locale of ['en', 'zh'] as const) {
      for (const kind of KINDS) {
        const line = txErrorText(locale, kind);
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain('\n');
        if (!KINDS_WITH_DURATION.has(kind)) {
          expect(line).not.toMatch(/[0-9]/);
        }
      }
    }
  });

  it('keeps locales distinct', () => {
    expect(txErrorText('en', 'gas')).not.toBe(txErrorText('zh', 'gas'));
  });
});
