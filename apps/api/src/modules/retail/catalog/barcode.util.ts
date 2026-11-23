/**
 * Barcode utilities for Jesmond 2.0 Retail Catalog & Barcode System.
 * Supports normalization, format validation, and checksum verification.
 */

export type BarcodeFormat =
  | 'EAN-13'
  | 'EAN-8'
  | 'UPC-A'
  | 'UPC-E'
  | 'CODE-128'
  | 'CODE-39'
  | 'ITF'
  | 'QR-CODE'
  | 'UNKNOWN';

export interface BarcodeValidationResult {
  valid: boolean;
  normalized: string;
  format: BarcodeFormat;
  error?: string;
}

export function normalizeBarcode(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

export function verifyMod10Checksum(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;

  const length = digits.length;
  const checkDigit = parseInt(digits[length - 1], 10);
  let sum = 0;

  for (let i = length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += parseInt(digits[i], 10) * weight;
  }

  const remainder = sum % 10;
  const calculatedCheck = remainder === 0 ? 0 : 10 - remainder;
  return calculatedCheck === checkDigit;
}

export function validateBarcode(raw: string): BarcodeValidationResult {
  const normalized = normalizeBarcode(raw);

  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      format: 'UNKNOWN',
      error: 'Barcode is empty',
    };
  }

  if (normalized.length < 3 || normalized.length > 128) {
    return {
      valid: false,
      normalized,
      format: 'UNKNOWN',
      error: 'Barcode length must be between 3 and 128 characters',
    };
  }

  if (/^\d+$/.test(normalized)) {
    if (normalized.length === 13) {
      const validChecksum = verifyMod10Checksum(normalized);
      return {
        valid: true,
        normalized,
        format: 'EAN-13',
        error: validChecksum ? undefined : 'Warning: checksum check failed for standard EAN-13',
      };
    }

    if (normalized.length === 12) {
      const validChecksum = verifyMod10Checksum(normalized);
      return {
        valid: true,
        normalized,
        format: 'UPC-A',
        error: validChecksum ? undefined : 'Warning: checksum check failed for standard UPC-A',
      };
    }

    if (normalized.length === 8) {
      const validChecksum = verifyMod10Checksum(normalized);
      return {
        valid: true,
        normalized,
        format: 'EAN-8',
        error: validChecksum ? undefined : 'Warning: checksum check failed for standard EAN-8',
      };
    }

    if (normalized.length === 6 || normalized.length === 7) {
      return {
        valid: true,
        normalized,
        format: 'UPC-E',
      };
    }

    if (normalized.length === 14) {
      return {
        valid: true,
        normalized,
        format: 'ITF',
      };
    }
  }

  if (/^[0-9A-Z\-\.\ \$\/\+\%\*]+$/.test(normalized)) {
    return {
      valid: true,
      normalized,
      format: 'CODE-39',
    };
  }

  if (/^[\x20-\x7E]+$/.test(normalized)) {
    return {
      valid: true,
      normalized,
      format: 'CODE-128',
    };
  }

  return {
    valid: true,
    normalized,
    format: 'UNKNOWN',
  };
}
