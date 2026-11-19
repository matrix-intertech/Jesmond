'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2, MapPin, Check, X, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/utils/api';

// Fix standard Leaflet marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface ResolvedLocationData {
  streetAddress: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

interface BusinessLocationMapInnerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  onConfirm: (data: ResolvedLocationData) => void;
  onCancel: () => void;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }): null {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }): null {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function BusinessLocationMapInner({
  initialLat,
  initialLng,
  initialAddress,
  onConfirm,
  onCancel,
}: BusinessLocationMapInnerProps) {
  // Default to Newcastle/Jesmond, NSW if not provided
  const hasInitialCoords =
    typeof initialLat === 'number' &&
    typeof initialLng === 'number' &&
    initialLat !== 0 &&
    initialLng !== 0;

  const defaultCenter: [number, number] = hasInitialCoords
    ? [initialLat as number, initialLng as number]
    : [-32.8991, 151.6854];

  const [position, setPosition] = useState<[number, number]>(defaultCenter);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [zoom, setZoom] = useState<number>(hasInitialCoords ? 15 : 13);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reverse geocode state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocationData>({
    streetAddress: initialAddress || '',
    suburb: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Australia',
    fullAddress: initialAddress || '',
    lat: defaultCenter[0],
    lng: defaultCenter[1],
  });
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const markerRef = useRef<L.Marker>(null);
  const latestReverseReq = useRef<number>(0);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const reqId = Date.now();
    latestReverseReq.current = reqId;
    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/locations/reverse?lat=${lat}&lng=${lng}`);
      if (latestReverseReq.current !== reqId) return;

      if (!res.ok) {
        throw new Error('Could not resolve address for this location');
      }

      const data = await res.json();
      if (latestReverseReq.current !== reqId) return;

      if (data) {
        const fullAddr = data.label || '';
        const streetAddr = data.streetAddress || data.road || '';
        const sub = data.suburb || '';
        const cit = data.city || '';
        const st = data.state || '';
        const post = data.postcode || '';
        const cntry = data.country || 'Australia';

        setResolvedLocation({
          streetAddress: streetAddr,
          suburb: sub || cit,
          city: cit || sub,
          state: st,
          postcode: post,
          country: cntry,
          fullAddress: fullAddr,
          lat,
          lng,
        });
      } else {
        setResolvedLocation((prev) => ({
          ...prev,
          lat,
          lng,
        }));
      }
    } catch (e: any) {
      if (latestReverseReq.current === reqId) {
        setGeocodeError(e.message || 'Unable to reverse geocode this location');
        setResolvedLocation((prev) => ({ ...prev, lat, lng }));
      }
    } finally {
      if (latestReverseReq.current === reqId) {
        setIsGeocoding(false);
      }
    }
  }, []);

  // Initial reverse geocode if coordinates provided but no address
  useEffect(() => {
    if (hasInitialCoords && !initialAddress) {
      reverseGeocode(defaultCenter[0], defaultCenter[1]);
    }
  }, [hasInitialCoords, initialAddress, defaultCenter, reverseGeocode]);

  const handlePositionChange = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    reverseGeocode(lat, lng);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query || query.length < 3) {
      setSearchError('Please enter at least 3 characters to search.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/locations/search?q=${encodeURIComponent(query)}&limit=5`);
      if (!res.ok) {
        throw new Error('Search failed. Please try again.');
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError(`No locations found matching "${query}". Try a different address or suburb.`);
        return;
      }

      setSearchResults(data);

      // Auto-select first result if exact or single result
      if (data.length === 1) {
        selectSearchResult(data[0]);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Location search error');
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: any) => {
    const lat = Number(item.lat ?? item.latitude);
    const lng = Number(item.lng ?? item.longitude);
    const label = item.label || item.name || item.address || '';
    if (!isNaN(lat) && !isNaN(lng)) {
      setPosition([lat, lng]);
      setMapCenter([lat, lng]);
      setZoom(16);
      setSearchResults([]);
      setSearchQuery(label);

      setResolvedLocation({
        streetAddress: item.streetAddress || item.road || '',
        suburb: item.suburb || item.city || '',
        city: item.city || item.suburb || '',
        state: item.state || '',
        postcode: item.postcode || '',
        country: item.country || 'Australia',
        fullAddress: label,
        lat,
        lng,
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full space-y-3">
      {/* Search Header */}
      <div className="relative z-20">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search address, suburb or landmark..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (searchError) setSearchError(null);
              }}
              className="w-full pl-9 pr-8 py-2 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {searchError && (
          <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Search Results Dropdown */}
        {searchResults.length > 1 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border-strong rounded-lg shadow-xl max-h-56 overflow-y-auto z-30 divide-y divide-border-subtle">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSearchResult(item)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-muted transition flex items-start gap-2 text-text-primary"
              >
                <MapPin className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <div className="truncate flex-1">
                  <span className="font-semibold">{item.label || item.name || item.address}</span>
                  {item.suburb && <span className="text-text-secondary ml-1">({item.suburb}, {item.state})</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map View Area */}
      <div className="relative w-full h-[320px] sm:h-[400px] rounded-xl overflow-hidden border border-border-strong bg-surface-muted shadow-inner z-10">
        <MapContainer
          center={position}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={mapCenter} zoom={zoom} />
          <MapClickHandler onPick={handlePositionChange} />

          <Marker
            position={position}
            draggable={true}
            ref={markerRef}
            eventHandlers={{
              dragend: () => {
                const marker = markerRef.current;
                if (marker) {
                  const latLng = marker.getLatLng();
                  handlePositionChange(latLng.lat, latLng.lng);
                }
              },
            }}
          />
        </MapContainer>

        {/* Map instruction overlay */}
        <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-sm border border-border-subtle px-2.5 py-1 rounded-md text-[11px] text-text-secondary shadow pointer-events-none z-[400]">
          Click map or drag pin to position
        </div>
      </div>

      {/* Resolved Address & Coordinates Display */}
      <div className="bg-surface-muted rounded-xl p-3 border border-border-subtle space-y-1.5 text-xs text-text-secondary">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="font-semibold text-text-primary flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            Selected Location Details
          </span>
          <span className="font-mono text-[11px] bg-surface px-2 py-0.5 rounded border border-border-subtle text-text-primary">
            Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
          </span>
        </div>

        <div className="min-h-[20px] flex items-center">
          {isGeocoding ? (
            <div className="flex items-center gap-1.5 text-text-muted italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resolving street address via OpenStreetMap...</span>
            </div>
          ) : geocodeError ? (
            <span className="text-amber-700">{geocodeError}</span>
          ) : resolvedLocation.fullAddress ? (
            <span className="text-text-primary font-medium">{resolvedLocation.fullAddress}</span>
          ) : (
            <span className="text-text-muted">No address details resolved yet</span>
          )}
        </div>
      </div>

      {/* Footer Modal Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border-strong rounded-lg text-sm font-medium text-text-primary bg-surface hover:bg-surface-muted transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(resolvedLocation)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition flex items-center gap-1.5 shadow-sm"
        >
          <Check className="w-4 h-4" />
          <span>Confirm Location</span>
        </button>
      </div>
    </div>
  );
}
