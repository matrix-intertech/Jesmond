"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HeroSearchBar() {
  const router = useRouter();
  // State mapped to the existing query parameters expected by Jesmond search
  const [city, setCity] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [roomType, setRoomType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (city && city !== "Any") params.append("city", city);
    if (moveIn) params.append("moveIn", moveIn);
    if (roomType && roomType !== "Any") params.append("roomType", roomType);
    if (maxPrice && maxPrice !== "Any") params.append("maxPrice", maxPrice);

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex flex-col md:flex-row items-center gap-4">
      
      {/* Search Input Container */}

      {/* Inputs Row */}
      <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
        
        {/* Property Type */}
        <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors">
          <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Property Type</label>
          <select 
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="w-full bg-transparent text-brand-navy outline-none text-sm font-medium cursor-pointer appearance-none"
          >
            <option value="">Any</option>
            <option value="Studio">Studio</option>
            <option value="Ensuite">Ensuite</option>
            <option value="Shared">Shared</option>
          </select>
          <div className="absolute right-3 top-1/2 mt-1 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        {/* Suburb (City) */}
        <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors">
          <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Suburb</label>
          <input 
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Any"
            className="w-full bg-transparent text-brand-navy placeholder-slate-400 outline-none text-sm font-medium"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <div className="absolute right-3 top-1/2 mt-1 pointer-events-none text-slate-400 hidden lg:block">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        {/* Move In */}
        <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors">
          <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Move In</label>
          <input 
            type="date"
            value={moveIn}
            onChange={(e) => setMoveIn(e.target.value)}
            className="w-full bg-transparent text-brand-navy placeholder-slate-400 outline-none text-sm font-medium cursor-pointer"
          />
        </div>

        {/* Max Price */}
        <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors">
          <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Max Price</label>
          <select 
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full bg-transparent text-brand-navy outline-none text-sm font-medium cursor-pointer appearance-none"
          >
            <option value="">Any</option>
            <option value="250">$250/wk</option>
            <option value="450">$450/wk</option>
            <option value="650">$650/wk</option>
          </select>
          <div className="absolute right-3 top-1/2 mt-1 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <button
        onClick={handleSearch}
        className="w-full md:w-auto bg-brand-orange hover:bg-orange-600 text-white rounded-lg px-8 py-4 flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95 shadow-md"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="font-semibold text-sm">Search Properties</span>
      </button>

    </div>
  );
}
