"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { SaveButton } from "../student/SaveButton";

// Dynamically import Leaflet map to avoid window is not defined SSR error
const MapExperience = dynamic(() => import('./MapExperience').then(m => m.MapExperience), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 font-medium">Loading Map Engine...</div>
});

export function SearchClient({ initialParams }: { initialParams: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  
  // API State
  const [properties, setProperties] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Utility to update URL state seamlessly
  const updateSearchState = (updates: Record<string, string | null>) => {
    const current = new URLSearchParams(window.location.search);
    let changed = false;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        if (current.has(key)) {
          current.delete(key);
          changed = true;
        }
      } else {
        if (current.get(key) !== value) {
          current.set(key, value);
          changed = true;
        }
      }
    });

    // If changing filters (not just pagination), reset to page 1
    if (changed && !updates.page && current.has('page')) {
      current.delete('page');
    }

    if (changed) {
      router.push(`${pathname}?${current.toString()}`, { scroll: false });
    }
  };

  // Fetch properties whenever initialParams change
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchProperties = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Construct query string
        const searchParams = new URLSearchParams();
        Object.entries(initialParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
          }
        });
        
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/v1/properties/search?${searchParams.toString()}`, {
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch properties');
        }
        
        const json = await response.json();
        setProperties(json.data || []);
        setMeta(json.meta || { total: 0, page: 1, limit: 20, totalPages: 1 });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'An error occurred while fetching properties');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProperties();
    
    return () => {
      controller.abort();
    };
  }, [initialParams]);

  return (
    <div className="flex flex-1 h-[calc(100vh-80px)] overflow-hidden relative">
      
      {/* LEFT: Scrollable Results */}
      <div className="w-full lg:w-[60%] xl:w-[50%] h-full overflow-y-auto bg-slate-50 flex flex-col custom-scrollbar relative">
        
        {/* Results Header */}
        <div className="px-6 sm:px-10 pt-8 pb-4 sticky top-0 bg-slate-50/90 backdrop-blur-md z-10">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
            {!isLoading && `${meta.total} verified student homes`}
            {isLoading && `Searching properties...`}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {initialParams.city ? `Student Accommodation in ${initialParams.city}` : 'Discover Student Living'}
          </h1>
          
          {/* Quick Filters - interacting with URL State */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 hide-scrollbar">
            <button onClick={() => updateSearchState({ maxPrice: '450' })} className={`px-4 py-2 border rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${initialParams.maxPrice === '450' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}>Under $450/wk</button>
            <button onClick={() => updateSearchState({ roomType: 'Studio' })} className={`px-4 py-2 border rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${initialParams.roomType === 'Studio' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}>Studio</button>
            <button onClick={() => updateSearchState({ maxPrice: null, roomType: null, city: null, page: null })} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-semibold text-slate-700 whitespace-nowrap hover:border-slate-400 transition-colors">Clear</button>
          </div>
        </div>

        {/* State Handling: Loading */}
        {isLoading && (
          <div className="px-6 sm:px-10 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col sm:flex-row bg-white border border-slate-200 rounded-[24px] overflow-hidden animate-pulse h-[320px] sm:h-[240px]">
                <div className="w-full sm:w-[300px] h-[200px] sm:h-full bg-slate-200 shrink-0"></div>
                <div className="p-6 flex flex-col justify-between flex-grow w-full">
                  <div>
                    <div className="w-3/4 h-6 bg-slate-200 rounded mb-2"></div>
                    <div className="w-1/2 h-4 bg-slate-200 rounded"></div>
                  </div>
                  <div className="mt-4 flex justify-between items-end">
                    <div className="w-24 h-8 bg-slate-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State Handling: Error */}
        {!isLoading && error && (
          <div className="p-10 m-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h3 className="text-lg font-bold text-red-900 mb-2">Failed to load properties</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button onClick={() => updateSearchState({})} className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition-colors">Retry</button>
          </div>
        )}

        {/* State Handling: Empty */}
        {!isLoading && !error && properties.length === 0 && (
          <div className="p-10 m-6 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center h-[400px]">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No properties found</h3>
            <p className="text-slate-500 mb-6 max-w-md">We couldn't find any student homes matching your current filters. Try adjusting your search criteria.</p>
            <button onClick={() => updateSearchState({ maxPrice: null, roomType: null, city: null, page: null })} className="px-6 py-2 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors">Clear all filters</button>
          </div>
        )}

        {/* Property Grid */}
        {!isLoading && !error && properties.length > 0 && (
          <div className="px-6 sm:px-10 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
            {properties.map((prop) => {
              const image = (prop.media && prop.media.length > 0 && !prop.media[0].url.includes('/properties/')) ? prop.media[0].url : '/assets/prop_1.png';
              const location = `${prop.suburb}, ${prop.city}`;
              const verified = prop.provider?.verified;

              return (
                <div 
                  key={prop.id}
                  onClick={() => router.push(`/property/${prop.id}`)}
                  onMouseEnter={() => setHoveredPropertyId(prop.id)}
                  onMouseLeave={() => setHoveredPropertyId(null)}
                  className="flex flex-col sm:flex-row gap-6 bg-white rounded-[24px] overflow-hidden border border-slate-200 hover:border-indigo-600 transition group relative cursor-pointer"
                >
                  <div className="absolute top-4 right-4 z-20">
                    <SaveButton propertyId={prop.id} />
                  </div>
                  <div className="relative w-full sm:w-[300px] h-[240px] sm:h-auto shrink-0 bg-slate-100">
                    <Image src={image} alt={prop.name} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
                    {verified && (
                      <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm">
                        Verified
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col justify-between flex-grow">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{prop.name}</h3>
                      <p className="text-sm font-medium text-slate-500 mb-4">{location}</p>
                    </div>
                    <div className="mt-4 flex justify-between items-end">
                      <p className="text-2xl font-bold text-slate-900 tracking-tight">${prop.lowestPricePerWeek}<span className="text-sm font-medium text-slate-500">/wk</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && !error && meta.totalPages > 1 && (
          <div className="px-6 sm:px-10 pb-10 pt-4 flex items-center justify-between border-t border-slate-200 mt-auto">
            <button 
              disabled={meta.page <= 1}
              onClick={() => updateSearchState({ page: String(meta.page - 1) })}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-500">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button 
              disabled={meta.page >= meta.totalPages}
              onClick={() => updateSearchState({ page: String(meta.page + 1) })}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Interactive Map */}
      <div className="hidden lg:block lg:w-[40%] xl:w-[50%] h-full relative border-l border-slate-300">
        <MapExperience 
          properties={properties} 
          hoveredPropertyId={hoveredPropertyId} 
          onMarkerHover={setHoveredPropertyId} 
        />
      </div>

    </div>
  );
}
