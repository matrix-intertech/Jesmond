'use client';

import dynamic from 'next/dynamic';
import { type PropertyMarkerData } from './PropertyMapInner';

// Dynamically import the map component with SSR disabled
const PropertyMapInner = dynamic(() => import('./PropertyMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-medium text-slate-500">Loading map...</span>
      </div>
    </div>
  ),
});

export interface PropertyMapProps {
  properties: PropertyMarkerData[];
  selectedPropertyId?: string;
  onMarkerClick?: (propertyId: string) => void;
  onBoundsChange?: (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => void;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

export default function PropertyMap(props: PropertyMapProps) {
  return <PropertyMapInner {...props} />;
}
