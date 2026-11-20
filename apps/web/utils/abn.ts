/**
 * Australian Business Number (ABN) Validation and Formatting utilities
 * Implements the official Australian Taxation Office (ATO) Modulus 89 algorithm.
 */

export function cleanAbn(abn: string): string {
  return abn.replace(/\s+/g, '').replace(/[^0-9]/g, '');
}

export function formatAbn(abn: string): string {
  const clean = cleanAbn(abn);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)} ${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}

export function validateAbnChecksum(abn: string): boolean {
  const clean = cleanAbn(abn);
  if (clean.length !== 11) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = clean.split('').map((d) => parseInt(d, 10));

  // Subtract 1 from the first digit
  digits[0] -= 1;

  // Calculate the weighted sum
  const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);

  // Valid if divisible by 89
  return sum % 89 === 0;
}
