import { Injectable, Logger } from '@nestjs/common';
import {
  LocationProvider,
  LocationSearchOptions,
  LocationResult,
} from './location-provider.interface';

@Injectable()
export class NominatimProvider implements LocationProvider {
  private readonly logger = new Logger(NominatimProvider.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor() {
    this.baseUrl =
      process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
    this.userAgent =
      process.env.NOMINATIM_USER_AGENT ||
      'Jesmond-Platform/2.0 (support@jesmond.com.au)';
  }

  async search(options: LocationSearchOptions): Promise<LocationResult[]> {
    try {
      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.append('q', options.query);
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');
      url.searchParams.append('countrycodes', 'au');
      url.searchParams.append('limit', (options.limit || 5).toString());

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim Search API error: ${res.statusText}`);
      }

      const data = await res.json();
      return this.normalizeSearchResults(data);
    } catch (err: any) {
      this.logger.error(`Nominatim search error: ${err.message}`);
      return [];
    }
  }

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<LocationResult | null> {
    try {
      const url = new URL(`${this.baseUrl}/reverse`);
      url.searchParams.append('lat', lat.toString());
      url.searchParams.append('lon', lng.toString());
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim Reverse API error: ${res.statusText}`);
      }

      const data = await res.json();
      return this.normalizeReverseResult(data, lat, lng);
    } catch (err: any) {
      this.logger.error(`Nominatim reverseGeocode error: ${err.message}`);
      return null;
    }
  }

  private normalizeSearchResults(data: any): LocationResult[] {
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const addr = item.address || {};
      const road = addr.road || addr.pedestrian || addr.street || addr.footway || '';
      const streetNumber = addr.house_number || addr.house_name || '';
      const building = addr.building || addr.house_name || addr.amenity || addr.shop || '';
      const streetAddress =
        streetNumber && road
          ? `${streetNumber} ${road}`
          : road || item.name || '';
      const suburb =
        addr.suburb ||
        addr.neighbourhood ||
        addr.locality ||
        addr.district ||
        '';
      const city =
        addr.city || addr.town || addr.municipality || addr.village || suburb || '';
      const state = addr.state || '';
      const postcode = addr.postcode || '';
      const country = addr.country || 'Australia';
      const countryCode = addr.country_code ? addr.country_code.toUpperCase() : (country === 'Australia' ? 'AU' : '');
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      return {
        id: item.place_id ? String(item.place_id) : `${lat}-${lng}`,
        label: item.display_name || '',
        latitude: lat,
        longitude: lng,
        country,
        countryCode,
        state,
        city,
        suburb,
        postcode,
        type: item.type || 'address',
        source: 'nominatim',
        road,
        streetNumber,
        streetAddress,
        building,
      };
    });
  }

  private normalizeReverseResult(
    data: any,
    fallbackLat: number,
    fallbackLng: number,
  ): LocationResult | null {
    if (!data || data.error) return null;

    const addr = data.address || {};
    const road = addr.road || addr.pedestrian || addr.street || addr.footway || '';
    const streetNumber = addr.house_number || addr.house_name || '';
    const building = addr.building || addr.house_name || addr.amenity || addr.shop || '';
    const streetAddress =
      streetNumber && road
        ? `${streetNumber} ${road}`
        : road || data.name || '';
    const suburb =
      addr.suburb ||
      addr.neighbourhood ||
      addr.locality ||
      addr.district ||
      '';
    const city =
      addr.city || addr.town || addr.municipality || addr.village || suburb || '';
    const state = addr.state || '';
    const postcode = addr.postcode || '';
    const country = addr.country || 'Australia';
    const countryCode = addr.country_code ? addr.country_code.toUpperCase() : (country === 'Australia' ? 'AU' : '');
    const lat = data.lat ? parseFloat(data.lat) : fallbackLat;
    const lng = data.lon ? parseFloat(data.lon) : fallbackLng;

    return {
      id: data.place_id ? String(data.place_id) : `${lat}-${lng}`,
      label: data.display_name || '',
      latitude: lat,
      longitude: lng,
      country,
      countryCode,
      state,
      city,
      suburb,
      postcode,
      type: data.type || 'address',
      source: 'nominatim',
      road,
      streetNumber,
      streetAddress,
      building,
    };
  }
}
