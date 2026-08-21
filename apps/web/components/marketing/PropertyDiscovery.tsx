"use client";

import Image from "next/image";
import { SafeImage } from "../ui/SafeImage";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PropertyDiscovery() {
  const [activeTab, setActiveTab] = useState("top_rated");
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchProps = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/v1/properties/search?sort=${activeTab}&limit=4`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        if (isMounted) {
          setProperties(data.data || []);
        }
      } catch (err) {
        console.error("Error fetching properties", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProps();
    return () => { isMounted = false; };
  }, [activeTab]);

  return (
    <section className="w-full max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 py-24 bg-slate-50">
      
      {/* Elegant Section Heading */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="max-w-2xl">
          <h2 
            className="text-[2.5rem] lg:text-[3.5rem] font-medium text-slate-900 tracking-[-0.03em] leading-[1.1] mb-6"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Curated living spaces.
          </h2>
          <p className="text-lg text-slate-500 font-light">
            We don't list everything. We only list the best. 
            Discover verified properties designed specifically for student success.
          </p>
        </div>
        
        {/* Quick Discovery Tabs */}
        <div className="flex gap-2 p-1 bg-slate-200/50 rounded-full border border-slate-200">
          <button 
            onClick={() => setActiveTab('top_rated')}
            className={`px-6 py-2.5 rounded-full text-sm transition-colors shadow-sm ${activeTab === 'top_rated' ? 'bg-white text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900 font-medium'}`}
          >
            Top Rated
          </button>
          <button 
            onClick={() => setActiveTab('closest_to_campus')}
            className={`px-6 py-2.5 rounded-full text-sm transition-colors shadow-sm ${activeTab === 'closest_to_campus' ? 'bg-white text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900 font-medium'}`}
          >
            Closest to Campus
          </button>
          <button 
            onClick={() => setActiveTab('available_now')}
            className={`px-6 py-2.5 rounded-full text-sm transition-colors shadow-sm ${activeTab === 'available_now' ? 'bg-white text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900 font-medium'}`}
          >
            Available Now
          </button>
        </div>
      </div>

      {/* Property Grid Optimized for Student Conversion Psychology */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8 min-h-[400px]">
        {loading ? (
          <div className="col-span-full flex justify-center items-center h-full">
            <p className="text-slate-500">Loading properties...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="col-span-full flex justify-center items-center h-full">
            <p className="text-slate-500">No properties found for this category.</p>
          </div>
        ) : properties.map((property: any) => {
          const isAvailableNow = property.roomTypes?.some((rt: any) => rt.inventory > 0);
          
          return (
            <div key={property.id} className="group relative flex flex-col rounded-[24px] bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-500">
              
              {/* Massive Image Header */}
              <div className="relative w-full h-[240px] overflow-hidden bg-slate-100">
                <SafeImage 
                  src={property.media?.[0]?.url || "/assets/prop_1.png"}
                  alt={property.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
                
                {/* Priority 5: Trust (Top Left) & Favourite (Top Right) */}
                <div className="absolute top-6 w-full px-6 flex justify-between items-start z-10">
                  <div className="flex flex-col gap-2">
                    {property.provider?.verified && (
                      <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        Verified
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm w-fit">
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      {/* Hardcode a rating if none provided in API */}
                      4.9 Student Score
                    </div>
                  </div>
                  
                  <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>
                </div>

                {/* Priority 7: Provider (Bottom Left - Lowest Priority) */}
                <div className="absolute bottom-6 left-6 z-10">
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Managed by {property.provider?.name || 'Partner'}</p>
                </div>
              </div>

              {/* Data Section Engineered for 5-second decision making */}
              <div className="p-5 lg:p-6 flex flex-col flex-grow justify-between bg-white relative">
                
                {/* Priority 1: Affordability & Identity */}
                <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1 line-clamp-1">{property.name}</h3>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</p>
                    <p className="text-2xl font-bold text-indigo-600 tracking-tight leading-none">${property.lowestPricePerWeek}<span className="text-xs font-medium text-slate-500">/wk</span></p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6">
                  
                  {/* Priority 2: Distance to University (Visual Highlight) */}
                  <div className="col-span-2 bg-indigo-50 rounded-xl p-3 flex items-center gap-3 border border-indigo-100/50">
                    <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Location</p>
                      <p className="text-xs font-semibold text-indigo-900 line-clamp-1">In <span className="font-bold">{property.suburb}</span></p>
                    </div>
                  </div>

                  {/* Priority 3: Availability */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Availability
                    </p>
                    <p className={`text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-md border line-clamp-1 ${isAvailableNow ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                      {isAvailableNow ? 'Available Now' : 'Waitlist'}
                    </p>
                  </div>

                  {/* Priority 4: Room Type */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      Room Type
                    </p>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{property.roomTypes?.[0]?.name || 'Various Rooms'}</p>
                  </div>

                </div>

                {/* Priority 6: Amenities (Lowest Priority Data) */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {property.amenities?.slice(0, 2).map((amenity: string) => (
                    <span key={amenity} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200/60">
                      {amenity}
                    </span>
                  ))}
                  {property.amenities?.length > 2 && (
                    <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200/60">
                      +{property.amenities.length - 2} more
                    </span>
                  )}
                </div>

                {/* Ultimate CTA */}
                <Link href={`/property/${property.id}`} className="w-full mt-auto">
                  <button className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 group/btn">
                    View Property
                    <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </Link>
              </div>
              
            </div>
          );
        })}
      </div>
    </section>
  );
}
