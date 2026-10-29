// CSP nonce policy checker (architecture.md §14, runbook stage 6 step 7).
// Proves three things against a production preview (default: the 4175 onchain build):
//   1. two independent document requests carry valid script-src nonces (base64, encoded
//      length >= csp-origins.json noncePolicy.minimumEncodedLength — the single threshold
//      source, consumed below) that DIFFER;
//   2. each response CSP contains exactly one 'nonce-…' occurrence;
//   3. in a real browser load, every nonce="…" the served markup carries equals the
//      nonce of that load's own response (live-DOM reads are hiding by design, so the
//      served markup is the enforceable surface);
// Refusals (non-zero exit with the failed proof named): JSON-only validation is not
// performed here by design (there is no JSON to check — the header is the policy);
// Content-Security-Policy-Report-Only alone fails (the enforcing header is required);
// a reused nonce fails proof 1; a missing DOM nonce fails proof 3. The nonce-shape floor is
// read from the workspace registry while the proofed artifact is the deployed build — a
// tree/build skew can only shift that shape floor, never origin decisions (the header is
// still the sole policy surface).
// CI wiring lands in stage 8 (§12); this step only builds the script and proves it locally.
//
// Run: node scripts/check-csp-policy.mjs --base-url http://localhost:4175 [--path /]
// Self-test (tamper modes must exit non-zero): node scripts/check-csp-policy.mjs --self-test
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

import cspOrigins from '../docs/security/csp-origins.json' with { type: 'json' };

const NONCE_RE = /'nonce-([A-Za-z0-9+/=]+)'/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_ENCODED_LENGTH = cspOrigins.noncePolicy?.minimumEncodedLength;
if (!Number.isInteger(MIN_ENCODED_LENGTH) || MIN_ENCODED_LENGTH < 1) {
  throw new Error('csp-origins.json noncePolicy.minimumEncodedLength is not a positive integer');
}

function isValidNonceShape(value) {
  return typeof value === 'string' && value.length >= MIN_ENCODED_LENGTH && BASE64_RE.test(value);
}

function extractNonce(csp) {
  const match = NONCE_RE.exec(csp ?? '');
  return match ? match[1] : null;
}

function countNonceOccurrences(csp) {
  return (csp ?? '').match(/'nonce-[A-Za-z0-9+/=]+'/g)?.length ?? 0;
}

async function fetchCsp(url) {
  const response = await fetch(url, { headers: { 'cache-control': 'no-store' } });
  const enforcing = response.headers.get('content-security-policy');
  const reportOnly = response.headers.get('content-security-policy-report-only');
  return { status: response.status, enforcing, reportOnly };
}

async function proofSeparateNonces(url) {
  const first = await fetchCsp(url);
  const second = await fetchCsp(url);
  const failures = [];
  for (const [label, fetched] of [
    ['first', first],
    ['second', second],
  ]) {
    if (fetched.status !== 200) failures.push(`${label} request status ${fetched.status}`);
    if (!fetched.enforcing)
      failures.push(`${label} response lacks enforcing Content-Security-Policy`);
    const nonce = extractNonce(fetched.enforcing);
    if (!isValidNonceShape(nonce)) failures.push(`${label} nonce shape invalid`);
  }
  const nonceA = extractNonce(first.enforcing);
  const nonceB = extractNonce(second.enforcing);
  if (nonceA !== null && nonceA === nonceB) failures.push('nonce reused across two requests');
  return { failures, nonces: [nonceA, nonceB] };
}

async function proofSingleOccurrence(url) {
  const fetched = await fetchCsp(url);
  const failures = [];
  if (!fetched.enforcing) {
    failures.push('response lacks enforcing Content-Security-Policy');
    return { failures };
  }
  const count = countNonceOccurrences(fetched.enforcing);
  if (count !== 1) failures.push(`expected exactly one nonce occurrence, found ${count}`);
  return { failures };
}

async function proofDomMatches(url) {
  const failures = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let responseNonce = null;
    let markup = null;
    page.on('response', (response) => {
      if (response.url() === url && response.request().resourceType() === 'document') {
        responseNonce = extractNonce(response.headers()['content-security-policy']);
      }
    });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (response) markup = await response.text();
    if (!isValidNonceShape(responseNonce)) {
      failures.push('document response nonce missing or malformed');
      return { failures };
    }
    // Chromium hides nonce attribute values from live-DOM reads (anti-exfiltration), so the
    // enforceable comparison is against the served markup: every nonce="…" it carries must
    // equal this load's own response nonce.
    const served = [...(markup ?? '').matchAll(/nonce="([^"]*)"/g)].map((match) => match[1]);
    if (served.length === 0) {
      failures.push('served markup carries no nonce');
    } else {
      const mismatches = served.filter((value) => value !== responseNonce);
      if (mismatches.length > 0) failures.push(`markup nonce mismatches: ${mismatches.join(', ')}`);
    }
  } finally {
    await browser.close();
  }
  return { failures };
}

export async function runProofs(baseUrl, path = '/') {
  const url = new URL(path, baseUrl).toString();
  const results = {
    separateNonces: await proofSeparateNonces(url),
    singleOccurrence: await proofSingleOccurrence(url),
    domMatches: await proofDomMatches(url),
  };
  return results;
}

function reportResults(results) {
  let ok = true;
  for (const [name, result] of Object.entries(results)) {
    if (result.failures.length === 0) {
      console.log(`ok - ${name}`);
    } else {
      ok = false;
      for (const failure of result.failures) console.log(`FAIL - ${name}: ${failure}`);
    }
  }
  return ok;
}

function stubServer(mode) {
  const FIXED = 'AAAAAAAAAAAAAAAAAAAAAA';
  let count = 0;
  return createServer((req, res) => {
    count += 1;
    const nonce =
      mode === 'reused' ? FIXED : Buffer.from(`stub-${Date.now()}-${count}-pad`).toString('base64');
    const csp =
      mode === 'missing'
        ? "script-src 'self'"
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
    res.writeHead(200, { 'content-security-policy': csp, 'content-type': 'text/html' });
    res.end(
      mode === 'dom-mismatch'
        ? '<html><head><script nonce="bogus">1</script></head><body></body></html>'
        : `<html><head><script nonce="${mode === 'reused' ? FIXED : nonce}">1</script></head><body></body></html>`,
    );
  });
}

async function withStub(mode, fn) {
  const server = stubServer(mode);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    return await fn(`http://127.0.0.1:${port}/`);
  } finally {
    server.close();
  }
}

async function runSelfTest() {
  const failures = [];
  const good = await withStub('good', (url) => runProofs(url));
  if (!Object.values(good).every((result) => result.failures.length === 0)) {
    failures.push('good stub should pass all proofs');
  }
  const reused = await withStub('reused', (url) => runProofs(url));
  if (reused.separateNonces.failures.length === 0) {
    failures.push('reused nonce stub should fail proof 1');
  }
  const missing = await withStub('missing', (url) => runProofs(url));
  if (missing.singleOccurrence.failures.length === 0) {
    failures.push('missing nonce stub should fail proof 2');
  }
  const mismatch = await withStub('dom-mismatch', (url) => runProofs(url));
  if (mismatch.domMatches.failures.length === 0) {
    failures.push('dom mismatch stub should fail proof 3');
  }
  if (failures.length > 0) {
    for (const failure of failures) console.log(`SELF-TEST FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('self-test ok: good passes, all three tamper modes fail');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    await runSelfTest();
    return;
  }
  const baseUrlIndex = args.indexOf('--base-url');
  const pathIndex = args.indexOf('--path');
  const baseUrl = baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : null;
  if (!baseUrl) {
    console.error(
      'usage: node scripts/check-csp-policy.mjs --base-url <production-url> [--path /]',
    );
    process.exitCode = 2;
    return;
  }
  const path = pathIndex >= 0 ? args[pathIndex + 1] : '/';
  const results = await runProofs(baseUrl, path);
  if (!reportResults(results)) process.exitCode = 1;
}

await main();
