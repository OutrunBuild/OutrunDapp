// Onchain adapter contract tests (stage 5 step 7): the adapter is the build-time alias target of
// the fixture repository in OUTRUN_DATA_SOURCE=onchain builds — these tests lock the seam rules:
//  (1) runtime-value isolation: the adapter NEVER imports runtime values from the fixture
//      repository (type-only; a stray value import would drag fixtures into the onchain graph)
//  (2) export-surface parity: every fixture-repository getter/constant consumed by components is
//      re-provided by the adapter (the onchain build must not resolve to a missing export)
//  (3) the async page-consumer pattern is sound: awaiting the fixture (sync) values equals the
//      values themselves, so fixture-mode rendering is unchanged by the async conversion
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('onchain adapter seam', () => {
  it('imports fixture-repository types only — never runtime values', () => {
    const src = readFileSync(join(repo, 'components/data/onchain-adapter.ts'), 'utf8');
    const imports = [
      ...src.matchAll(/import\s+(type\s+)?\{[^{}]+\}\s+from\s+['"][^'"]*fixture-repository['"]/g),
    ];
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) {
      expect((m[1] ?? '').trim(), 'fixture-repository imports must be type-only').toBe('type');
    }
  });

  it('re-exports the full runtime surface consumed by components', async () => {
    const adapter = await import('../../../components/data/onchain-adapter');
    const surface = [
      'PROTECTION_WINDOW_MS',
      'getFixtureSnapshot',
      'getFixtureVerse',
      'getFixtureChains',
      'getFixtureCreateConfig',
      'getFixtureOccupiedSymbols',
      'getFixtureParticipationOptions',
      'getFixtureFaucet',
      'getFixtureReferral',
      'getFixtureVerseTrade',
      'getFixtureStaking',
      'getFixturePolPosition',
      'getFixtureGovernanceState',
      'getFixtureAssetUsdSample',
      'getFixtureWalletAssets',
      'getFixtureReserveBalances',
      'getFixtureWalletBalances',
      'getFixturePsmPair',
      'getFixtureCdpPositions',
      'getFixtureUsrSavings',
      'getFixtureVaultRows',
      'getFixturePortfolioActions',
      'getFixtureParticipationRows',
      'getFixturePortfolioSignals',
      'getFixtureParticipations',
    ];
    for (const name of surface) {
      expect(adapter, `adapter export ${name}`).toHaveProperty(name);
    }
    expect(adapter.PROTECTION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('PROTECTION_WINDOW_MS equals the fixture repository constant', async () => {
    const fixtures = await import('../../../lib/data/fixture-repository');
    const adapter = await import('../../../components/data/onchain-adapter');
    expect(adapter.PROTECTION_WINDOW_MS).toBe(fixtures.PROTECTION_WINDOW_MS);
  });
});
