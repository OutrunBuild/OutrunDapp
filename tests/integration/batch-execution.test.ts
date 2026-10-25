// Layer-1 fork execution tests (batch-content truth): every participation flow wired in
// 2026-10 (combined entries + Psm/Stake legs) is built with the REAL session-actions
// builders and executed on the fork from a fresh anvil burner with realistic pre-state
// (zero allowances, tokens funded through real flows). The batch's calls go out one by one
// — exactly the legs a delegator/wallet executes inside the single batch transaction.
//
//   TEST_CHAIN_ID=97 ANVIL_URL=http://localhost:8545 VERSE_ID=<id> \
//     pnpm exec vitest run tests/integration/batch-execution.test.ts
//
// Same conventions as type4-session.test.ts: skips without ANVIL_URL, one burner per test
// (faucet cooldowns persist on the fork), verse flows need VERSE_ID (a deployed verse).
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Abi,
  type Chain,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  erc20ReadAbi,
  faucetAbi,
  launcherAbi,
  polendAbi,
  psmAbi,
  stakingPositionAbi,
} from '../../lib/web3/abis';
const mockUsdcAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;
import type { Abi as JsonAbi } from 'viem';
import {
  approvalCall,
  fundCreditInput,
  fundPsmInput,
  fundStakeInput,
  fundUAssetInput,
  genesisAndPreorderCall,
  genesisByTokenCall,
  genesisCall,
  leveragedGenesisAndPreorderCall,
  leveragedGenesisByPsmCall,
  leveragedGenesisWithCreditCall,
  preorderByPsmCall,
  preorderCall,
  type BatchExecution,
} from '../../lib/web3/session-actions';

const ANVIL_URL = process.env.ANVIL_URL ?? '';
const TEST_CHAIN_ID = Number(process.env.TEST_CHAIN_ID ?? 97);
const VERSE_ID = process.env.VERSE_ID ?? '';
const CHAIN: Chain = bscTestnet;

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function deploymentOf(chainId: number): Record<string, Hex> {
  const raw = JSON.parse(readFileSync(join(repo, 'deployments', `${chainId}.json`), 'utf8'));
  return Object.fromEntries(
    Object.entries(raw.contracts as Record<string, string>).map(([k, v]) => [k, v as Hex]),
  );
}

describe.skipIf(!ANVIL_URL)('participation batch fork execution', () => {
  const deployment = ANVIL_URL ? deploymentOf(TEST_CHAIN_ID) : ({} as Record<string, Hex>);
  const contracts = deployment;
  const transport = http(ANVIL_URL || 'http://127.0.0.1:1');
  const publicClient = createPublicClient({ chain: CHAIN, transport });

  const C = {
    launcher: contracts.MemeverseLauncher,
    router: contracts.OutrunRouter,
    polend: contracts.POLend,
    psmUusd: contracts['OutrunPSM.UUSD'],
    usdc: contracts.MockUSDC,
    uusd: contracts['UAsset.UUSD'],
    credit: contracts['GenesisCredit.UUSD'],
    spSusds: contracts['OutrunStakingPosition.sUSDS'],
    faucet: contracts.Faucet,
  };
  const verseId = BigInt(VERSE_ID || '0');

  const read = <T>(address: Hex, abi: Abi, functionName: string, args?: readonly unknown[]) =>
    publicClient.readContract({ address, abi, functionName, args }) as Promise<T>;

  const encode = (abi: unknown, functionName: string, args: readonly unknown[]): Hex =>
    encodeFunctionData({ abi: abi as JsonAbi, functionName, args: args as never });

  /**
   * One burner per test with a RANDOM key: the faucet cools down per address on the forked
   * real-chain state, and the well-known anvil dev addresses have already claimed there
   * (ClaimTooSoon). A fresh address has a clean cooldown; gas comes from anvil_setBalance.
   */
  async function burner(): Promise<{
    address: Hex;
    send: (call: BatchExecution) => Promise<void>;
  }> {
    const account = privateKeyToAccount(generatePrivateKey());
    const node = publicClient.transport as unknown as {
      request: (a: { method: string; params?: unknown }) => Promise<unknown>;
    };
    // Fresh address needs gas: anvil injects it directly (fork-only cheat, test-infra tier).
    await node.request({
      method: 'anvil_setBalance',
      params: [account.address, '0x8ac7230489e80000'],
    });
    const wallet = createWalletClient({ account, chain: CHAIN, transport });
    const send = async (call: BatchExecution) => {
      const hash = await wallet.sendTransaction({
        to: call.target,
        data: call.callData,
        value: call.value,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');
    };
    return { address: account.address, send };
  }

  const balanceOf = (token: Hex, owner: Hex) =>
    read<bigint>(token, erc20ReadAbi, 'balanceOf', [owner]);
  const allowanceOf = (token: Hex, owner: Hex, spender: Hex) =>
    read<bigint>(token, erc20ReadAbi, 'allowance', [owner, spender]);

  // Fork-testing whale: the funded testnet deployer account this repo's operations use
  // (verified balances on 97). The faucet's mock-token stock is drained by real claims
  // (ERC20InsufficientBalance inside claim), so tests pull from the live whale instead.
  const WHALE = '0xBec9209dFe21f896852cd1495478D2830C4a6DB2' as Hex;

  /** anvil impersonation tier: send from any account without its key. */
  async function sendAs(sender: Hex, call: BatchExecution): Promise<void> {
    const node = publicClient.transport as unknown as {
      request: (a: { method: string; params?: unknown }) => Promise<unknown>;
    };
    await node.request({ method: 'anvil_impersonateAccount', params: [sender] });
    await node.request({
      method: 'anvil_setBalance',
      params: [sender, '0x8ac7230489e80000'],
    });
    const wallet = createWalletClient({ account: sender, chain: CHAIN, transport });
    const hash = await wallet.sendTransaction({
      to: call.target,
      data: call.callData,
      value: call.value,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');
  }

  async function fundUsdc(b: Awaited<ReturnType<typeof burner>>, amount: bigint): Promise<void> {
    await sendAs(WHALE, {
      target: C.usdc,
      value: 0n,
      callData: encode(mockUsdcAbi, 'transfer', [b.address, amount]),
    });
  }

  async function fundUusdViaPsm(
    b: Awaited<ReturnType<typeof burner>>,
    amount: bigint,
  ): Promise<void> {
    // Real face-value PSM path: approve the PSM, mint uAsset at par minus tin.
    await b.send({
      target: C.usdc,
      value: 0n,
      callData: encode(mockUsdcAbi, 'approve', [C.psmUusd, amount]),
    });
    await b.send({
      target: C.psmUusd,
      value: 0n,
      callData: encode(psmAbi, 'mint', [b.address, amount]),
    });
  }

  async function fundCreditViaFaucet(b: Awaited<ReturnType<typeof burner>>): Promise<bigint> {
    // Credits are dispensed by the faucet's held-token stock (claimHeld) — the same source
    // the production flow uses; no synthetic minting.
    await b.send({
      target: C.faucet,
      value: 0n,
      callData: encode(faucetAbi, 'claimHeld', [C.credit]),
    });
    const balance = await balanceOf(C.credit, b.address);
    expect(balance > 0n, 'faucet claimHeld must fund credits').toBe(true);
    return balance;
  }

  const genesisFundOf = (owner: Hex) =>
    read<[bigint, boolean, boolean]>(C.launcher, launcherAbi, 'userGenesisData', [
      verseId,
      owner,
    ]).then(([fund]) => fund);
  const preorderFundOf = (owner: Hex) =>
    read<[bigint, bigint, boolean]>(C.launcher, launcherAbi, 'userPreorderData', [
      verseId,
      owner,
    ]).then(([fund]) => fund);
  const totalInterest = () =>
    read<bigint>(C.polend, polendAbi, 'getTotalLeveragedInterest', [verseId]);

  async function executeBatch(
    b: Awaited<ReturnType<typeof burner>>,
    calls: readonly BatchExecution[],
  ) {
    for (const call of calls) await b.send(call);
  }

  const approve = (token: Hex, spender: Hex, amount: bigint) =>
    approvalCall(token, spender, amount);

  beforeAll(() => {
    expect(
      contracts.OutrunRouter,
      'deployments/97.json must carry the wired contracts',
    ).toBeDefined();
    expect(VERSE_ID, 'VERSE_ID env required for verse flows (see file header)').not.toBe('');
  });

  it('combined genesisAndPreorder: uAsset genesis leg + Psm preorder leg lands and consumes approvals', async () => {
    const b = await burner();
    const genesisUAsset = parseUnits('3', 18);
    const preorderUsdc = parseUnits('50', 18);
    await fundUsdc(b, preorderUsdc + parseUnits('6', 18));
    await fundUusdViaPsm(b, genesisUAsset + parseUnits('1', 18));

    const genesisBefore = await genesisFundOf(b.address);
    const preorderBefore = await preorderFundOf(b.address);
    const usdcBefore = await balanceOf(C.usdc, b.address);
    const uusdBefore = await balanceOf(C.uusd, b.address);

    await executeBatch(b, [
      approve(C.uusd, C.router, genesisUAsset),
      approve(C.usdc, C.router, preorderUsdc),
      genesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundUAssetInput(genesisUAsset),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    // Genesis ledger books exactly the pulled uAsset; the Psm preorder leg books the
    // fee-adjusted mint (par minus tin), never more than the reserve input.
    expect((await genesisFundOf(b.address)) - genesisBefore).toBe(genesisUAsset);
    const preorderDelta = (await preorderFundOf(b.address)) - preorderBefore;
    expect(preorderDelta).toBeGreaterThan(0n);
    expect(preorderDelta).toBeLessThanOrEqual(preorderUsdc);
    // Exact approvals consumed back to zero (allowance decrements on pull).
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
    // Balances moved by exactly the funded amounts.
    expect(uusdBefore - (await balanceOf(C.uusd, b.address))).toBe(genesisUAsset);
    expect(usdcBefore - (await balanceOf(C.usdc, b.address))).toBe(preorderUsdc);
  }, 240_000);

  it('single-leg genesis (launcher) and preorder (launcher) land', async () => {
    const b = await burner();
    const amount = parseUnits('2', 18);
    await fundUsdc(b, amount + parseUnits('2', 18) + parseUnits('1', 18));
    await fundUusdViaPsm(b, amount + parseUnits('2', 18));
    const genesisBefore = await genesisFundOf(b.address);
    await executeBatch(b, [
      approve(C.uusd, C.launcher, amount),
      genesisCall(C.launcher, { verseId, amountInUAsset: amount, user: b.address }),
    ]);
    expect((await genesisFundOf(b.address)) - genesisBefore).toBe(amount);

    const preorderAmount = parseUnits('1', 18);
    const preorderBefore = await preorderFundOf(b.address);
    await executeBatch(b, [
      approve(C.uusd, C.launcher, preorderAmount),
      preorderCall(C.launcher, { verseId, amountInUAsset: preorderAmount, user: b.address }),
    ]);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
  }, 240_000);

  it('combined leveragedGenesisAndPreorder: credit interest leg + uAsset preorder leg lands', async () => {
    const b = await burner();
    const creditAmount = await fundCreditViaFaucet(b);
    const preorderAmount = parseUnits('1', 18);
    await fundUsdc(b, preorderAmount + parseUnits('1', 18) + parseUnits('1', 18));
    await fundUusdViaPsm(b, preorderAmount + parseUnits('1', 18));

    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.credit, C.router, creditAmount),
      approve(C.uusd, C.router, preorderAmount),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundCreditInput(creditAmount),
        preorder: fundUAssetInput(preorderAmount),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBe(creditAmount);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
    expect(await allowanceOf(C.credit, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('leveragedGenesisWithCredit single leg (POLend) lands', async () => {
    const b = await burner();
    const creditAmount = await fundCreditViaFaucet(b);
    const interestBefore = await totalInterest();
    await executeBatch(b, [
      approve(C.credit, C.polend, creditAmount),
      leveragedGenesisWithCreditCall(C.polend, { verseId, creditAmount, user: b.address }),
    ]);
    expect((await totalInterest()) - interestBefore).toBe(creditAmount);
  }, 240_000);

  it('leveragedGenesisByPSM single leg (router, reserve interest) lands', async () => {
    const b = await burner();
    const reserveAmount = parseUnits('10', 18);
    await fundUsdc(b, reserveAmount + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    await executeBatch(b, [
      approve(C.usdc, C.router, reserveAmount),
      leveragedGenesisByPsmCall(C.router, {
        uAsset: C.uusd,
        reserveToken: C.usdc,
        amountIn: reserveAmount,
        verseId,
        genesisUser: b.address,
      }),
    ]);
    // The router mints uAsset through the PSM (fee-adjusted), so interest books the mint.
    expect((await totalInterest()) - interestBefore).toBeGreaterThan(0n);
  }, 240_000);

  it('genesisByToken stake leg (router, SP gate) opens a CDP position', async () => {
    const b = await burner();
    const stakeAmount = parseUnits('5', 18);
    await fundUsdc(b, stakeAmount + parseUnits('1', 18));
    const positionsBefore = await read<bigint>(C.spSusds, stakingPositionAbi, 'idCounter');
    const genesisBefore = await genesisFundOf(b.address);

    await executeBatch(b, [
      approve(C.usdc, C.router, stakeAmount),
      genesisByTokenCall(C.router, {
        sp: C.spSusds,
        tokenIn: C.usdc,
        tokenAmount: stakeAmount,
        minSyOut: 0n,
        verseId,
        genesisUser: b.address,
        minUAssetMinted: 0n,
      }),
    ]);

    expect((await read<bigint>(C.spSusds, stakingPositionAbi, 'idCounter')) - positionsBefore).toBe(
      1n,
    );
    // Value-parity mint: the SP stakes the SY and hands the minted uAsset to the launcher.
    expect((await genesisFundOf(b.address)) - genesisBefore).toBe(stakeAmount);
  }, 240_000);

  // --- full funding matrix (IOutrunRouter family matrix, all 12 combined combos + the
  // single-leg PSM preorder). One test per leg pair; merged same-token legs assert the
  // single-approve shape, mixed-token legs the two-approve shape.

  it('combined normal: uAsset genesis + uAsset preorder (merged single approve)', async () => {
    const b = await burner();
    const genesisAmount = parseUnits('2', 18);
    const preorderAmount = parseUnits('1', 18);
    await fundUsdc(b, genesisAmount + preorderAmount + parseUnits('1', 18));
    await fundUusdViaPsm(b, genesisAmount + preorderAmount + parseUnits('1', 18));
    const genesisBefore = await genesisFundOf(b.address);
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      // Both legs pay the raise uAsset: ONE merged approve covers the total.
      approve(C.uusd, C.router, genesisAmount + preorderAmount),
      genesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundUAssetInput(genesisAmount),
        preorder: fundUAssetInput(preorderAmount),
        user: b.address,
      }),
    ]);

    expect((await genesisFundOf(b.address)) - genesisBefore).toBe(genesisAmount);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined normal: Psm genesis + uAsset preorder lands', async () => {
    const b = await burner();
    const genesisUsdc = parseUnits('20', 18);
    const preorderAmount = parseUnits('1', 18);
    await fundUsdc(b, genesisUsdc + preorderAmount + parseUnits('1', 18));
    await fundUusdViaPsm(b, preorderAmount + parseUnits('1', 18));
    const genesisBefore = await genesisFundOf(b.address);
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.usdc, C.router, genesisUsdc),
      approve(C.uusd, C.router, preorderAmount),
      genesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundPsmInput(C.usdc, genesisUsdc),
        preorder: fundUAssetInput(preorderAmount),
        user: b.address,
      }),
    ]);

    // Psm genesis books the fee-adjusted mint; preorder books exactly the uAsset leg.
    expect((await genesisFundOf(b.address)) - genesisBefore).toBeGreaterThan(0n);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined normal: Psm genesis + Psm preorder on the same reserve (merged single approve)', async () => {
    const b = await burner();
    const genesisUsdc = parseUnits('20', 18);
    const preorderUsdc = parseUnits('10', 18);
    await fundUsdc(b, genesisUsdc + preorderUsdc + parseUnits('1', 18));
    const genesisBefore = await genesisFundOf(b.address);
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      // Same reserve on both legs: the PSM pulls the merged total in one approve.
      approve(C.usdc, C.router, genesisUsdc + preorderUsdc),
      genesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundPsmInput(C.usdc, genesisUsdc),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    expect((await genesisFundOf(b.address)) - genesisBefore).toBeGreaterThan(0n);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined normal: Stake genesis + Psm preorder lands', async () => {
    const b = await burner();
    const stakeAmount = parseUnits('3', 18);
    const preorderUsdc = parseUnits('10', 18);
    await fundUsdc(b, stakeAmount + preorderUsdc + parseUnits('1', 18));
    const positionsBefore = await read<bigint>(C.spSusds, stakingPositionAbi, 'idCounter');
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.usdc, C.router, stakeAmount + preorderUsdc),
      genesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundStakeInput(C.spSusds, C.usdc, stakeAmount),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    expect((await read<bigint>(C.spSusds, stakingPositionAbi, 'idCounter')) - positionsBefore).toBe(
      1n,
    );
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
  }, 240_000);

  it('combined leveraged: credit interest + Psm preorder lands', async () => {
    const b = await burner();
    const creditAmount = await fundCreditViaFaucet(b);
    const preorderUsdc = parseUnits('10', 18);
    await fundUsdc(b, preorderUsdc + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.credit, C.router, creditAmount),
      approve(C.usdc, C.router, preorderUsdc),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundCreditInput(creditAmount),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBe(creditAmount);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
    expect(await allowanceOf(C.credit, b.address, C.router)).toBe(0n);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined leveraged: uAsset interest + uAsset preorder (merged single approve)', async () => {
    const b = await burner();
    const interestAmount = parseUnits('2', 18);
    const preorderAmount = parseUnits('1', 18);
    await fundUsdc(b, interestAmount + preorderAmount + parseUnits('2', 18));
    await fundUusdViaPsm(b, interestAmount + preorderAmount + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.uusd, C.router, interestAmount + preorderAmount),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundUAssetInput(interestAmount),
        preorder: fundUAssetInput(preorderAmount),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBe(interestAmount);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined leveraged: uAsset interest + Psm preorder lands', async () => {
    const b = await burner();
    const interestAmount = parseUnits('2', 18);
    const preorderUsdc = parseUnits('10', 18);
    await fundUsdc(b, preorderUsdc + interestAmount + parseUnits('2', 18));
    await fundUusdViaPsm(b, interestAmount + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.uusd, C.router, interestAmount),
      approve(C.usdc, C.router, preorderUsdc),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundUAssetInput(interestAmount),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBe(interestAmount);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined leveraged: Psm interest + uAsset preorder lands', async () => {
    const b = await burner();
    const interestUsdc = parseUnits('20', 18);
    const preorderAmount = parseUnits('1', 18);
    await fundUsdc(b, interestUsdc + preorderAmount + parseUnits('2', 18));
    await fundUusdViaPsm(b, preorderAmount + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.usdc, C.router, interestUsdc),
      approve(C.uusd, C.router, preorderAmount),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundPsmInput(C.usdc, interestUsdc),
        preorder: fundUAssetInput(preorderAmount),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBeGreaterThan(0n);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBe(preorderAmount);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
    expect(await allowanceOf(C.uusd, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('combined leveraged: Psm interest + Psm preorder on the same reserve (merged single approve)', async () => {
    const b = await burner();
    const interestUsdc = parseUnits('20', 18);
    const preorderUsdc = parseUnits('10', 18);
    await fundUsdc(b, interestUsdc + preorderUsdc + parseUnits('1', 18));
    const interestBefore = await totalInterest();
    const preorderBefore = await preorderFundOf(b.address);

    await executeBatch(b, [
      approve(C.usdc, C.router, interestUsdc + preorderUsdc),
      leveragedGenesisAndPreorderCall(C.router, {
        verseId,
        genesis: fundPsmInput(C.usdc, interestUsdc),
        preorder: fundPsmInput(C.usdc, preorderUsdc),
        user: b.address,
      }),
    ]);

    expect((await totalInterest()) - interestBefore).toBeGreaterThan(0n);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
    expect(await allowanceOf(C.usdc, b.address, C.router)).toBe(0n);
  }, 240_000);

  it('preorderByPSM single leg (router, reserve-paid preorder tab) lands', async () => {
    const b = await burner();
    const reserveAmount = parseUnits('10', 18);
    await fundUsdc(b, reserveAmount + parseUnits('1', 18));
    const preorderBefore = await preorderFundOf(b.address);
    await executeBatch(b, [
      approve(C.usdc, C.router, reserveAmount),
      preorderByPsmCall(C.router, {
        uAsset: C.uusd,
        reserveToken: C.usdc,
        amountIn: reserveAmount,
        verseId,
        preorderUser: b.address,
      }),
    ]);
    expect((await preorderFundOf(b.address)) - preorderBefore).toBeGreaterThan(0n);
  }, 240_000);
});
