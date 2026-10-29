import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import cspOrigins from '../../docs/security/csp-origins.json';
import { proxy } from '../../proxy';

// Registry scope lock: docs/security/csp-origins.json carries only the directive groups
// proxy.ts joins. Every other directive lives in proxy.ts alone, so a group mirrored back into
// the JSON would silently do nothing (font-src had already diverged this way) — fail here instead.
const CONSUMED = ['child-src', 'connect-src', 'frame-src'];

const directives = cspOrigins.directives as Record<string, string[]>;

describe('CSP origin registry scope', () => {
  it('declares exactly the directive groups proxy.ts consumes', () => {
    expect(Object.keys(directives).sort()).toEqual([...CONSUMED].sort());
  });

  it('emits every registered group verbatim in the response CSP', () => {
    const res = proxy(new NextRequest(new URL('http://localhost/')));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).not.toBe('');
    for (const key of CONSUMED) {
      expect(csp).toContain(`${key} ${directives[key].join(' ')}`);
    }
  });

  // Header directive-set pin (reverse of the registry lock): the emitted directive list is the
  // registered security posture. default-src/worker-src/manifest-src are deliberately absent
  // (registered gap — filling in is tied to the first consuming feature landing in the same
  // round). Silently adding one would suddenly constrain previously-unconstrained resource
  // classes (media/manifest); silently dropping one would loosen the policy — fail here instead.
  it('emits exactly the pinned directive set (no silent tightening or loosening)', () => {
    const res = proxy(new NextRequest(new URL('http://localhost/')));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).not.toBe('');
    const names = csp.split(';').map((part) => part.trim().split(/\s+/)[0]);
    expect(names.sort()).toEqual(
      [
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'frame-src',
        'child-src',
        'frame-ancestors',
        'base-uri',
        'form-action',
        'object-src',
      ].sort(),
    );
  });
});
