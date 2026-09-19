'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';
import { LocationAutocomplete, LocationResult } from '../location/LocationAutocomplete';

const LocationPickerMap = dynamic(
  () => import('./LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-700">Property Location</div>
        <div className="h-[350px] w-full rounded-xl bg-gray-100 animate-pulse border border-gray-300 flex items-center justify-center">
          <span className="text-gray-400">Loading map...</span>
        </div>
      </div>
    )
  }
);

interface LocationPickerProps {
  lat: string | number;
  lng: string | number;
  onChange: (lat: number, lng: number, locationResult?: LocationResult) => void;
  suburbLat?: number | null;
  suburbLng?: number | null;
}

export default function LocationPicker(props: LocationPickerProps) {
  const [autocompleteValue, setAutocompleteValue] = useState<LocationResult | null>(null);

  const handleAutocompleteChange = (location: LocationResult | null) => {
    setAutocompleteValue(location);
    if (location) {
      props.onChange(location.latitude, location.longitude, location);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Search Address (Optional)</label>
        <LocationAutocomplete
          value={autocompleteValue}
          onChange={handleAutocompleteChange}
          placeholder="Search for an address or place to drop a pin..."
        />
      </div>
      <LocationPickerMap {...props} />
    </div>
  );
}
