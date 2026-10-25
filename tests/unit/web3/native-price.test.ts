// Chainlink round validation: a stale, non-positive, or malformed round must read as
// "no price" — the gas control hides its USD line rather than showing a dead number.
import { describe, expect, it } from 'vitest';

import { chainlinkAnswerToUsd, MAX_PRICE_AGE_SEC } from '../../../lib/web3/native-price';

const NOW = 1_800_000_000;

describe('chainlinkAnswerToUsd', () => {
  it('normalizes a fresh 8-decimal answer', () => {
    expect(
      chainlinkAnswerToUsd({ answer: 74_280_890_000n, decimals: 8, updatedAt: NOW - 60, now: NOW }),
    ).toBeCloseTo(742.8089, 4);
  });

  it('rejects a stale round', () => {
    expect(
      chainlinkAnswerToUsd({
        answer: 74_280_890_000n,
        decimals: 8,
        updatedAt: NOW - MAX_PRICE_AGE_SEC - 1,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('rejects non-positive and malformed rounds', () => {
    expect(chainlinkAnswerToUsd({ answer: 0n, decimals: 8, updatedAt: NOW, now: NOW })).toBeNull();
    expect(chainlinkAnswerToUsd({ answer: -1n, decimals: 8, updatedAt: NOW, now: NOW })).toBeNull();
    expect(
      chainlinkAnswerToUsd({ answer: 100n, decimals: 99, updatedAt: NOW, now: NOW }),
    ).toBeNull();
    expect(chainlinkAnswerToUsd({ answer: 100n, decimals: 8, updatedAt: 0, now: NOW })).toBeNull();
  });
});
