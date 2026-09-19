export interface LocationResult {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  country: string;
  state: string;
  city: string;
  suburb: string;
  postcode: string;
  type: string;
  source: string;
}

export interface LocationSearchOptions {
  query: string;
  limit?: number;
}

export interface LocationProvider {
  search(options: LocationSearchOptions): Promise<LocationResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<LocationResult | null>;
}
