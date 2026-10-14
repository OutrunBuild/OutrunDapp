// Shared base type source for all three layers: Locale/VerseStage/FixtureChain are site-wide
// shared vocabulary, not fixture sample data. This module must keep zero data-layer dependencies:
// importing fixtures/** or the fixture repository is forbidden (governed by the
// direct-fixture-import / illegal-bridge-consumer rules of check-fixture-boundary); any other
// layer may import it.
export type FixtureChain = {
  chainId: number;
  name: string;
  env: 'mainnet' | 'testnet';
  nativeSymbol: string;
  sourceRef: string;
};

export type Locale = 'zh' | 'en';
export type VerseStage = 'genesis' | 'locked' | 'unlocked' | 'refund';
