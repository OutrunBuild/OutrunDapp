// MemeverseLauncher vesting storage layout. The launcher keeps the preorder schedule in
// ERC-7201 namespaced storage with no public view, so the claim center and its RUN_NET_REPRO
// regression test must derive the same slots — they import this module instead of each
// re-implementing the double-keccak formula (a copied formula drifts silently).
import { encodePacked, keccak256, toHex } from 'viem'

/** ERC-7201 base: keccak(bytes32(keccak(namespace) − 1)) & ~0xff. */
export const LAUNCHER_BASE = (() => {
  const h1 = BigInt(keccak256(toHex('outrun.storage.MemeverseLauncher')))
  const inner = toHex((h1 - 1n) % (1n << 256n), { size: 32 })
  return BigInt(keccak256(inner)) & ~0xffn
})()

/** Append-only struct offsets: preorderVestingDuration @ +11, preorderStates mapping @ +18. */
export const PREORDER_VESTING_DURATION_OFFSET = 11n
export const PREORDER_STATES_OFFSET = 18n
/** PreorderState.settlementTimestamp sits at entry + 2 (uint40, packed in the word's low bytes). */
export const PREORDER_SETTLEMENT_TIMESTAMP_OFFSET = 2n

export function preorderVestingDurationSlot(base: bigint = LAUNCHER_BASE): bigint {
  return base + PREORDER_VESTING_DURATION_OFFSET
}

export function preorderStateEntrySlot(verseId: bigint, base: bigint = LAUNCHER_BASE): bigint {
  return BigInt(
    keccak256(encodePacked(['uint256', 'uint256'], [verseId, base + PREORDER_STATES_OFFSET])),
  )
}

export function preorderSettlementTimestampSlot(
  verseId: bigint,
  base: bigint = LAUNCHER_BASE,
): bigint {
  return preorderStateEntrySlot(verseId, base) + PREORDER_SETTLEMENT_TIMESTAMP_OFFSET
}
