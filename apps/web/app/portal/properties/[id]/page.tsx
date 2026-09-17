'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { SafeImage } from '../../../../components/ui/SafeImage';
import PageHeader from '@/components/ui/PageHeader';
import LocationPicker from '@/components/ui/LocationPicker';
import { getAccessToken, clearAuth } from '@/utils/auth';

import { handleApiError } from '@/utils/api';
import HierarchyManager from './HierarchyManager';
import ResidentManager from './ResidentManager';
import HouseRulesManager from './HouseRulesManager';

export default function AccommodationManagementPage() {
  const router = useRouter();
  const onAuthError = () => { clearAuth(); router.replace('/login'); };
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [submitConfirm, setSubmitConfirm] = useState(false);

  // Forms
  const [newRoom, setNewRoom] = useState({ name: '', description: '', price: '', inventory: '' });
  const [availDate, setAvailDate] = useState('');
  const [availCount, setAvailCount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingProp, setIsEditingProp] = useState(false);
  const [editPropForm, setEditPropForm] = useState<any>({ name: '', address: '', postcode: '', lat: '', lng: '', description: '', showContactDetails: false });
  const [allAmenities, setAllAmenities] = useState<any[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [isEditingAmenities, setIsEditingAmenities] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [suburbs, setSuburbs] = useState<any[]>([]);
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [statesLoading, setStatesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [suburbsLoading, setSuburbsLoading] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const latestGeocodeReq = useRef(0);


  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/amenities`)
      .then(res => res.json())
      .then(data => setAllAmenities(data))
      .catch(err => console.log('Failed to load amenities. Ensure API is running.', err.message));

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/states`)
      .then(res => res.json())
      .then(data => { setStates(data); setStatesLoading(false); })
      .catch(() => setStatesLoading(false));
  }, []);

  const fetchProperty = async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        const data = await res.json();
        setProperty(data);
        setEditPropForm({
          name: data.name, address: data.address, postcode: data.postcode,
                    lat: data.lat, lng: data.lng, description: data.description,
          suburbId: data.suburbId || data.suburb?.id || '',
          propertyType: data.propertyType || '',
          offeringType: data.offeringType || '',
          furnishingType: data.furnishingType || '',
          availableFrom: data.availableFrom ? new Date(data.availableFrom).toISOString().split('T')[0] : '',
          minimumStay: data.minimumStay || '',
          maximumStay: data.maximumStay || '',
          maximumOccupancy: data.maximumOccupancy || '',
          pricePerWeek: data.roomTypes?.[0]?.pricePerWeek ? (data.roomTypes[0].pricePerWeek / 100).toString() : '',
          bedrooms: data.configuration?.bedrooms || '',
          bathrooms: data.configuration?.bathrooms || '',
          parkingSpaces: data.configuration?.parkingSpaces || '',
          showContactDetails: data.showContactDetails || false,
        });
        setSelectedAmenities(data.amenities?.map((a: any) => a.amenityId) || []);

        if (data.suburb?.city?.stateId) setSelectedStateId(data.suburb.city.stateId);
        if (data.suburb?.cityId) setSelectedCityId(data.suburb.cityId);

        if (data.suburb?.city?.stateId) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/cities?stateId=${data.suburb.city.stateId}`)
            .then(r => r.json())
            .then(cData => setCities(Array.isArray(cData) ? cData : []));
        }
        if (data.suburb?.cityId) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/suburbs?cityId=${data.suburb.cityId}`)
            .then(r => r.json())
            .then(sData => setSuburbs(Array.isArray(sData) ? sData : []));
        }
      } else {
        setError('Failed to fetch property');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAccessToken();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setToast('Image uploaded successfully');
        setTimeout(() => setToast(''), 3000);
      } else {
        const err = await res.json();
        setError(err.message || 'Upload failed');
      }
      fetchProperty();
    } catch (err) {
      console.error(err);
      setError('Upload failed');
    }
  };

  
  const handleStateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateId = e.target.value;
    setSelectedStateId(stateId);
    setSelectedCityId('');
    setEditPropForm((prev: any) => ({ ...prev, suburbId: '', postcode: '' }));
    setSuburbs([]);
    setIsManualLocation(true);
    if (!stateId) { setCities([]); return; }
    setCitiesLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/cities?stateId=${stateId}`);
      const data = await res.json();
      setCities(Array.isArray(data) ? data : []);
    } catch (err) {} finally { setCitiesLoading(false); }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    setEditPropForm((prev: any) => ({ ...prev, suburbId: '', postcode: '' }));
    setIsManualLocation(true);
    if (!cityId) { setSuburbs([]); return; }
    setSuburbsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/suburbs?cityId=${cityId}`);
      const data = await res.json();
      setSuburbs(Array.isArray(data) ? data : []);
    } catch (err) {} finally { setSuburbsLoading(false); }
  };

  const handleSuburbChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setIsManualLocation(true);
    const selectedSuburb = suburbs.find(s => s.id === sId);
    setEditPropForm((prev: any) => {
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

  const handleLocationChange = async (lat: number, lng: number) => {
    setIsManualLocation(false);
    setEditPropForm((prev: any) => ({ ...prev, lat: String(lat), lng: String(lng) }));
    setError('');

    const reqId = Date.now();
    latestGeocodeReq.current = reqId;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      
      if (latestGeocodeReq.current !== reqId) return;
      
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
            
            setCitiesLoading(true);
            const cityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/cities?stateId=${matchedState.id}`);
            const cityData = await cityRes.json();
            const loadedCities = Array.isArray(cityData) ? cityData : [];
            setCities(loadedCities);
            setCitiesLoading(false);
            
            if (latestGeocodeReq.current !== reqId) return;
            
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
              
              setSuburbsLoading(true);
              const suburbRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/suburbs?cityId=${matchedCity.id}`);
              const suburbData = await suburbRes.json();
              const loadedSuburbs = Array.isArray(suburbData) ? suburbData : [];
              setSuburbs(loadedSuburbs);
              setSuburbsLoading(false);
              
              if (latestGeocodeReq.current !== reqId) return;
              
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
                const nearestRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/nearest?lat=${lat}&lng=${lng}&stateId=${matchedState.id}`);
                if (nearestRes.ok) {
                  const nearestData = await nearestRes.json();
                  if (nearestData && nearestData.id) {
                    if (nearestData.cityId) {
                      matchedCity = loadedCities.find((c: any) => c.id === nearestData.cityId);
                      if (matchedCity) {
                        setSelectedCityId(matchedCity.id);
                        setSuburbsLoading(true);
                        const suburbRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/locations/suburbs?cityId=${matchedCity.id}`);
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
            
            if (latestGeocodeReq.current !== reqId) return;

            if (matchedSuburb) {
              setEditPropForm((prev: any) => ({
                ...prev,
                suburbId: matchedSuburb.id,
                postcode: data.address.postcode || matchedSuburb.postcode || prev.postcode
              }));
            } else if (matchedCity) {
              setEditPropForm((prev: any) => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
            } else {
              setSelectedCityId('');
              setSuburbs([]);
              setEditPropForm((prev: any) => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
            }
          } else {
            setSelectedStateId('');
            setCities([]);
            setSelectedCityId('');
            setSuburbs([]);
            setEditPropForm((prev: any) => ({ ...prev, suburbId: '', postcode: data.address.postcode || prev.postcode }));
          }
        }
      }
    } catch (err) {
      if (latestGeocodeReq.current === reqId) {
        setError("Couldn't automatically detect the location. Please select it manually.");
      }
    }
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editPropForm,
          lat: parseFloat(editPropForm.lat),
          lng: parseFloat(editPropForm.lng),
          suburbId: editPropForm.suburbId || undefined,
          minimumStay: editPropForm.minimumStay ? parseInt(editPropForm.minimumStay as any) : undefined,
          maximumStay: editPropForm.maximumStay ? parseInt(editPropForm.maximumStay as any) : undefined,
          maximumOccupancy: editPropForm.maximumOccupancy ? parseInt(editPropForm.maximumOccupancy as any) : undefined,
          pricePerWeek: editPropForm.pricePerWeek ? Math.round(parseFloat(editPropForm.pricePerWeek as any) * 100) : undefined,
          showContactDetails: editPropForm.showContactDetails,
          configuration: {
            bedrooms: editPropForm.bedrooms ? parseInt(editPropForm.bedrooms as any) : undefined,
            bathrooms: editPropForm.bathrooms ? parseInt(editPropForm.bathrooms as any) : undefined,
            parkingSpaces: editPropForm.parkingSpaces ? parseInt(editPropForm.parkingSpaces as any) : undefined,
          }
        })
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Property updated successfully');
        setIsEditingProp(false);
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Update failed');
      }
    } catch (err) { setError('Update failed'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room type?')) return;
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Room deleted successfully');
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Delete failed');
      }
    } catch (err) { setError('Delete failed'); } finally { setIsSubmitting(false); }
  };

  const handleUpdateAmenities = async () => {
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/amenities`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amenities: selectedAmenities })
      });
      if (await handleApiError(res, onAuthError) === 'ok') {
        setToast('Amenities updated');
        setIsEditingAmenities(false);
        fetchProperty();
      } else {
        setError((await res.json()).message || 'Failed to update amenities');
      }
    } catch (err) { setError('Failed to update amenities'); } finally { setIsSubmitting(false); }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoom.name,
          description: newRoom.description,
          pricePerWeek: Math.round(parseFloat(newRoom.price) * 100), // convert to cents
          inventory: parseInt(newRoom.inventory)
        })
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setNewRoom({ name: '', description: '', price: '', inventory: '' });
        setToast('Room created successfully');
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to create room');
    } finally { setIsSubmitting(false); }
  };

  const handleUpdateAvailability = async (roomId: string) => {
    if (!availDate || !availCount) return setError('Date and count required');
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/rooms/${roomId}/availability`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: availDate,
          available: parseInt(availCount)
        })
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setAvailDate('');
        setAvailCount('');
        setToast('Availability updated');
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(Array.isArray(err.message) ? err.message.join(', ') : err.message);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to update availability');
    } finally { setIsSubmitting(false); }
  };

  const handleSubmitReview = async () => {
    const token = getAccessToken();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setToast('Property submitted for review!');
        setSubmitConfirm(false);
        setTimeout(() => setToast(''), 3000);
        fetchProperty();
      } else {
        const err = await res.json();
        setError(err.message);
        setSubmitConfirm(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to submit');
      setSubmitConfirm(false);
    } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
  if (!property) return null;

  const isPending = property.status === 'PENDING_APPROVAL';
  const isPublished = property.status === 'PUBLISHED';

  return (
    <>
      <PageHeader title={property.name} description={`${property.address}, ${property.suburb.name}`} onBack={() => router.push('/portal')} />
      <div className="max-w-5xl mx-auto py-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-medium text-brand-navy font-outfit">{property.name}</h1>
            <p className="text-gray-500">{property.address}, {property.suburb.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {property.status}
            </span>
            {property.status === 'DRAFT' && !isEditingProp && (
              <button onClick={() => setIsEditingProp(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-surface-muted text-sm">
                Edit Details
              </button>
            )}
            {property.status === 'DRAFT' && (
              <div className="relative">
                <button disabled={isSubmitting} onClick={() => setSubmitConfirm(true)} className="bg-brand-orange text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm disabled:opacity-50">
                  Submit for Review
                </button>
                {submitConfirm && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border shadow-lg rounded-xl p-4 z-10">
                    <h3 className="font-semibold text-sm mb-2">Submit for Review?</h3>
                    <p className="text-xs text-gray-600 mb-4">You will not be able to edit it while pending.</p>
                    <div className="flex gap-2 justify-end">
                      <button disabled={isSubmitting} onClick={() => setSubmitConfirm(false)} className="text-xs px-3 py-1 text-gray-500 disabled:opacity-50">Cancel</button>
                      <button disabled={isSubmitting} onClick={handleSubmitReview} className="text-xs px-3 py-1 bg-brand-orange text-white rounded disabled:opacity-50">
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isPublished && (
              <a href={`/property/${property.id}`} target="_blank" className="text-brand-orange text-sm hover:underline">
                View Public Listing
              </a>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 relative">
          {error}
          <button onClick={() => setError('')} className="absolute top-4 right-4 text-red-500 hover:text-red-700">✕</button>
        </div>}
        {toast && <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-8">{toast}</div>}

        {isPending && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8">
            <h3 className="font-medium">Awaiting Admin Approval</h3>
            <p className="text-sm">This property is currently being reviewed by administrators. Editing is disabled until a decision is made.</p>
          </div>
        )}

        {isEditingProp && (
          <form onSubmit={handleUpdateProperty} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-4">
            <h2 className="text-xl font-medium mb-4">Edit Details</h2>
            <div><label className="block text-sm text-gray-700 mb-1">Name</label><input required type="text" value={editPropForm.name} onChange={e => setEditPropForm({...editPropForm, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            <div><label className="block text-sm text-gray-700 mb-1">Address</label><input required type="text" value={editPropForm.address} onChange={e => setEditPropForm({...editPropForm, address: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select value={selectedStateId} onChange={handleStateChange} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                  <option value="">{statesLoading ? 'Loading states...' : 'Select State'}</option>
                  {states.map((s: any) => (<option key={s.id} value={s.id}>{s.name} ({s.code})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select value={selectedCityId} onChange={handleCityChange} disabled={!selectedStateId || citiesLoading} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                  <option value="">Select City</option>
                  {cities.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
                <select value={editPropForm.suburbId} onChange={handleSuburbChange} disabled={!selectedCityId || suburbsLoading} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white">
                  <option value="">Select Suburb</option>
                  {suburbs.map((s: any) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
            </div>
            
            <div><label className="block text-sm text-gray-700 mb-1">Postcode</label><input required type="text" value={editPropForm.postcode} onChange={e => setEditPropForm((prev:any)=>({...prev, postcode: e.target.value}))} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            
            <LocationPicker lat={editPropForm.lat} lng={editPropForm.lng} onChange={handleLocationChange} suburbLat={suburbs.find(s => s.id === editPropForm.suburbId)?.lat} suburbLng={suburbs.find(s => s.id === editPropForm.suburbId)?.lng} />
            <div><label className="block text-sm text-gray-700 mb-1">Description</label><textarea required rows={4} value={editPropForm.description} onChange={e => setEditPropForm({...editPropForm, description: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
            
            {(property.listingMode === 'INDIVIDUAL' || property.offeringType === 'ENTIRE_PLACE') && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">Price per Week ($)</label>
                <input type="number" step="0.01" min="0" value={editPropForm.pricePerWeek} onChange={e => setEditPropForm({...editPropForm, pricePerWeek: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" placeholder="e.g. 450" />
              </div>
            )}
            
            <h3 className="font-semibold text-lg mt-6">Structured Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Property Type</label>
                <select value={editPropForm.propertyType} onChange={e => setEditPropForm({...editPropForm, propertyType: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="">Select Property Type</option>
                  <option value="HOUSE">House</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="STUDIO">Studio</option>
                  <option value="UNIT">Unit</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Offering Type</label>
                <select value={editPropForm.offeringType} onChange={e => setEditPropForm({...editPropForm, offeringType: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="">Select Offering Type</option>
                  <option value="ENTIRE_PLACE">Entire Place</option>
                  <option value="ROOM_IN_SHARED_SPACE">Room in Shared Space</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Furnishing</label>
                <select value={editPropForm.furnishingType} onChange={e => setEditPropForm({...editPropForm, furnishingType: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="">Select Furnishing</option>
                  <option value="FULLY_FURNISHED">Fully Furnished</option>
                  <option value="UNFURNISHED">Unfurnished</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Available From</label>
                <input type="date" value={editPropForm.availableFrom} onChange={e => setEditPropForm({...editPropForm, availableFrom: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Minimum Stay (months)</label>
                <input type="number" min="1" value={editPropForm.minimumStay} onChange={e => setEditPropForm({...editPropForm, minimumStay: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Maximum Stay (months)</label>
                <input type="number" min="1" value={editPropForm.maximumStay} onChange={e => setEditPropForm({...editPropForm, maximumStay: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Bedrooms</label><input type="number" min="0" value={editPropForm.bedrooms} onChange={e => setEditPropForm({...editPropForm, bedrooms: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Bathrooms</label><input type="number" min="0" value={editPropForm.bathrooms} onChange={e => setEditPropForm({...editPropForm, bathrooms: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Parking</label><input type="number" min="0" value={editPropForm.parkingSpaces} onChange={e => setEditPropForm({...editPropForm, parkingSpaces: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" /></div>
              {property.listingType === 'CO_LIVING' && (
                <div className="col-span-3">
                  <label className="block text-sm text-gray-700 mb-1">Maximum Occupancy (Required)</label>
                  <input type="number" min="1" value={editPropForm.maximumOccupancy} onChange={e => setEditPropForm({...editPropForm, maximumOccupancy: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={editPropForm.showContactDetails} 
                  onChange={(e) => setEditPropForm({...editPropForm, showContactDetails: e.target.checked})} 
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-orange" 
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">Show my contact details on this property</span>
                  <span className="text-sm text-gray-500">
                    If checked, your approved public contact phone and email will be visible to seekers.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-4 justify-end">
              <button disabled={isSubmitting} type="button" onClick={() => setIsEditingProp(false)} className="px-4 py-2 text-gray-600 hover:text-brand-navy disabled:opacity-50">Cancel</button>
              <button disabled={isSubmitting} type="submit" className="bg-brand-orange text-white px-4 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-8">
          {/* Images Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-medium mb-4">Images</h2>
            <div className="flex flex-wrap gap-4 mb-4">
              {property.media.map((m: any) => (
                <div key={m.id} className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <SafeImage src={m.url} alt="Property" fill className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
            {!isPending && (
              <div>
                <label className="bg-brand-orange/10 text-brand-orange px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-100 transition inline-block">
                  <span>+ Upload Image</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isPending} />
                </label>
                <p className="text-xs text-gray-400 mt-2">Note: S3 storage must be configured to upload real images.</p>
              </div>
            )}
          </section>

          {/* Amenities Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">Amenities</h2>
              {!isPending && !isEditingAmenities && (
                <button onClick={() => setIsEditingAmenities(true)} className="text-sm text-brand-orange hover:underline">Edit Amenities</button>
              )}
            </div>

            {isEditingAmenities ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {allAmenities.map(am => (
                    <label key={am.id} className="flex items-center gap-2 text-sm border p-2 rounded cursor-pointer hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(am.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAmenities([...selectedAmenities, am.id]);
                          else setSelectedAmenities(selectedAmenities.filter(id => id !== am.id));
                        }}
                      />
                      {am.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 justify-end">
                  <button disabled={isSubmitting} onClick={() => {
                    setSelectedAmenities(property.amenities?.map((a: any) => a.amenityId) || []);
                    setIsEditingAmenities(false);
                  }} className="text-sm text-gray-600 disabled:opacity-50">Cancel</button>
                  <button disabled={isSubmitting} onClick={handleUpdateAmenities} className="text-sm bg-brand-orange text-white px-4 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {property.amenities?.length > 0 ? (
                  property.amenities.map((pa: any) => (
                    <span key={pa.amenityId} className="bg-brand-orange/10 text-brand-orange px-3 py-1 rounded-full text-sm">
                      {pa.amenity.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No amenities selected.</p>
                )}
              </div>
            )}
          </section>

          {/* Resident Manager Section */}
          {property.listingType === 'CO_LIVING' && (
            <>
              <ResidentManager propertyId={property.id} initialResidents={property.residents || []} onAuthError={onAuthError} onUpdate={fetchProperty} />
              <HouseRulesManager propertyId={property.id} initialHouseRule={property.houseRule} onAuthError={onAuthError} onUpdate={fetchProperty} />
            </>
          )}

          {/* Hierarchy Section */}
          {property.listingMode === 'MULTI_UNIT' && (
            <HierarchyManager property={property} fetchProperty={fetchProperty} isPending={isPending} />
          )}

        </div>
      </div>
    </>
  );
}
