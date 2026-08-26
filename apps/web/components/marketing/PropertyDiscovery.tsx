"use client";

import Image from "next/image";
import { SafeImage } from "../ui/SafeImage";
import Link from "next/link";
import { useEffect, useState, useRef, useMemo } from "react";
import PropertyMap from "../ui/PropertyMap";
import { type PropertyMarkerData } from "../ui/PropertyMapInner";

export function PropertyDiscovery() {
  const [activeTab, setActiveTab] = useState("top_rated");
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showMapMobile, setShowMapMobile] = useState(false);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | undefined>();
  const [mapBounds, setMapBounds] = useState<{ swLat: number; swLng: number; neLat: number; neLng: number } | null>(null);
  const [appliedBounds, setAppliedBounds] = useState<{ swLat: number; swLng: number; neLat: number; neLng: number } | null>(null);
  const [mapDirty, setMapDirty] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchProps = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = `${apiUrl}/api/v1/properties/search?sort=${activeTab}&limit=12`;
        if (appliedBounds) {
           url += `&bounds=${appliedBounds.swLat},${appliedBounds.swLng},${appliedBounds.neLat},${appliedBounds.neLng}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        if (isMounted) {
          setProperties(data.data || []);
          setMapDirty(false); // Reset map dirty state after fetching new bounds
        }
      } catch (err) {
        console.error("Error fetching properties", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProps();
    return () => { isMounted = false; };
  }, [activeTab, appliedBounds]);

  const handleBoundsChange = (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => {
    setMapBounds(bounds);
    setMapDirty(true);
  };

  const handleSearchThisArea = () => {
    if (mapBounds) {
      setAppliedBounds(mapBounds);
    }
  };

  const handleMarkerClick = (propertyId: string) => {
    setHoveredPropertyId(propertyId);

    // On mobile, switch back to list view to show the selected property
    if (window.innerWidth < 1024) {
      setShowMapMobile(false);
    }

    // Scroll the property card into view
    const cardElement = document.getElementById(`property-card-${propertyId}`);
    if (cardElement) {
       cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const mapData = useMemo(() => properties.map((p: any) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    lowestPricePerWeek: p.lowestPricePerWeek,
    suburb: p.suburb,
    thumbnailUrl: p.media?.[0]?.url
  })), [properties]);

  return (
    <section className="w-full h-[calc(100vh-80px)] mt-20 flex flex-col bg-surface-muted relative">

      {/* Mobile Map Toggle */}
      <div className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setShowMapMobile(!showMapMobile)}
          className="bg-brand-navy text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-brand-navy/20 flex items-center gap-2"
        >
          {showMapMobile ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Show List
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              Show Map
            </>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Left List Pane */}
        <div className={`w-full lg:w-[60%] flex-col overflow-y-auto ${showMapMobile ? 'hidden' : 'flex'}`}>
          <div className="px-6 sm:px-12 py-8 lg:py-12">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
              <div className="max-w-xl">
                <h2
                  className="text-3xl lg:text-4xl font-medium text-brand-navy tracking-[-0.02em] leading-tight mb-4"
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  Curated living spaces.
                </h2>
                <p className="text-base text-slate-500 font-light">
                  We don't list everything. We only list the best.
                  Discover verified properties designed specifically for student success.
                </p>
              </div>

              {/* Quick Discovery Tabs */}
              <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-full border border-slate-200 w-fit shrink-0">
                <button
                  onClick={() => { setActiveTab('top_rated'); setAppliedBounds(null); }}
                  className={`px-4 py-2 rounded-full text-xs transition-colors shadow-sm ${activeTab === 'top_rated' ? 'bg-white text-brand-navy font-semibold' : 'text-slate-500 hover:text-brand-navy font-medium'}`}
                >
                  Top Rated
                </button>
                <button
                  onClick={() => { setActiveTab('closest_to_campus'); setAppliedBounds(null); }}
                  className={`px-4 py-2 rounded-full text-xs transition-colors shadow-sm ${activeTab === 'closest_to_campus' ? 'bg-white text-brand-navy font-semibold' : 'text-slate-500 hover:text-brand-navy font-medium'}`}
                >
                  Closest to Campus
                </button>
                <button
                  onClick={() => { setActiveTab('available_now'); setAppliedBounds(null); }}
                  className={`px-4 py-2 rounded-full text-xs transition-colors shadow-sm ${activeTab === 'available_now' ? 'bg-white text-brand-navy font-semibold' : 'text-slate-500 hover:text-brand-navy font-medium'}`}
                >
                  Available Now
                </button>
              </div>
            </div>

            {/* Property Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24 lg:pb-8">
              {loading ? (
                <div className="col-span-full flex justify-center items-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-slate-500 font-medium">Loading properties...</p>
                  </div>
                </div>
              ) : properties.length === 0 ? (
                <div className="col-span-full flex justify-center items-center py-20 bg-white rounded-2xl border border-slate-200">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    <h3 className="text-lg font-medium text-brand-navy mb-1">No properties found</h3>
                    <p className="text-slate-500 text-sm">Try adjusting your map area or filters.</p>
                  </div>
                </div>
              ) : properties.map((property: any) => {
                const isAvailableNow = property.roomTypes?.some((rt: any) => rt.inventory > 0);
                const isHovered = hoveredPropertyId === property.id;

                return (
                  <div
                    key={property.id}
                    id={`property-card-${property.id}`}
                    onMouseEnter={() => setHoveredPropertyId(property.id)}
                    onMouseLeave={() => setHoveredPropertyId(undefined)}
                    className={`group relative flex flex-col rounded-[20px] bg-white border ${isHovered ? 'border-brand-navy shadow-xl' : 'border-slate-100 shadow-sm'} overflow-hidden hover:shadow-xl transition-all duration-300`}
                  >

                    <div className="relative w-full h-48 overflow-hidden bg-slate-100">
                      <SafeImage
                        src={property.media?.[0]?.url || "/assets/prop_1.png"}
                        alt={property.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        sizes="(max-width: 768px) 100vw, 30vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

                      <div className="absolute top-4 w-full px-4 flex justify-between items-start z-10">
                        <div className="flex flex-col gap-1.5">
                          {property.provider?.verified && (
                            <div className="flex items-center gap-1 bg-emerald-500/90 backdrop-blur-md text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              Verified
                            </div>
                          )}
                          <div className="flex items-center gap-1 bg-brand-navy/80 backdrop-blur-md text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm w-fit">
                            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            4.9
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-grow justify-between bg-white relative">
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-xl font-bold text-brand-navy tracking-tight mb-1 line-clamp-1">{property.name}</h3>
                          <p className="text-xs text-slate-500">{property.suburb}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">From</p>
                          <p className="text-xl font-bold text-brand-orange tracking-tight leading-none">${property.lowestPricePerWeek}<span className="text-[12px] font-medium text-slate-500">/wk</span></p>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-4 text-xs font-medium text-slate-600">
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${isAvailableNow ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                           {isAvailableNow ? 'Available' : 'Waitlist'}
                         </span>
                         <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-muted border border-slate-100">
                           {property.roomTypes?.[0]?.name || 'Various'}
                         </span>
                      </div>

                      <Link href={`/property/${property.id}`} className="w-full mt-auto">
                        <button className="w-full py-3 bg-white hover:bg-surface-muted text-brand-navy border border-slate-200 rounded-xl text-sm font-bold transition-colors">
                          View details
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Map Pane */}
        <div className={`w-full lg:w-[40%] bg-slate-200 relative border-l border-slate-200 ${!showMapMobile ? 'hidden lg:block' : 'block'}`}>
          <PropertyMap
            properties={mapData}
            selectedPropertyId={hoveredPropertyId}
            onBoundsChange={handleBoundsChange}
            onMarkerClick={handleMarkerClick}
            interactive={true}
          />

          {mapDirty && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400]">
               <button
                  onClick={handleSearchThisArea}
                  className="bg-white text-brand-navy px-5 py-2.5 rounded-full text-sm font-bold shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100 hover:scale-105 transition-transform flex items-center gap-2"
               >
                 <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 Search this area
               </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
