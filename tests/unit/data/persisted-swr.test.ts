// Same-machine SWR disk seed store: the graph repository's happy path already exercises a seed
// round trip, but the store's own failure contract (corrupt file, missing directory, last write
// wins, atomic rename) is only ever mocked elsewhere. These cases drive the real fs implementation.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deleteSeed, readSeed, writeSeed } from '../../../lib/data/persisted-swr';

const DIR = join(tmpdir(), 'outrun-dapp-swr');
let seq = 0;
let namespace = '';

const freshNamespace = () => {
  namespace = `unit-${process.pid}-${seq++}`;
  return namespace;
};

afterEach(() => {
  if (namespace) rmSync(join(DIR, `${namespace}.json`), { force: true });
});

describe('persisted-swr (same-machine disk seed store)', () => {
  it('returns null for a missing file / directory', () => {
    expect(readSeed(freshNamespace(), 'verse')).toBeNull();
  });

  it('round-trips bigint values losslessly and keeps the last write', () => {
    const ns = freshNamespace();
    writeSeed(ns, 'verse', 1, { amount: 123456789012345678901234567890n });
    writeSeed(ns, 'verse', 2, { amount: 42n });
    expect(readSeed(ns, 'verse')).toEqual({ at: 2, value: { amount: 42n } });
  });

  it('treats a corrupt file as no seed and starts fresh on the next write', () => {
    const ns = freshNamespace();
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, `${ns}.json`), '{not json');
    expect(readSeed(ns, 'verse')).toBeNull();
    writeSeed(ns, 'verse', 3, { ok: true });
    expect(readSeed(ns, 'verse')).toEqual({ at: 3, value: { ok: true } });
  });

  it('drops one key and keeps its siblings', () => {
    const ns = freshNamespace();
    writeSeed(ns, 'a', 1, 'A');
    writeSeed(ns, 'b', 2, 'B');
    deleteSeed(ns, 'a');
    expect(readSeed(ns, 'a')).toBeNull();
    expect(readSeed(ns, 'b')).toEqual({ at: 2, value: 'B' });
  });

  it('never leaves a half-written file behind (tmp + rename)', () => {
    const ns = freshNamespace();
    writeSeed(ns, 'verse', 0, { v: 0 });
    for (let i = 1; i <= 20; i++) writeSeed(ns, 'verse', i, { v: i });
    const parsed = JSON.parse(readFileSync(join(DIR, `${ns}.json`), 'utf8')) as {
      verse: { at: number; value: { v: number } };
    };
    expect(parsed.verse).toEqual({ at: 20, value: { v: 20 } });
  });
});
