// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetWalletLink,
  readWalletLink,
  rememberWalletLink,
} from '../../../lib/web3/session-hint';

beforeEach(() => {
  window.localStorage.clear();
});

describe('wallet-link marker (injected session across refresh)', () => {
  it('is absent on a clean browser', () => {
    expect(readWalletLink()).toBeNull();
  });

  it('round-trips the MetaMask link', () => {
    rememberWalletLink('metamask');
    expect(readWalletLink()).toBe('metamask');
  });

  it('clears on intentional disconnect', () => {
    rememberWalletLink('metamask');
    forgetWalletLink();
    expect(readWalletLink()).toBeNull();
  });

  it('ignores unknown or corrupted values', () => {
    window.localStorage.setItem('outrun:wallet-link', 'coinbase');
    expect(readWalletLink()).toBeNull();
    window.localStorage.setItem('outrun:wallet-link', '');
    expect(readWalletLink()).toBeNull();
  });
});
