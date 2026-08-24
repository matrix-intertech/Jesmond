"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export function HeroSearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const [city, setCity] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [roomType, setRoomType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleSearch = () => {
    if (!city.trim()) {
      alert("Please enter a location to search.");
      return;
    }

    const params = new URLSearchParams();
    if (city) params.append("city", city);
    if (moveIn) params.append("moveIn", moveIn);
    if (roomType) params.append("roomType", roomType);
    if (maxPrice) params.append("maxPrice", maxPrice);

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="relative w-full z-50">

      {/* Mobile Unified Search Button (Hidden on md+) */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-white rounded-full shadow-lg border border-slate-200 p-4 flex items-center justify-between text-slate-600"
        >
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-semibold text-slate-900">Where to?</span>
            <span className="text-xs text-slate-500">Anywhere • Any week • Add guests</span>
          </div>
          <div className="bg-indigo-600 text-white rounded-full p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </button>
      </div>

      {/* Desktop Search Pill (Hidden on mobile) */}
      <div className="hidden md:block relative">
        <div
          onClick={() => setIsOpen(true)}
          className="w-full max-w-[640px] bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/60 p-2 flex items-center cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-shadow"
        >
          <div className="flex-1 px-6 py-2 hover:bg-slate-50 rounded-full transition-colors">
            <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Where</label>
            <p className="text-sm text-slate-900 truncate font-medium">{city || 'Search university or city'}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex-1 px-6 py-2 hover:bg-slate-50 rounded-full transition-colors">
            <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Move In</label>
            <p className="text-sm text-slate-900 truncate font-medium">{moveIn || 'Add dates'}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex-1 px-6 py-2 hover:bg-slate-50 rounded-full transition-colors">
            <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Room</label>
            <p className="text-sm text-slate-900 truncate font-medium">{roomType || 'Any type'}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 flex-shrink-0 ml-2 transition-colors z-10 relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Absolute Expanded Modal Overlay (Z-Axis Expansion) */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Invisible Backdrop to close modal */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />

              <motion.div
                layoutId="search-bar"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-0 left-0 w-full min-w-[800px] z-50 bg-white rounded-[24px] shadow-2xl border border-slate-200 p-4"
              >
                <div className="flex items-center w-full">
                  <div className="flex-1 px-6 py-3 bg-white hover:bg-slate-50 rounded-full cursor-text transition-colors shadow-[0_0_0_2px_white,0_0_0_4px_#e2e8f0] focus-within:shadow-[0_0_0_2px_white,0_0_0_4px_#4f46e5]">
                    <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Where</label>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search university or city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-white text-slate-900 placeholder-slate-400 outline-none text-sm font-medium"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <div className="flex-1 px-4 py-3 bg-white hover:bg-slate-50 rounded-full transition-colors ml-2 border border-transparent focus-within:border-indigo-500">
                    <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Move In</label>
                    <input
                      type="date"
                      value={moveIn}
                      onChange={(e) => setMoveIn(e.target.value)}
                      className="w-full bg-white text-slate-900 placeholder-slate-400 outline-none text-sm font-medium cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 px-4 py-3 bg-white hover:bg-slate-50 rounded-full transition-colors border border-transparent focus-within:border-indigo-500">
                    <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Room</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="w-full bg-white text-slate-900 placeholder-slate-400 outline-none text-sm font-medium cursor-pointer"
                    >
                      <option value="">Any type</option>
                      <option value="Studio">Studio</option>
                      <option value="Ensuite">Ensuite</option>
                      <option value="Shared">Shared</option>
                    </select>
                  </div>
                  <div className="flex-1 px-4 py-3 bg-white hover:bg-slate-50 rounded-full transition-colors border border-transparent focus-within:border-indigo-500">
                    <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-0.5">Budget</label>
                    <select
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-white text-slate-900 placeholder-slate-400 outline-none text-sm font-medium cursor-pointer"
                    >
                      <option value="">Any price</option>
                      <option value="250">Under $250/wk</option>
                      <option value="450">Under $450/wk</option>
                      <option value="650">Under $650/wk</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSearch}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-full px-8 py-4 flex items-center gap-2 flex-shrink-0 ml-4 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="font-semibold text-sm">Search</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
