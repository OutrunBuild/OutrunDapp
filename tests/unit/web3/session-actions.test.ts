// Session action builder tests (stage 6 step 3/4): every Router/Hook write leg encodes
// against the frozen v1-rc ABIs (byte snapshots); approval defaults to the exact amount
// with unlimited as an explicit opt-in; session assembly keeps approval? → begin →
// action → end.
import { describe, expect, it } from 'vitest';
import { decodeFunctionData, getFunctionSelector, maxUint256, padHex, type Hex } from 'viem';

import { faucetAbi, kernelAbi, launcherAbi, outrunRouterAbi } from '../../../lib/web3/abis';
import {
  approvalCall,
  beginSessionCall,
  buildSessionWrite,
  encodeSessionCalldata,
  endSessionCall,
  faucetBatchClaimCall,
  faucetClaimCall,
  flashPolToYtCall,
  fundCreditInput,
  fundUAssetInput,
  genesisAndPreorderCall,
  genesisCall,
  leveragedGenesisAndPreorderCall,
  limitForDirection,
  MAX_SQRT_PRICE_X96,
  mergeCall,
  MIN_SQRT_PRICE_X96,
  mintPolCall,
  oftSendCall,
  psmMintCall,
  redeemMemecoinLiquidityUnwrapCall,
  redeemPtCall,
  registerAtCenterCall,
  splitCall,
  stakingRedeemCall,
  swapExactInputCall,
  UNLIMITED_APPROVAL,
  usrDepositCall,
  type PoolKey,
  vaultDepositCall,
  vaultRequestRedeemCall,
  vaultWithdrawCall,
} from '../../../lib/web3/session-actions';

const TOKEN = '0x3333333333333333333333333333333333333333' as Hex;
const ROUTER = '0x4444444444444444444444444444444444444444' as Hex;
const HOOK = '0x5555555555555555555555555555555555555555' as Hex;
const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const KEY: PoolKey = {
  currency0: TOKEN,
  currency1: EOA,
  fee: 3000,
  tickSpacing: 60,
  hooks: HOOK,
};

describe('approvalCall', () => {
  it('encodes the exact amount by default and max only on explicit opt-in', () => {
    expect(UNLIMITED_APPROVAL).toBe(maxUint256);
    const exact = approvalCall(TOKEN, ROUTER, 100n);
    expect(exact.target).toBe(TOKEN);
    expect(exact).toMatchSnapshot();
    const unlimited = approvalCall(TOKEN, ROUTER, UNLIMITED_APPROVAL);
    expect(unlimited.callData).not.toBe(exact.callData);
  });
});

describe('session legs', () => {
  it('snapshots begin/end/swap/genesis/mint/psm/faucet/usr legs', () => {
    expect(beginSessionCall(HOOK)).toMatchSnapshot();
    expect(endSessionCall(HOOK)).toMatchSnapshot();
    expect(
      swapExactInputCall(ROUTER, {
        key: KEY,
        zeroForOne: true,
        amountIn: 1000n,
        amountOutMinimum: 990n,
        recipient: EOA,
        deadline: 9999999999n,
      }),
    ).toMatchSnapshot();
    expect(genesisCall(ROUTER, { verseId: 21n, amountInUAsset: 50n, user: EOA })).toMatchSnapshot();
    expect(
      genesisAndPreorderCall(ROUTER, {
        verseId: 21n,
        genesis: fundUAssetInput(50n),
        preorder: fundUAssetInput(10n),
        user: EOA,
      }),
    ).toMatchSnapshot();
    expect(
      mintPolCall(ROUTER, {
        verseId: 21n,
        amountInUAssetDesired: 50n,
        amountInMemecoinDesired: 60n,
        amountInUAssetMin: 49n,
        amountInMemecoinMin: 59n,
        amountOutDesired: 5n,
        deadline: 9999999999n,
      }),
    ).toMatchSnapshot();
    expect(psmMintCall(ROUTER, EOA, 100n)).toMatchSnapshot();
    expect(faucetClaimCall(ROUTER, TOKEN)).toMatchSnapshot();
    expect(usrDepositCall(ROUTER, 100n, EOA)).toMatchSnapshot();
    expect(splitCall(ROUTER, 21n, 10n)).toMatchSnapshot();
    expect(mergeCall(ROUTER, 21n, 10n)).toMatchSnapshot();
    expect(redeemPtCall(ROUTER, { verseId: 21n, ptAmount: 5n, to: EOA })).toMatchSnapshot();
    expect(
      flashPolToYtCall(ROUTER, {
        verseId: 21n,
        exactYTOut: 5n,
        maxPOLIn: 10n,
        sqrtPriceLimitX96: 1n,
        recipient: EOA,
        deadline: 9999999999n,
      }),
    ).toMatchSnapshot();
    expect(
      oftSendCall(
        ROUTER,
        {
          dstEid: 30184,
          to: padHex(EOA, { size: 32 }),
          amountLD: 100n,
          minAmountLD: 100n,
          extraOptions: '0x',
          composeMsg: '0x',
          oftCmd: '0x',
        },
        1000n,
        EOA,
        1000n,
      ),
    ).toMatchSnapshot();
    expect(
      stakingRedeemCall(ROUTER, {
        positionId: 7n,
        syRedeemed: 100n,
        receiver: EOA,
        tokenOut: TOKEN,
        minTokenOut: 99n,
      }),
    ).toMatchSnapshot();
    expect(
      redeemMemecoinLiquidityUnwrapCall(ROUTER, {
        verseId: 21n,
        amountInPOL: 10n,
        amount0Min: 5n,
        amount1Min: 5n,
        deadline: 9999999999n,
      }),
    ).toMatchSnapshot();
    expect(vaultDepositCall(ROUTER, 100n, EOA)).toMatchSnapshot();
    expect(
      vaultRequestRedeemCall(ROUTER, { shares: 100n, controller: EOA, owner: EOA }),
    ).toMatchSnapshot();
    expect(
      vaultWithdrawCall(ROUTER, { assets: 100n, receiver: EOA, owner: EOA }),
    ).toMatchSnapshot();
    expect(
      registerAtCenterCall(ROUTER, {
        name: 'Name',
        symbol: 'SYM',
        uri: '',
        desc: 'desc',
        communities: [],
        durationDays: 2n,
        omnichainIds: [421614],
        uAsset: TOKEN,
        flashGenesis: false,
      }),
    ).toMatchSnapshot();
  });

  it('pins sqrt price limits per direction', () => {
    expect(MIN_SQRT_PRICE_X96).toBe(4295128739n);
    expect(MAX_SQRT_PRICE_X96).toBe(1461446703485210103287273052203988822378723970342n);
    expect(limitForDirection(true)).toBe(MIN_SQRT_PRICE_X96 + 1n);
    expect(limitForDirection(false)).toBe(MAX_SQRT_PRICE_X96 - 1n);
  });
});

describe('encodeSessionCalldata', () => {
  it('assembles approval → begin → action → end inside Kernel execute', () => {
    const data = encodeSessionCalldata({
      hook: HOOK,
      approval: approvalCall(TOKEN, ROUTER, 1000n),
      action: swapExactInputCall(ROUTER, {
        key: KEY,
        zeroForOne: true,
        amountIn: 1000n,
        amountOutMinimum: 990n,
        recipient: EOA,
        deadline: 9999999999n,
      }),
    });
    const decoded = decodeFunctionData({ abi: kernelAbi, data });
    expect(decoded.functionName).toBe('execute');
    expect(data).toMatchSnapshot();
  });

  it('omits approval when nothing needs it', () => {
    const withApproval = encodeSessionCalldata({
      hook: HOOK,
      approval: approvalCall(TOKEN, ROUTER, 1n),
      action: genesisCall(ROUTER, { verseId: 1n, amountInUAsset: 1n, user: EOA }),
    });
    const without = encodeSessionCalldata({
      hook: HOOK,
      action: genesisCall(ROUTER, { verseId: 1n, amountInUAsset: 1n, user: EOA }),
    });
    expect(withApproval).not.toBe(without);
    expect(without.startsWith('0x')).toBe(true);
  });
});

describe('buildSessionWrite', () => {
  it('returns the same legs for 5792 and the Kernel calldata in session order', () => {
    const input = {
      hook: HOOK,
      approval: approvalCall(TOKEN, ROUTER, 1000n),
      action: genesisCall(ROUTER, { verseId: 1n, amountInUAsset: 1n, user: EOA }),
    };
    const { calls, calldata } = buildSessionWrite(input);
    expect(calls.map((leg) => leg.target)).toEqual([TOKEN, HOOK, ROUTER, HOOK]);
    expect(calldata).toBe(encodeSessionCalldata(input));
  });
});

describe('faucet direct legs', () => {
  it('batchClaim targets the Faucet with the token array (no session guards)', () => {
    const leg = faucetBatchClaimCall(ROUTER, [TOKEN, EOA]);
    expect(leg.target).toBe(ROUTER);
    expect(leg.value).toBe(0n);
    const decoded = decodeFunctionData({ abi: faucetAbi, data: leg.callData });
    expect(decoded.functionName).toBe('batchClaim');
    expect(decoded.args).toEqual([[TOKEN, EOA]]);
    expect(leg.callData).toMatchSnapshot();
  });
});

describe('overload resolution', () => {
  it('encodes the 6-param unwrap overload (not the 2-param one)', () => {
    const leg = redeemMemecoinLiquidityUnwrapCall(ROUTER, {
      verseId: 21n,
      amountInPOL: 10n,
      amount0Min: 5n,
      amount1Min: 6n,
      deadline: 9999999999n,
    });
    const decoded = decodeFunctionData({ abi: launcherAbi, data: leg.callData });
    expect(decoded.functionName).toBe('redeemMemecoinLiquidity');
    expect(decoded.args).toEqual([21n, 10n, true, 5n, 6n, 9999999999n]);
  });
});

describe('combined router entrypoints', () => {
  // Both entrypoints share the FundInput shape: (uint8,address,uint256,address,uint256,uint256).
  const fundInputSig = '(uint8,address,uint256,address,uint256,uint256)';
  const zeroAddress = '0x0000000000000000000000000000000000000000' as Hex;
  const uAssetLeg = (amount: bigint) => ({
    source: 0,
    token: zeroAddress,
    amount,
    sp: zeroAddress,
    minSyOut: 0n,
    minUAssetMinted: 0n,
  });

  it('genesisAndPreorder targets the router with two uAsset FundInput legs', () => {
    const leg = genesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundUAssetInput(50n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(leg.target).toBe(ROUTER);
    expect(leg.value).toBe(0n);
    expect(leg.callData.slice(0, 10)).toBe(
      getFunctionSelector(`genesisAndPreorder(uint256,${fundInputSig},${fundInputSig},address)`),
    );
    const decoded = decodeFunctionData({ abi: outrunRouterAbi, data: leg.callData });
    expect(decoded.functionName).toBe('genesisAndPreorder');
    expect(decoded.args).toEqual([21n, uAssetLeg(50n), uAssetLeg(10n), EOA]);
  });

  it('leveragedGenesisAndPreorder composes credit/uAsset legs per route', () => {
    const credit = leveragedGenesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundCreditInput(7n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(credit.target).toBe(ROUTER);
    expect(credit.callData.slice(0, 10)).toBe(
      getFunctionSelector(
        `leveragedGenesisAndPreorder(uint256,${fundInputSig},${fundInputSig},address)`,
      ),
    );
    const decodedCredit = decodeFunctionData({ abi: outrunRouterAbi, data: credit.callData });
    expect(decodedCredit.functionName).toBe('leveragedGenesisAndPreorder');
    expect(decodedCredit.args).toEqual([
      21n,
      {
        source: 3,
        token: zeroAddress,
        amount: 7n,
        sp: zeroAddress,
        minSyOut: 0n,
        minUAssetMinted: 0n,
      },
      uAssetLeg(10n),
      EOA,
    ]);

    const uAsset = leveragedGenesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundUAssetInput(5n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    const decodedUAsset = decodeFunctionData({ abi: outrunRouterAbi, data: uAsset.callData });
    expect(decodedUAsset.args).toEqual([21n, uAssetLeg(5n), uAssetLeg(10n), EOA]);
  });
});

describe('combined entrypoint golden calldata vectors', () => {
  // Golden vectors generated with `cast calldata` against IOutrunRouter at OutStake HEAD,
  // whose enum order is UAsset=0, Psm=1, Stake=2, Credit=3. The router ABI erases the enum
  // to a bare uint8, so decode-based assertions cannot see the numeric↔semantic FUND_SOURCE
  // mapping — only byte-exact calldata can: the golden vector pins the mapping against
  // contract-side enum reorder and builder typos alike (calldata bytes change iff mapping
  // drifts). The credit-leg genesisAndPreorder vector is an encoder-level pin: the runtime
  // family matrix rejects Credit there (FundSourceNotAllowed); only the leveraged entry
  // accepts a credit-funded genesis leg.
  const golden = {
    genesisAndPreorderCredit:
      '0x4c1def1d000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111',
    genesisAndPreorderUAsset:
      '0x4c1def1d000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111',
    leveragedGenesisAndPreorderCredit:
      '0x26cec0dd000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111',
    leveragedGenesisAndPreorderUAsset:
      '0x26cec0dd000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111',
  } as const;

  it('genesisAndPreorder byte-exact: credit genesis leg encodes source=3', () => {
    const leg = genesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundCreditInput(50n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(leg.callData).toBe(golden.genesisAndPreorderCredit);
  });

  it('genesisAndPreorder byte-exact: uAsset legs encode source=0', () => {
    const leg = genesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundUAssetInput(50n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(leg.callData).toBe(golden.genesisAndPreorderUAsset);
  });

  it('leveragedGenesisAndPreorder byte-exact: credit genesis leg encodes source=3', () => {
    const leg = leveragedGenesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundCreditInput(7n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(leg.callData).toBe(golden.leveragedGenesisAndPreorderCredit);
  });

  it('leveragedGenesisAndPreorder byte-exact: uAsset genesis leg encodes source=0', () => {
    const leg = leveragedGenesisAndPreorderCall(ROUTER, {
      verseId: 21n,
      genesis: fundUAssetInput(5n),
      preorder: fundUAssetInput(10n),
      user: EOA,
    });
    expect(leg.callData).toBe(golden.leveragedGenesisAndPreorderUAsset);
  });
});
