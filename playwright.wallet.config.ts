import { defineConfig } from '@playwright/test';

// Layer-3 wallet-boundary suite: a REAL built page (onchain dev server) driven through an
// injected spec-shaped wallet, executing against a forked chain. Separate from the visual
// e2e config on purpose — this suite never boots the fixture build (no webServer) and only
// runs when explicitly gated:
//
//   anvil --fork-url https://bsc-testnet-rpc.publicnode.com --port 8545
//   WALLET_E2E=1 ANVIL_URL=http://127.0.0.1:8545 VERSE_ID=<id> BASE_URL=http://localhost:3000 \
//     pnpm exec playwright test --config playwright.wallet.config.ts
//
// BASE_URL must point at a running OUTRUN_DATA_SOURCE=onchain server (pnpm dev with the
// onchain env); the suite does not manage server lifecycle.
// Fail closed on a silent port-3000 fallback: with BASE_URL unset the suite would drive
// whatever occupies 3000 (e.g. a leftover dev:fixture server) through onchain assertions.
if (!process.env.BASE_URL) {
  throw new Error(
    'BASE_URL must point at a running OUTRUN_DATA_SOURCE=onchain server (see header comment for the invocation)',
  );
}
const BASE = process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'wallet-*.spec.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 2, // Privy's iframe connect is flaky under automation — wholesale test retries absorb it
  reporter: [['list']],
  use: {
    baseURL: BASE,
    colorScheme: 'dark',
  },
});
