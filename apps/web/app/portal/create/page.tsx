'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import LocationPicker from '@/components/ui/LocationPicker';
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
  const [isIndividualProperty, setIsIndividualProperty] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    suburbId: '',
    postcode: '',
    lat: '',
    lng: '',
    description: '',
  });

  useEffect(() => {
    let isMounted = true;
    setStatesLoading(true);
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/v1/locations/states`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (isMounted) setStates(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (isMounted) setError('Failed to load states. Ensure API is running.');
      })
      .finally(() => {
        if (isMounted) setStatesLoading(false);
      });
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
      const data = await res.json();
      setCities(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load cities:', err);
      setError('Failed to load cities for the selected state.');
    } finally {
      setCitiesLoading(false);
    }
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
      const data = await res.json();
      setSuburbs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load suburbs:', err);
      setError('Failed to load suburbs for the selected city.');
    } finally {
      setSuburbsLoading(false);
    }
  };

  const handleSuburbChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const suburbId = e.target.value;
    const selectedSuburb = suburbs.find(s => s.id === suburbId);

    setFormData(prev => {
      const next = { ...prev, suburbId };
      if (selectedSuburb) {
        if (selectedSuburb.postcode) {
          next.postcode = selectedSuburb.postcode;
        }
        if (selectedSuburb.lat && selectedSuburb.lng && !isManualLocation) {
          next.lat = String(selectedSuburb.lat);
          next.lng = String(selectedSuburb.lng);
        }
      }
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setIsManualLocation(true);
    setFormData(prev => ({
      ...prev,
      lat: String(lat),
      lng: String(lng)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.lat || !formData.lng) {
      setError('Please select the accommodation location on the map.');
      setLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) { onAuthError(); return; }
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          listingMode: isIndividualProperty ? 'INDIVIDUAL' : 'MULTI_UNIT',
        })
      });
      const status = await handleApiError(res, onAuthError);
      if (status !== 'ok') {
        const errData = await res.json();
        throw new Error(Array.isArray(errData.message) ? errData.message.join(', ') : errData.message || 'Failed to create property');
      }
      // Success
      setSuccess(true);
      setTimeout(() => { router.push('/portal'); }, 2000);
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
          <h2 className="text-2xl font-bold text-green-600 mb-2">Accommodation Created Successfully</h2>
          <p className="text-gray-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Create Accommodation" onBack={() => router.push('/portal')} />
      <div className="max-w-[800px] mx-auto py-12">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm">{error}</div>}

          <div className="flex items-start space-x-3 bg-surface-muted p-4 rounded-lg border border-gray-200">
            <div className="flex items-center h-5">
              <input
                id="isIndividualProperty"
                name="isIndividualProperty"
                type="checkbox"
                checked={isIndividualProperty}
                onChange={(e) => setIsIndividualProperty(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-indigo-600"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="isIndividualProperty" className="text-sm font-medium text-brand-navy">
                Add Individual Property
              </label>
              <p className="text-sm text-gray-500">
                Use this for a single house, apartment, unit, or independently managed property.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="e.g., Unilodge Melbourne" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input required type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="123 Example Street" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                required
                name="stateId"
                value={selectedStateId}
                onChange={handleStateChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
              >
                <option value="">{statesLoading ? 'Loading states...' : 'Select State'}</option>
                {states.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                required
                name="cityId"
                value={selectedCityId}
                onChange={handleCityChange}
                disabled={!selectedStateId || citiesLoading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed bg-white"
              >
                <option value="">
                  {citiesLoading
                    ? 'Loading cities...'
                    : !selectedStateId
                    ? 'Select a State first'
                    : cities.length === 0
                    ? 'No cities found'
                    : 'Select City'}
                </option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
              <select
                required
                name="suburbId"
                value={formData.suburbId}
                onChange={handleSuburbChange}
                disabled={!selectedCityId || suburbsLoading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed bg-white"
              >
                <option value="">
                  {suburbsLoading
                    ? 'Loading suburbs...'
                    : !selectedCityId
                    ? 'Select a City first'
                    : suburbs.length === 0
                    ? 'No suburbs found'
                    : 'Select Suburb'}
                </option>
                {suburbs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
            <input
              required
              type="text"
              name="postcode"
              value={formData.postcode}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g. 3000"
            />
          </div>

          <LocationPicker
            lat={formData.lat}
            lng={formData.lng}
            onChange={handleLocationChange}
            suburbLat={suburbs.find(s => s.id === formData.suburbId)?.lat}
            suburbLng={suburbs.find(s => s.id === formData.suburbId)?.lng}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Describe the accommodation..."></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-orange text-white px-6 py-2 rounded-md hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
