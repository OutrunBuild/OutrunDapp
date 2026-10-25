// Base units — the SITE-WIDE unit layer for every token amount the UI parses, formats or
// compares (all features: participation, faucet/PSM convert, vault, pools, portfolio).
// Pure unit conversion only: no protocol knowledge, no floats on money. Amounts are bigint in
// the token's smallest unit; display truncates (never rounds up), so a shown figure can never
// exceed what the chain will actually move.

export const WAD = 10n ** 18n;
export const BPS = 10_000n;

/** Floor division that reads like the contracts' integer math. */
export function floorDiv(a: bigint, b: bigint): bigint {
  return a / b;
}

const pow10 = (decimals: number): bigint => 10n ** BigInt(decimals);

/**
 * User-typed decimal string -> base units, floored to the asset's decimals. Trailing dots and
 * empty input are zero; fraction digits beyond the asset's precision are truncated (the chain
 * cannot represent them), never rounded up.
 */
export function toBaseUnits(input: string, decimals: number): bigint {
  const clean = input.trim();
  if (clean === '' || clean === '.') return 0n;
  const [wholeRaw, fracRaw = ''] = clean.split('.');
  const whole = wholeRaw === '' ? '0' : wholeRaw;
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fracRaw)) return 0n;
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(whole) * pow10(decimals) + (decimals > 0 ? BigInt(frac || '0') : 0n);
}

/**
 * Exact base-units -> display string: whole part locale-grouped, fraction truncated (never
 * rounded) to `maxFractionDigits`, trailing zeros dropped. Uses Intl on BigInt so large
 * integers never pass through float64.
 */
export function formatBaseUnits(
  base: bigint,
  decimals: number,
  locale: string,
  maxFractionDigits = 6,
): string {
  const unit = pow10(decimals);
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const whole = abs / unit;
  const fracAll = (abs % unit).toString().padStart(decimals, '0');
  const digits = Math.min(decimals, maxFractionDigits);
  const frac = fracAll.slice(0, digits).replace(/0+$/, '');
  const grouped = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(whole);
  return `${negative ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Display an 18-dec point value (e.g. a fee wad) as a percentage with fixed precision. */
export function formatWadPercent(wad: bigint, locale: string, fractionDigits = 1): string {
  const scaled = floorDiv(wad * 100n * pow10(fractionDigits), WAD);
  const whole = scaled / pow10(fractionDigits);
  const frac = (scaled % pow10(fractionDigits)).toString().padStart(fractionDigits, '0');
  const grouped = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(whole);
  return `${grouped}.${frac}`;
}
