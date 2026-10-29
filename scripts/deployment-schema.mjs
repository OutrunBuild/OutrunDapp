// deployment-schema.mjs — Zod schemas for the current ABI release's manifest
// (contracts/abi/<abiVersion>/manifest.json, abiVersion = CURRENT_ABI_VERSION below) and
// deployments/{chainId}.json (deployment-artifact field lists, direct transcription),
// plus the shared keccak-256/EIP-55 helpers (generator emits, validators check).
// Shared by the artifact generator (build-time) and scripts/check-abi-manifest.mjs (CI).

// --- keccak-256 (Ethereum padding), pure JS ---------------------------------
const KECCAK_ROUND = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];
// (rho-pi is written in direct canonical form below; no piln table needed.)
const ROT_TABLE = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];
const MASK64 = (1n << 64n) - 1n;
const rotl64 = (x, n) => ((x << n) | (x >> (64n - n))) & MASK64;

// State lane(x, y) lives at st[x + 5*y]. One Keccak-f[1600] round = theta, rho+pi, chi, iota.
function keccakF(a) {
  const B = new Array(25).fill(0n);
  const C = new Array(5).fill(0n);
  const D = new Array(5).fill(0n);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) C[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) a[x + 5 * y] ^= D[x];
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(a[x + 5 * y], BigInt(ROT_TABLE[x][y]));
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] =
          B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & B[((x + 2) % 5) + 5 * y] & MASK64);
      }
    }
    a[0] ^= KECCAK_ROUND[round];
  }
}
export function keccak256(hex) {
  const data = hex.length % 2 === 0 ? hex : '0' + hex;
  const st = new Array(25).fill(0n);
  const rate = 136; // 1088-bit rate for 256-bit output
  const bytes = [];
  for (let i = 0; i < data.length; i += 2) bytes.push(parseInt(data.slice(i, i + 2), 16));
  // pad10*1 with Keccak (not SHA3) domain padding: 0x01 … 0x80
  const padded = [...bytes, 0x01];
  if (padded.length % rate === 0) {
    padded[padded.length - 1] |= 0x80;
  } else {
    while (padded.length % rate !== rate - 1) padded.push(0);
    padded.push(0x80);
  }
  for (let block = 0; block < padded.length; block += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 7; j >= 0; j--) lane = (lane << 8n) | BigInt(padded[block + i * 8 + j]);
      st[i] ^= lane;
    }
    keccakF(st);
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    const hex16 = st[i].toString(16).padStart(16, '0');
    out += hex16.match(/../g).reverse().join('');
  }
  return '0x' + out;
}
// --- EIP-55 -------------------------------------------------------------------
export function toChecksumAddress(address) {
  const lower = address.toLowerCase();
  // EIP-55 hashes the ASCII bytes of the 40-char lowercase hex string (not the
  // decoded 20 address bytes); keccak256 takes hex input, so encode the ASCII.
  const hash = keccak256(Buffer.from(lower.slice(2), 'utf8').toString('hex')).slice(2);
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[2 + i].toUpperCase() : lower[2 + i];
  }
  return out;
}
export function isChecksumAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && toChecksumAddress(address) === address;
}

// --- schemas ------------------------------------------------------------------
import { z } from 'zod';

const checksummedAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine(isChecksumAddress, { message: 'address must be exact EIP-55 checksummed' });

const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const codehash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const instanceDetailSchema = z.object({
  address: checksummedAddress,
  implementation: checksummedAddress.nullable().optional(),
  deploymentTx: txHash.nullable().optional(),
  deploymentBlock: z.number().int().nonnegative().nullable().optional(),
  runtimeCodehash: codehash.nullable().optional(),
});

export const contractEntrySchema = z.object({
  abi: z.string().min(1),
  address: checksummedAddress.nullable(),
  status: z.enum(['deployed', 'undeployed', 'dynamic']),
  implementation: checksummedAddress.nullable().optional(),
  deploymentTx: txHash.nullable().optional(),
  deploymentBlock: z.number().int().nonnegative().nullable().optional(),
  runtimeCodehash: codehash.nullable().optional(),
  instances: z.record(z.string(), instanceDetailSchema).optional(),
  note: z.string().optional(),
});

// ABI release directory name. Frozen releases are immutable: a semantic ABI change opens a NEW
// version directory beside the old one instead of overwriting it, so rollback is a pointer flip
// and one version never holds two different byte sets. The enum keeps retained releases
// parseable; new artifacts are always written with CURRENT_ABI_VERSION.
export const ABI_VERSIONS = ['v1-rc', 'v1-rc2'];
export const CURRENT_ABI_VERSION = 'v1-rc2';

export const manifestSchema = z.object({
  abiVersion: z.enum(ABI_VERSIONS),
  memeverseCommit: z.string().regex(/^[0-9a-f]{40}$/),
  outstakeCommit: z.string().regex(/^[0-9a-f]{40}$/),
  kernelTagCommit: z.string().regex(/^[0-9a-f]{40}$/),
  abis: z.record(z.string(), sha256Hex),
  chains: z.record(
    z.string().regex(/^[0-9]+$/),
    z.object({
      kernel7702: z.object({
        implementation: checksummedAddress,
        runtimeCodehash: codehash,
        observedBlock: z.number().int().nonnegative().nullable(),
      }),
      contracts: z.record(z.string(), contractEntrySchema),
    }),
  ),
});

export const chainConfigSchema = z.object({
  chainId: z.number().int().positive(),
  environment: z.literal('testnet'),
  rpc: z.object({ primary: z.string().url(), fallback: z.string().url() }),
  explorer: z.string().url(),
  layerZeroEid: z.number().int().nonnegative(),
  finalityPolicy: z.object({ safeBlockLag: z.number().int().nonnegative() }),
  contracts: z.record(z.string(), checksummedAddress),
  deploymentBlock: z.number().int().nonnegative(),
  abiVersion: z.enum(ABI_VERSIONS),
  implementationCodehashes: z.record(z.string(), codehash),
  kernel7702Implementation: checksummedAddress,
  kernel7702Codehash: codehash,
  eip7702TxType: z.literal('0x04'),
  authorizationPolicy: z.literal('chain-specific'),
  gasPaymentPolicy: z.literal('user-pays-native'),
  subgraphEndpoint: z.string(),
  features: z.array(z.string()),
});
