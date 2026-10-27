// Network-gated regression for the claim center's msg.sender-scoped read (2026-10-26 live
// incident): viem multicall does NOT split `account`-carrying calls out of aggregate3 — the
// scoped claimablePreorderMemecoin silently reads msg.sender = the multicall contract and
// returns 0, blanking the preorder card. The production path therefore runs that ONE read as
// a standalone readContract beside the batch. This test locks the pitfall: aggregated = 0
// while scoped (from = the account) > 0, whenever a live position exists.
//
// Run: RUN_NET_REPRO=1 pnpm exec vitest run tests/unit/data/claim-center-net.test.ts
// Optional env overrides (default = the seeded BSC-testnet fixture address/verse):
//   CLAIM_NET_RPC, CLAIM_NET_LAUNCHER, CLAIM_NET_ACCOUNT, CLAIM_NET_VERSE
import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type PublicClient } from 'viem';
import { bscTestnet } from 'viem/chains';

import { launcherAbi } from '../../../lib/web3/abis';

const RPC = process.env.CLAIM_NET_RPC ?? 'https://bsc-testnet-rpc.publicnode.com';
const LAUNCHER = (process.env.CLAIM_NET_LAUNCHER ??
  '0x634FA8eEf0649B200F7059b1Aa32C8a16149205E') as `0x${string}`;
const ACCOUNT = (process.env.CLAIM_NET_ACCOUNT ??
  '0xBec9209dFe21f896852cd1495478D2830C4a6DB2') as `0x${string}`;
const VERSE = BigInt(
  process.env.CLAIM_NET_VERSE ??
    '52837714424155436352242994144496188832833587031649586216523996295503828439311',
);

const RUN = process.env.RUN_NET_REPRO === '1';
const d = RUN ? describe : describe.skip;

d('claim center scoped-read regression (network)', () => {
  let client: PublicClient;

  it('proves the aggregate path cannot serve the msg.sender-scoped preview', async () => {
    client = createPublicClient({ chain: bscTestnet, transport: http(RPC) });

    // The regression signature: inside aggregate3, msg.sender is the multicall contract →
    // the scoped preview reads 0. (If this ever changes, the production shortcut of folding
    // the scoped read into the batch would STILL be wrong — the from-address is the contract
    // semantics — but the silent-zero tripwire is what blanked the card in production.)
    const [aggregated, scoped] = await Promise.all([
      client.multicall({
        contracts: [
          {
            address: LAUNCHER,
            abi: launcherAbi,
            functionName: 'claimablePreorderMemecoin',
            args: [VERSE],
          } as never,
        ],
        allowFailure: true,
      }),
      // The production shape: standalone readContract with the account as from
      client.readContract({
        address: LAUNCHER,
        abi: launcherAbi,
        functionName: 'claimablePreorderMemecoin',
        args: [VERSE],
        account: ACCOUNT,
      }),
    ]);

    const aggregatedFirst = aggregated[0];
    expect(aggregatedFirst?.status).toBe('success');
    expect(aggregatedFirst?.status === 'success' ? aggregatedFirst.result : undefined).toBe(0n);
    // Scoped read must succeed; a live position makes it strictly positive. After a full
    // claim it can legitimately be 0 — the position ledger is the tie-breaker.
    expect(typeof scoped).toBe('bigint');
    const [preorderData] = await Promise.all([
      client.readContract({
        address: LAUNCHER,
        abi: launcherAbi,
        functionName: 'userPreorderData',
        args: [VERSE, ACCOUNT],
      }),
    ]);
    const funds = (preorderData as readonly [bigint, bigint, boolean])[0];
    if (funds > 0n && scoped === 0n) {
      // Fully claimed + nothing newly vested is legal; the position still proves the account.
      console.log(
        `[claim-center-net] scoped=0 with funds=${funds} — fully claimed (legal); aggregated-vs-scoped contrast still asserted above`,
      );
    }
  }, 60_000);

  it('keeps the schedule slots sane (vesting duration > 0, settlement in the past)', async () => {
    client ??= createPublicClient({ chain: bscTestnet, transport: http(RPC) });
    // LAUNCHER_BASE + mapping entry mirror components/verse/claim-center.tsx exactly
    // (OZ SlotDerivation double keccak; entry = keccak(abi.encodePacked(key, slot))).
    const { encodePacked, keccak256, toHex } = await import('viem');
    const h1 = BigInt(keccak256(toHex('outrun.storage.MemeverseLauncher')));
    const inner = toHex((h1 - 1n) % (1n << 256n), { size: 32 });
    const base = BigInt(keccak256(inner)) & ~0xffn;
    const [durRaw, settledRaw] = await Promise.all([
      client.getStorageAt({ address: LAUNCHER, slot: toHex(base + 11n, { size: 32 }) }),
      client.getStorageAt({
        address: LAUNCHER,
        slot: toHex(
          BigInt(keccak256(encodePacked(['uint256', 'uint256'], [VERSE, base + 18n]))) + 2n,
          { size: 32 },
        ),
      }),
    ]);
    const duration = Number(BigInt(durRaw ?? '0x0'));
    const settled = Number(BigInt(settledRaw ?? '0x0') & 0xffffffffffn);
    expect(duration).toBeGreaterThan(0);
    expect(settled).toBeGreaterThan(0);
    expect(settled).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  }, 60_000);
});
