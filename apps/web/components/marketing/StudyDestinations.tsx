"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const DESTINATIONS = [
  {
    slug: "melbourne",
    city: "Melbourne",
    state: "VIC",
    studentPop: "350k+",
    uniCount: 8,
    verifiedProps: "4,200+",
    avgRent: "$380/wk",
    avgWalk: "10 min",
    lifestyle: ["City Life", "Coffee Culture", "Nightlife", "Arts"],
    image: "/assets/city_melbourne.png",
    universities: [
      { name: "University of Melbourne", slug: "unimelb", props: "1,200+", rent: "$420/wk", walk: "5 min" },
      { name: "Monash University", slug: "monash", props: "950+", rent: "$350/wk", walk: "15 min" },
      { name: "RMIT University", slug: "rmit", props: "1,800+", rent: "$390/wk", walk: "2 min" },
    ]
  },
  {
    slug: "sydney",
    city: "Sydney",
    state: "NSW",
    studentPop: "320k+",
    uniCount: 6,
    verifiedProps: "3,800+",
    avgRent: "$450/wk",
    avgWalk: "15 min",
    lifestyle: ["Beach", "Premium", "Technology", "Global Hub"],
    image: "/assets/city_melbourne.png", // Using the same placeholder for demo
    universities: [
      { name: "UNSW Sydney", slug: "unsw", props: "1,100+", rent: "$480/wk", walk: "10 min" },
      { name: "University of Sydney", slug: "usyd", props: "1,400+", rent: "$500/wk", walk: "8 min" },
      { name: "UTS", slug: "uts", props: "900+", rent: "$450/wk", walk: "5 min" },
    ]
  },
  {
    slug: "brisbane",
    city: "Brisbane",
    state: "QLD",
    studentPop: "150k+",
    uniCount: 4,
    verifiedProps: "2,100+",
    avgRent: "$320/wk",
    avgWalk: "12 min",
    lifestyle: ["Sunny", "Affordable", "Nature", "Relaxed"],
    image: "/assets/city_melbourne.png",
    universities: [
      { name: "University of Queensland", slug: "uq", props: "800+", rent: "$340/wk", walk: "10 min" },
      { name: "QUT", slug: "qut", props: "950+", rent: "$360/wk", walk: "5 min" },
    ]
  }
];

export function StudyDestinations() {
  const [activeDest, setActiveDest] = useState(DESTINATIONS[0]);

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-32 bg-white">
      
      {/* Premium Typography Header */}
      <div className="mb-16 max-w-3xl">
        <h2 
          className="text-[2.5rem] lg:text-[4rem] font-medium text-brand-navy tracking-[-0.04em] leading-[1.05] mb-6"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          Where do you actually <br className="hidden md:block" /> want to study?
        </h2>
        <p className="text-xl text-slate-500 font-light leading-relaxed">
          Explore Australia's premier student cities. 
          Discover the perfect balance of world-class education, affordability, and lifestyle.
        </p>
      </div>

      {/* Split Panel Progressive Disclosure */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-[700px]">
        
        {/* Left Column: Vertical City Index */}
        <div className="w-full lg:w-1/3 flex flex-col gap-2 relative z-10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-4">
            Select Destination
          </p>
          {DESTINATIONS.map((dest) => {
            const isActive = activeDest.slug === dest.slug;
            return (
              <button
                key={dest.slug}
                onClick={() => setActiveDest(dest)}
                className={`relative w-full text-left p-6 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-brand-navy text-white shadow-xl shadow-brand-navy/10" 
                    : "bg-transparent text-slate-500 hover:bg-surface-muted"
                }`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <h3 className={`text-3xl font-semibold tracking-tight transition-colors duration-300 ${isActive ? "text-white" : "text-brand-navy group-hover:text-brand-orange"}`}>
                      {dest.city}
                    </h3>
                    <p className={`text-sm mt-1 uppercase tracking-widest font-bold ${isActive ? "text-slate-400" : "text-slate-400"}`}>
                      {dest.state}
                    </p>
                  </div>
                  <div className={`transition-transform duration-300 ${isActive ? "translate-x-2 text-white" : "opacity-0 -translate-x-4 text-brand-orange group-hover:opacity-100 group-hover:translate-x-0"}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Immersive Destination Data (The Reveal) */}
        <div className="w-full lg:w-2/3 relative rounded-[24px] overflow-hidden bg-brand-navy shadow-2xl flex flex-col justify-end">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDest.slug}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-0"
            >
              <Image 
                src={activeDest.image}
                alt={`${activeDest.city} Cityscape`}
                fill
                sizes="100vw"
                className="object-cover opacity-80"
                priority
              />
              {/* Complex gradient to ensure text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeDest.slug}-content`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="relative z-10 p-8 lg:p-12 w-full"
            >
              {/* City Level Stats Bento */}
              <div className="mb-10">
                <div className="flex flex-wrap gap-2 mb-6">
                  {activeDest.lifestyle.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full text-[11px] font-bold uppercase tracking-wider">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-brand-navy/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Student Pop.</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{activeDest.studentPop}</p>
                  </div>
                  <div className="bg-brand-navy/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Universities</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{activeDest.uniCount}</p>
                  </div>
                  <div className="bg-brand-navy/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Avg Rent</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{activeDest.avgRent}</p>
                  </div>
                  <div className="bg-brand-navy/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Avg Walk</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{activeDest.avgWalk}</p>
                  </div>
                </div>
              </div>

              {/* Top Universities Section */}
              <div className="bg-white/95 backdrop-blur-2xl rounded-xl p-6 lg:p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-bold text-brand-navy tracking-tight">Top Universities in {activeDest.city}</h4>
                  <Link href={`/cities/${activeDest.slug}`} className="text-sm font-semibold text-brand-orange hover:text-brand-orange flex items-center gap-1">
                    Explore City <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
                
                <div className="flex flex-col gap-3">
                  {activeDest.universities.map((uni) => (
                    <Link 
                      key={uni.slug} 
                      href={`/universities/${uni.slug}`}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-brand-orange/10/50 transition-colors"
                    >
                      <div className="mb-2 sm:mb-0">
                        <p className="font-semibold text-brand-navy group-hover:text-indigo-900 transition-colors">{uni.name}</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{uni.props} verified properties</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Rent</p>
                          <p className="text-sm font-semibold text-slate-700">{uni.rent}</p>
                        </div>
                        <div className="text-right w-16">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Walk</p>
                          <p className="text-sm font-semibold text-slate-700">{uni.walk}</p>
                        </div>
                        <div className="text-indigo-400 group-hover:text-brand-orange group-hover:translate-x-1 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>

        </div>
      </div>
      
    </section>
  );
}
