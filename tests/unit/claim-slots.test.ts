// Claim-center vesting slots: the launcher keeps the preorder schedule in ERC-7201 namespaced
// storage with no public view, so a drifted slot derivation silently reads some other field and
// the progress clock renders a wrong percentage. The literals below are the OZ SlotDerivation
// values (double keccak, ~0xff mask, append-only struct offsets) — both the component and the
// RUN_NET_REPRO regression test consume the same module, so a change here trips this test.
import { describe, expect, it } from 'vitest';

import {
  LAUNCHER_BASE,
  preorderSettlementTimestampSlot,
  preorderStateEntrySlot,
  preorderVestingDurationSlot,
  PREORDER_SETTLEMENT_TIMESTAMP_OFFSET,
  PREORDER_STATES_OFFSET,
  PREORDER_VESTING_DURATION_OFFSET,
} from '../../components/verse/claim-slots';

const toHex32 = (value: bigint) => `0x${value.toString(16).padStart(64, '0')}`;

describe('launcher vesting slot derivation', () => {
  it('derives the documented ERC-7201 base for "outrun.storage.MemeverseLauncher"', () => {
    // component-contract.md §38 pins the base as 0xe4d6…8f500
    expect(toHex32(LAUNCHER_BASE)).toBe(
      '0xe4d68b4f0bdabf27c869795dba7c9a87fd97b24006928b28f58769be5bd8f500',
    );
  });

  it('keeps the append-only struct offsets (+11 duration, +18 states, +2 settlement)', () => {
    expect(PREORDER_VESTING_DURATION_OFFSET).toBe(11n);
    expect(PREORDER_STATES_OFFSET).toBe(18n);
    expect(PREORDER_SETTLEMENT_TIMESTAMP_OFFSET).toBe(2n);
  });

  it('places the vesting duration at base+11', () => {
    expect(toHex32(preorderVestingDurationSlot())).toBe(
      '0xe4d68b4f0bdabf27c869795dba7c9a87fd97b24006928b28f58769be5bd8f50b',
    );
  });

  it('maps a verse id onto the preorderStates entry and its settlement field', () => {
    const entry = preorderStateEntrySlot(1n);
    expect(toHex32(entry)).toBe(
      '0x79cf597aecb76ebe064c8a4d74a2a4587f57b855ba1103300e6bb9aa1baa7d3b',
    );
    // entry +2 inside the same packed word (uint40, low 5 bytes)
    expect(toHex32(preorderSettlementTimestampSlot(1n))).toBe(
      '0x79cf597aecb76ebe064c8a4d74a2a4587f57b855ba1103300e6bb9aa1baa7d3d',
    );
  });

  it('separates two verses into different mapping entries', () => {
    expect(preorderStateEntrySlot(1n)).not.toBe(preorderStateEntrySlot(2n));
  });
});
