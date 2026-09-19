import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LocationProvider, LocationSearchOptions, LocationResult } from './providers/location-provider.interface';
import { PhotonProvider } from './providers/photon.provider';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private provider: LocationProvider;

  constructor(
    private readonly redisService: RedisService,
    private readonly photonProvider: PhotonProvider,
    private readonly prisma: PrismaService
  ) {
    // We can swap providers here based on environment variable if we add more
    const providerType = process.env.LOCATION_PROVIDER || 'photon';

    if (providerType === 'photon') {
      this.provider = this.photonProvider;
    } else {
      this.provider = this.photonProvider; // Fallback
    }
  }

  async search(query: string, limit: number = 5): Promise<LocationResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    const cacheKey = `location:search:au:${query.toLowerCase().trim()}:${limit}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      this.logger.warn(`Redis cache error during location search: ${error.message}`);
    }

    const results = await this.provider.search({ query, limit });

    try {
      if (results && results.length > 0) {
        // Cache for 24 hours since geocoding results rarely change rapidly
        await this.redisService.set(cacheKey, JSON.stringify(results), 86400);
      }
    } catch (error) {
      this.logger.warn(`Redis cache set error during location search: ${error.message}`);
    }

    return results;
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    const cacheKey = `location:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      this.logger.warn(`Redis cache error during reverse geocoding: ${error.message}`);
    }

    const result = await this.provider.reverseGeocode(lat, lng);

    try {
      if (result) {
        await this.redisService.set(cacheKey, JSON.stringify(result), 86400);
      }
    } catch (error) {
      this.logger.warn(`Redis cache set error during reverse geocoding: ${error.message}`);
    }

    return result;
  }

  async matchLocation(suburbName: string, cityName?: string) {
    if (!suburbName) return null;

    let match = await this.prisma.suburb.findFirst({
      where: {
        name: { equals: suburbName, mode: 'insensitive' },
        ...(cityName ? { city: { name: { equals: cityName, mode: 'insensitive' } } } : {})
      },
      include: {
        city: {
          include: {
            state: true
          }
        }
      }
    });

    // Fallback if city doesn't match perfectly, but suburb does
    if (!match && cityName) {
      match = await this.prisma.suburb.findFirst({
        where: { name: { equals: suburbName, mode: 'insensitive' } },
        include: { city: { include: { state: true } } }
      });
    }

    if (match && match.city && match.city.state) {
      return {
        suburbId: match.id,
        cityId: match.city.id,
        stateId: match.city.state.id,
        suburb: match.name,
        city: match.city.name,
        state: match.city.state.name,
        postcode: match.postcode
      };
    }
    return null;
  }
}
