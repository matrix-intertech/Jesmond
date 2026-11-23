import { normalizeBarcode, validateBarcode, verifyMod10Checksum } from './barcode.util';

describe('Universal Barcode System - Unit Tests', () => {
  describe('Barcode Normalization & Leading-Zero Preservation', () => {
    it('should strictly preserve leading zeros on standard UPC/EAN barcodes', () => {
      const upcWithZero = '012345678905';
      const normalized = normalizeBarcode(upcWithZero);
      expect(normalized).toBe('012345678905');
      expect(normalized.startsWith('0')).toBe(true);
      expect(normalized.length).toBe(12);
    });

    it('should preserve multiple leading zeros on alphanumeric and custom barcodes', () => {
      const barcode = '0004567890123';
      const normalized = normalizeBarcode(barcode);
      expect(normalized).toBe('0004567890123');
      expect(normalized.startsWith('000')).toBe(true);
    });

    it('should strip accidental surrounding whitespace, newlines, and control chars', () => {
      const raw = '  \t\n9312345001021\r\n  ';
      const normalized = normalizeBarcode(raw);
      expect(normalized).toBe('9312345001021');
    });

    it('should preserve uppercase and lowercase alphanumeric values for Code 128 / QR', () => {
      const code128 = 'JES-prod-009A';
      const normalized = normalizeBarcode(code128);
      expect(normalized).toBe('JES-prod-009A');
    });
  });

  describe('Barcode Modulo-10 Checksum Validation', () => {
    it('should validate valid EAN-13 check digit', () => {
      // 9312345001026: 54 sum -> check digit 6
      expect(verifyMod10Checksum('9312345001026')).toBe(true);
      // 4006381333931: standard European Article Number
      expect(verifyMod10Checksum('4006381333931')).toBe(true);
    });

    it('should detect invalid checksum digits', () => {
      expect(verifyMod10Checksum('9312345001029')).toBe(false);
      expect(verifyMod10Checksum('012345678900')).toBe(false);
    });

    it('should validate valid UPC-A check digit', () => {
      expect(verifyMod10Checksum('012345678905')).toBe(true);
    });

    it('should validate valid EAN-8 check digit', () => {
      expect(verifyMod10Checksum('96385074')).toBe(true);
    });
  });

  describe('Format Identification', () => {
    it('should recognize EAN-13', () => {
      const res = validateBarcode('9312345001021');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('EAN-13');
    });

    it('should recognize UPC-A', () => {
      const res = validateBarcode('012345678905');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('UPC-A');
    });

    it('should recognize EAN-8', () => {
      const res = validateBarcode('96385074');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('EAN-8');
    });

    it('should recognize Code 39', () => {
      const res = validateBarcode('CODE-39-TEST*');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('CODE-39');
    });

    it('should recognize Code 128', () => {
      const res = validateBarcode('Jesmond128_Special');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('CODE-128');
    });

    it('should reject barcodes that are too short', () => {
      const res = validateBarcode('12');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('between 3 and 128');
    });
  });
});
