// Sole fixture export entry point.
// Sentinel constant for the boundary checker to scan: its presence in production code is a violation
// (scripts/check-fixture-boundary.mjs).
// Allowed import graph: fixtures/** -> lib/data/fixture-repository.ts -> components/** (excluding
// ui/design-system) or fixtures/inspector/**
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
import referral from './data/referral.json';
import faucet from './data/faucet.json';
import scenarios from './scenarios/states.json';

export const fixtureData = {
  chains, assets, verses, markets, positions, psm, usrVaults,
  bridgeMessages, transactions, governance, staking, polPositions, accounts, notifications, participations, yieldSources, createConfig, balances, referral, faucet, scenarios,
} as const;
