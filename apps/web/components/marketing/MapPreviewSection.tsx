"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const HUBS = [
  { 
    id: "melbourne", 
    name: "Melbourne", 
    tagline: "The cultural capital of Australia.",
    props: "4,200+", 
    avgRent: "$380",
    students: "350k+",
    unis: ["University of Melbourne", "Monash University", "RMIT"],
    coords: [-37.8136, 144.9631] 
  },
  { 
    id: "sydney", 
    name: "Sydney", 
    tagline: "Iconic beaches meets global education.",
    props: "3,800+", 
    avgRent: "$450",
    students: "320k+",
    unis: ["UNSW", "University of Sydney", "UTS"],
    coords: [-33.8688, 151.2093] 
  },
  { 
    id: "brisbane", 
    name: "Brisbane", 
    tagline: "Sunshine state of mind.",
    props: "2,100+", 
    avgRent: "$320",
    students: "150k+",
    unis: ["University of Queensland", "QUT"],
    coords: [-27.4698, 153.0251] 
  }
];

export function MapPreviewSection() {
  const [activeHub, setActiveHub] = useState(HUBS[0]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-32"
    >
      <div className="flex flex-col items-center text-center mb-16">
        <h2 
          className="text-[2.5rem] lg:text-[4rem] font-medium text-brand-navy tracking-[-0.04em] leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          Where are you planning <br className="hidden sm:block" /> to study?
        </h2>
        <p className="text-lg text-slate-500 max-w-2xl font-light">
          Australia is home to some of the world's highest-ranking universities. 
          Discover verified accommodation in the heart of the action.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-[600px]">
        
        {/* Hub Selector (Col 1-4) */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-3">
          {HUBS.map((hub) => {
            const isActive = activeHub.id === hub.id;
            return (
              <button
                key={hub.id}
                onClick={() => setActiveHub(hub)}
                className={`flex flex-col text-left p-6 rounded-[24px] transition-all duration-500 ${
                  isActive 
                    ? "bg-brand-navy text-white shadow-xl shadow-brand-navy/10 scale-100" 
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:shadow-md scale-[0.98]"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-2xl font-semibold tracking-tight ${isActive ? "text-white" : "text-brand-navy"}`}>
                    {hub.name}
                  </h3>
                  {isActive && (
                    <motion.div layoutId="active-indicator" className="w-2 h-2 rounded-full bg-brand-orange/100" />
                  )}
                </div>
                <p className={`text-sm ${isActive ? "text-slate-400" : "text-slate-500"}`}>
                  {hub.tagline}
                </p>
              </button>
            );
          })}
        </div>

        {/* Dynamic Data Panel (Col 5-12) */}
        <div className="col-span-1 lg:col-span-8 relative rounded-[24px] overflow-hidden bg-white border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeHub.id}
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-0"
            >
              {/* The map is now a subdued background element supporting the data */}
              <div className="absolute inset-0 bg-brand-navy/5 z-10 pointer-events-none" />
              <Image
                src="/assets/map_bg.png"
                alt="Map Background"
                fill
                sizes="100vw"
                className="object-cover opacity-20 grayscale"
                priority
              />
            </motion.div>
          </AnimatePresence>

          {/* Foreground Content */}
          <div className="relative z-10 flex-1 p-10 lg:p-12 flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeHub.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-3 gap-8"
              >
                {/* Stat Cards */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-2xl shadow-sm">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Verified Rooms</p>
                  <p className="text-3xl font-semibold text-brand-navy tracking-tight">{activeHub.props}</p>
                </div>
                
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-2xl shadow-sm">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Avg Rent</p>
                  <p className="text-3xl font-semibold text-brand-navy tracking-tight">{activeHub.avgRent} <span className="text-lg text-slate-500 font-normal">/wk</span></p>
                </div>

                <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-2xl shadow-sm hidden md:block">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Student Pop.</p>
                  <p className="text-3xl font-semibold text-brand-navy tracking-tight">{activeHub.students}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeHub.id}-footer`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-12"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-brand-navy uppercase tracking-widest mb-4">Major Universities</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeHub.unis.map((uni) => (
                        <span key={uni} className="px-4 py-2 bg-brand-navy/5 text-slate-700 rounded-lg text-sm font-medium border border-brand-navy/10 backdrop-blur-sm">
                          {uni}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button className="bg-brand-orange hover:bg-orange-600 text-white rounded-xl px-8 py-4 text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 flex-shrink-0">
                    Explore {activeHub.name}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </motion.section>
  );
}
