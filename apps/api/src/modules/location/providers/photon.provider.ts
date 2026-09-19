import { Injectable, Logger } from '@nestjs/common';
import { LocationProvider, LocationSearchOptions, LocationResult } from './location-provider.interface';

@Injectable()
export class PhotonProvider implements LocationProvider {
  private readonly logger = new Logger(PhotonProvider.name);
  private readonly baseUrl: string;
  private readonly countryCode: string;

  constructor() {
    this.baseUrl = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io/api';
    this.countryCode = process.env.PHOTON_COUNTRY_CODE || 'au'; // Default to Australia
  }

  async search(options: LocationSearchOptions): Promise<LocationResult[]> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.append('q', options.query);
      if (options.limit) {
        url.searchParams.append('limit', options.limit.toString());
      }

      // Enforce bounding country if set
      if (this.countryCode) {
        // Photon uses lat/lon bias or specific bbox. Sometimes bbox or specific country filters aren't standardized globally.
        // We can append it to the query or rely on client-side filtering if API doesn't support strict country bounds.
        // Photon has an undocumented/experimental 'bbox' or we just filter results.
        // Let's rely on filtering results to match the country/state.
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Photon API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResult(data, this.countryCode);
    } catch (error) {
      this.logger.error(`Error searching location: ${error.message}`);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    try {
      const url = new URL(this.baseUrl.replace('/api', '/reverse'));
      url.searchParams.append('lat', lat.toString());
      url.searchParams.append('lon', lng.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Photon Reverse API error: ${response.statusText}`);
      }

      const data = await response.json();
      const normalized = this.normalizeResult(data, this.countryCode);
      return normalized.length > 0 ? normalized[0] : null;
    } catch (error) {
      this.logger.error(`Error reverse geocoding location: ${error.message}`);
      return null;
    }
  }

  private normalizeResult(data: any, expectedCountryCode: string): LocationResult[] {
    if (!data || !data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: LocationResult[] = [];

    for (const feature of data.features) {
      const properties = feature.properties;
      const geometry = feature.geometry;

      if (!properties || !geometry || geometry.type !== 'Point') {
        continue;
      }

      const countryCode = properties.countrycode?.toLowerCase() || '';

      // Filter out non-target countries
      if (expectedCountryCode && countryCode && countryCode !== expectedCountryCode.toLowerCase()) {
        continue;
      }

      const lng = geometry.coordinates[0];
      const lat = geometry.coordinates[1];

      const name = properties.name || '';
      const city = properties.city || properties.town || properties.village || '';
      const state = properties.state || '';
      const country = properties.country || '';
      const postcode = properties.postcode || '';

      // For Australian addresses, suburb is typically mapped to locality, suburb, or district
      const suburb = properties.suburb || properties.locality || properties.district || city || '';

      const id = properties.osm_id?.toString() || `${lat}-${lng}`;

      const type = properties.osm_value || properties.type || 'unknown';

      // Build a clean label
      const labelParts = [];
      if (name && name !== suburb && name !== city) labelParts.push(name);
      if (suburb && suburb !== city) labelParts.push(suburb);
      if (city) labelParts.push(city);
      if (state) labelParts.push(state);
      if (country && !expectedCountryCode) labelParts.push(country); // Omit country if implied

      const label = labelParts.join(', ');

      results.push({
        id,
        label: label || 'Unknown Location',
        latitude: lat,
        longitude: lng,
        country,
        state,
        city,
        suburb,
        postcode,
        type,
        source: `photon-${properties.osm_type || 'node'}`
      });
    }

    // Deduplicate by ID
    const unique = [];
    const ids = new Set();
    for (const res of results) {
      if (!ids.has(res.id)) {
        ids.add(res.id);
        unique.push(res);
      }
    }

    return unique;
  }
}
