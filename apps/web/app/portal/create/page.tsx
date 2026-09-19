'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import LocationPicker from '@/components/ui/LocationPicker';
import { LocationAutocomplete, LocationResult } from '@/components/location/LocationAutocomplete';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError, getApiUrl } from '@/utils/api';

export default function CreatePropertyPage() {
  const router = useRouter();
  const onAuthError = () => { clearAuth(); router.replace('/login'); };

  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [suburbs, setSuburbs] = useState<any[]>([]);
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [suburbsLoading, setSuburbsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const latestGeocodeReq = useRef(0);

  const [step, setStep] = useState(1);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    listingType: 'NORMAL',
    listingMode: 'MULTI_UNIT',
    propertyType: '',
    offeringType: '',
    furnishingType: '',
    availableFrom: '',
    minimumStay: '',
    minimumStayUnit: 'months',
    maximumStay: '',
    maximumStayUnit: 'months',
    bedrooms: '',
    bathrooms: '',
    parkingSpaces: '',
    name: '',
    address: '',
    suburbId: '',
    postcode: '',
    lat: '',
    lng: '',
    description: '',
    maximumOccupancy: '',
    pricePerWeek: '',
    showContactDetails: false,
  });

  useEffect(() => {
    let isMounted = true;
    setStatesLoading(true);
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/v1/locations/states`)
      .then(res => { if (!res.ok) throw new Error(`HTTP error ${res.status}`); return res.json(); })
      .then(data => { if (isMounted) setStates(Array.isArray(data) ? data : []); })
      .catch(() => { if (isMounted) setError('Failed to load states. Ensure API is running.'); })
      .finally(() => { if (isMounted) setStatesLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const handleStateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateId = e.target.value;
    setSelectedStateId(stateId);
    setSelectedCityId('');
    setCities([]);
    setSuburbs([]);
    setFormData(prev => ({ ...prev, suburbId: '', postcode: '' }));
    if (!stateId) return;

    setCitiesLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/locations/cities?stateId=${encodeURIComponent(stateId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      setCities(Array.isArray(await res.json()) ? await res.json() : []);
    } catch (err: any) { setError('Failed to load cities for the selected state.'); }
    finally { setCitiesLoading(false); }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    setSuburbs([]);
    setFormData(prev => ({ ...prev, suburbId: '', postcode: '' }));
    if (!cityId) return;

    setSuburbsLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/locations/suburbs?cityId=${encodeURIComponent(cityId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      setSuburbs(Array.isArray(await res.json()) ? await res.json() : []);
    } catch (err: any) { setError('Failed to load suburbs for the selected city.'); }
    finally { setSuburbsLoading(false); }
  };

  const handleSuburbChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setIsManualLocation(true);
    const selectedSuburb = suburbs.find(s => s.id === sId);

    setFormData(prev => {
      const next = { ...prev, suburbId: sId };
      if (selectedSuburb) {
        if (selectedSuburb.postcode) next.postcode = selectedSuburb.postcode;
        // Since we just set it to true, we know it's a manual location change.
        // We do NOT want to overwrite the map coordinates with generic suburb coordinates here,
        // because the user might have placed a precise pin.
      }
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = async (lat: number, lng: number, locationResult?: any) => {
    setIsManualLocation(false);
    setFormData(prev => ({ ...prev, lat: String(lat), lng: String(lng) }));
    setError('');

    const reqTime = Date.now();
    latestGeocodeReq.current = reqTime;

    if (locationResult && locationResult.suburb) {
      try {
        const apiUrl = getApiUrl();
        const url = new URL(`${apiUrl}/api/v1/locations/match`);
        url.searchParams.append('suburb', locationResult.suburb);
        if (locationResult.city) url.searchParams.append('city', locationResult.city);

        const res = await fetch(url.toString());
        if (res.ok) {
          const match = await res.json();
          if (latestGeocodeReq.current !== reqTime) return;

          setSelectedStateId(match.stateId);
          setSelectedCityId(match.cityId);
          setCities([{ id: match.cityId, name: match.city }]);
          setSuburbs([{ id: match.suburbId, name: match.suburb }]);

          setFormData(prev => ({
            ...prev,
            suburbId: match.suburbId,
            postcode: locationResult.postcode || match.postcode || prev.postcode
          }));
          return; // Skip Nominatim reverse geocoding
        }
      } catch (err) {
        console.log('[Location] Failed to match location to database, falling back to reverse geocode', err);
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();

      if (latestGeocodeReq.current !== reqTime) return;

      if (data && data.address) {
        if (data.address.country_code !== 'au') {
          setError("Couldn't automatically detect the location. Please select it manually.");
          return;
        }

        const stateName = data.address.state;
        if (stateName) {
          const matchedState = states.find(s =>
            s.name.toLowerCase() === stateName.trim().toLowerCase() ||
            s.code.toLowerCase() === stateName.trim().toLowerCase() ||
            stateName.trim().toLowerCase().includes(s.name.toLowerCase())
          );

          if (matchedState) {
            setSelectedStateId(matchedState.id);

            // Fetch cities
            setCitiesLoading(true);
            const apiUrl = getApiUrl();
            const cityRes = await fetch(`${apiUrl}/api/v1/locations/cities?stateId=${matchedState.id}`);
            const cityData = await cityRes.json();
            const loadedCities = Array.isArray(cityData) ? cityData : [];
            setCities(loadedCities);
            setCitiesLoading(false);

            if (latestGeocodeReq.current !== reqTime) return;

            let matchedCity: any = null;
            let matchedSuburb: any = null;

            const cityName = data.address.city || data.address.town || data.address.municipality || data.address.locality || data.address.village;
            if (cityName) {
              matchedCity = loadedCities.find((c: any) =>
                c.name.toLowerCase() === cityName.trim().toLowerCase() ||
                cityName.trim().toLowerCase().includes(c.name.toLowerCase())
              );
            }

            if (matchedCity) {
              setSelectedCityId(matchedCity.id);

              // Fetch suburbs
              setSuburbsLoading(true);
              const suburbRes = await fetch(`${apiUrl}/api/v1/locations/suburbs?cityId=${matchedCity.id}`);
              const suburbData = await suburbRes.json();
              const loadedSuburbs = Array.isArray(suburbData) ? suburbData : [];
              setSuburbs(loadedSuburbs);
              setSuburbsLoading(false);

              if (latestGeocodeReq.current !== reqTime) return;

              const suburbName = data.address.suburb || data.address.neighbourhood || data.address.locality || data.address.village || data.address.hamlet;
              if (suburbName) {
                matchedSuburb = loadedSuburbs.find((s: any) =>
                  s.name.toLowerCase() === suburbName.trim().toLowerCase() ||
                  suburbName.trim().toLowerCase().includes(s.name.toLowerCase())
                );
              }
            }

            // FALLBACK TO GEOGRAPHIC DISTANCE RESOLUTION
            if (!matchedSuburb) {
              try {
                const nearestRes = await fetch(`${apiUrl}/api/v1/locations/nearest?lat=${lat}&lng=${lng}&stateId=${matchedState.id}`);
                if (nearestRes.ok) {
                  const nearestData = await nearestRes.json();
                  if (nearestData && nearestData.id) {
                    if (nearestData.cityId) {
                      matchedCity = loadedCities.find((c: any) => c.id === nearestData.cityId);
                      if (matchedCity) {
                        setSelectedCityId(matchedCity.id);
                        setSuburbsLoading(true);
                        const suburbRes = await fetch(`${apiUrl}/api/v1/locations/suburbs?cityId=${matchedCity.id}`);
                        const loadedSuburbs = await suburbRes.json();
                        setSuburbs(loadedSuburbs);
                        setSuburbsLoading(false);
                        matchedSuburb = nearestData;
                      }
                    } else {
                      matchedSuburb = nearestData;
                      setSelectedCityId('');
                      setSuburbs([nearestData]);
                    }
                  }
                }
              } catch (e) { console.log('[Location] Fallback resolution failed', e); }
            }

            if (latestGeocodeReq.current !== reqTime) return;

            if (matchedSuburb) {
              setFormData(prev => ({
                ...prev,
                suburbId: matchedSuburb.id,
                postcode: data.address.postcode || matchedSuburb.postcode || prev.postcode
              }));
            } else if (matchedCity) {
              setFormData(prev => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
            } else {
              setSelectedCityId('');
              setSuburbs([]);
              setFormData(prev => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
            }
          } else {
            setSelectedStateId('');
            setCities([]);
            setSelectedCityId('');
            setSuburbs([]);
            setFormData(prev => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
          }
        }
      }
    } catch (err) {
      if (latestGeocodeReq.current === reqTime) {
        setError("Couldn't automatically detect the location. Please select it manually.");
      }
    }
  };

  const handleSubmit = async () => {
    const t0 = performance.now();
    setLoading(true);
    setError('');

    if (!formData.lat || !formData.lng) {
      setError('Please select the accommodation location on the map.');
      setLoading(false);
      return;
    }
    const t1 = performance.now();
    console.log(`[CreateProperty] validation: ${Math.round(t1 - t0)}ms`);

    const token = getAccessToken();
    if (!token) { onAuthError(); return; }
    try {
      const apiUrl = getApiUrl();
      const { bedrooms, bathrooms, parkingSpaces, ...restFormData } = formData;

      const t2 = performance.now();
      const res = await fetch(`${apiUrl}/api/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...restFormData,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          minimumStay: formData.minimumStay ? parseInt(formData.minimumStay) : undefined,
          maximumStay: formData.maximumStay ? parseInt(formData.maximumStay) : undefined,
          maximumOccupancy: formData.maximumOccupancy ? parseInt(formData.maximumOccupancy) : undefined,
          pricePerWeek: formData.pricePerWeek ? Math.round(parseFloat(formData.pricePerWeek) * 100) : undefined,
          showContactDetails: formData.showContactDetails,
          configuration: {
            bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
            bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
            parkingSpaces: formData.parkingSpaces ? parseInt(formData.parkingSpaces) : undefined,
          }
        })
      });
      const status = await handleApiError(res, onAuthError);
      if (status !== 'ok') {
        const errData = await res.json();
        throw new Error(Array.isArray(errData.message) ? errData.message.join(', ') : errData.message || 'Failed to create property');
      }
      const createdProperty = await res.json();

      const t3 = performance.now();
      console.log(`[CreateProperty] property-create: ${Math.round(t3 - t2)}ms`);

      // Upload media concurrently
      let failedUploads = 0;
      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file, index) => {
          const tUpload0 = performance.now();
          const mData = new FormData();
          mData.append('file', file);
          try {
            const upRes = await fetch(`${apiUrl}/api/v1/properties/my/${createdProperty.id}/media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: mData
            });
            if (!upRes.ok) failedUploads++;
            const tUpload1 = performance.now();
            console.log(`[CreateProperty] media-upload-${index + 1}: ${Math.round(tUpload1 - tUpload0)}ms`);
          } catch (e) {
            failedUploads++;
            console.error('Failed to upload a media file', e);
          }
        });
        await Promise.all(uploadPromises);
      }

      const t4 = performance.now();
      console.log(`[CreateProperty] total: ${Math.round(t4 - t0)}ms`);

      setSuccess(true);
      if (failedUploads > 0) {
        setError(`Property created, but ${failedUploads} image(s) failed to upload. Check Edit Property to retry.`);
      }

      setTimeout(() => { router.push('/portal'); }, failedUploads > 0 ? 5000 : 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Property Created Successfully!</h2>
          <p className="text-gray-600 mb-6">Your property listing has been saved.</p>
          {error && <div className="mt-4 mb-6 p-4 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
          <p className="text-sm text-gray-500">Redirecting to your properties...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Create Property Listing" onBack={() => router.push('/portal')} />
      <div className="max-w-[800px] mx-auto py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h3 className="text-lg font-bold text-brand-navy">Step {step} of 8</h3>
          </div>

          {error && !success && <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm">{error}</div>}

          {step === 1 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">1. Listing Type & Property Type</h4>

              <div className="bg-surface-muted p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-brand-navy mb-3">Listing Mode</label>
                <div className="flex flex-col space-y-3">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="radio" checked={formData.listingMode === 'MULTI_UNIT' && formData.listingType === 'NORMAL'} onChange={() => setFormData({...formData, listingMode: 'MULTI_UNIT', listingType: 'NORMAL'})} className="mt-1 h-4 w-4 border-gray-300 text-brand-orange" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">Multi-Unit Property</span>
                      <span className="text-sm text-gray-500">Student accommodation building with multiple room types.</span>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="radio" checked={formData.listingMode === 'INDIVIDUAL' && formData.listingType === 'NORMAL'} onChange={() => setFormData({...formData, listingMode: 'INDIVIDUAL', listingType: 'NORMAL'})} className="mt-1 h-4 w-4 border-gray-300 text-brand-orange" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">Individual Property</span>
                      <span className="text-sm text-gray-500">A single house, apartment, or unit rented entirely.</span>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="radio" checked={formData.listingType === 'CO_LIVING'} onChange={() => setFormData({...formData, listingMode: 'INDIVIDUAL', listingType: 'CO_LIVING'})} className="mt-1 h-4 w-4 border-gray-300 text-brand-orange" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">Co-Living Space</span>
                      <span className="text-sm text-gray-500">A property with shared spaces, house rules, and resident profiles.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select name="propertyType" value={formData.propertyType} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="">Select Property Type</option>
                  <option value="HOUSE">House</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="STUDIO">Studio</option>
                  <option value="GRANNY_FLAT">Granny Flat</option>
                  <option value="TOWNHOUSE">Townhouse</option>
                  <option value="UNIT">Unit</option>
                  <option value="DUPLEX">Duplex</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">2. Configuration & Offering</h4>

              <div className="grid grid-cols-2 gap-4">
                {formData.listingType === 'CO_LIVING' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Occupancy (Required)</label>
                    <input type="number" name="maximumOccupancy" value={formData.maximumOccupancy} onChange={handleChange} placeholder="e.g. 6" min="1" className="w-full border border-gray-300 rounded-md px-3 py-2" />
                    <p className="text-xs text-gray-500 mt-1">Total number of residents allowed to live at this property.</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input type="number" min="0" name="bedrooms" value={formData.bedrooms} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                  <input type="number" min="0" name="bathrooms" value={formData.bathrooms} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parking Spaces</label>
                  <input type="number" min="0" name="parkingSpaces" value={formData.parkingSpaces} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offering Type</label>
                <select name="offeringType" value={formData.offeringType} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="">Select Offering</option>
                  <option value="ROOM_IN_SHARED_SPACE">Room in Shared Space</option>
                  <option value="ENTIRE_PLACE">Entire Place</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">3. Furnishing & Availability</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
                <select name="furnishingType" value={formData.furnishingType} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="">Select Furnishing</option>
                  <option value="UNFURNISHED">Unfurnished</option>
                  <option value="FULLY_FURNISHED">Fully Furnished</option>
                  <option value="FLEXIBLE">Flexible</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
                <input type="date" name="availableFrom" value={formData.availableFrom} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stay (months)</label>
                  <input type="number" min="1" name="minimumStay" value={formData.minimumStay} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Stay (months)</label>
                  <input type="number" min="1" name="maximumStay" value={formData.maximumStay} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Leave blank for none" />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">4. Basic Details</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="e.g., Unilodge Melbourne" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Describe the property..."></textarea>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">5. Pricing</h4>
              <p className="text-sm text-gray-600">What will the seeker pay?</p>

              {formData.listingMode === 'MULTI_UNIT' ? (
                <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm border border-blue-200">
                  <p className="font-semibold mb-1">Multi-Unit Pricing</p>
                  <p>You have selected a Multi-Unit property. You will be able to configure pricing for each individual room type (e.g., Studio, 1-Bed) in the "Rooms & Spaces" tab after creating this property.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Week ($)</label>
                    <input type="number" min="0" step="0.01" name="pricePerWeek" value={formData.pricePerWeek} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="e.g. 450" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">6. Photos & Media</h4>
              <p className="text-sm text-gray-600">Upload high-quality images of the property. You can upload multiple images at once.</p>

              <div className="flex flex-wrap gap-4 mb-4">
                {mediaFiles.map((file, i) => (
                  <div key={i} className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="object-cover w-full h-full" />
                    <button
                      type="button"
                      onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-white rounded-full text-red-500 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <label className="bg-brand-orange/10 text-brand-orange px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-100 transition inline-block">
                <span>+ Select Images</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      setMediaFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">7. Location</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Address</label>
                <LocationAutocomplete
                  value={null}
                  onChange={(res) => {
                    setFormData(prev => ({ ...prev, address: res.label || '' }));
                    if (res) {
                      handleLocationChange(res.latitude, res.longitude, res);
                    }
                  }}
                  placeholder="Start typing your address..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Street Address</label>
                <input required type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50" placeholder="123 Example Street" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select name="stateId" value={selectedStateId} onChange={handleStateChange} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                    <option value="">{statesLoading ? 'Loading states...' : 'Select State'}</option>
                    {states.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.code})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <select name="cityId" value={selectedCityId} onChange={handleCityChange} disabled={!selectedStateId || citiesLoading} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                    <option value="">Select City</option>
                    {cities.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
                  <select name="suburbId" value={formData.suburbId} onChange={handleSuburbChange} disabled={!selectedCityId || suburbsLoading} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                    <option value="">Select Suburb</option>
                    {suburbs.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                <input required type="text" name="postcode" value={formData.postcode} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>

              <LocationPicker lat={formData.lat} lng={formData.lng} onChange={handleLocationChange} suburbLat={suburbs.find(s => s.id === formData.suburbId)?.lat} suburbLng={suburbs.find(s => s.id === formData.suburbId)?.lng} />
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6">
              <h4 className="text-md font-semibold">8. Contact & Enquiry Preferences</h4>
              <p className="text-sm text-gray-600">Choose how seekers can contact you about this property.</p>

              <div className="bg-surface-muted p-4 rounded-lg border border-gray-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showContactDetails}
                    onChange={(e) => setFormData({...formData, showContactDetails: e.target.checked})}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-orange"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">Show my contact details on this property</span>
                    <span className="text-sm text-gray-500">
                      If checked, your approved public contact phone and email will be visible to seekers. If unchecked, seekers must use the secure Enquiry Form.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-between border-t mt-8">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-2 rounded-md border text-gray-600 hover:bg-gray-50">Back</button>
            ) : <div/>}

            {step < 8 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="bg-brand-navy text-white px-6 py-2 rounded-md hover:bg-opacity-90">Next Step</button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading} className="bg-brand-orange text-white px-6 py-2 rounded-md hover:bg-orange-600 transition disabled:opacity-50">
                {loading ? 'Creating...' : 'Save Draft & Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
