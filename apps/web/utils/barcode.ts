/**
 * Barcode utilities for Jesmond 2.0 Universal Barcode Scanning System.
 * Supports normalization, format validation, checksum verification, and audio feedback.
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

/**
 * Normalizes barcode input by trimming surrounding whitespace,
 * stripping accidental hidden control characters, while strictly preserving
 * leading zeros and alphanumeric case.
 */
export function normalizeBarcode(raw: string): string {
  if (!raw) return '';
  // Remove non-printable control characters, trim leading/trailing whitespace
  return raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

/**
 * Validates EAN / UPC check digit using the standard modulo-10 algorithm.
 */
export function verifyMod10Checksum(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;

  const length = digits.length;
  const checkDigit = parseInt(digits[length - 1], 10);
  let sum = 0;

  // Process from right to left (excluding check digit)
  // Odd positions from right multiply by 3, even by 1
  for (let i = length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += parseInt(digits[i], 10) * weight;
  }

  const remainder = sum % 10;
  const calculatedCheck = remainder === 0 ? 0 : 10 - remainder;
  return calculatedCheck === checkDigit;
}

/**
 * Validates and identifies barcode format.
 */
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

  // Pure numeric formats
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

  // Code 39 format: alphanumeric + specific symbols (- . $ / + % *)
  if (/^[0-9A-Z\-\.\ \$\/\+\%\*]+$/.test(normalized)) {
    return {
      valid: true,
      normalized,
      format: 'CODE-39',
    };
  }

  // Code 128 format: ASCII 32 to 126
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

/**
 * Web Audio API synthesize scanner beep feedback
 * Avoids dependency on external mp3 files that can fail over networks or slow down loading.
 */
export function playScanAudio(type: 'success' | 'error' | 'warning' = 'success'): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // Crisp POS chime: 1760Hz (A6) high tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'warning') {
      // Double low tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      // Error buzz: 220Hz low tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    }

    // Clean up AudioContext after sound finishes
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // Audio autostart policy or lack of audio device - safe to ignore
  }
}
