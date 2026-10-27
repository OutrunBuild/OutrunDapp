#!/usr/bin/env node
// Generates subgraph/subgraph.yaml from deployments/{chainId}.json — the only legal contract
// address source (architecture.md §5). Rerun after any deployment change:
//   node scripts/gen-subgraph-config.mjs
// Per-source startBlocks default to the chain's deploymentBlock; MemeverseYTFlashSwapRouter uses
// its own later deployment blocks (architecture.md §27 broadcast records). Optional per-chain
// sources (RegistrationCenter/GenesisCredit/StakingPosition variants) are emitted only where the
// deployment manifest carries the key.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CURRENT_ABI_VERSION } from './deployment-schema.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
// key = The Graph canonical network id (TheGraphNetworksRegistry.json — the Studio deploy API only
// accepts these, aliases like bnb-testnet/bsc-testnet are rejected as "network is not supported");
// file = the manifest file name, decoupled so repo naming stays independent of registry ids
const NETWORKS = [
  { key: 'arbitrum-sepolia', chainId: '421614', file: 'arbitrum-sepolia' },
  { key: 'base-sepolia', chainId: '84532', file: 'base-sepolia' },
  { key: 'chapel', chainId: '97', file: 'bnb-testnet' },
];
const deployment = (chainId) =>
  JSON.parse(readFileSync(join(repo, 'deployments', `${chainId}.json`), 'utf8'));

//YTFlashSwapRouter per-chain deployment blocks (§27); all other sources start at the chain block
const YT_FLASH_BLOCKS = { 421614: 319059915, 84532: 48102821, 97: 136726282 };

const camel = (s) => {
  const cased = s.replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase());
  return cased.charAt(0).toUpperCase() + cased.slice(1).toLowerCase();
};

// --- ABI event signature resolution (graph manifests need full signatures) -------------
const abiCache = new Map();
// third-party / non-frozen fragments kept locally (PoolManager v4 Swap, ProxyDeployer events
// for the settlement-deploy governance addresses)
const LOCAL_ABIS = new Set(['UniswapV4PoolManager', 'MemeverseProxyDeployer']);
function loadAbi(abiFile) {
  if (!abiCache.has(abiFile)) {
    const p = LOCAL_ABIS.has(abiFile)
      ? join(repo, 'subgraph', 'abis', `${abiFile}.json`)
      : join(repo, 'contracts', 'abi', CURRENT_ABI_VERSION, `${abiFile}.json`);
    abiCache.set(abiFile, JSON.parse(readFileSync(p, 'utf8')));
  }
  return abiCache.get(abiFile);
}
function sigType(input) {
  if (input.type === 'tuple') return `(${input.components.map((c) => sigType(c)).join(',')})`;
  if (input.type === 'tuple[]') return `(${input.components.map((c) => sigType(c)).join(',')})[]`;
  return input.type;
}
/** Full event signature "Name(indexed type,...)" from the frozen ABI */
function eventSig(abiFile, eventName) {
  const entry = loadAbi(abiFile).find((e) => e.type === 'event' && e.name === eventName);
  if (!entry) throw new Error(`event ${eventName} not found in ${abiFile}.json`);
  return `${eventName}(${entry.inputs.map((i) => (i.indexed ? 'indexed ' : '') + sigType(i)).join(',')})`;
}

// [sourceName, abiFile, deploymentKeyPattern, mappingFile, handlers[[event, handler]], entities[]]
const STATIC_SOURCES = [
  [
    'Launcher',
    'MemeverseLauncherUpgradeable',
    /^MemeverseLauncher$/,
    'src/verse-participation.ts',
    [
      ['RegisterMemeverse', 'handleRegisterMemeverse'],
      ['ChangeStage', 'handleChangeStage'],
      ['SetExternalInfo', 'handleSetExternalInfo'],
      ['Genesis', 'handleGenesis'],
      ['Preorder', 'handlePreorder'],
      ['Refund', 'handleRefund'],
      ['RefundPreorder', 'handleRefundPreorder'],
      ['ClaimNormalFees', 'handleClaimNormalFees'],
      ['ClaimNormalYT', 'handleClaimNormalYT'],
      ['ClaimPreorderMemecoin', 'handleClaimPreorderMemecoin'],
    ],
    [
      'Verse',
      'VerseStageChange',
      'VerseParticipant',
      'ProtocolStats',
      'GenesisParticipation',
      'PreorderParticipation',
      'ParticipationRefund',
      'ParticipationClaim',
    ],
  ],
  [
    'Polend',
    'POLendUpgradeable',
    /^POLend$/,
    'src/participation-polend.ts',
    [
      ['LeveragedGenesis', 'handleLeveragedGenesis'],
      ['LeveragedGenesisWithCredit', 'handleLeveragedGenesisWithCredit'],
      ['ClaimRefund', 'handlePolendClaimRefund'],
      ['CreditRefunded', 'handleCreditRefunded'],
      ['ClaimLeveragedYT', 'handleClaimLeveragedYT'],
      ['ClaimResidual', 'handleClaimResidual'],
    ],
    [
      'Verse',
      'VerseParticipant',
      'ProtocolStats',
      'LeveragedGenesisParticipation',
      'ParticipationRefund',
      'ParticipationClaim',
    ],
  ],
  [
    'PolSplitter',
    'POLSplitterUpgradeable',
    /^POLSplitter$/,
    'src/tokens.ts',
    [
      ['Split', 'handleSplit'],
      ['Merge', 'handleMerge'],
      ['RedeemPT', 'handleRedeemPT'],
      ['RedeemYT', 'handleRedeemYT'],
    ],
    ['ParticipationClaim'],
  ],
  [
    'Hook',
    'MemeverseUniswapHookUpgradeable',
    /^MemeverseUniswapHook$/,
    'src/swap.ts',
    [
      ['PoolInitialized', 'handlePoolInitialized'],
      ['PoolInitializationAuthorized', 'handlePoolInitializationAuthorized'],
      ['LiquidityAdded', 'handleLiquidityAdded'],
      ['LiquidityRemoved', 'handleLiquidityRemoved'],
      ['FeesClaimed', 'handleFeesClaimed'],
      ['LPFeeCollected', 'handleLPFeeCollected'],
      ['ProtocolFeeCollected', 'handleProtocolFeeCollected'],
      ['ReferralRebateAccrued', 'handleReferralRebateAccrued'],
      ['ReferralRebateClaimed', 'handleReferralRebateClaimed'],
    ],
    ['Pool', 'PoolLiquidity', 'PoolFee', 'ReferralRebate'],
  ],
  [
    'PoolManager',
    'UniswapV4PoolManager',
    /^UniswapV4PoolManager$/,
    'src/swap.ts',
    [['Swap', 'handlePoolSwap']],
    ['PoolSwap'],
  ],
  [
    'YTFlashSwapRouter',
    'MemeverseYTFlashSwapRouter',
    /^MemeverseYTFlashSwapRouter$/,
    'src/swap.ts',
    [
      ['YTFlashSwapPOLForYT', 'handleYTFlashSwapPOLForYT'],
      ['YTFlashSwapYTForPOL', 'handleYTFlashSwapYTForPOL'],
    ],
    ['YTFlashSwap'],
  ],
  [
    'Interoperation',
    'MemeverseOmnichainInteroperation',
    /^MemeverseOmnichainInteroperation$/,
    'src/crosschain.ts',
    [['OmnichainMemecoinStaking', 'handleInteroperationStaking']],
    ['LayerZeroMessage'],
  ],
  [
    'Staker',
    'OmnichainMemecoinStakerUpgradeable',
    /^OmnichainMemecoinStaker$/,
    'src/crosschain.ts',
    [
      ['OmnichainMemecoinStakingProcessed', 'handleStakingProcessed'],
      ['StakingComposeSettled', 'handleStakingComposeSettled'],
      ['ComposeRejected', 'handleComposeRejected'],
    ],
    ['LayerZeroMessage'],
  ],
  [
    'RegistrationCenter',
    'MemeverseRegistrationCenterUpgradeable',
    /^MemeverseRegistrationCenter$/,
    'src/registration.ts',
    [['Registration', 'handleRegistration']],
    ['SymbolRegistration'],
  ],
  [
    'ProxyDeployer',
    'MemeverseProxyDeployer',
    /^MemeverseProxyDeployer$/,
    'src/governance-deploy.ts',
    [
      ['DeployYieldVault', 'handleDeployYieldVault'],
      ['DeployGovernorAndIncentivizer', 'handleDeployGovernorAndIncentivizer'],
    ],
    ['Verse'],
  ],
];

// families keyed by deployment contract-key prefix; one source per matching key
const FAMILY_SOURCES = [
  [
    'OutrunPSM.',
    'OutrunPSMUpgradeable',
    'src/outstake.ts',
    [
      ['SwapMintForUAsset', 'handlePsmMint'],
      ['SwapRedeemForReserve', 'handlePsmRedeem'],
    ],
    ['PsmSwap'],
  ],
  [
    'OutrunUSRVault.',
    'OutrunUSRVaultUpgradeable',
    'src/outstake.ts',
    [
      ['Deposit', 'handleUsrDeposit'],
      ['Withdraw', 'handleUsrWithdraw'],
    ],
    ['UsrVaultActivity'],
  ],
  [
    'OutrunStakingPosition.',
    'OutrunStakingPositionUpgradeable',
    null,
    [
      ['Stake', 'handleCdpStake'],
      ['StakeForGenesis', 'handleCdpStakeForGenesis'],
      ['Redeem', 'handleCdpRedeem'],
    ],
    ['CdpPositionEvent'],
  ],
  [
    'GenesisCredit.',
    'GenesisCredit',
    'src/genesis-credit.ts',
    [['Claimed', 'handleGenesisCreditClaimed']],
    ['GenesisCreditClaim'],
  ],
  [
    'UAsset.',
    'OutrunUniversalAssetsUpgradeable',
    'src/crosschain.ts',
    [
      ['OFTSent', 'handleUAssetOftSent'],
      ['OFTReceived', 'handleUAssetOftReceived'],
    ],
    ['LayerZeroMessage'],
  ],
];

const TEMPLATE_SOURCES = [
  [
    'Memecoin',
    'Memecoin',
    'src/crosschain.ts',
    [
      ['OFTSent', 'handleMemecoinOftSent'],
      ['OFTReceived', 'handleMemecoinOftReceived'],
    ],
    ['LayerZeroMessage'],
  ],
  // Token Transfer indexing is deliberately absent (POL/PT/YT templates dropped with it): no
  // product query path consumes raw transfers, balances are RPC-domain, and full indexing grows
  // unbounded on mainnet. Revisit only when a concrete consumer appears.
  [
    'MemecoinYieldVault',
    'MemecoinYieldVault',
    'src/tokens.ts',
    [
      ['Deposit', 'handleVaultDeposit'],
      ['Withdraw', 'handleVaultWithdraw'],
      ['RedeemRequest', 'handleVaultRedeemRequest'],
      ['DelegateChanged', 'handleVaultDelegateChanged'],
      ['AccumulateYields', 'handleVaultAccumulateYields'],
    ],
    ['VaultActivity'],
  ],
  [
    'MemecoinDaoGovernor',
    'MemecoinDaoGovernorUpgradeable',
    'src/governance.ts',
    [
      ['ProposalCreated', 'handleProposalCreated'],
      ['ProposalCanceled', 'handleProposalCanceled'],
      ['ProposalQueued', 'handleProposalQueued'],
      ['ProposalExecuted', 'handleProposalExecuted'],
      ['VoteCast', 'handleVoteCast'],
    ],
    ['GovernanceProposal', 'GovernanceVote'],
  ],
  [
    'GovernanceCycleIncentivizer',
    'GovernanceCycleIncentivizerUpgradeable',
    'src/governance.ts',
    [
      ['CycleStarted', 'handleCycleStarted'],
      ['CycleFinalized', 'handleCycleFinalized'],
      ['RewardClaimed', 'handleRewardClaimed'],
      ['TreasuryIncomeRecorded', 'handleTreasuryIncome'],
      ['TreasuryAssetSpendRecorded', 'handleTreasurySpend'],
    ],
    ['GovernanceCycle', 'GovernanceRewardClaim', 'TreasuryActivity'],
  ],
];

const ABI_DIR = `../contracts/abi/${CURRENT_ABI_VERSION}`;
const LOCAL_ABI_DIR = './abis'; // third-party standard fragments kept locally (PoolManager Swap)

const yamlDataSource = (name, abiFile, address, startBlock, file, handlers, entities, abiDir) => {
  const h = handlers.map(
    ([event, handler]) => `      - event: ${eventSig(abiFile, event)}
        handler: ${handler}`,
  );
  const e = entities.map((x) => `      - ${x}`);
  return `  - kind: ethereum
    name: ${name}
    network: __NETWORK__
    source:
      address: "${address}"
      abi: ${name}
      startBlock: ${startBlock}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
${e.join('\n')}
      abis:
        - name: ${name}
          file: ${abiDir}/${abiFile}.json
      eventHandlers:
${h.join('\n')}
      file: ${file}
`;
};

const yamlTemplate = ([name, abiFile, file, handlers, entities]) => {
  const h = handlers.map(
    ([event, handler]) => `      - event: ${eventSig(abiFile, event)}
        handler: ${handler}`,
  );
  const e = entities.map((x) => `      - ${x}`);
  return `  - kind: ethereum
    name: ${name}
    network: __NETWORK__
    source:
      abi: ${name}
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
${e.join('\n')}
      abis:
        - name: ${name}
          file: ${ABI_DIR}/${abiFile}.json
      eventHandlers:
${h.join('\n')}
      file: ${file}
`;
};

// graph-cli allows exactly ONE network per manifest (and per Studio deployment): emit one
// manifest per testnet; step 5 deploys each against its own slug
for (const net of NETWORKS) {
  const dep = deployment(net.chainId);
  const defaultBlock = dep.deploymentBlock;
  const keys = Object.keys(dep.contracts);
  const sources = [];
  for (const [name, abiFile, keyRe, file, handlers, entities] of STATIC_SOURCES) {
    const key = keys.find((k) => keyRe.test(k));
    if (!key) continue; // optional per-chain source (e.g. RegistrationCenter on the hub only)
    const block = name === 'YTFlashSwapRouter' ? YT_FLASH_BLOCKS[net.chainId] : defaultBlock;
    sources.push(
      yamlDataSource(
        name,
        abiFile,
        dep.contracts[key],
        block,
        file,
        handlers,
        entities,
        LOCAL_ABIS.has(abiFile) ? LOCAL_ABI_DIR : ABI_DIR,
      ),
    );
  }
  for (const [prefix, abiFile, file, handlers, entities] of FAMILY_SOURCES) {
    for (const key of keys.filter((k) => k.startsWith(prefix))) {
      const suffix = camel(key.slice(prefix.length)); // UETH -> Ueth, slisBNB -> Slisbnb
      // StakingPosition variants split per chain: slisBNB exists on BSC Testnet only and gets its
      // own mapping file so remote manifests never compile its generated imports
      const resolvedFile =
        file === null
          ? suffix === 'Slisbnb'
            ? 'src/outstake-slisbnb.ts'
            : 'src/outstake.ts'
          : file;
      const sourceName =
        prefix === 'OutrunPSM.'
          ? `Psm${suffix}`
          : prefix === 'OutrunUSRVault.'
            ? `UsrVault${suffix}`
            : prefix === 'OutrunStakingPosition.'
              ? `StakingPosition${suffix}`
              : prefix === 'GenesisCredit.'
                ? `GenesisCredit${suffix}`
                : `UAsset${suffix}`;
      // one handler per family instance (codegen event types are per-source nominal classes)
      const scopedHandlers = handlers.map(([event, handler]) => [event, `${handler}${suffix}`]);
      sources.push(
        yamlDataSource(
          sourceName,
          abiFile,
          dep.contracts[key],
          defaultBlock,
          resolvedFile,
          scopedHandlers,
          entities,
          ABI_DIR,
        ),
      );
    }
  }
  const out =
    `# GENERATED by scripts/gen-subgraph-config.mjs from deployments/${net.chainId}.json -- do not edit by hand;
# regenerate after deployment changes. Addresses come only from the deployment manifest.
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
` +
    sources.map((s) => s.replaceAll('__NETWORK__', net.key)).join('') +
    '\ntemplates:\n' +
    TEMPLATE_SOURCES.map((t) => yamlTemplate(t).replaceAll('__NETWORK__', net.key)).join('');
  writeFileSync(join(repo, 'subgraph', `subgraph.${net.file}.yaml`), out);
  console.log(
    `subgraph/subgraph.${net.file}.yaml written (${out.split('\n').length} lines, network=${net.key})`,
  );
}
