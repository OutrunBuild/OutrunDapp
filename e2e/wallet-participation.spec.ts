// Layer-3 wallet-boundary spec: the REAL onchain page (server-rendered by the dev server)
// is driven through an injected, spec-shaped external wallet across the FULL participation
// matrix (12 genesis×preorder combined combos + preorder tab + singles), and every batch it
// produces is EXECUTED on the forked chain by the node-side bridge. Assertions live on both
// sides:
//   - wallet side: the page issued one spec-shaped wallet_sendCalls (v2.0.0 envelope, legs
//     against the right spenders, merged same-token approves)
//   - chain side: the fork's ledgers book the expected deltas (genesis fund / preorder fund
//     / POLend interest)
// The page never talks to the fork directly (CSP connect-src): the shim forwards JSON-RPC
// through a Playwright binding, and the bridge executes wallet_sendCalls batches as
// sequential eth_sendTransactions (a spec-valid non-atomic wallet) against the fork.
//
// Gated (see playwright.wallet.config.ts): WALLET_E2E=1 ANVIL_URL VERSE_ID required.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import {
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  http,
  parseAbi,
  parseUnits,
  type Abi,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';

const ANVIL_URL = process.env.ANVIL_URL ?? '';
const VERSE_ID = process.env.VERSE_ID ?? '';
const GATED = process.env.WALLET_E2E === '1' && ANVIL_URL !== '' && VERSE_ID !== '';

// Playwright always runs from the repo root (its own loader rejects import.meta here).
const repo = process.cwd();
const CHAIN_ID = Number(process.env.TEST_CHAIN_ID ?? 97);

const ERC20 = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

const deployment = JSON.parse(
  readFileSync(join(repo, 'deployments', `${CHAIN_ID}.json`), 'utf8'),
) as { abiVersion: string; contracts: Record<string, string> };

// Decode baseline tracks the release the deployment table pins — the same version the
// check-abi-manifest gate blesses; a version literal here gets silently stranded by release sweeps.
const ROUTER_ABI = JSON.parse(
  readFileSync(join(repo, 'contracts', 'abi', deployment.abiVersion, 'OutrunRouter.json'), 'utf8'),
) as Abi;

// Fork-testing whale: the funded testnet deployer this repo's operations use (see the
// Layer-1 fork suite for the rationale — the faucet stock is drained on the live chain).
const WHALE = '0xBec9209dFe21f896852cd1495478D2830C4a6DB2' as Hex;

type RecordedRequest = { method: string; params: unknown };
type SendCallsRecord = {
  from: string;
  version: string;
  atomicRequired?: boolean;
  calls: { to: string; data?: string; value?: string }[];
};

type Variant = {
  id: string;
  mode: 'Standard' | 'Leverage' | 'Preorder';
  route?: 'Direct' | 'Stake' | 'Genesis Credit';
  /** Main pay asset; undefined = the form default (raise uAsset, or the stake route default). */
  pay?: 'USDC' | 'UUSD';
  amount: string;
  preorder?: { pay: 'USDC' | 'UUSD'; amount: string };
  fund: { usdc?: number; uusd?: number; credit?: boolean };
  expect: {
    /** Exact batch shape: number of ERC20 approve legs the page must issue (merged
     * same-token legs = 1; mixed-token legs = 2). The minimal-authorization property. */
    approves: number;
    /** userGenesisData delta: exact uAsset string, or '+' for a fee-adjusted Psm/Stake mint */
    genesis?: string | '+';
    /** userPreorderData delta: exact uAsset string, or '+' for a fee-adjusted Psm mint */
    preorder?: string | '+';
    /** POLend total interest delta: exact (credit/uAsset legs) or '+' (Psm leg) */
    interest?: string | '+';
  };
};

// The full UI matrix: every wired funding combo through the real page.
const VARIANTS: Variant[] = [
  // --- Standard mode / Direct route (genesis leg: uAsset or Psm) ---
  {
    id: 'std-direct-uasset',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    fund: { uusd: 6 },
    expect: { approves: 1, genesis: '5' },
  },
  {
    id: 'std-direct-uasset-pre-uasset',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { uusd: 6 },
    expect: { approves: 1, genesis: '5', preorder: '0.5' },
  },
  {
    id: 'std-direct-uasset-pre-usdc',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { uusd: 6, usdc: 2 },
    expect: { approves: 2, genesis: '5', preorder: '+' },
  },
  {
    id: 'std-direct-usdc',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    pay: 'USDC',
    fund: { usdc: 6 },
    expect: { approves: 1, genesis: '+' },
  },
  {
    id: 'std-direct-usdc-pre-uasset',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    pay: 'USDC',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { usdc: 6, uusd: 2 },
    expect: { approves: 2, genesis: '+', preorder: '0.5' },
  },
  {
    id: 'std-direct-usdc-pre-usdc',
    mode: 'Standard',
    route: 'Direct',
    amount: '5',
    pay: 'USDC',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { usdc: 8 },
    expect: { approves: 1, genesis: '+', preorder: '+' },
  },
  // --- Standard mode / Stake route (genesis leg: SP stake) ---
  {
    id: 'std-stake-usdc',
    mode: 'Standard',
    route: 'Stake',
    amount: '5',
    fund: { usdc: 6 },
    expect: { approves: 1, genesis: '5' },
  },
  {
    id: 'std-stake-usdc-pre-uasset',
    mode: 'Standard',
    route: 'Stake',
    amount: '5',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { usdc: 6, uusd: 2 },
    expect: { approves: 2, genesis: '5', preorder: '0.5' },
  },
  {
    id: 'std-stake-usdc-pre-usdc',
    mode: 'Standard',
    route: 'Stake',
    amount: '5',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { usdc: 8 },
    expect: { approves: 1, genesis: '5', preorder: '+' },
  },
  // --- Leverage mode / Direct route (interest leg: uAsset or Psm) ---
  {
    id: 'lev-direct-uasset',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    fund: { uusd: 2 },
    expect: { approves: 1, interest: '1' },
  },
  {
    id: 'lev-direct-uasset-pre-uasset',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { uusd: 3 },
    expect: { approves: 1, interest: '1', preorder: '0.5' },
  },
  {
    id: 'lev-direct-uasset-pre-usdc',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { uusd: 2, usdc: 2 },
    expect: { approves: 2, interest: '1', preorder: '+' },
  },
  {
    id: 'lev-direct-usdc',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    pay: 'USDC',
    fund: { usdc: 2 },
    expect: { approves: 1, interest: '+' },
  },
  {
    id: 'lev-direct-usdc-pre-uasset',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    pay: 'USDC',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { usdc: 2, uusd: 2 },
    expect: { approves: 2, interest: '+', preorder: '0.5' },
  },
  {
    id: 'lev-direct-usdc-pre-usdc',
    mode: 'Leverage',
    route: 'Direct',
    amount: '1',
    pay: 'USDC',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { usdc: 3 },
    expect: { approves: 1, interest: '+', preorder: '+' },
  },
  // --- Leverage mode / Genesis Credit route (interest leg: credit escrow) ---
  {
    id: 'lev-credit',
    mode: 'Leverage',
    route: 'Genesis Credit',
    amount: '1',
    fund: { credit: true },
    expect: { approves: 1, interest: '1' },
  },
  {
    id: 'lev-credit-pre-uasset',
    mode: 'Leverage',
    route: 'Genesis Credit',
    amount: '1',
    preorder: { pay: 'UUSD', amount: '0.5' },
    fund: { credit: true, uusd: 2 },
    expect: { approves: 2, interest: '1', preorder: '0.5' },
  },
  {
    id: 'lev-credit-pre-usdc',
    mode: 'Leverage',
    route: 'Genesis Credit',
    amount: '1',
    preorder: { pay: 'USDC', amount: '0.5' },
    fund: { credit: true, usdc: 2 },
    expect: { approves: 2, interest: '1', preorder: '+' },
  },
  // --- Preorder tab (preorder-only: launcher uAsset or router preorderByPSM) ---
  {
    id: 'preorder-tab-uasset',
    mode: 'Preorder',
    amount: '1',
    fund: { uusd: 2 },
    expect: { approves: 1, preorder: '1' },
  },
  {
    id: 'preorder-tab-usdc',
    mode: 'Preorder',
    amount: '1',
    pay: 'USDC',
    fund: { usdc: 2 },
    expect: { approves: 1, preorder: '+' },
  },
];

function nodeRpc(publicClient: ReturnType<typeof createPublicClient>) {
  return publicClient.transport as unknown as {
    request: (a: { method: string; params?: unknown }) => Promise<unknown>;
  };
}

async function newBurner(publicClient: ReturnType<typeof createPublicClient>): Promise<Hex> {
  const address = privateKeyToAccount(generatePrivateKey()).address as Hex;
  await nodeRpc(publicClient).request({
    method: 'anvil_setBalance',
    params: [address, '0x8ac7230489e80000'],
  });
  return address;
}

async function sendAs(
  publicClient: ReturnType<typeof createPublicClient>,
  sender: Hex,
  to: Hex,
  data: Hex,
): Promise<void> {
  const node = nodeRpc(publicClient);
  await node.request({ method: 'anvil_impersonateAccount', params: [sender] });
  await node.request({ method: 'anvil_setBalance', params: [sender, '0x8ac7230489e80000'] });
  const hash = (await node.request({
    method: 'eth_sendTransaction',
    params: [{ from: sender, to, data }],
  })) as Hex;
  for (let i = 0; i < 120; i += 1) {
    const receipt = (await node.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      expect(receipt.status).toBe('0x1');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`fork tx not mined: ${hash}`);
}

test.describe('wallet-boundary participation matrix (real page × fork)', () => {
  test.skip(!GATED, 'requires WALLET_E2E=1, ANVIL_URL and VERSE_ID (see file header)');

  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(ANVIL_URL) });
  const contracts = deployment.contracts;
  const launcher = contracts.MemeverseLauncher as Hex;
  const uusd = contracts['UAsset.UUSD'] as Hex;
  const usdc = contracts.MockUSDC as Hex;
  const credit = contracts['GenesisCredit.UUSD'] as Hex;
  const router = contracts.OutrunRouter as Hex;
  const verseId = BigInt(VERSE_ID);
  const genesisDataAbi = parseAbi([
    'function userGenesisData(uint256,address) view returns (uint128,bool,bool)',
  ]);
  const preorderDataAbi = parseAbi([
    'function userPreorderData(uint256,address) view returns (uint256,uint256,bool)',
  ]);

  const genesisFundOf = (owner: Hex) =>
    publicClient
      .readContract({
        address: launcher,
        abi: genesisDataAbi,
        functionName: 'userGenesisData',
        args: [verseId, owner],
      })
      .then(([fund]) => fund as bigint);
  const preorderFundOf = (owner: Hex) =>
    publicClient
      .readContract({
        address: launcher,
        abi: preorderDataAbi,
        functionName: 'userPreorderData',
        args: [verseId, owner],
      })
      .then(([fund]) => fund as bigint);
  const totalInterest = () =>
    publicClient
      .readContract({
        address: contracts.POLend as Hex,
        abi: parseAbi(['function getTotalLeveragedInterest(uint256) view returns (uint256)']),
        functionName: 'getTotalLeveragedInterest',
        args: [verseId],
      })
      .then((v) => v as bigint);

  /** Node side of the bridge: JSON-RPC passthrough + a sendCalls executor on the fork. */
  const bridgeCall = async (
    payload: { method: string; params?: unknown },
    log: RecordedRequest[],
    batches: Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >,
    failure?: 'user-reject' | 'internal-error' | 'on-chain-failure',
  ): Promise<unknown> => {
    const { method, params } = payload;
    if (method === 'wallet_sendCalls') {
      log.push({ method: 'wallet_sendCalls', params: (params as SendCallsRecord[])[0] });
      if (failure === 'user-reject') {
        throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      }
      if (failure === 'internal-error') {
        // The recorded MetaMask inpage shape: bare -32603 with a data object, no revert payload.
        throw Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603, data: {} });
      }
      const invocation = (params as SendCallsRecord[])[0];
      const node = nodeRpc(publicClient);
      const entries: {
        hash: Hex;
        call: { to: string; data?: string; value?: string };
        from: Hex;
      }[] = [];
      for (const call of invocation.calls) {
        await node.request({ method: 'anvil_impersonateAccount', params: [invocation.from] });
        const tx = {
          from: invocation.from as Hex,
          to: call.to as Hex,
          ...(call.data ? { data: call.data } : {}),
          ...(call.value ? { value: call.value } : {}),
        };
        log.push({ method: 'bridge.executed', params: { ...tx } });
        try {
          entries.push({
            hash: (await node.request({ method: 'eth_sendTransaction', params: [tx] })) as Hex,
            call: tx,
            from: invocation.from as Hex,
          });
        } catch (error) {
          // Fork-infra flakes (a lazy upstream state fetch failing the gas estimate) surface
          // here: record the reason and rethrow — the executor renders the generic failure.
          log.push({
            method: 'bridge.error',
            params: {
              to: tx.to,
              message: String((error as { message?: string }).message ?? error).slice(0, 300),
            },
          });
          writeFileSync(
            join(repo, 'test-results', `wallet-log-error-${Date.now()}.json`),
            JSON.stringify({ log }, null, 2),
          );
          throw error;
        }
      }
      const batchId = `0xwallet-${entries.length}-${Date.now()}`;
      batches.set(batchId, entries);
      if (failure === 'on-chain-failure') {
        // Execution is irrelevant to the UI contract in this mode: the wallet REPORTS a
        // mined, reverted bundle, and the page must render the reverted terminal state.
        batches.set(`0xfail-${batchId}`, []);
        return `0xfail-${batchId}`;
      }
      return batchId;
    }
    if (method === 'wallet_getCallsStatus') {
      const requested = (params as string[])[0];
      if (requested.startsWith('0xfail-')) {
        return {
          status: 500,
          receipts: [{ status: '0x0', transactionHash: ('0x' + 'cd'.repeat(32)) as Hex }],
        };
      }
      const entries = batches.get(requested);
      if (!entries) return { status: 500 };
      const receipts: { status: string; transactionHash: Hex; revertReason?: string }[] = [];
      for (const entry of entries) {
        for (let i = 0; i < 120; i += 1) {
          const receipt = (await publicClient.request({
            method: 'eth_getTransactionReceipt',
            params: [entry.hash],
          })) as { status?: string } | null;
          if (receipt) {
            const status = receipt.status ?? '0x1';
            let revertReason: string | undefined;
            if (status === '0x0') {
              // Replay the original payload for the revert reason (state may have moved on;
              // the gate error usually persists — diagnosis-grade, not proof).
              try {
                await nodeRpc(publicClient).request({
                  method: 'eth_call',
                  params: [
                    {
                      from: entry.from,
                      to: entry.call.to,
                      ...(entry.call.data ? { data: entry.call.data } : {}),
                      ...(entry.call.value ? { value: entry.call.value } : {}),
                    },
                    'latest',
                  ],
                });
                revertReason = 'replay unexpectedly succeeded';
              } catch (e) {
                revertReason = String((e as { message?: string }).message ?? e).slice(0, 300);
              }
            }
            receipts.push({ status, transactionHash: entry.hash, revertReason });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      if (receipts.length !== entries.length) return { status: 100 };
      const anyReverted = receipts.some((r) => r.status === '0x0');
      writeFileSync(
        join(repo, 'test-results', `wallet-log-${Date.now()}.json`),
        JSON.stringify({ log, receipts }, null, 2),
      );
      return { status: anyReverted ? 500 : 200, receipts };
    }
    // Plain JSON-RPC passthrough to the fork (eth_call, eth_estimateGas, eth_chainId...).
    return publicClient.request({
      method: method as Parameters<typeof publicClient.request>[0]['method'],
      params: (params ?? []) as never,
    });
  };

  async function injectWallet(
    page: Page,
    burner: Hex,
    log: RecordedRequest[],
    batches: Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >,
    opts: {
      /** Wallet-side failure script (the recorded real-wallet failure shapes). */
      failure?: 'user-reject' | 'internal-error' | 'on-chain-failure';
      /** Override the reported chain id (wrong-network gate tests). */
      chainIdHex?: string;
    } = {},
  ): Promise<void> {
    await page.exposeBinding('__outrunBridge', async (_source, payload: unknown) =>
      bridgeCall(payload as { method: string; params?: unknown }, log, batches, opts.failure),
    );
    await page.addInitScript(
      ([chainIdHex, address]: string[]) => {
        const bridge = (window as unknown as { __outrunBridge: unknown })
          .__outrunBridge as (payload: { method: string; params?: unknown }) => Promise<unknown>;
        window.ethereum = {
          isMetaMask: true,
          request: async (args: { method: string; params?: unknown }) => {
            const { method, params } = args;
            if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address];
            if (method === 'eth_chainId') return chainIdHex;
            if (method === 'net_version') return String(parseInt(chainIdHex, 16));
            if (method === 'wallet_getCapabilities') {
              return {
                [chainIdHex]: { atomic: { status: 'supported' } },
                '0x0': { atomic: { status: 'supported' } },
              };
            }
            return bridge({ method, params });
          },
          on: () => {},
          removeListener: () => {},
          isConnected: () => true,
        };
        window.dispatchEvent(new CustomEvent('ethereum#initialized'));
      },
      [opts.chainIdHex ?? `0x${CHAIN_ID.toString(16)}`, burner],
    );
  }

  async function connect(page: Page): Promise<void> {
    // Privy's iframe loads flakily under automation — retry the connect until the chip lands.
    await expect(async () => {
      await page.keyboard.press('Escape'); // reset a half-open dialog from the prior attempt
      // A hard reload re-arms a wedged Privy iframe (its init can exhaust attempts); the
      // init-script shim and the Node bridge survive reloads by construction.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Login' }).first().click();
      await page.getByRole('button', { name: /MetaMask/i }).click();
      await expect(page.getByRole('button', { name: /^0x/ }).first()).toBeVisible({
        timeout: 10_000,
      });
    }).toPass({ timeout: 150_000 });
  }

  /**
   * Pick an option in a "Pay with" combobox: main pay = first in DOM, preorder pay = last
   * (the stake route has no main "Pay with" — its asset rides the "Participation asset"
   * select — so the preorder combobox is the only one and last() still resolves).
   */
  async function pickPay(page: Page, which: 'main' | 'preorder', symbol: string): Promise<void> {
    const box = page
      .getByRole('combobox', { name: 'Pay with' })
      [which === 'main' ? 'first' : 'last']();
    await box.click();
    await page.getByRole('option', { name: symbol, exact: true }).click();
  }

  for (const v of VARIANTS) {
    test(`UI ${v.id}`, async ({ page }) => {
      test.setTimeout(180_000);
      const burner = await newBurner(publicClient);
      // Funding (real fork flows): whale transfers + faucet-held credits.
      if (v.fund.usdc) {
        await sendAs(
          publicClient,
          WHALE,
          usdc,
          encodeFunctionData({
            abi: ERC20,
            functionName: 'transfer',
            args: [burner, parseUnits(String(v.fund.usdc), 18)],
          }),
        );
      }
      if (v.fund.uusd) {
        await sendAs(
          publicClient,
          WHALE,
          uusd,
          encodeFunctionData({
            abi: ERC20,
            functionName: 'transfer',
            args: [burner, parseUnits(String(v.fund.uusd), 18)],
          }),
        );
      }
      let creditAmount = 0n;
      if (v.fund.credit) {
        await sendAs(
          publicClient,
          burner,
          contracts.Faucet as Hex,
          encodeFunctionData({
            abi: parseAbi(['function claimHeld(address)']),
            functionName: 'claimHeld',
            args: [credit],
          }),
        );
        creditAmount = (await publicClient.readContract({
          address: credit,
          abi: ERC20,
          functionName: 'balanceOf',
          args: [burner],
        })) as bigint;
        expect(creditAmount > 0n, 'faucet claimHeld must fund credits').toBe(true);
      }
      const genesisBefore = await genesisFundOf(burner);
      const preorderBefore = await preorderFundOf(burner);
      const interestBefore = await totalInterest();

      const log: RecordedRequest[] = [];
      const batches = new Map<
        string,
        { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
      >();
      await injectWallet(page, burner, log, batches);

      await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
      await connect(page);

      // Drive the real form through the variant's mode/route/pay/preorder selections.
      if (v.mode !== 'Standard') {
        await page.getByRole('button', { name: v.mode, exact: true }).click();
      }
      if (v.route && v.route !== 'Direct') {
        await page.getByRole('button', { name: v.route, exact: true }).click();
      }
      if (v.pay) await pickPay(page, 'main', v.pay);
      const amountLabel =
        v.mode === 'Leverage'
          ? 'Interest amount'
          : v.mode === 'Preorder'
            ? 'Preorder amount'
            : 'Amount';
      await page.getByRole('textbox', { name: amountLabel }).fill(v.amount);
      if (v.preorder) {
        await page.getByRole('button', { name: 'One-Click Preorder' }).click();
        if (v.preorder.pay !== 'UUSD') await pickPay(page, 'preorder', v.preorder.pay);
        await page.getByRole('textbox', { name: 'Preorder amount' }).fill(v.preorder.amount);
      }

      await page.getByRole('button', { name: 'Confirm Participation' }).click();
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      try {
        await expect(page.getByText(/Participation\s*Success|参与\s*成功/).first()).toBeVisible({
          timeout: 60_000,
        });
      } catch (error) {
        await test.info().attach('wallet-log', {
          body: JSON.stringify(
            {
              log: log.map((e) => ({ method: e.method, params: e.params })),
              batches: [...batches.entries()],
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        throw error;
      }

      // Wallet side: exactly one spec-shaped sendCalls whose legs hit the right spenders.
      const sent = log.filter((entry) => entry.method === 'wallet_sendCalls');
      expect(sent, 'exactly one sendCalls').toHaveLength(1);
      const invocation = sent[0]!.params as SendCallsRecord;
      expect(invocation.from.toLowerCase()).toBe(burner.toLowerCase());
      expect(invocation.version).toBe('2.0.0');
      expect(invocation.atomicRequired).toBe(true);
      const legs = invocation.calls;
      // Decode the action leg (router entries) so failures name the actual funding legs.
      const actionData = legs[legs.length - 1]!.data ?? '0x';
      let decoded = '';
      try {
        const d = decodeFunctionData({ abi: ROUTER_ABI, data: actionData as Hex });
        const fundLeg = (f: { source: number; token: string; amount: bigint }) =>
          `src=${f.source} token=${f.token} amount=${f.amount}`;
        if (d.functionName.includes('AndPreorder')) {
          const args = d.args ?? [];
          const [vid, g, pr] = args as [
            bigint,
            { source: number; token: string; amount: bigint },
            { source: number; token: string; amount: bigint },
            string,
          ];
          decoded = `${d.functionName} verse=${vid} genesis[${fundLeg(g)}] preorder[${fundLeg(pr)}] user=${args[3]}`;
        } else {
          decoded = `${d.functionName} ${JSON.stringify(d.args)}`;
        }
      } catch {
        decoded = 'undecodable';
      }
      // Minimal-authorization shape: exactly the variant's approve legs + exactly one action.
      expect(
        legs.length,
        `batch legs for ${v.id} [${decoded}]: ${JSON.stringify(
          legs.map((l) => ({ to: l.to, selector: (l.data ?? '0x').slice(0, 10) })),
        )}`,
      ).toBe(v.expect.approves + 1);
      const approveTos = legs.slice(0, v.expect.approves).map((l) => l.to.toLowerCase());
      expect(new Set(approveTos).size, 'approve legs are distinct tokens').toBe(approveTos.length);
      for (const to of approveTos) {
        expect([uusd.toLowerCase(), usdc.toLowerCase(), credit.toLowerCase()]).toContain(to);
      }
      // Action target: launcher (uAsset single legs), router (combined/PSM/stake entries),
      // POLend (leverage credit + uAsset-direct single legs).
      const actionTo = legs[legs.length - 1]!.to.toLowerCase();
      expect([
        launcher.toLowerCase(),
        router.toLowerCase(),
        (contracts.POLend as Hex).toLowerCase(),
      ]).toContain(actionTo);

      // Chain side: the ledgers book the variant's expected deltas.
      if (v.expect.genesis === '+') {
        expect((await genesisFundOf(burner)) - genesisBefore).toBeGreaterThan(0n);
      } else if (v.expect.genesis) {
        expect((await genesisFundOf(burner)) - genesisBefore).toBe(
          parseUnits(v.expect.genesis, 18),
        );
      }
      if (v.expect.preorder === '+') {
        expect((await preorderFundOf(burner)) - preorderBefore).toBeGreaterThan(0n);
      } else if (v.expect.preorder) {
        expect((await preorderFundOf(burner)) - preorderBefore).toBe(
          parseUnits(v.expect.preorder, 18),
        );
      }
      if (v.expect.interest === '+') {
        expect((await totalInterest()) - interestBefore).toBeGreaterThan(0n);
      } else if (v.expect.interest) {
        expect((await totalInterest()) - interestBefore).toBe(parseUnits(v.expect.interest, 18));
      }
    });
  }

  test('UI failure: wallet rejects the sendCalls prompt → Cancelled terminal, no success echo', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches, { failure: 'user-reject' });

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await page.getByRole('textbox', { name: 'Amount' }).fill('1');
    await page.getByRole('button', { name: 'Confirm Participation' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    // The terminal state names the cancellation and states nothing was sent — never success.
    await expect(page.getByText('Cancelled').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('You declined the request. Nothing was sent.')).toBeVisible();
    await expect(page.getByText(/Participation\s*Success/)).toHaveCount(0);
    expect(log.filter((e) => e.method === 'wallet_sendCalls')).toHaveLength(1);
  });

  test('UI failure: wallet-internal -32603 → Reverted terminal (the recorded incident shape)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches, { failure: 'internal-error' });

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await page.getByRole('textbox', { name: 'Amount' }).fill('1');
    await page.getByRole('button', { name: 'Confirm Participation' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(page.getByText('Reverted').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('The chain rejected the action. Adjust and retry.')).toBeVisible();
    await expect(page.getByText(/Participation\s*Success/)).toHaveCount(0);
  });

  test('UI failure: a batch that mines and reverts → Reverted terminal', async ({ page }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches, { failure: 'on-chain-failure' });

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await page.getByRole('textbox', { name: 'Amount' }).fill('1');
    await page.getByRole('button', { name: 'Confirm Participation' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(page.getByText('Reverted').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('The chain rejected the action. Adjust and retry.')).toBeVisible();
    await expect(page.getByText(/Participation\s*Success/)).toHaveCount(0);
  });

  test('UI gate: preorder over cap is blocked client-side (no dialog, cap FieldError)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches);

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await page.getByRole('textbox', { name: 'Amount' }).fill('5');
    await page.getByRole('button', { name: 'One-Click Preorder' }).click();
    await page.getByRole('textbox', { name: 'Preorder amount' }).fill('5'); // cap = 5×70%×25% ≈ 0.875
    await expect(page.getByText(/Exceeds your preorder cap/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Confirm Participation' }).click();
    // Submit intercepted: the review dialog never opens.
    await expect(page.getByRole('heading', { name: 'Confirm Your Participation' })).toHaveCount(0);
    expect(log.filter((e) => e.method === 'wallet_sendCalls')).toHaveLength(0);
  });

  test('UI gate: amount above wallet balance is blocked client-side', async ({ page }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient); // zero UUSD on purpose
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches);

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await page.getByRole('textbox', { name: 'Amount' }).fill('5');
    await expect(page.getByText('Insufficient balance.').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Confirm Participation' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Your Participation' })).toHaveCount(0);
    expect(log.filter((e) => e.method === 'wallet_sendCalls')).toHaveLength(0);
  });

  test('UI gate: a wallet on the wrong network flips the CTA to the network switch', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    // Sepolia (11155111) is a supported wallet chain but not this verse's execution chain.
    await injectWallet(page, burner, log, batches, { chainIdHex: '0x7a69' });

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await expect(
      page.getByRole('button', { name: /Switch to BNB Smart Chain Testnet/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Confirm Participation' })).toHaveCount(0);
    expect(log.filter((e) => e.method === 'wallet_sendCalls')).toHaveLength(0);
  });

  test('UI repeat: the same wallet participates twice and the ledger accumulates', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const burner = await newBurner(publicClient);
    await sendAs(
      publicClient,
      WHALE,
      uusd,
      encodeFunctionData({
        abi: ERC20,
        functionName: 'transfer',
        args: [burner, parseUnits('5', 18)],
      }),
    );
    const genesisBefore = await genesisFundOf(burner);
    const log: RecordedRequest[] = [];
    const batches = new Map<
      string,
      { hash: Hex; call: { to: string; data?: string; value?: string }; from: Hex }[]
    >();
    await injectWallet(page, burner, log, batches);

    await page.goto(`/memeverse/${VERSE_ID}`, { waitUntil: 'domcontentloaded' });
    await connect(page);

    for (let round = 0; round < 2; round += 1) {
      await page.getByRole('textbox', { name: 'Amount' }).fill('1');
      await page.getByRole('button', { name: 'Confirm Participation' }).click();
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(page.getByText(/Participation\s*Success|参与\s*成功/).first()).toBeVisible({
        timeout: 60_000,
      });
      // Close the success dialog; the form keeps its amount for the next round.
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('heading', { name: 'Confirm Your Participation' })).toHaveCount(
        0,
      );
    }

    expect(log.filter((e) => e.method === 'wallet_sendCalls')).toHaveLength(2);
    expect((await genesisFundOf(burner)) - genesisBefore).toBe(parseUnits('2', 18));
  });
});
