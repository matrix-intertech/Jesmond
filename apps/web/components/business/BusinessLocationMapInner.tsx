'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2, MapPin, Check, X, AlertCircle, CheckCircle2, Building, Compass } from 'lucide-react';
import { getApiUrl } from '@/utils/api';

// Fix standard Leaflet marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface ResolvedLocationData {
  fullAddress: string;
  streetAddress: string;
  building?: string;
  streetName?: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
}

interface BusinessLocationMapInnerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  initialLocationData?: Partial<ResolvedLocationData>;
  onConfirm: (data: ResolvedLocationData) => void;
  onCancel: () => void;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }): null {
  const map = useMap();
  useEffect(() => {
    if (map && map.getContainer()) {
      map.setView(center, zoom, { animate: false });
    }
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
  initialLocationData,
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

  // Reverse geocode state & Autofill feedback
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);

  // Form fields below the map
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocationData>({
    streetAddress: initialLocationData?.streetAddress || initialAddress || '',
    building: initialLocationData?.building || '',
    streetName: initialLocationData?.streetName || '',
    suburb: initialLocationData?.suburb || '',
    city: initialLocationData?.city || '',
    state: initialLocationData?.state || '',
    postcode: initialLocationData?.postcode || '',
    country: initialLocationData?.country || 'Australia',
    countryCode: initialLocationData?.countryCode || 'AU',
    fullAddress: initialLocationData?.fullAddress || initialAddress || '',
    lat: defaultCenter[0],
    lng: defaultCenter[1],
  });

  const markerRef = useRef<L.Marker>(null);
  const latestReverseReq = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reverse geocode API call
  const executeReverseGeocode = useCallback(async (lat: number, lng: number) => {
    const reqId = Date.now();
    latestReverseReq.current = reqId;
    setIsGeocoding(true);
    setGeocodeError(null);
    setGeocodeNotice(null);

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/locations/reverse?lat=${lat}&lng=${lng}`);
      if (latestReverseReq.current !== reqId) return;

      if (!res.ok) {
        throw new Error('Could not reverse-geocode coordinates. You can enter the address manually below.');
      }

      const data = await res.json();
      if (latestReverseReq.current !== reqId) return;

      if (data) {
        const fullAddr = data.label || data.address || '';
        const streetAddr =
          data.streetAddress ||
          (data.streetNumber && data.road ? `${data.streetNumber} ${data.road}` : data.road) ||
          data.name ||
          '';
        const road = data.road || '';
        const bldg = data.building || '';
        const sub = data.suburb || data.locality || '';
        const cit = data.city || data.town || '';
        const st = data.state || '';
        const post = data.postcode || '';
        const cntry = data.country || 'Australia';
        const cc = data.countryCode || (cntry === 'Australia' ? 'AU' : '');

        // Non-destructive update: Preserve any existing user-entered values if API returns blank
        setResolvedLocation((prev) => {
          const effectiveStreet = streetAddr || prev.streetAddress;
          const effectiveSuburb = sub || cit || prev.suburb;
          const effectiveCity = cit || sub || prev.city;
          const effectiveState = st || prev.state;
          const effectivePostcode = post || prev.postcode;
          const effectiveCountry = cntry || prev.country || 'Australia';

          const computedFull =
            fullAddr ||
            [
              effectiveStreet,
              effectiveSuburb,
              [effectiveState, effectivePostcode].filter(Boolean).join(' '),
              effectiveCountry !== 'Australia' ? effectiveCountry : '',
            ]
              .filter(Boolean)
              .join(', ');

          return {
            streetAddress: effectiveStreet,
            building: bldg || prev.building || '',
            streetName: road || prev.streetName || '',
            suburb: effectiveSuburb,
            city: effectiveCity,
            state: effectiveState,
            postcode: effectivePostcode,
            country: effectiveCountry,
            countryCode: cc || prev.countryCode || 'AU',
            fullAddress: computedFull,
            lat,
            lng,
          };
        });

        setGeocodeNotice('Address autofilled from map selection. You can edit any field below.');
      } else {
        setResolvedLocation((prev) => ({
          ...prev,
          lat,
          lng,
        }));
        setGeocodeNotice('Coordinates updated. You can enter or adjust the address below.');
      }
    } catch (e: any) {
      if (latestReverseReq.current === reqId) {
        setGeocodeError(
          e.message || 'Could not reverse-geocode coordinates. You can enter the address manually below.'
        );
        setResolvedLocation((prev) => ({ ...prev, lat, lng }));
      }
    } finally {
      if (latestReverseReq.current === reqId) {
        setIsGeocoding(false);
      }
    }
  }, []);

  // Debounced trigger for reverse geocode to avoid duplicate requests during rapid pin movement
  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      setPosition([lat, lng]);
      setIsGeocoding(true);
      setGeocodeError(null);
      setGeocodeNotice(null);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeReverseGeocode(lat, lng);
      }, 350);
    },
    [executeReverseGeocode]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Initial reverse geocode if coordinates provided but no address
  useEffect(() => {
    if (hasInitialCoords && !initialAddress) {
      executeReverseGeocode(defaultCenter[0], defaultCenter[1]);
    }
  }, [hasInitialCoords, initialAddress, defaultCenter, executeReverseGeocode]);

  // Handle address search
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

      // Auto-select first result if single result
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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setPosition([lat, lng]);
      setMapCenter([lat, lng]);
      setZoom(16);
      setSearchResults([]);
      setSearchQuery(label);
      setGeocodeError(null);

      const streetAddr =
        item.streetAddress ||
        (item.streetNumber && item.road ? `${item.streetNumber} ${item.road}` : item.road) ||
        item.name ||
        '';
      const road = item.road || '';
      const bldg = item.building || '';
      const sub = item.suburb || item.locality || '';
      const cit = item.city || item.town || '';
      const st = item.state || '';
      const post = item.postcode || '';
      const cntry = item.country || 'Australia';
      const cc = item.countryCode || (cntry === 'Australia' ? 'AU' : '');

      setResolvedLocation((prev) => ({
        streetAddress: streetAddr || prev.streetAddress,
        building: bldg || prev.building || '',
        streetName: road || prev.streetName || '',
        suburb: sub || cit || prev.suburb,
        city: cit || sub || prev.city,
        state: st || prev.state,
        postcode: post || prev.postcode,
        country: cntry || prev.country || 'Australia',
        countryCode: cc || prev.countryCode || 'AU',
        fullAddress: label || prev.fullAddress || '',
        lat,
        lng,
      }));

      setGeocodeNotice('Address autofilled from search selection. You can edit any field below.');
    }
  };

  // Field edit handler (user edits any autofilled field below the map)
  const handleFieldChange = (field: keyof ResolvedLocationData, value: string) => {
    setResolvedLocation((prev) => {
      const updated = { ...prev, [field]: value };
      // Dynamically recompute full address if street, suburb, state, or postcode changed
      if (['streetAddress', 'suburb', 'state', 'postcode', 'country'].includes(field)) {
        const parts = [
          updated.streetAddress.trim(),
          updated.suburb.trim(),
          [updated.state.trim(), updated.postcode.trim()].filter(Boolean).join(' '),
          updated.country.trim() !== 'Australia' ? updated.country.trim() : '',
        ].filter(Boolean);
        updated.fullAddress = parts.join(', ');
      }
      return updated;
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full space-y-3.5">
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
      <div className="relative w-full h-[300px] sm:h-[360px] rounded-xl overflow-hidden border border-border-strong bg-surface-muted shadow-inner z-10">
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

      {/* Live Autofill Status Feedback */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
          <span className="font-semibold text-text-primary flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            Selected Coordinates
          </span>
          <span className="font-mono text-[11px] bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-text-primary">
            Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
          </span>
        </div>

        {isGeocoding ? (
          <div className="p-2.5 bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-xl flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
            <span>Autofilling address from map coordinates...</span>
          </div>
        ) : geocodeError ? (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{geocodeError}</span>
          </div>
        ) : geocodeNotice ? (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{geocodeNotice}</span>
          </div>
        ) : null}
      </div>

      {/* Address Form Fields Below the Map */}
      <div className="bg-surface-muted/60 p-3.5 rounded-xl border border-border-subtle space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Address Details (Autofilled & Editable)
          </span>
          <span className="text-[11px] text-text-secondary">
            Changes refresh automatically from map pin
          </span>
        </div>

        {/* Street Address */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Street Address <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Shop 4, 12 Blue Gum Road"
            value={resolvedLocation.streetAddress}
            onChange={(e) => handleFieldChange('streetAddress', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          />
        </div>

        {/* Building & Street Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Building / Premise <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Suite 4, Central Plaza or Building A"
              value={resolvedLocation.building || ''}
              onChange={(e) => handleFieldChange('building', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Street Name <span className="text-text-muted font-normal">(Road)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Blue Gum Road or George Street"
              value={resolvedLocation.streetName || ''}
              onChange={(e) => handleFieldChange('streetName', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
        </div>

        {/* Suburb & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Suburb / Locality
            </label>
            <input
              type="text"
              placeholder="e.g. Jesmond"
              value={resolvedLocation.suburb}
              onChange={(e) => handleFieldChange('suburb', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              City
            </label>
            <input
              type="text"
              placeholder="e.g. Newcastle"
              value={resolvedLocation.city}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
        </div>

        {/* State & Postcode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              State / Territory / Province
            </label>
            <input
              type="text"
              placeholder="e.g. NSW"
              value={resolvedLocation.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Postcode / ZIP
            </label>
            <input
              type="text"
              placeholder="e.g. 2299"
              value={resolvedLocation.postcode}
              onChange={(e) => handleFieldChange('postcode', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
        </div>

        {/* Country & Country Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Country
            </label>
            <input
              type="text"
              placeholder="e.g. Australia"
              value={resolvedLocation.country}
              onChange={(e) => handleFieldChange('country', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Country Code
            </label>
            <input
              type="text"
              placeholder="e.g. AU"
              value={resolvedLocation.countryCode || ''}
              onChange={(e) => handleFieldChange('countryCode', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border-strong rounded-lg bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>
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
