import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';

// Contract under test: the home lifecycle steps carry the fixed VerseStage mapping
// (docs/design-system/foundations.md §1.2). No gate asserts it — check:design scans .tsx
// only, the contrast gate reads tokens.css, the freeze manifest omits globals.css, and the
// e2e diff tolerance swallows a few-pixel color change — so a wrong token ships silently.
// Parsed rather than regex-matched: a commented-out declaration, a later override rule and
// a direct echo-token color must all fail this contract, not slide past a text search.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

const STAGE_TOKENS: Record<string, string> = {
  genesis: 'var(--accent-primary)',
  locked: 'var(--accent-echo)',
  unlocked: 'var(--or-cyan)',
  normal: 'var(--color-success)',
};

const ECHO_TOKENS = new Set([
  'var(--stage-color)',
  'var(--accent-echo)',
  'var(--logo-magenta-bright)',
]);

type ParsedRule = { selector: string; decls: Map<string, string> };

const rules: ParsedRule[] = [];
parse(css).walkRules((rule) => {
  const decls = new Map<string, string>();
  rule.walkDecls((decl) => {
    decls.set(decl.prop, decl.value);
  });
  rules.push({ selector: rule.selector, decls });
});

function selectorsOf(rule: ParsedRule): string[] {
  return rule.selector.split(',').map((selector) => selector.trim());
}

function ruleFor(selector: string): ParsedRule | undefined {
  return rules.find((rule) => selectorsOf(rule).includes(selector));
}

describe('verse-lifecycle stage colors', () => {
  for (const [tone, token] of Object.entries(STAGE_TOKENS)) {
    it(`.verse-lifecycle__step--${tone} maps --stage-color to ${token}`, () => {
      const matches = rules.filter(
        (rule) =>
          selectorsOf(rule).includes(`.verse-lifecycle__step--${tone}`) &&
          rule.decls.has('--stage-color'),
      );
      expect(matches, `expected exactly one --stage-color declaration for --${tone}`).toHaveLength(
        1,
      );
      expect(matches[0].decls.get('--stage-color')).toBe(token);
    });
  }

  it('keeps the stage color on the node border', () => {
    expect(ruleFor('.verse-lifecycle__node')?.decls.get('border')).toBe(
      '1px solid var(--stage-color)',
    );
  });

  // Stage color in this component stops at the node border, connector lines, 4px squares
  // and the 14px signals title; the 12px meta line and node number stay neutral. Every
  // rule targeting the meta line or node number is checked, not just the base
  // declarations: an override selector or a direct echo token must fail too.
  it('never colors the 12px meta line or node number with the stage color', () => {
    const textSelectors = ['.verse-lifecycle__meta', '.verse-lifecycle__node'];
    const offenders = rules
      .filter((rule) => textSelectors.some((selector) => rule.selector.includes(selector)))
      .flatMap((rule) => {
        const color = rule.decls.get('color');
        return color !== undefined && ECHO_TOKENS.has(color)
          ? [`${rule.selector} -> color: ${color}`]
          : [];
      });

    expect(offenders).toEqual([]);
  });

  it('renders the 12px meta line and node number at the label tier', () => {
    expect(ruleFor('.verse-lifecycle__meta')?.decls.get('font-size')).toBe('var(--text-xs)');
    expect(ruleFor('.verse-lifecycle__node')?.decls.get('font-size')).toBe('var(--text-xs)');
  });
});
