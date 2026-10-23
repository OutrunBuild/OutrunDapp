// Locale mapping for transaction-center error kinds (copy §wallet.errors, 决议 033).
// lib/web3 only carries kind codes; every user-facing line resolves here per locale:
// single short sentences with no interpolated values (2026-10-04).
import type { Locale } from '@/lib/data/fixture-repository';
import type { RevertKind } from '@/lib/web3/kernel';
import type { TxErrorKind } from '@/lib/web3/tx-center';

import { getCopy } from './copy';

export function txErrorText(locale: Locale, kind: TxErrorKind | RevertKind): string {
  const wallet = getCopy(locale).wallet;
  const errors = wallet.errors;
  switch (kind) {
    case 'simulation':
      return errors.simulation;
    case 'reverted':
      return errors.reverted;
    case 'replaced':
      return errors.replaced;
    case 'gas':
      return errors.gas;
    case 'wrong-network':
      return wallet.account.wrongNetworkBody;
    case 'wallet-unsupported':
      return wallet.account.callsUnsupported;
    case 'batch-reverted':
      return errors.batch;
    case 'kernel-error':
      return errors.kernel;
    case 'error-string':
      return errors.reason;
    case 'panic':
      return errors.panic;
    case 'claim-too-soon':
      return getCopy(locale).faucet.claimedHint;
    case 'unknown':
      return errors.unknown;
  }
}
