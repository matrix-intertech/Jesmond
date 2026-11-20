import { AbnLookupService } from '../../src/modules/credentials/services/abn-lookup.service';
import { RedisService } from '../../src/modules/redis/redis.service';

describe('AbnLookupService - Modulus 89 & Validation', () => {
  let service: AbnLookupService;
  let mockRedis: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;
    service = new AbnLookupService(mockRedis);
  });

  describe('isValidAbnChecksum', () => {
    it('should validate official Australian ABNs with correct Modulus 89 checksum', () => {
      // Known valid ABNs:
      // Department of Industry: 51 824 753 556
      // BHP: 49 004 028 077
      // Commonwealth Bank: 48 123 123 124
      // Telstra: 33 051 775 556
      expect(service.isValidAbnChecksum('51 824 753 556')).toBe(true);
      expect(service.isValidAbnChecksum('51824753556')).toBe(true);
      expect(service.isValidAbnChecksum('49 004 028 077')).toBe(true);
      expect(service.isValidAbnChecksum('48 123 123 124')).toBe(true);
      expect(service.isValidAbnChecksum('33 051 775 556')).toBe(true);
    });

    it('should reject invalid ABN checksums', () => {
      expect(service.isValidAbnChecksum('51824753557')).toBe(false);
      expect(service.isValidAbnChecksum('11111111111')).toBe(false);
      expect(service.isValidAbnChecksum('00000000000')).toBe(false);
      expect(service.isValidAbnChecksum('12345678901')).toBe(false);
    });

    it('should reject wrong-length, empty, or non-numeric inputs', () => {
      expect(service.isValidAbnChecksum('')).toBe(false);
      expect(service.isValidAbnChecksum('123')).toBe(false);
      expect(service.isValidAbnChecksum('518247535561')).toBe(false); // 12 digits
      expect(service.isValidAbnChecksum('ABCDEFGHIJK')).toBe(false);
    });
  });

  describe('lookupAbn', () => {
    it('should throw BadRequestException if ABN checksum fails', async () => {
      await expect(service.lookupAbn('12345678901')).rejects.toThrow(
        /failed Modulus 89 checksum/i,
      );
    });

    it('should return cached result if present in Redis', async () => {
      const cached = {
        isValid: true,
        abn: '51824753556',
        entityName: 'Cached Entity Pty Ltd',
        status: 'Active',
        gstRegistered: true,
      };
      mockRedis.get.mockResolvedValueOnce(cached as any);

      const res = await service.lookupAbn('51824753556');
      expect(res.entityName).toBe('Cached Entity Pty Ltd');
      expect(res.isCached).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('abn:lookup:51824753556');
    });

    it('should cache result for 7 days upon successful lookup', async () => {
      const res = await service.lookupAbn('51824753556');
      expect(res.isValid).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'abn:lookup:51824753556',
        expect.objectContaining({ abn: '51824753556', isValid: true }),
        7 * 24 * 60 * 60,
      );
    });
  });
});
