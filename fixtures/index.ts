// Fixture 唯一导出入口（阶段 2 步骤 9）。
// 哨兵常量供边界检查器扫描：生产代码出现该标识即违规（scripts/check-fixture-boundary.mjs）。
// 允许的 import 图：fixtures/** → lib/data/fixture-repository.ts → components/**（ui/design-system 除外）或 fixtures/inspector/**
export const OUTRUN_FIXTURE_ONLY_v1 = 'OUTRUN_FIXTURE_ONLY_v1' as const;

export type * from './schema';

import chains from './data/chains.json';
import assets from './data/assets.json';
import verses from './data/verses.json';
import markets from './data/markets.json';
import positions from './data/positions.json';
import psm from './data/psm.json';
import usrVaults from './data/usr-vaults.json';
import bridgeMessages from './data/bridge-messages.json';
import transactions from './data/transactions.json';
import governance from './data/governance.json';
import staking from './data/staking.json';
import polPositions from './data/pol-positions.json';
import accounts from './data/accounts.json';
import notifications from './data/notifications.json';
import participations from './data/participations.json';
import yieldSources from './data/yield-sources.json';
import createConfig from './data/create-config.json';
import balances from './data/balances.json';
import scenarios from './scenarios/states.json';

export const fixtureData = {
  chains, assets, verses, markets, positions, psm, usrVaults,
  bridgeMessages, transactions, governance, staking, polPositions, accounts, notifications, participations, yieldSources, createConfig, balances, scenarios,
} as const;
