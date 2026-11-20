import { AbnLookupService } from './abn-lookup.service';
import { RedisService } from '../../redis/redis.service';

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

    it('should throw ServiceUnavailableException if ABR_GUID is missing in production', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origGuid = process.env.ABR_GUID;
      const origAllowMock = process.env.ALLOW_MOCK_ABR;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ABR_GUID;
        delete process.env.ALLOW_MOCK_ABR;

        await expect(service.lookupAbn('51824753556')).rejects.toThrow(
          /ABR verification service unavailable: ABR_GUID is not configured/i,
        );
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        if (origGuid) process.env.ABR_GUID = origGuid;
        if (origAllowMock) process.env.ALLOW_MOCK_ABR = origAllowMock;
      }
    });

    it('should throw ServiceUnavailableException if ABR_GUID is missing in staging', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origGuid = process.env.ABR_GUID;
      const origAllowMock = process.env.ALLOW_MOCK_ABR;

      try {
        process.env.NODE_ENV = 'staging';
        delete process.env.ABR_GUID;
        delete process.env.ALLOW_MOCK_ABR;

        await expect(service.lookupAbn('51824753556')).rejects.toThrow(
          /ABR verification service unavailable/i,
        );
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        if (origGuid) process.env.ABR_GUID = origGuid;
        if (origAllowMock) process.env.ALLOW_MOCK_ABR = origAllowMock;
      }
    });

    it('should allow mock ABR responses only when explicitly configured or in test mode', async () => {
      const origGuid = process.env.ABR_GUID;
      try {
        delete process.env.ABR_GUID;
        process.env.ALLOW_MOCK_ABR = 'true';
        const res = await service.lookupAbn('51824753556');
        expect(res.isValid).toBe(true);
        expect(res.abn).toBe('51824753556');
      } finally {
        if (origGuid) process.env.ABR_GUID = origGuid;
      }
    });

    it('should handle authoritative ABR responses correctly', async () => {
      const origGuid = process.env.ABR_GUID;
      process.env.ABR_GUID = 'test-guid-1234';

      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          'callback({"Abn":"51824753556","AbnStatus":"Active","EntityName":"OFFICIAL TEST ENTITY","Gst":"2020-01-01"})',
      });
      global.fetch = mockFetch;

      try {
        const res = await service.lookupAbn('51824753556');
        expect(res.entityName).toBe('OFFICIAL TEST ENTITY');
        expect(res.isValid).toBe(true);
        expect(res.status).toBe('Active');
        expect(res.gstRegistered).toBe(true);
      } finally {
        if (origGuid) process.env.ABR_GUID = origGuid;
        else delete process.env.ABR_GUID;
      }
    });

    it('should throw ServiceUnavailableException on ABR network timeout without caching failed result', async () => {
      const origGuid = process.env.ABR_GUID;
      process.env.ABR_GUID = 'test-guid-1234';

      const mockFetch = jest.fn().mockRejectedValueOnce(new Error('Connection timed out'));
      global.fetch = mockFetch;

      try {
        await expect(service.lookupAbn('51824753556')).rejects.toThrow(
          /ABR external registration service error/i,
        );
        // Ensure failed result was NOT cached in redis
        expect(mockRedis.set).not.toHaveBeenCalled();
      } finally {
        if (origGuid) process.env.ABR_GUID = origGuid;
        else delete process.env.ABR_GUID;
      }
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
