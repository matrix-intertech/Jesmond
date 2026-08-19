'use client';

import dynamic from 'next/dynamic';

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
  onChange: (lat: number, lng: number) => void;
  suburbLat?: number | null;
  suburbLng?: number | null;
}

export default function LocationPicker(props: LocationPickerProps) {
  return <LocationPickerMap {...props} />;
}
