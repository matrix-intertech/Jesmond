import { test, expect } from '@playwright/test';
import { convertCentsToAud } from '../utils/pricing';

test.describe('Pricing Conversion (Cents to AUD)', () => {
  test('converts whole dollar amounts in cents to AUD', () => {
    expect(convertCentsToAud(35000)).toBe(350);
    expect(convertCentsToAud(29900)).toBe(299);
    expect(convertCentsToAud(100)).toBe(1);
  });

  test('preserves fractional dollar precision without lossy rounding', () => {
    // 35,050 cents = $350.50 AUD
    expect(convertCentsToAud(35050)).toBe(350.5);
    // 35,025 cents = $350.25 AUD
    expect(convertCentsToAud(35025)).toBe(350.25);
    // 1 cent = $0.01 AUD
    expect(convertCentsToAud(1)).toBe(0.01);
    // 99 cents = $0.99 AUD
    expect(convertCentsToAud(99)).toBe(0.99);
  });

  test('handles zero, negative, missing, non-finite, and invalid values gracefully', () => {
    expect(convertCentsToAud(0)).toBeUndefined();
    expect(convertCentsToAud(-100)).toBeUndefined();
    expect(convertCentsToAud(-5000)).toBeUndefined();
    expect(convertCentsToAud(null)).toBeUndefined();
    expect(convertCentsToAud(undefined)).toBeUndefined();
    expect(convertCentsToAud(NaN)).toBeUndefined();
    expect(convertCentsToAud(Infinity)).toBeUndefined();
    expect(convertCentsToAud(-Infinity)).toBeUndefined();
    expect(convertCentsToAud('35000' as any)).toBeUndefined();
    expect(convertCentsToAud({} as any)).toBeUndefined();
  });
});
