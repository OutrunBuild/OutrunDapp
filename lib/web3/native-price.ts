// Chainlink native/USD read for the in-app gas control.
// Client-side through the wallet provider (no RPC keys on the client path, §14); the
// feed address is a deployment-manifest fact (deployments/{chainId}.json -> nativeUsdFeed).
// Staleness is enforced here, not in the UI: a stale or non-positive round reads as
// "no price" and the USD line simply does not render.
import { parseAbi, type Hex, type PublicClient } from 'viem';

const aggregatorAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
]);

/** Chainlink testnet heartbeats vary; anything older than a day is not a price. */
export const MAX_PRICE_AGE_SEC = 24 * 60 * 60;

/** Pure validation/normalization half (unit-tested without a client). */
export function chainlinkAnswerToUsd(input: {
  answer: bigint;
  decimals: number;
  updatedAt: number;
  now: number;
  maxAgeSec?: number;
}): number | null {
  const { answer, decimals, updatedAt, now } = input;
  const maxAge = input.maxAgeSec ?? MAX_PRICE_AGE_SEC;
  if (answer <= 0n) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  if (!Number.isFinite(updatedAt) || updatedAt <= 0 || now - updatedAt > maxAge) return null;
  const value = Number(answer) / 10 ** decimals;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function readNativeUsdPrice(client: PublicClient, feed: Hex): Promise<number | null> {
  try {
    const [round, decimals] = await Promise.all([
      client.readContract({ address: feed, abi: aggregatorAbi, functionName: 'latestRoundData' }),
      client.readContract({ address: feed, abi: aggregatorAbi, functionName: 'decimals' }),
    ]);
    return chainlinkAnswerToUsd({
      answer: round[1],
      decimals,
      updatedAt: Number(round[3]),
      now: Math.floor(Date.now() / 1000),
    });
  } catch {
    return null;
  }
}
