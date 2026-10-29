// Faucet cooldown slots: claim() gates on tokenInfos[token].lastClaimed[user] read straight out
// of storage (no view function). A wrong key derivation reads some other account's cooldown and
// the button flips to claimable early. The literals below are the keccak256(abi.encode(key,
// slot)) values for the Faucet layout (forge inspect: _owner=0, tokenInfos=1, lastClaimed@base+1).
import { describe, expect, it } from 'vitest';

import { faucetLastClaimedSlot, mappingSlot } from '../../components/faucet/faucet-claims';

const TOKEN = '0x1111111111111111111111111111111111111111' as const;
const USER = '0x2222222222222222222222222222222222222222' as const;

describe('faucet storage slot derivation', () => {
  it('hashes a mapping key against its slot (literal vector)', () => {
    // keccak256(abi.encode(token, 1)) — the tokenInfos entry base
    expect(mappingSlot(TOKEN, 1n)).toBe(
      '0x8eec1c9afb183a84aac7003cf8e730bfb6385f6e43761d6425fba4265de3a9eb',
    );
  });

  it("normalizes the key's case — checksummed and lowercase addresses share a slot", () => {
    const checksummed = '0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd' as const;
    expect(mappingSlot(checksummed, 1n)).toBe(
      mappingSlot(checksummed.toLowerCase() as typeof checksummed, 1n),
    );
  });

  it('nests the inner mapping: lastClaimed[user] lives at entry base + 1', () => {
    // tokenBase = keccak256(token . tokenInfosSlot); the nested mapping hashes the USER against
    // (tokenBase + 1), NOT against tokenBase — off-by-one here reads dailyLimit as a timestamp.
    const tokenBase = BigInt(mappingSlot(TOKEN, 1n));
    expect(faucetLastClaimedSlot(TOKEN, USER)).toBe(mappingSlot(USER, tokenBase + 1n));
  });

  it('separates users and tokens (literal vector for the composed slot)', () => {
    expect(faucetLastClaimedSlot(TOKEN, USER)).toBe(
      '0x549f5d0fc76077c5f89374add50ee1806d89e7f66762b0b5368a27fd1e261001',
    );
    expect(
      faucetLastClaimedSlot(TOKEN, '0x3333333333333333333333333333333333333333' as const),
    ).not.toBe(faucetLastClaimedSlot(TOKEN, USER));
    expect(
      faucetLastClaimedSlot('0x4444444444444444444444444444444444444444' as const, USER),
    ).not.toBe(faucetLastClaimedSlot(TOKEN, USER));
  });
});
