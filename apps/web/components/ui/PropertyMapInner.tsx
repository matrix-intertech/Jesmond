'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { SafeImage } from './SafeImage';

// Fix Leaflet's default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom highlighted icon
const highlightIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export interface PropertyMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lowestPricePerWeek?: number;
  suburb?: string;
  thumbnailUrl?: string;
}

interface PropertyMapInnerProps {
  properties: PropertyMarkerData[];
  selectedPropertyId?: string;
  onMarkerClick?: (propertyId: string) => void;
  onBoundsChange?: (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => void;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

// Component to handle map events like zooming and panning
function MapEventsHandler({ onBoundsChange }: { onBoundsChange?: (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => void }): null {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          swLat: bounds.getSouthWest().lat,
          swLng: bounds.getSouthWest().lng,
          neLat: bounds.getNorthEast().lat,
          neLng: bounds.getNorthEast().lng
        });
      }
    },
    zoomend: () => {
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          swLat: bounds.getSouthWest().lat,
          swLng: bounds.getSouthWest().lng,
          neLat: bounds.getNorthEast().lat,
          neLng: bounds.getNorthEast().lng
        });
      }
    }
  });

  return null;
}

// Component to smoothly pan when a selected property changes
function MapFocusHandler({ selectedPropertyId, properties, zoom, center }: { selectedPropertyId?: string; properties: PropertyMarkerData[], zoom: number, center: [number, number] }): null {
  const map = useMap();

  useEffect(() => {
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id === selectedPropertyId);
      if (prop && prop.lat && prop.lng) {
        map.setView([prop.lat, prop.lng], 15, { animate: true, duration: 0.5 });
      }
    } else if (properties.length === 1 && properties[0].lat && properties[0].lng) {
      map.setView([properties[0].lat, properties[0].lng], 15, { animate: true });
    } else if (properties.length > 1) {
       // Fit bounds if no selection and multiple properties
       const bounds = L.latLngBounds(properties.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]));
       if (bounds.isValid()) {
         map.fitBounds(bounds, { padding: [50, 50], animate: true });
       }
    } else {
       map.setView(center, zoom, { animate: true });
    }
  }, [selectedPropertyId, properties, map, zoom, center]);

  return null;
}

const DEFAULT_CENTER: [number, number] = [-25.2744, 133.7751];

export default function PropertyMapInner({
  properties,
  selectedPropertyId,
  onMarkerClick,
  onBoundsChange,
  center = DEFAULT_CENTER,
  zoom = 4,
  interactive = true
}: PropertyMapInnerProps) {

  // Memoize marker creation
  const validProperties = useMemo(() => properties.filter(p => p.lat && p.lng), [properties]);

  // Calculate initial center based on properties if center is Australia default
  const initialCenter: [number, number] = validProperties.length === 1
    ? [validProperties[0].lat, validProperties[0].lng]
    : center;

  const initialZoom = validProperties.length === 1 ? 15 : zoom;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={interactive}
        zoomControl={interactive}
        dragging={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validProperties.map(prop => (
          <Marker
            key={prop.id}
            position={[prop.lat, prop.lng]}
            icon={selectedPropertyId === prop.id ? highlightIcon : (L.Icon.Default.prototype as any)}
            eventHandlers={{
              click: () => {
                if (onMarkerClick) onMarkerClick(prop.id);
              }
            }}
          >
            {/* Show popup if it's the search page (has price/suburb data) */}
            {prop.name && (
              <Popup closeButton={false} className="custom-popup">
                <Link href={`/property/${prop.id}`} className="block w-48 no-underline group hover:no-underline">
                  <div className="flex flex-col gap-2 rounded-lg overflow-hidden">
                    <div className="relative w-full h-24 bg-slate-100">
                       <SafeImage
                          src={prop.thumbnailUrl || "/assets/property-placeholder.png"}
                          alt={prop.name}
                          fill
                          className="object-cover"
                       />
                    </div>
                    <div className="p-2">
                      <h4 className="font-bold text-sm text-brand-navy leading-tight mb-1 line-clamp-1 group-hover:text-brand-orange transition-colors">{prop.name}</h4>
                      {prop.suburb && <p className="text-xs text-slate-500 mb-1">{prop.suburb}</p>}
                      {prop.lowestPricePerWeek && <p className="text-sm font-bold text-brand-orange">From ${prop.lowestPricePerWeek}/wk</p>}
                    </div>
                  </div>
                </Link>
              </Popup>
            )}
          </Marker>
        ))}

        <MapEventsHandler onBoundsChange={onBoundsChange} />
        <MapFocusHandler selectedPropertyId={selectedPropertyId} properties={validProperties} center={center} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
