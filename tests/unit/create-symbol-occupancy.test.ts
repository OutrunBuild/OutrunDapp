// Symbol occupancy: the create form's onchain verdict path (the per-candidate previewRegistration
// probe) and the submit gate that consumes it. No chain — the ContractReader seam is stubbed.
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import { readSymbolAvailable, type ContractReader } from '../../components/global/execution-reads';
import { registrationInputsOk } from '../../components/create/create-form';

const CENTER = '0x6666666666666666666666666666666666666666' as Hex;

const stubReader = (routes: Record<string, unknown>): ContractReader => ({
  read: async ({ functionName }) => {
    const value = routes[functionName];
    if (value === undefined) throw new Error(`unstubbed ${functionName}`);
    return value;
  },
});

describe('readSymbolAvailable', () => {
  it('reports a symbol as free when the center answers true', async () => {
    const reader = stubReader({ previewRegistration: true });
    await expect(readSymbolAvailable(reader, CENTER, 'MOON')).resolves.toBe(true);
  });

  it('reports a symbol as taken when the center answers false', async () => {
    const reader = stubReader({ previewRegistration: false });
    await expect(readSymbolAvailable(reader, CENTER, 'MOON')).resolves.toBe(false);
  });

  // The probe has no fallback source: an unreadable read must stay "unresolved", because the
  // gate only blocks on an explicit false.
  it('degrades to null rather than claiming availability when the probe is unreadable', async () => {
    const reader = stubReader({});
    await expect(readSymbolAvailable(reader, CENTER, 'MOON')).resolves.toBeNull();
  });
});

describe('registrationInputsOk (symbol occupancy term)', () => {
  const base = {
    hasLogo: true,
    name: 'Moon Verse',
    symbol: 'MOON',
    desc: 'A memeverse',
    occupiedSymbols: [] as string[],
    duration: 2,
    config: { minDurationDays: 1, maxDurationDays: 3 },
  };

  it('leaves the fixture-only path unchanged when no probe verdict is supplied', () => {
    expect(registrationInputsOk(base)).toBe(true);
    expect(registrationInputsOk({ ...base, occupiedSymbols: ['MOON'] })).toBe(false);
  });

  it('blocks submission on a live "taken" verdict', () => {
    expect(registrationInputsOk({ ...base, symbolAvailable: false })).toBe(false);
  });

  // The two sources OR together, so a free verdict must never cancel a fixture sample hit: the
  // gate is two independent && terms and only an explicit false can block.
  it('does not let a live "free" verdict override a fixture sample hit', () => {
    expect(
      registrationInputsOk({ ...base, occupiedSymbols: ['MOON'], symbolAvailable: true }),
    ).toBe(false);
  });

  it('passes on a live "free" verdict', () => {
    expect(registrationInputsOk({ ...base, symbolAvailable: true })).toBe(true);
  });

  // Blocking here too would disable the form whenever no probe can run; the async submit path
  // re-probes and fails closed instead.
  it('treats an unresolved probe (null) as non-blocking', () => {
    expect(registrationInputsOk({ ...base, symbolAvailable: null })).toBe(true);
  });
});
