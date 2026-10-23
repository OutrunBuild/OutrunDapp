// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  beginDisconnect,
  endDisconnect,
  isDisconnecting,
  releaseDisconnectStorage,
} from '../../lib/web3/disconnect-guard';

beforeEach(() => {
  endDisconnect();
});

describe('disconnect-guard (intentional-disconnect window)', () => {
  it('rests clear: no window flagged', () => {
    expect(isDisconnecting()).toBe(false);
  });

  it('flags the window between begin and end', () => {
    beginDisconnect();
    expect(isDisconnecting()).toBe(true);
    endDisconnect();
    expect(isDisconnecting()).toBe(false);
  });

  it('memory flag carries the guard when sessionStorage is unavailable', () => {
    const getItem = window.sessionStorage.getItem;
    const setItem = window.sessionStorage.setItem;
    const removeItem = window.sessionStorage.removeItem;
    window.sessionStorage.getItem = () => {
      throw new Error('denied');
    };
    window.sessionStorage.setItem = () => {
      throw new Error('denied');
    };
    window.sessionStorage.removeItem = () => {
      throw new Error('denied');
    };
    try {
      beginDisconnect();
      expect(isDisconnecting()).toBe(true);
      endDisconnect();
      expect(isDisconnecting()).toBe(false);
    } finally {
      window.sessionStorage.getItem = getItem;
      window.sessionStorage.setItem = setItem;
      window.sessionStorage.removeItem = removeItem;
    }
    expect(isDisconnecting()).toBe(false);
  });

  it('a stale stored stamp is ignored and cleaned up (survived a reload)', () => {
    window.sessionStorage.setItem('outrun:disconnecting', String(Date.now() - 120_000));
    expect(isDisconnecting()).toBe(false);
    expect(window.sessionStorage.getItem('outrun:disconnecting')).toBeNull();
  });

  it('a legacy boolean flag ("1") is treated as stale', () => {
    window.sessionStorage.setItem('outrun:disconnecting', '1');
    expect(isDisconnecting()).toBe(false);
    expect(window.sessionStorage.getItem('outrun:disconnecting')).toBeNull();
  });

  it('the in-page guard never expires, even if the stored stamp is old', () => {
    beginDisconnect();
    // Simulate a long Privy logout whose stored stamp aged out: the memory flag
    // must still block auto-linking in this page.
    window.sessionStorage.setItem('outrun:disconnecting', String(Date.now() - 120_000));
    expect(isDisconnecting()).toBe(true);
  });

  it('a fresh stored stamp keeps the window after a reload', () => {
    window.sessionStorage.setItem('outrun:disconnecting', String(Date.now()));
    expect(isDisconnecting()).toBe(true);
  });

  it('releaseDisconnectStorage clears the reload stamp but keeps the in-page guard', () => {
    beginDisconnect();
    expect(window.sessionStorage.getItem('outrun:disconnecting')).not.toBeNull();
    releaseDisconnectStorage();
    expect(window.sessionStorage.getItem('outrun:disconnecting')).toBeNull();
    // The current page still blocks bounce-back; only a reload may link again.
    expect(isDisconnecting()).toBe(true);
  });

  it('endDisconnect is idempotent: double end stays clear', () => {
    beginDisconnect();
    endDisconnect();
    endDisconnect();
    expect(isDisconnecting()).toBe(false);
  });
});
