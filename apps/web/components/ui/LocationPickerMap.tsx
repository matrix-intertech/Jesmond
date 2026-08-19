'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerMapProps {
  lat: string | number;
  lng: string | number;
  onChange: (lat: number, lng: number) => void;
  suburbLat?: number | null;
  suburbLng?: number | null;
}

// Component to handle map clicks
function MapEvents({ onChange }: { onChange: (lat: number, lng: number) => void }): null {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map when suburb changes
function MapRecenter({ lat, lng }: { lat: number; lng: number }): null {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onChange, suburbLat, suburbLng }: LocationPickerMapProps) {
  // Default to Australia center if nothing provided
  const defaultCenter: [number, number] = [-25.2744, 133.7751];
  
  const currentLat = lat ? Number(lat) : suburbLat;
  const currentLng = lng ? Number(lng) : suburbLng;
  
  const center: [number, number] = currentLat && currentLng ? [currentLat, currentLng] : defaultCenter;
  const zoom = currentLat && currentLng ? 13 : 4;

  const markerRef = useRef<L.Marker>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-gray-700">Property Location</div>
      <div className="text-xs text-gray-500 mb-1">Click on the map or drag the marker to set the exact location.</div>
      
      <div className="h-[350px] w-full rounded-xl overflow-hidden border border-gray-300 relative z-0">
        <MapContainer 
          center={center} 
          zoom={zoom} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {suburbLat && suburbLng && <MapRecenter lat={suburbLat} lng={suburbLng} />}
          
          {lat && lng && (
            <Marker 
              position={[Number(lat), Number(lng)]} 
              draggable={true}
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const marker = markerRef.current;
                  if (marker) {
                    const position = marker.getLatLng();
                    onChange(position.lat, position.lng);
                  }
                },
              }}
            />
          )}
          <MapEvents onChange={onChange} />
        </MapContainer>
      </div>

      {lat && lng && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 mt-2">
          <div className="font-medium text-gray-900 mb-1">Selected location:</div>
          <div>Latitude: {Number(lat).toFixed(6)}</div>
          <div>Longitude: {Number(lng).toFixed(6)}</div>
        </div>
      )}
    </div>
  );
}
