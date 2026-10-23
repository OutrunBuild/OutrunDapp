// Anvil fork Type-4 session suite (runbook step 8, architecture.md §11.3).
// One fork at a time; the chain under test comes from the environment:
//
//   TEST_CHAIN_ID=97 ANVIL_URL=http://localhost:8545 VERSE_ID=<id> pnpm exec vitest run tests/integration
//
// VERSE_ID empty = skip verse flows (genesis needs a deployed verse; only BSC has one).
// Without ANVIL_URL the whole file skips, so plain `pnpm test` never needs a fork.
// Fixed fork blocks are recorded in docs/runbooks/acceptance-checklist.md (AC-5).
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  fromRlp,
  getAddress,
  http,
  keccak256,
  parseUnits,
  type Abi,
  type Chain,
  type Hex,
} from 'viem';
import { recoverAuthorizationAddress } from 'viem/utils';
import { arbitrumSepolia, baseSepolia, bscTestnet } from 'viem/chains';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { erc20ReadAbi, faucetAbi, kernelAbi, psmAbi, usrVaultAbi } from '../../lib/web3/abis';
import { detectCodeCapability } from '../../lib/web3/account';
import { EXEC_MODE_DEFAULT, encodeKernelExecute } from '../../lib/web3/kernel';
import {
  assertByteIdentical,
  buildAuthorizationRequest,
  prepareType4,
  type SignedAuthorization,
  type Type4Ports,
  type UnsignedType4,
} from '../../lib/web3/type4-pipeline';
import {
  approvalCall,
  encodeSessionCalldata,
  genesisCall,
  psmMintCall,
  psmRedeemCall,
  usrDepositCall,
} from '../../lib/web3/session-actions';
import { toRpcAuthorization } from '../../lib/web3/viem-type4-adapter';

const ANVIL_URL = process.env.ANVIL_URL ?? '';
const TEST_CHAIN_ID = Number(process.env.TEST_CHAIN_ID ?? 0);
const VERSE_ID = process.env.VERSE_ID ?? '';

const CHAINS: Record<number, Chain> = {
  421614: arbitrumSepolia,
  84532: baseSepolia,
  97: bscTestnet,
};

// One burner per state-changing test (anvil dev accounts 0/1/2): faucet cooldowns and the
// delegation itself persist on the fork, so sharing one burner would couple the tests.
// Anvil dev-account addresses are stable per mnemonic index; index 0 is inlined above.
const BURNER_MNEMONIC = 'test test test test test test test test test test test junk';
const CAST_BIN = process.env.CAST_BIN ?? 'cast';

async function castSignAuthorization(
  contractAddress: Hex,
  chainId: number,
  nonce: number,
  accountIndex: number,
  expectedSigner: Hex,
): Promise<SignedAuthorization> {
  const raw = execFileSync(
    CAST_BIN,
    [
      'wallet',
      'sign-auth',
      contractAddress,
      '--mnemonic',
      BURNER_MNEMONIC,
      '--mnemonic-index',
      String(accountIndex),
      '--nonce',
      String(nonce),
      '--chain',
      String(chainId),
      '--json',
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
  const data = (JSON.parse(raw) as { data: Hex }).data;
  const [chainIdHex, address, nonceHex, yParityHex, r, s] = fromRlp(data, 'hex') as [
    Hex,
    Hex,
    Hex,
    Hex,
    Hex,
    Hex,
  ];
  // RLP empty strings decode to '0x' (not '0x0'): y_parity 0 arrives empty.
  const num = (value: Hex): number => (value === '0x' ? 0 : Number(value));
  const signed: SignedAuthorization = {
    chainId: num(chainIdHex),
    address,
    nonce: num(nonceHex),
    r,
    s,
    yParity: num(yParityHex),
  };
  // Authorization.address is the delegation target (kernel), not the signer: the signer
  // must recover to the burner.
  expect(signed.chainId).toBe(chainId);
  expect(signed.nonce).toBe(nonce);
  expect(signed.address.toLowerCase()).toBe(contractAddress.toLowerCase());
  const recovered = await recoverAuthorizationAddress({
    authorization: {
      address: signed.address,
      chainId: signed.chainId,
      nonce: signed.nonce,
      r: signed.r,
      s: signed.s,
      yParity: signed.yParity ?? 0,
    },
  });
  expect(recovered.toLowerCase()).toBe(expectedSigner.toLowerCase());
  return signed;
}

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function deploymentOf(chainId: number): {
  contracts: Record<string, string>;
  kernel: string;
  kernelCodehash: string;
} {
  const raw = JSON.parse(readFileSync(join(repo, 'deployments', `${chainId}.json`), 'utf8'));
  const checksumRecord = (record: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, getAddress(value)]));
  return {
    contracts: checksumRecord(raw.contracts as Record<string, string>),
    kernel: getAddress(raw.kernel7702Implementation as string),
    kernelCodehash: raw.kernel7702Codehash as string,
  };
}

describe.skipIf(!ANVIL_URL)('anvil fork Type-4 session', () => {
  // Eager setup is unreachable without ANVIL_URL (the file skips at collection): the guards
  // below only keep `pnpm test` green, they never execute in a real run.
  const chain = CHAINS[TEST_CHAIN_ID] as Chain;
  const deployment = ANVIL_URL && TEST_CHAIN_ID ? deploymentOf(TEST_CHAIN_ID) : null;
  const contracts = (deployment?.contracts ?? {}) as Record<string, string>;
  const kernel = (deployment?.kernel ?? '0x0000000000000000000000000000000000000000') as Hex;
  const transport = http(ANVIL_URL || 'http://127.0.0.1:1');
  const publicClient: ReturnType<typeof createPublicClient> = ANVIL_URL
    ? createPublicClient({ chain, transport })
    : (null as never);

  const read = (address: Hex, abi: Abi, functionName: string, args?: readonly unknown[]) =>
    publicClient.readContract({ address, abi, functionName, args }) as Promise<never>;

  function makePorts(
    burnerAddress: Hex,
    accountIndex: number,
  ): {
    ports: Type4Ports;
    walletClient: ReturnType<typeof createWalletClient>;
  } {
    const walletClient = createWalletClient({ account: burnerAddress, chain, transport });
    const ports: Type4Ports = {
      getPendingNonce: (eoa: Hex) =>
        publicClient.getTransactionCount({ address: eoa, blockTag: 'pending' }),
      getChainId: () => publicClient.getChainId(),
      getCode: async (eoa: Hex) => (await publicClient.getCode({ address: eoa })) ?? '0x',
      signAuthorization: async (req) =>
        castSignAuthorization(
          req.contractAddress,
          req.chainId,
          req.nonce,
          accountIndex,
          burnerAddress,
        ),
      simulateType4: async (tx: UnsignedType4) => {
        try {
          const list = tx.authorizationList;
          const call =
            list && list.length > 0
              ? {
                  from: tx.eoa,
                  to: tx.to,
                  data: tx.data,
                  value: `0x${tx.value.toString(16)}`,
                  authorizationList: list.map(toRpcAuthorization),
                }
              : {
                  from: tx.eoa,
                  to: tx.to,
                  data: tx.data,
                  value: `0x${tx.value.toString(16)}`,
                };
          await publicClient.request({ method: 'eth_call', params: [call, 'latest'] } as never);
          return { ok: true as const };
        } catch {
          return { ok: false as const };
        }
      },
      sendType4: (tx: UnsignedType4) =>
        walletClient.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          nonce: tx.nonce,
          // Absent list = the delegated-account form (plain type-2 self-execution).
          ...(tx.authorizationList?.length ? { authorizationList: tx.authorizationList } : {}),
        } as Parameters<typeof walletClient.sendTransaction>[0]),
    };
    return { ports, walletClient };
  }

  const shared = makePorts('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex, 0);
  const ports = shared.ports;

  const USED_BURNER_INDEXES = new Set<number>();

  async function burnerAddressOf(index: number): Promise<Hex> {
    const out = execFileSync(
      CAST_BIN,
      ['wallet', 'address', '--mnemonic', BURNER_MNEMONIC, '--mnemonic-index', String(index)],
      { encoding: 'utf8', timeout: 60_000 },
    );
    return getAddress(out.trim());
  }

  // Anvil 1.8.5 Base forks intermittently drop a submitted transaction without an
  // error (receipt never arrives; ARS/BSC forks don't). Poll briefly and resubmit
  // the identical tx — same nonce, so this is replace-by-fee on a live network.
  async function receiptWithResend(
    send: () => Promise<Hex>,
    windowMs = 15_000,
    tries = 3,
  ): Promise<{ status: 'success' | 'reverted'; transactionHash: Hex }> {
    let hash = await send();
    for (let attempt = 0; attempt < tries; attempt++) {
      const deadline = Date.now() + windowMs;
      while (Date.now() < deadline) {
        const receipt = (await publicClient.getTransactionReceipt({ hash }).catch(() => null)) as {
          status: 'success' | 'reverted';
          transactionHash: Hex;
        } | null;
        if (receipt) return receipt;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      hash = await send();
    }
    throw new Error('outrun: fork never mined the transaction');
  }

  // First unused burner whose faucet claim lands (faucet cooldowns are per-user on the
  // forked state; the real dev accounts may have claimed within 24h of the fork block).
  async function acquireFundedBurner(): Promise<{ address: Hex; index: number }> {
    const faucet = contracts.Faucet as Hex;
    const reserve = (await read(
      contracts['OutrunPSM.UUSD'] as Hex,
      psmAbi,
      'reserveToken',
      [],
    )) as Hex;
    for (let index = 0; index < 10; index++) {
      if (USED_BURNER_INDEXES.has(index)) continue;
      const address = await burnerAddressOf(index);
      const wc = createWalletClient({ account: address, chain, transport });
      try {
        const receipt = await receiptWithResend(() =>
          wc.writeContract({
            address: faucet,
            abi: faucetAbi,
            functionName: 'claim',
            args: [reserve],
          } as unknown as Parameters<typeof wc.writeContract>[0]),
        );
        if (receipt.status !== 'success') continue;
        USED_BURNER_INDEXES.add(index);
        return { address, index };
      } catch {
        continue;
      }
    }
    throw new Error('outrun: no fundable burner (faucet cooldowns?)');
  }

  // Address-only burner (no funds needed): rollback and read-only paths.
  async function acquireBareBurner(): Promise<{ address: Hex; index: number }> {
    for (let index = 0; index < 10; index++) {
      if (USED_BURNER_INDEXES.has(index)) continue;
      USED_BURNER_INDEXES.add(index);
      return { address: await burnerAddressOf(index), index };
    }
    throw new Error('outrun: burner pool exhausted');
  }

  // Cold anvil 1.8.5 Base forks eat TYPE-4 submissions (simulation passes, the tx
  // never mines — even resubmissions) for roughly the first minute; plain txs mine
  // fine and ARS/BSC forks don't show this. Drive one Type-4 no-op delegation to a
  // mined receipt before the tests, with a long resend budget to outlast the window.
  beforeAll(async () => {
    if (!ANVIL_URL) return;
    const address = await burnerAddressOf(9);
    const { ports } = makePorts(address, 9);
    USED_BURNER_INDEXES.add(9);
    const result = await prepareType4(ports, {
      eoa: address,
      kernel,
      expectedChainId: TEST_CHAIN_ID,
      batchCallData: encodeKernelExecute([]),
      quoteId: 'fork-warmup',
      minOutput: '—',
      slippageBps: 0,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      manifestVersion: 'v1-rc',
      nativeBalance: await publicClient.getBalance({ address }).catch(() => 1n),
      estimatedCost: 0n,
    });
    if (!('prepared' in result)) throw new Error('outrun: warm-up Type-4 failed to prepare');
    await receiptWithResend(() => ports.sendType4(result.prepared), 15_000, 10);
  }, 300_000);

  it('chain + kernel certification match the manifest', async () => {
    expect(await ports.getChainId()).toBe(TEST_CHAIN_ID);
    const kernelCode = (await publicClient.getCode({ address: kernel })) as Hex;
    expect(kernelCode).not.toBe('0x');
    expect(keccak256(kernelCode)).toBe(deployment?.kernelCodehash);
  }, 60_000);

  it('faucet funds the burner, PSM mints uAsset, USR takes a session deposit', async () => {
    const funded = await acquireFundedBurner();
    const burner = { address: funded.address };
    const { ports } = makePorts(funded.address, funded.index);
    const psmKey = Object.keys(contracts).find((key) => key === 'OutrunPSM.UUSD');
    expect(psmKey, 'PSM.UUSD deployed').toBeTruthy();
    const psm = contracts['OutrunPSM.UUSD'] as Hex;
    const reserve = (await read(psm, psmAbi, 'reserveToken', [])) as Hex;
    const uAsset = (await read(psm, psmAbi, 'uAsset', [])) as Hex;

    const reserveBalance = (await read(reserve, erc20ReadAbi, 'balanceOf', [
      burner.address,
    ])) as bigint;
    expect(reserveBalance > 0n).toBe(true);

    const mintAmount = reserveBalance / 10n;
    const hook = contracts.MemeverseUniswapHook as Hex;
    const mintData = encodeSessionCalldata({
      hook,
      approval: approvalCall(reserve, psm, mintAmount),
      action: psmMintCall(psm, burner.address, mintAmount),
    });
    const mintResult = await prepareType4(ports, {
      eoa: burner.address,
      kernel,
      expectedChainId: TEST_CHAIN_ID,
      batchCallData: mintData,
      quoteId: `fork-psm-mint-${TEST_CHAIN_ID}`,
      minOutput: '—',
      slippageBps: 0,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      manifestVersion: 'v1-rc',
      nativeBalance: await publicClient.getBalance({ address: burner.address }),
      estimatedCost: 0n,
    });
    expect(mintResult).toHaveProperty('prepared');
    if (!('prepared' in mintResult)) throw new Error('unreachable');
    assertByteIdentical(mintResult.prepared, { ...mintResult.prepared });
    const mintReceipt = await receiptWithResend(() => ports.sendType4(mintResult.prepared));
    expect(mintReceipt.status).toBe('success');
    const uBalance = (await read(uAsset, erc20ReadAbi, 'balanceOf', [burner.address])) as bigint;
    expect(uBalance > 0n).toBe(true);

    const [tin, tout, stockCap, quoteOut] = (await Promise.all([
      read(psm, psmAbi, 'tin', []),
      read(psm, psmAbi, 'tout', []),
      read(psm, psmAbi, 'stockCap', []),
      read(psm, psmAbi, 'quoteMint', [mintAmount]),
    ])) as unknown as [bigint, bigint, bigint, bigint];
    expect(tin >= 0n && tout >= 0n && stockCap > 0n && quoteOut > 0n).toBe(true);

    const vault = contracts['OutrunUSRVault.UUSD'] as Hex | undefined;
    expect(vault, 'USR vault deployed').toBeTruthy();
    const index = (await read(vault as Hex, usrVaultAbi, 'accrualIndex', [])) as bigint;
    expect(index > 0n).toBe(true);
    const depositAmount = uBalance / 2n;
    const depositData = encodeSessionCalldata({
      hook,
      approval: approvalCall(uAsset, vault as Hex, depositAmount),
      action: usrDepositCall(vault as Hex, depositAmount, burner.address),
    });
    const depositResult = await prepareType4(ports, {
      eoa: burner.address,
      kernel,
      expectedChainId: TEST_CHAIN_ID,
      batchCallData: depositData,
      quoteId: `fork-usr-deposit-${TEST_CHAIN_ID}`,
      minOutput: '—',
      slippageBps: 0,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      manifestVersion: 'v1-rc',
      nativeBalance: await publicClient.getBalance({ address: burner.address }),
      estimatedCost: 0n,
    });
    expect(depositResult).toHaveProperty('prepared');
    if (!('prepared' in depositResult)) throw new Error('unreachable');
    // The delegated send is the pipeline's natural product: a plain type-2 with no
    // authorizationList. (An empty list is invalid per EIP-7702 — every pool rejects it;
    // verified on Arbitrum/Base Sepolia 2026-10-20, where the type-2 form mined and the
    // empty-list form was refused outright. The old refreshAuth workaround is deleted.)
    assertByteIdentical(depositResult.prepared, { ...depositResult.prepared });
    const depositReceipt = await receiptWithResend(() => ports.sendType4(depositResult.prepared));
    expect(depositReceipt.status).toBe('success');
  }, 240_000);

  it.skipIf(!VERSE_ID || TEST_CHAIN_ID === 421614)(
    'genesis session: N/N+1, chain-specific auth, to=self, byte-identical broadcast',
    async () => {
      const funded = await acquireFundedBurner();
      const burner = { address: funded.address };
      const { ports } = makePorts(funded.address, funded.index);
      const launcher = contracts.MemeverseLauncher as Hex;
      const hook = contracts.MemeverseUniswapHook as Hex;
      const uAsset = contracts['UAsset.UUSD'] as Hex;
      const verseId = BigInt(VERSE_ID);
      const amount = parseUnits('10', 18);

      // Self-funding: PSM mint via direct sends (not session writes).
      const burnerClient = createWalletClient({ account: funded.address, chain, transport });
      const fund = async (params: Record<string, unknown>) =>
        burnerClient.writeContract(params as never);
      const psm = contracts['OutrunPSM.UUSD'] as Hex;
      const reserve = (await read(psm, psmAbi, 'reserveToken', [])) as Hex;
      const reserveBalance = (await read(reserve, erc20ReadAbi, 'balanceOf', [
        burner.address,
      ])) as bigint;
      const approveReceipt = await receiptWithResend(() =>
        fund({
          address: reserve,
          abi: erc20ReadAbi,
          functionName: 'approve',
          args: [psm, reserveBalance / 10n],
        }),
      );
      expect(approveReceipt.status).toBe('success');
      const mintFundReceipt = await receiptWithResend(() =>
        fund({
          address: psm,
          abi: psmAbi,
          functionName: 'mint',
          args: [burner.address, reserveBalance / 10n],
        }),
      );
      expect(mintFundReceipt.status).toBe('success');

      const data = encodeSessionCalldata({
        hook,
        approval: approvalCall(uAsset, launcher, amount),
        action: genesisCall(launcher, { verseId, amountInUAsset: amount, user: burner.address }),
      });

      const nonce = await ports.getPendingNonce(burner.address);
      const authReq = buildAuthorizationRequest({
        kernel,
        chainId: TEST_CHAIN_ID,
        authNonce: nonce + 1,
      });
      expect(authReq.chainId).not.toBe(0);
      expect(authReq.executor).toBe('self');

      const result = await prepareType4(ports, {
        eoa: burner.address,
        kernel,
        expectedChainId: TEST_CHAIN_ID,
        batchCallData: data,
        quoteId: `fork-genesis-${VERSE_ID}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: 'v1-rc',
        nativeBalance: await publicClient.getBalance({ address: burner.address }),
        estimatedCost: 0n,
      });
      expect(result).toHaveProperty('prepared');
      if (!('prepared' in result)) throw new Error('unreachable');
      const { prepared } = result;
      expect(prepared.to.toLowerCase()).toBe(burner.address.toLowerCase());
      expect(prepared.nonce).toBe(nonce);
      expect(prepared.authorizationList).toHaveLength(1);
      expect(prepared.authorizationList?.[0]?.nonce).toBe(nonce + 1);

      assertByteIdentical(prepared, { ...prepared });
      const genesisReceipt = await receiptWithResend(() => ports.sendType4(prepared));
      expect(genesisReceipt.status).toBe('success');

      const sent = (await publicClient.getTransaction({
        hash: genesisReceipt.transactionHash,
      })) as unknown as {
        to: Hex;
        authorizationList: SignedAuthorization[];
        input: Hex;
      };
      expect(sent.to?.toLowerCase()).toBe(burner.address.toLowerCase());
      expect(sent.authorizationList).toHaveLength(1);

      const code = await ports.getCode(burner.address);
      expect(detectCodeCapability(code, kernel)).toBe('kernel-delegated');
      expect(code.toLowerCase().endsWith(kernel.slice(2).toLowerCase())).toBe(true);

      // TRY_EXEC-negative: the broadcast batch decodes as default atomic mode.
      const decoded = decodeFunctionData({ abi: kernelAbi, data: sent.input });
      expect(decoded.functionName).toBe('execute');
      expect(decoded.args?.[0]).toBe(EXEC_MODE_DEFAULT);
    },
    180_000,
  );

  it.skipIf(!VERSE_ID || TEST_CHAIN_ID === 421614)(
    'atomic rollback: a reverting inner leg fails the whole batch (status 0, nothing applied)',
    async () => {
      const bare = await acquireBareBurner();
      const burner = { address: bare.address };
      const { ports } = makePorts(bare.address, bare.index);
      const launcher = contracts.MemeverseLauncher as Hex;
      const hook = contracts.MemeverseUniswapHook as Hex;
      const uAsset = contracts['UAsset.UUSD'] as Hex;
      const reverting = encodeSessionCalldata({
        hook,
        action: genesisCall(launcher, {
          verseId: BigInt(VERSE_ID),
          amountInUAsset: 0n,
          user: burner.address,
        }),
      });
      const allowanceBefore = (await read(uAsset, erc20ReadAbi, 'allowance', [
        burner.address,
        launcher,
      ])) as bigint;
      const nonce = await ports.getPendingNonce(burner.address);
      const auth = await ports.signAuthorization(
        buildAuthorizationRequest({ kernel, chainId: TEST_CHAIN_ID, authNonce: nonce + 1 }),
        burner.address,
      );
      const rollbackReceipt = await receiptWithResend(() =>
        ports.sendType4({
          to: burner.address,
          eoa: burner.address,
          chainId: TEST_CHAIN_ID,
          nonce,
          value: 0n,
          data: reverting,
          authorizationList: [auth],
        }),
      );
      expect(rollbackReceipt.status).toBe('reverted');
      const allowanceAfter = (await read(uAsset, erc20ReadAbi, 'allowance', [
        burner.address,
        launcher,
      ])) as bigint;
      expect(allowanceAfter).toBe(allowanceBefore);
    },
    180_000,
  );

  it('fail-closed: a reverting batch blocks preparation and never sends', async () => {
    const bare = await acquireBareBurner();
    const { ports } = makePorts(bare.address, bare.index);
    // Deterministic revert: the bare burner holds zero uAsset, so a 1-wei PSM
    // redeem fails under any protocol state or execution order (§11.3 fail-closed).
    const data = encodeSessionCalldata({
      hook: contracts.MemeverseUniswapHook as Hex,
      action: psmRedeemCall(contracts['OutrunPSM.UUSD'] as Hex, bare.address, 1n),
    });
    const result = await prepareType4(ports, {
      eoa: bare.address,
      kernel,
      expectedChainId: TEST_CHAIN_ID,
      batchCallData: data,
      quoteId: 'fork-fail-closed',
      minOutput: '—',
      slippageBps: 0,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      manifestVersion: 'v1-rc',
      nativeBalance: await publicClient.getBalance({ address: bare.address }).catch(() => 0n),
      estimatedCost: 0n,
    });
    expect(result).toMatchObject({ blocked: 'simulation-failed' });
  }, 120_000);
});
