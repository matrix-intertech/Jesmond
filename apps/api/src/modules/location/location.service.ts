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

    const q = query.trim();
    const cacheKey = `location:search:au:${q.toLowerCase()}:${limit}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      this.logger.warn(`Redis cache error during location search: ${error.message}`);
    }

    let localMatches: any[] = [];
    const isPostcode = /^\d+$/.test(q);

    try {
      if (isPostcode) {
        localMatches = await this.prisma.suburb.findMany({
          where: { postcode: { startsWith: q } },
          include: { city: { include: { state: true } } },
          take: limit,
        });
      } else {
        const suburbs = await this.prisma.suburb.findMany({
          where: {
            OR: [
              { name: { startsWith: q, mode: 'insensitive' } },
              { postcode: { startsWith: q } },
              { city: { name: { startsWith: q, mode: 'insensitive' } } }
            ]
          },
          include: { city: { include: { state: true } } },
          take: limit * 2, // Take extra for JS ranking
        });

        const lowerQ = q.toLowerCase();
        const exactMatch = [];
        const prefixMatch = [];
        const otherMatch = [];

        for (const s of suburbs) {
          const sName = s.name.toLowerCase();
          if (sName === lowerQ) exactMatch.push(s);
          else if (sName.startsWith(lowerQ)) prefixMatch.push(s);
          else otherMatch.push(s);
        }

        localMatches = [...exactMatch, ...prefixMatch, ...otherMatch].slice(0, limit);
      }
    } catch (dbError) {
      this.logger.warn(`Database query failed during location search: ${dbError.message}`);
    }

    let results: LocationResult[] = localMatches.map(s => {
      const stateName = s.city?.state?.name || '';
      const stateCode = s.city?.state?.code || '';
      const cityName = s.city?.name || '';

      const labelParts = [];
      if (s.name && s.name !== cityName) labelParts.push(s.name);
      if (cityName) labelParts.push(cityName);
      if (stateCode) labelParts.push(stateCode);

      return {
        id: s.id,
        label: labelParts.join(', '),
        latitude: s.lat || 0,
        longitude: s.lng || 0,
        country: 'Australia',
        state: stateName,
        city: cityName,
        suburb: s.name,
        postcode: s.postcode,
        type: 'suburb',
        source: 'local-db'
      };
    });

    if (results.length < limit) {
      try {
        const photonResults = await this.provider.search({ query: q, limit });
        const existingIds = new Set(results.map(r => r.id));
        const existingNames = new Set(results.map(r => `${r.suburb?.toLowerCase()}-${r.postcode}`));

        for (const p of photonResults) {
          const dupKey = `${p.suburb?.toLowerCase()}-${p.postcode}`;
          if (!existingIds.has(p.id) && !existingNames.has(dupKey) && results.length < limit) {
            results.push(p);
            existingIds.add(p.id);
            existingNames.add(dupKey);
          }
        }
      } catch (photonError) {
        this.logger.warn(`Photon provider error: ${photonError.message}`);
      }
    }

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
