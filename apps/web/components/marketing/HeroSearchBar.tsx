"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationAutocomplete, LocationResult } from "../location/LocationAutocomplete";

export function HeroSearchBar() {
  const router = useRouter();
  // State mapped to the existing query parameters expected by Jesmond search
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>("10");
  const [moveIn, setMoveIn] = useState("");
  const [roomType, setRoomType] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (location) {
      params.append("latitude", location.latitude.toString());
      params.append("longitude", location.longitude.toString());
      params.append("radiusKm", radiusKm);
      params.append("locationLabel", location.label);
      params.append("sortBy", "distance");
      params.append("sortOrder", "asc");
    }

    if (moveIn) params.append("moveIn", moveIn);
    if (roomType && roomType !== "Any") params.append("roomType", roomType);

    if (priceRange) {
      if (priceRange === "under200") {
        params.append("maxPrice", "200");
      } else if (priceRange === "200-300") {
        params.append("minPrice", "200");
        params.append("maxPrice", "300");
      } else if (priceRange === "300-400") {
        params.append("minPrice", "300");
        params.append("maxPrice", "400");
      } else if (priceRange === "400-500") {
        params.append("minPrice", "400");
        params.append("maxPrice", "500");
      } else if (priceRange === "over500") {
        params.append("minPrice", "500");
      }
    }

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex flex-col gap-4">

      {/* Location Row (Primary) */}
      <div className="w-full flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
            placeholder="Search suburb, address or postcode"
          />
        </div>

        {/* Distance Filter (Only enabled when location selected) */}
        <div className="w-full md:w-48 relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors bg-white">
          <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Distance</label>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            disabled={!location}
            className="w-full bg-transparent text-brand-navy outline-none text-sm font-medium cursor-pointer appearance-none disabled:opacity-50"
          >
            <option value="1">Within 1 km</option>
            <option value="2">Within 2 km</option>
            <option value="5">Within 5 km</option>
            <option value="10">Within 10 km</option>
            <option value="20">Within 20 km</option>
            <option value="50">Within 50 km</option>
          </select>
          <div className="absolute right-3 top-1/2 mt-1 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Secondary Filters Row */}
      <div className="w-full flex flex-col md:flex-row items-center gap-3">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {/* Property Type */}
          <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors bg-white">
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

          {/* Move In */}
          <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors bg-white">
            <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Move In</label>
            <input
              type="date"
              value={moveIn}
              onChange={(e) => setMoveIn(e.target.value)}
              className="w-full bg-transparent text-brand-navy placeholder-slate-400 outline-none text-sm font-medium cursor-pointer"
            />
          </div>

          {/* Price Range */}
          <div className="relative border border-slate-200 rounded-lg p-2.5 focus-within:border-brand-navy transition-colors bg-white">
            <label className="block text-[10px] font-bold text-slate-800 mb-0.5">Price Range</label>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full bg-transparent text-brand-navy outline-none text-sm font-medium cursor-pointer appearance-none"
            >
              <option value="">Any</option>
              <option value="under200">Under $200/wk</option>
              <option value="200-300">$200 - $300/wk</option>
              <option value="300-400">$300 - $400/wk</option>
              <option value="400-500">$400 - $500/wk</option>
              <option value="over500">$500+/wk</option>
            </select>
            <div className="absolute right-3 top-1/2 mt-1 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className="w-full md:w-auto h-[62px] bg-brand-orange hover:bg-orange-600 text-white rounded-lg px-8 flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95 shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-semibold text-sm">Search Properties</span>
        </button>
      </div>

    </div>
  );
}
