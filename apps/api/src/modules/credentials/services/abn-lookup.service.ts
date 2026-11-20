import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface AbnLookupResult {
  isValid: boolean;
  abn: string;
  entityName: string;
  entityType?: string;
  status: string;
  gstRegistered: boolean;
  state?: string;
  postcode?: string;
  isCached?: boolean;
  manualReviewRequired?: boolean;
}

@Injectable()
export class AbnLookupService {
  private readonly logger = new Logger(AbnLookupService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Validates an Australian Business Number (ABN) using the statutory Modulus 89 algorithm.
   * Weight vector: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
   */
  isValidAbnChecksum(rawAbn: string): boolean {
    if (!rawAbn) return false;
    const clean = rawAbn.replace(/[\s-]/g, '');
    if (!/^\d{11}$/.test(clean)) return false;

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const firstDigit = parseInt(clean.charAt(0), 10) - 1;
    let sum = firstDigit * weights[0];

    for (let i = 1; i < 11; i++) {
      sum += parseInt(clean.charAt(i), 10) * weights[i];
    }

    return sum % 89 === 0;
  }

  /**
   * Cleans raw input to 11-digit string.
   */
  cleanAbn(rawAbn: string): string {
    return (rawAbn || '').replace(/[\s-]/g, '');
  }

  /**
   * Looks up ABN details against Redis cache or the official ABR Web Service.
   * Caches successful responses for 7 days (604,800 seconds).
   */
  async lookupAbn(rawAbn: string): Promise<AbnLookupResult> {
    const clean = this.cleanAbn(rawAbn);
    if (!this.isValidAbnChecksum(clean)) {
      throw new BadRequestException(
        'Invalid Australian Business Number (failed Modulus 89 checksum validation)',
      );
    }

    const cacheKey = `abn:lookup:${clean}`;
    const cached = await this.redisService.get<AbnLookupResult>(cacheKey);
    if (cached) {
      return { ...cached, isCached: true };
    }

    const isProductionOrStaging =
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging' ||
      process.env.APP_ENV === 'production' ||
      process.env.APP_ENV === 'staging';

    const allowMockAbr =
      process.env.ALLOW_MOCK_ABR === 'true' ||
      (!isProductionOrStaging && (process.env.NODE_ENV === 'test' || process.env.ALLOW_MOCK_ABR !== 'false'));

    const guid = process.env.ABR_GUID;
    if (!guid) {
      if (isProductionOrStaging) {
        throw new ServiceUnavailableException(
          'ABR verification service unavailable: ABR_GUID is not configured in this environment.',
        );
      }
      if (!allowMockAbr) {
        throw new ServiceUnavailableException(
          'ABR verification service unavailable: ABR_GUID is missing and mock mode is disabled.',
        );
      }

      this.logger.warn(
        'ABR_GUID not configured. Mock ABR lookup active for test/development.',
      );
      const simulated: AbnLookupResult = {
        isValid: true,
        abn: clean,
        entityName: `Registered Business (${clean})`,
        entityType: 'Australian Private Company',
        status: 'Active',
        gstRegistered: true,
        state: 'NSW',
        postcode: '2000',
      };
      await this.redisService.set(cacheKey, simulated, 7 * 24 * 60 * 60);
      return simulated;
    }

    try {
      const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${clean}&guid=${guid}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`ABR HTTP status: ${res.status}`);
      }

      const text = await res.text();
      // ABR returns JSONP callback(...)
      const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
      const parsed = JSON.parse(jsonStr);

      if (parsed.Message) {
        throw new BadRequestException(`ABR Lookup message: ${parsed.Message}`);
      }

      const result: AbnLookupResult = {
        isValid: parsed.AbnStatus === 'Active',
        abn: parsed.Abn || clean,
        entityName: parsed.EntityName || parsed.BusinessName?.[0] || 'Registered Entity',
        entityType: parsed.EntityTypeName,
        status: parsed.AbnStatus || 'Active',
        gstRegistered: !!parsed.Gst,
        state: parsed.AddressState,
        postcode: parsed.AddressPostcode,
      };

      await this.redisService.set(cacheKey, result, 7 * 24 * 60 * 60);
      return result;
    } catch (err: any) {
      this.logger.error(`ABR lookup network error for ABN ${clean}: ${err.message}`);
      // An ABR network timeout or external service failure must never mark the credential VERIFIED
      // and must never be cached as a successful result!
      throw new ServiceUnavailableException(
        `ABR external registration service error: ${err.message || 'connection failed'}. Please try again later or request manual compliance review.`,
      );
    }
  }
}
