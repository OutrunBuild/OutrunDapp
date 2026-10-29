import { existsSync, globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';

// Contract under test: every data-conditioned utility class in components/ui/*.tsx must
// compile to a value-form attribute selector ([data-name='value']) whose attribute is
// actually emitted at runtime — by the primitive itself, by the installed @base-ui/react,
// or by a consumer. The presence-form trap (`data-horizontal:h-px` → `[data-horizontal]`,
// never matching base-ui's `data-orientation`) compiled silently and shipped to main once
// already; this suite is the gate that class of drift has to trip.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const UI_DIR = path.join(ROOT, 'components/ui');
const GLOBALS_CSS = path.join(ROOT, 'app/globals.css');
const BASE_UI_DIR = path.join(ROOT, 'node_modules/@base-ui/react');

// Set by call sites rather than the primitives themselves: create-form.tsx and
// participation-panel.tsx pass data-invalid="true" into Field; buttons decorate their icon
// spans with data-icon="inline-start|inline-end" for has-data-[icon=…] padding variants.
const CONSUMER_FED_ATTRS = new Set(['invalid', 'icon']);

function extractDataTokens(source: string): string[] {
  const tokens = new Set<string>();
  for (const literal of source.match(/"[^"\n]*"|'[^'\n]*'/g) ?? []) {
    for (const token of literal.slice(1, -1).split(/\s+/)) {
      // `data-` anywhere in the token: bracket value forms (`data-[orientation=…]`,
      // `group-data-[spacing=0]/…`) carry the attribute name after '[', so a stricter
      // pattern would silently drop the majority of the inventory — the incident family
      // itself (`data-horizontal:h-px` vs `data-[orientation=horizontal]:h-px`).
      if (token.includes(':') && token.includes('data-')) tokens.add(token);
    }
  }
  return [...tokens];
}

const uiSources = (globSync('*.tsx', { cwd: UI_DIR }) as string[]).map((file) => ({
  file,
  source: readFileSync(path.join(UI_DIR, file), 'utf8'),
}));

const bindings = uiSources
  .map(({ file, source }) => ({ file, tokens: extractDataTokens(source) }))
  .filter(({ tokens }) => tokens.length > 0);
const allTokens = [...new Set(bindings.flatMap(({ tokens }) => tokens))];

// JSX data-* props the primitives set on their own elements (data-variant={…}, data-slot="…").
const selfSetAttrs = new Set(
  uiSources.flatMap(({ source }) =>
    [...source.matchAll(/\bdata-([\w-]+)\s*=\s*[{"']/g)].map((match) => match[1]),
  ),
);

function baseUiEmittedAttrs(): Set<string> {
  const attrs = new Set<string>();
  // *DataAttributes enums declare per-component attributes; stateAttributesMapping.js adds
  // the transition attributes (data-starting-style / data-ending-style) that dialog family
  // primitives emit but never list in a *DataAttributes enum.
  const patterns = ['**/*DataAttributes.js', '**/*AttributesMapping.js'];
  for (const pattern of patterns) {
    for (const rel of globSync(pattern, { cwd: BASE_UI_DIR }) as string[]) {
      if (rel.split(path.sep).includes('node_modules')) continue;
      const content = readFileSync(path.join(BASE_UI_DIR, rel), 'utf8');
      for (const match of content.matchAll(/['"]data-([\w-]+)['"]/g)) attrs.add(match[1]);
    }
  }
  return attrs;
}

const globalsCss = readFileSync(GLOBALS_CSS, 'utf8');

// Presence-form selectors are only sanctioned inside the inlined @custom-variant
// OR-branches (globals.css: [data-checked]:not([data-checked='false']) etc.).
function customVariantAttrs(): Set<string> {
  const start = globalsCss.indexOf('@custom-variant');
  const end = globalsCss.indexOf('@theme', start);
  return new Set(
    [...globalsCss.slice(start, end).matchAll(/\[data-([\w-]+)/g)].map((match) => match[1]),
  );
}

const baseUiAttrs = baseUiEmittedAttrs();
const customAttrs = customVariantAttrs();

const compiler = await compile(globalsCss, {
  base: path.dirname(GLOBALS_CSS),
  // The low-level compile() ships without a stylesheet loader; resolve bare specifiers
  // (tailwindcss, tw-animate-css) to their CSS entry and relative imports against `base`.
  async loadStylesheet(id, base) {
    const file = id.startsWith('.') ? path.resolve(base, id) : resolvePackageCss(id, base);
    return { path: file, base: path.dirname(file), content: readFileSync(file, 'utf8') };
  },
});

const require = createRequire(import.meta.url);

function resolvePackageCss(id: string, base: string): string {
  let packageDir: string;
  try {
    packageDir = path.dirname(require.resolve(`${id}/package.json`, { paths: [base] }));
  } catch {
    let dir = base;
    for (;;) {
      const candidate = path.join(dir, 'node_modules', id);
      if (existsSync(candidate)) {
        packageDir = candidate;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error(`cannot resolve stylesheet package: ${id}`);
      dir = parent;
    }
  }
  const cssEntry = cssEntryFromManifest(path.join(packageDir, 'package.json'));
  return cssEntry ?? path.join(packageDir, 'index.css');
}

function cssEntryFromManifest(manifestPath: string): string | null {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, unknown>;
  };
  const flat: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') flat.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(manifest.exports?.['.']);
  const entry = flat.find((value) => value.endsWith('.css'));
  return entry ? path.join(path.dirname(manifestPath), entry) : null;
}

// build() returns the whole stylesheet, so scope each candidate to the selector segments
// that contain its escaped class name — attribute conditions attach there.
function escapedCandidate(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function selectorSegments(css: string, needle: string): string[] {
  const segments: string[] = [];
  for (
    let index = css.indexOf(needle);
    index !== -1;
    index = css.indexOf(needle, index + needle.length)
  ) {
    const start =
      Math.max(
        css.lastIndexOf('{', index),
        css.lastIndexOf('}', index),
        css.lastIndexOf(';', index),
      ) + 1;
    const end = css.indexOf('{', index);
    if (end !== -1) segments.push(css.slice(start, end));
  }
  return segments;
}

function candidateSelectors(): { token: string; selectorText: string }[] {
  return allTokens.map((token) => {
    const css = compiledFor(token);
    const segments = selectorSegments(css, escapedCandidate(token));
    expect(segments.length, `utility compiled to no CSS rule: ${token}`).toBeGreaterThan(0);
    return { token, selectorText: segments.join('\n') };
  });
}

function compiledFor(token: string): string {
  try {
    return compiler.build([token]);
  } catch (cause) {
    throw new Error(`ui utility failed to compile: ${token}`, { cause });
  }
}

describe('ui primitive data-binding contract', () => {
  it('protects a non-empty data-conditioned utility inventory', () => {
    const covered = bindings.map(({ file, tokens }) => `${file}: ${tokens.length}`).join(', ');
    expect(
      allTokens.length,
      `inventory drained — extraction broke? (${covered})`,
    ).toBeGreaterThanOrEqual(20);
    expect(selfSetAttrs.size, 'self-set attribute extraction broke').toBeGreaterThan(0);
    expect(baseUiAttrs.size, '@base-ui/react *DataAttributes enums unreadable').toBeGreaterThan(0);
    expect(customAttrs.size, '@custom-variant block not found in globals.css').toBeGreaterThan(0);
  });

  it('compiles every data-conditioned utility (no silent variant drops)', () => {
    expect(candidateSelectors().length).toEqual(allTokens.length);
  });

  it('never emits the presence-form orientation trap', () => {
    const offendingTokens = allTokens.filter((token) =>
      /(^|[^[\w-])data-(horizontal|vertical):/.test(token),
    );
    expect(offendingTokens, 'presence-form data variants are dead selectors').toEqual([]);
    const offendingSelectors = candidateSelectors().filter(({ selectorText }) =>
      /\[data-(horizontal|vertical)(?=[=\])])/.test(selectorText),
    );
    expect(offendingSelectors.map(({ token }) => token)).toEqual([]);
  });

  it('binds only attributes the runtime actually emits', () => {
    const allowed = new Set([
      ...customAttrs,
      ...selfSetAttrs,
      ...baseUiAttrs,
      ...CONSUMER_FED_ATTRS,
    ]);
    const valueForm = new Set<string>();
    const presenceForm = new Set<string>();
    for (const { selectorText } of candidateSelectors()) {
      for (const match of selectorText.matchAll(/\[data-([\w-]+)\s*=/g)) {
        valueForm.add(match[1]);
      }
      for (const match of selectorText.matchAll(/\[data-([\w-]+)\](?![-\w])/g)) {
        presenceForm.add(match[1]);
      }
    }
    const unknownValue = [...valueForm].filter((name) => !allowed.has(name));
    expect(
      unknownValue,
      `value-form attributes no runtime emits: ${unknownValue.join(', ')}`,
    ).toEqual([]);
    const unknownPresence = [...presenceForm].filter(
      // Presence form is sanctioned when it mirrors an emission shape the runtime itself
      // uses: the @custom-variant OR-branches, base-ui presence-only attributes like
      // Select's data-placeholder, and the transition attributes (data-starting-style /
      // data-ending-style) that dialog-family primitives emit during enter/leave.
      (name) => !customAttrs.has(name) && !baseUiAttrs.has(name),
    );
    expect(
      unknownPresence,
      `presence-form attributes outside the sanctioned @custom-variant set: ${unknownPresence.join(', ')}`,
    ).toEqual([]);
    expect(
      valueForm.size,
      'no value-form data conditions found — extraction broke',
    ).toBeGreaterThan(0);
  });
});
