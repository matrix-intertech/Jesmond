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
