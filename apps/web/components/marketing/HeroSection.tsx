"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { HeroSearchBar } from "./HeroSearchBar";

export function HeroSection() {
  return (
    <section className="relative w-full min-h-[90vh] bg-slate-50 flex items-center overflow-visible">
      {/* Subtle Grid Background for structural depth */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 pt-24 pb-32">
        {/* 12-Column Grid Layout */}
        <div className="grid grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT: Typography (Spans 5 cols) */}
          <div className="col-span-12 lg:col-span-5 flex flex-col justify-center relative z-20">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-block px-3 py-1 mb-8 text-[11px] font-bold tracking-[0.2em] uppercase text-slate-500 border border-slate-200 rounded-full">
                Australia's Premium Network
              </span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-[3.5rem] lg:text-[4.5rem] font-medium text-slate-900 tracking-[-0.04em] leading-[1.05] mb-6"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Find your perfect student home.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-[1.125rem] text-slate-500 mb-12 max-w-[420px] leading-relaxed font-light"
            >
              Discover verified purpose-built student accommodation. 
              Book securely with zero hidden fees.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[480px]"
            >
              {/* Note: HeroSearchBar manages its own absolute dropdown over the Z-axis */}
              <HeroSearchBar />
            </motion.div>

            {/* Quick Chips */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-10 flex flex-wrap gap-2 items-center text-sm"
            >
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wider mr-2">Popular:</span>
              {["UniMelb", "Monash", "UNSW"].map((uni) => (
                <button key={uni} className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                  {uni}
                </button>
              ))}
            </motion.div>

            {/* Trust Metrics - Positioned absolutely relative to the grid on large screens */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="mt-16 flex gap-10 items-center"
            >
              <div>
                <p className="text-[1.75rem] font-semibold text-slate-900 tracking-tight">12k+</p>
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1">Verified Rooms</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-[1.75rem] font-semibold text-slate-900 tracking-tight flex items-center gap-1">
                  4.9
                  <svg className="w-4 h-4 text-yellow-400 pb-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                </p>
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1">Student Rating</p>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Cinematic Image (Spans 7 cols) */}
          <div className="col-span-12 lg:col-span-7 relative mt-16 lg:mt-0 h-[65vh] min-h-[600px] z-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full h-full rounded-[24px] overflow-hidden"
              style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.15), 0 4px 6px -1px rgba(0,0,0,0.05)" }}
            >
              <Image
                src="/assets/hero_bg.png"
                alt="Premium Student Accommodation"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority
              />
              {/* Edge mask to blend into the white slightly */}
              <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.3)] pointer-events-none" />
            </motion.div>

            {/* Custom Premium Glassmorphism Card */}
            <motion.div 
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.6, type: "spring", stiffness: 100, damping: 20 }}
              className="absolute -bottom-8 -left-8 lg:-bottom-10 lg:-left-12 max-w-[340px] w-full"
            >
              <div className="relative overflow-hidden rounded-[20px] p-6 text-white shadow-2xl backdrop-blur-2xl bg-white/10 border border-white/20">
                {/* SVG Noise Layer for premium glass texture */}
                <div 
                  className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" 
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
                />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">Scape Swanston</h3>
                      <p className="text-white/60 text-sm mt-0.5">Melbourne CBD</p>
                    </div>
                    {/* Badge */}
                    <div className="bg-white/20 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded">
                      Verified
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end border-t border-white/10 pt-5">
                    <div>
                      <p className="text-xs text-white/50 mb-1 uppercase tracking-wider font-semibold">From</p>
                      <p className="text-3xl font-medium tracking-tight">$389 <span className="text-sm font-normal text-white/50">/ week</span></p>
                    </div>
                    <button className="bg-white text-slate-900 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-lg">
                      View
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
