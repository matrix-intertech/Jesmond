'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Navigation,
  Compass,
  Map,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Building,
} from 'lucide-react';
import { getApiUrl } from '@/utils/api';
import { getAccessToken, buildAuthHeaders } from '@/utils/auth';
import type { ResolvedLocationData } from './BusinessLocationMapInner';

// Dynamically load the Leaflet map picker to avoid SSR issues
const BusinessLocationMapInner = dynamic(
  () => import('./BusinessLocationMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[360px] sm:h-[420px] rounded-xl bg-surface-muted animate-pulse border border-border-strong flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-sm font-medium text-text-secondary">Loading interactive map...</span>
      </div>
    ),
  }
);

interface BusinessLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation?: {
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  onSuccess: (updated: any) => void;
}

export function parseAddressParts(fullAddress?: string | null) {
  if (!fullAddress) {
    return {
      streetAddress: '',
      building: '',
      streetName: '',
      suburb: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Australia',
      countryCode: 'AU',
    };
  }

  const parts = fullAddress.split(',').map((p) => p.trim());
  if (parts.length >= 3) {
    const streetAddress = parts[0] || '';
    const suburb = parts[1] || '';
    // Look for state and postcode in subsequent parts
    const statePostcode = parts[2] || '';
    const spMatch = statePostcode.match(/([A-Za-z\s]+)\s*(\d{4})/);
    const state = spMatch ? spMatch[1].trim() : statePostcode;
    const postcode = spMatch ? spMatch[2].trim() : '';
    const country = parts[3] || 'Australia';
    const countryCode = country === 'Australia' ? 'AU' : '';
    return {
      streetAddress,
      building: '',
      streetName: '',
      suburb,
      city: suburb,
      state,
      postcode,
      country,
      countryCode,
    };
  }

  return {
    streetAddress: fullAddress,
    building: '',
    streetName: '',
    suburb: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Australia',
    countryCode: 'AU',
  };
}

export default function BusinessLocationModal({
  isOpen,
  onClose,
  currentLocation,
  onSuccess,
}: BusinessLocationModalProps) {
  const [viewMode, setViewMode] = useState<'form' | 'map'>('form');

  // Manual & Autofilled Form State
  const [streetAddress, setStreetAddress] = useState('');
  const [building, setBuilding] = useState('');
  const [streetName, setStreetName] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('Australia');
  const [countryCode, setCountryCode] = useState('AU');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Status / Feedback
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Initialize from currentLocation prop
  useEffect(() => {
    if (isOpen) {
      const parsed = parseAddressParts(currentLocation?.address);
      setStreetAddress(parsed.streetAddress);
      setBuilding(parsed.building || '');
      setStreetName(parsed.streetName || '');
      setSuburb(parsed.suburb);
      setCity(parsed.city || parsed.suburb || '');
      setState(parsed.state);
      setPostcode(parsed.postcode);
      setCountry(parsed.country || 'Australia');
      setCountryCode(parsed.countryCode || (parsed.country === 'Australia' ? 'AU' : ''));

      const initialLat = typeof currentLocation?.lat === 'number' ? currentLocation.lat : null;
      const initialLng = typeof currentLocation?.lng === 'number' ? currentLocation.lng : null;
      setLat(initialLat && initialLat !== 0 ? initialLat : null);
      setLng(initialLng && initialLng !== 0 ? initialLng : null);

      setViewMode('form');
      setErrorMsg(null);
      setGpsNotice(null);
    }
  }, [isOpen, currentLocation]);

  if (!isOpen) return null;

  // Handle Method C: Use Current Location (Geolocation + Reverse Geocode)
  const handleUseCurrentLocation = () => {
    setErrorMsg(null);
    setGpsNotice(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please enter your address or choose on map.');
      return;
    }

    setIsDetectingGps(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const detectedLat = pos.coords.latitude;
        const detectedLng = pos.coords.longitude;

        setLat(detectedLat);
        setLng(detectedLng);

        // Reverse geocode via backend proxy
        try {
          const apiUrl = getApiUrl();
          const res = await fetch(`${apiUrl}/api/v1/locations/reverse?lat=${detectedLat}&lng=${detectedLng}`);
          if (res.ok) {
            const data = await res.json();
            if (data) {
              const streetAddr =
                data.streetAddress ||
                (data.streetNumber && data.road ? `${data.streetNumber} ${data.road}` : data.road) ||
                data.name ||
                '';
              const road = data.road || '';
              const bldg = data.building || '';
              const sub = data.suburb || data.locality || '';
              const cit = data.city || data.town || '';
              const effectiveSuburb = sub || cit || '';
              const st = data.state || '';
              const post = data.postcode || '';
              const cntry = data.country || 'Australia';
              const cc = data.countryCode || (cntry === 'Australia' ? 'AU' : '');

              // Non-destructive update
              if (streetAddr) setStreetAddress(streetAddr);
              if (bldg) setBuilding(bldg);
              if (road) setStreetName(road);
              if (effectiveSuburb) setSuburb(effectiveSuburb);
              if (cit || sub) setCity(cit || sub);
              if (st) setState(st);
              if (post) setPostcode(post);
              if (cntry) setCountry(cntry);
              if (cc) setCountryCode(cc);

              setGpsNotice(data.label ? `Location detected: ${data.label}` : 'Location detected successfully.');
            } else {
              setGpsNotice('Coordinates detected. Please verify your street address.');
            }
          } else {
            setGpsNotice('Coordinates detected. Please enter your street address.');
          }
        } catch {
          setGpsNotice('Coordinates retrieved from GPS. Please fill in street address details.');
        } finally {
          setIsDetectingGps(false);
          setViewMode('form');
        }
      },
      (err) => {
        setIsDetectingGps(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorMsg(
              'Location permission was denied. Please allow access or select your location manually or on the map.'
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setErrorMsg(
              'GPS location information is currently unavailable. Please choose your location on the map.'
            );
            break;
          case err.TIMEOUT:
            setErrorMsg(
              'Location detection timed out. Please try again or select your location on the map.'
            );
            break;
          default:
            setErrorMsg('Unable to retrieve your current location. Please choose on map or enter manually.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  // Handle Method B: Map Picker Confirmation
  const handleMapConfirm = (data: ResolvedLocationData) => {
    // Non-destructive updates from map picker
    if (data.streetAddress) setStreetAddress(data.streetAddress);
    if (data.building) setBuilding(data.building);
    if (data.streetName) setStreetName(data.streetName);
    if (data.suburb) setSuburb(data.suburb);
    if (data.city) setCity(data.city);
    if (data.state) setState(data.state);
    if (data.postcode) setPostcode(data.postcode);
    if (data.country) setCountry(data.country);
    if (data.countryCode) setCountryCode(data.countryCode);
    setLat(data.lat);
    setLng(data.lng);

    setViewMode('form');
    setGpsNotice(`Location set from map: ${data.fullAddress || `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`}`);
    setErrorMsg(null);
  };

  // Build formatted full address
  const buildFullAddress = () => {
    const parts = [
      streetAddress.trim(),
      suburb.trim(),
      [state.trim(), postcode.trim()].filter(Boolean).join(' '),
      country.trim() !== 'Australia' ? country.trim() : '',
    ].filter(Boolean);

    return parts.join(', ');
  };

  // Save location to API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const fullAddr = buildFullAddress();
    if (!streetAddress.trim()) {
      setErrorMsg('Street address is required.');
      return;
    }

    let finalLat = lat;
    let finalLng = lng;

    setIsSubmitting(true);

    try {
      // If coordinates are missing or zero, attempt forward geocoding via proxy
      if (finalLat === null || finalLng === null || (finalLat === 0 && finalLng === 0)) {
        const apiUrl = getApiUrl();
        const searchRes = await fetch(
          `${apiUrl}/api/v1/locations/search?q=${encodeURIComponent(fullAddr)}&limit=1`
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            finalLat = Number(searchData[0].lat ?? searchData[0].latitude);
            finalLng = Number(searchData[0].lng ?? searchData[0].longitude);
            setLat(finalLat);
            setLng(finalLng);
          }
        }
      }

      // Check if coordinates were resolved
      if (finalLat === null || finalLng === null || (finalLat === 0 && finalLng === 0)) {
        setIsSubmitting(false);
        setErrorMsg(
          'Coordinates could not be automatically determined. Please click "Choose on Map" to drop a pin on your location.'
        );
        return;
      }

      // Validate numeric range
      if (finalLat < -90 || finalLat > 90 || finalLng < -180 || finalLng > 180) {
        setIsSubmitting(false);
        setErrorMsg('Invalid coordinates detected. Latitude must be -90 to 90, Longitude -180 to 180.');
        return;
      }

      const token = getAccessToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/retail/businesses/location`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json', }),
        body: JSON.stringify({
          address: fullAddr,
          lat: finalLat,
          lng: finalLng,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to update business location');
      }

      const updated = await res.json();
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while saving location');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className={`inline-block align-bottom bg-surface rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle w-full p-5 sm:p-7 border border-border-strong ${
            viewMode === 'map' ? 'sm:max-w-3xl' : 'sm:max-w-xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  {viewMode === 'map'
                    ? 'Choose on Map'
                    : currentLocation?.address
                    ? 'Edit Business Location'
                    : 'Add Your Business Location'}
                </h3>
                <p className="text-xs text-text-secondary">
                  {viewMode === 'map'
                    ? 'Search, drag the marker, or click to set coordinates. Address fields below update automatically.'
                    : 'Specify your physical storefront or operating address.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* GPS / Map Success Notice */}
          {gpsNotice && !errorMsg && (
            <div className="mt-4 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1">{gpsNotice}</div>
            </div>
          )}

          {/* View Mode: Map Picker with Live Address Form Below */}
          {viewMode === 'map' ? (
            <div className="mt-4">
              <BusinessLocationMapInner
                initialLat={lat}
                initialLng={lng}
                initialAddress={streetAddress ? buildFullAddress() : currentLocation?.address || ''}
                initialLocationData={{
                  streetAddress,
                  building,
                  streetName,
                  suburb,
                  city,
                  state,
                  postcode,
                  country,
                  countryCode,
                  fullAddress: streetAddress ? buildFullAddress() : currentLocation?.address || '',
                  lat: lat || undefined,
                  lng: lng || undefined,
                }}
                onConfirm={handleMapConfirm}
                onCancel={() => setViewMode('form')}
              />
            </div>
          ) : (
            /* View Mode: Main Form */
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {/* Quick Action Buttons (Methods B & C) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isDetectingGps}
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 border border-border-strong rounded-xl bg-surface-muted hover:bg-surface-hover text-text-primary text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {isDetectingGps ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4 text-accent" />
                  )}
                  <span>{isDetectingGps ? 'Detecting Location...' : 'Use Current Location'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 border border-border-strong rounded-xl bg-surface-muted hover:bg-surface-hover text-text-primary text-sm font-medium transition shadow-sm"
                >
                  <Map className="w-4 h-4 text-accent" />
                  <span>Choose on Map</span>
                </button>
              </div>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border-subtle" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-text-muted font-medium">Or enter address details</span>
                </div>
              </div>

              {/* Method A: Manual Address Inputs */}
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shop 4, 12 Blue Gum Road"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
              </div>

              {/* Optional Building & Street Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Building / Premise <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suite 4, Central Plaza or Tower 1"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Street Name <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Gum Road or George Street"
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              </div>

              {/* Suburb / City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Suburb / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jesmond"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    State / Territory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NSW"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              </div>

              {/* Postcode & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2299"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Australia"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-border-strong rounded-xl bg-surface text-text-primary shadow-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                </div>
              </div>

              {/* Coordinates Status Badge */}
              <div className="p-3 bg-surface-muted rounded-xl border border-border-subtle flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Coordinates:</span>
                </div>
                {lat !== null && lng !== null && lat !== 0 && lng !== 0 ? (
                  <span className="font-mono text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-text-muted italic">
                    Resolved upon saving or choosing on map
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border-subtle flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border-strong rounded-xl text-sm font-medium text-text-primary bg-surface hover:bg-surface-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition shadow flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? 'Saving Location...' : 'Save Location'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
