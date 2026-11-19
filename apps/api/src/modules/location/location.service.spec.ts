import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { RedisService } from '../redis/redis.service';
import { PhotonProvider } from './providers/photon.provider';
import { NominatimProvider } from './providers/nominatim.provider';
import { PrismaService } from '../prisma/prisma.service';

describe('LocationService & NominatimProvider', () => {
  let service: LocationService;
  let nominatim: NominatimProvider;
  let photon: PhotonProvider;
  let redis: RedisService;
  let prisma: PrismaService;

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockPhoton = {
    search: jest.fn().mockResolvedValue([]),
    reverseGeocode: jest.fn().mockResolvedValue(null),
  };

  const mockNominatim = {
    search: jest.fn().mockResolvedValue([]),
    reverseGeocode: jest.fn().mockResolvedValue(null),
  };

  const mockPrisma = {
    suburb: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PhotonProvider, useValue: mockPhoton },
        { provide: NominatimProvider, useValue: mockNominatim },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    nominatim = module.get<NominatimProvider>(NominatimProvider);
    photon = module.get<PhotonProvider>(PhotonProvider);
    redis = module.get<RedisService>(RedisService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reverseGeocode', () => {
    it('returns cached reverse geocoding result from Redis if available', async () => {
      const cachedResult = {
        id: 'place-1',
        label: '12 Blue Gum Rd, Jesmond NSW 2299',
        latitude: -32.8991,
        longitude: 151.6854,
        country: 'Australia',
        state: 'New South Wales',
        city: 'Newcastle',
        suburb: 'Jesmond',
        postcode: '2299',
        type: 'address',
        source: 'nominatim',
        road: 'Blue Gum Road',
        streetNumber: '12',
        streetAddress: '12 Blue Gum Road',
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResult));

      const result = await service.reverseGeocode(-32.8991, 151.6854);
      expect(result).toEqual(cachedResult);
      expect(mockNominatim.reverseGeocode).not.toHaveBeenCalled();
    });

    it('queries provider and caches in Redis when not in cache', async () => {
      const providerResult = {
        id: 'place-2',
        label: '100 Hunter St, Newcastle NSW 2300',
        latitude: -32.9283,
        longitude: 151.7817,
        country: 'Australia',
        state: 'New South Wales',
        city: 'Newcastle',
        suburb: 'Newcastle',
        postcode: '2300',
        type: 'address',
        source: 'nominatim',
        road: 'Hunter Street',
        streetNumber: '100',
        streetAddress: '100 Hunter Street',
      };
      mockRedis.get.mockResolvedValueOnce(null);
      mockNominatim.reverseGeocode.mockResolvedValueOnce(providerResult);

      const result = await service.reverseGeocode(-32.9283, 151.7817);
      expect(result).toEqual(providerResult);
      expect(mockNominatim.reverseGeocode).toHaveBeenCalledWith(-32.9283, 151.7817);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('location:reverse:-32.9283:151.7817'),
        JSON.stringify(providerResult),
        86400,
      );
    });

    it('falls back to secondary provider if primary returns null', async () => {
      const fallbackResult = {
        id: 'photon-1',
        label: 'Hunter Street, Newcastle',
        latitude: -32.9283,
        longitude: 151.7817,
        country: 'Australia',
        state: 'New South Wales',
        city: 'Newcastle',
        suburb: 'Newcastle',
        postcode: '2300',
        type: 'street',
        source: 'photon-way',
      };
      mockRedis.get.mockResolvedValueOnce(null);
      mockNominatim.reverseGeocode.mockResolvedValueOnce(null);
      mockPhoton.reverseGeocode.mockResolvedValueOnce(fallbackResult);

      const result = await service.reverseGeocode(-32.9283, 151.7817);
      expect(result).toEqual(fallbackResult);
      expect(mockPhoton.reverseGeocode).toHaveBeenCalledWith(-32.9283, 151.7817);
    });
  });

  describe('search', () => {
    it('returns empty array if query is less than 3 chars', async () => {
      const res = await service.search('ab');
      expect(res).toEqual([]);
    });

    it('queries external provider and caches result when local db has fewer than limit results', async () => {
      const externalItem = {
        id: 'place-ext-1',
        label: 'Blue Gum Road, Jesmond NSW',
        latitude: -32.8991,
        longitude: 151.6854,
        country: 'Australia',
        state: 'New South Wales',
        city: 'Newcastle',
        suburb: 'Jesmond',
        postcode: '2299',
        type: 'street',
        source: 'nominatim',
        road: 'Blue Gum Road',
        streetAddress: 'Blue Gum Road',
      };
      mockRedis.get.mockResolvedValueOnce(null);
      mockPrisma.suburb.findMany.mockResolvedValueOnce([]);
      mockNominatim.search.mockResolvedValueOnce([externalItem]);

      const res = await service.search('Blue Gum', 5);
      expect(res).toHaveLength(1);
      expect(res[0].label).toContain('Blue Gum');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('location:search:au:blue gum:5'),
        expect.any(String),
        86400,
      );
    });
  });
});
