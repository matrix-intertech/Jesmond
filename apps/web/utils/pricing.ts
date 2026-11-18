/**
 * Safely converts an amount in cents to Australian Dollars (AUD).
 * Preserves fractional AUD prices (e.g. 35050 cents -> 350.5 AUD).
 * Returns undefined for missing, zero, negative, non-finite, or invalid amounts.
 */
export function convertCentsToAud(priceInCents: number | null | undefined): number | undefined {
  if (typeof priceInCents !== 'number' || isNaN(priceInCents) || !isFinite(priceInCents) || priceInCents <= 0) {
    return undefined;
  }
  return Math.round(priceInCents) / 100;
}

export interface FormatAudOptions {
  showPrefix?: boolean;
}

/**
 * Standard, canonical currency formatter for Australian Dollars (AUD).
 * Converts minor currency units (cents) to major currency units (AUD) exactly once at the display boundary.
 *
 * Examples:
 *   formatAudPrice(8900)                         -> "$89.00"
 *   formatAudPrice(7900)                         -> "$79.00"
 *   formatAudPrice(14900)                        -> "$149.00"
 *   formatAudPrice(8900, { showPrefix: true })  -> "AUD $89.00"
 *   formatAudPrice(0)                            -> "$0.00"
 *   formatAudPrice(null)                         -> "$0.00"
 */
export function formatAudPrice(
  priceInCents: number | string | null | undefined,
  options?: FormatAudOptions
): string {
  const numeric = typeof priceInCents === 'string' ? Number(priceInCents) : priceInCents;
  if (typeof numeric !== 'number' || isNaN(numeric) || !isFinite(numeric) || numeric < 0) {
    return options?.showPrefix ? 'AUD $0.00' : '$0.00';
  }
  const formatted = `$${(Math.round(numeric) / 100).toFixed(2)}`;
  return options?.showPrefix ? `AUD ${formatted}` : formatted;
}
