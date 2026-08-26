"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { HeroSearchBar } from "./HeroSearchBar";

export function HeroSection() {
  return (
    <section className="relative w-full min-h-[600px] lg:h-[720px] flex flex-col justify-center pb-24 lg:pb-0 pt-24 mt-16">
      
      {/* 1. FULL-BLEED BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
        <Image
          src="/assets/user_hero_bg.jpg"
          alt="Jesmond Student Accommodation"
          fill
          sizes="100vw"
          className="object-cover object-[center_60%]"
          priority
        />
      </div>

      {/* 2. SUBTLE OVERLAY FOR READABILITY */}
      <div className="absolute inset-0 z-10 bg-brand-navy/40 bg-gradient-to-b from-[#07163D]/70 via-transparent to-[#07163D]/80" />

      {/* 3. CONTENT OVERLAY */}
      <div className="relative z-20 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 pt-8 pb-16">
        <div className="grid grid-cols-12 gap-8 items-end">
          
          {/* Left Side: Typography & Metrics */}
          <div className="col-span-12 lg:col-span-8 flex flex-col items-start text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-brand-orange font-[family-name:var(--font-outfit)] text-sm tracking-[0.2em] uppercase font-bold mb-4">
                Australia's Premium Network
              </h2>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-[3rem] sm:text-[4rem] lg:text-[5rem] font-bold text-white tracking-tight leading-[1.05] mb-6 max-w-3xl drop-shadow-lg"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Find your perfect student home.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl leading-relaxed font-light drop-shadow-md"
            >
              Discover verified purpose-built student accommodation. Book securely with zero hidden fees.
            </motion.p>

            {/* Trust Metrics */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="flex justify-start gap-12 items-center mt-2 bg-brand-navy/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl"
            >
              <div className="text-left">
                <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">12k+</p>
                <p className="text-[10px] sm:text-xs text-white/70 font-semibold tracking-widest uppercase mt-1">Verified Rooms</p>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-left">
                <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center justify-start gap-1">
                  4.9
                  <svg className="w-5 h-5 text-yellow-400 pb-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                </p>
                <p className="text-[10px] sm:text-xs text-white/70 font-semibold tracking-widest uppercase mt-1">Student Rating</p>
              </div>
            </motion.div>
          </div>

          {/* Right Side: Badges */}
          <div className="col-span-12 lg:col-span-4 flex flex-col items-start lg:items-end justify-end gap-3 pb-2 pt-8 lg:pt-0">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col gap-4 w-full sm:w-auto items-end"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-full px-5 py-2 border border-white/20 shadow-lg flex items-center gap-2 font-medium text-white text-sm whitespace-nowrap">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Verified Listings
              </div>
              <div className="bg-brand-navy/60 backdrop-blur-md text-white rounded-xl p-4 border border-white/10 shadow-lg flex items-center gap-4 w-full max-w-[260px]">
                <div className="w-10 h-10 bg-white/20 rounded-full flex flex-shrink-0 items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <div>
                  <p className="text-xs text-white/60 font-semibold uppercase tracking-wider">Premium Providers</p>
                  <p className="text-sm font-medium">Scrape, Iglu, Unilodge</p>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      {/* 4. FLOATING SEARCH BAR CONTAINER */}
      <div className="absolute bottom-0 translate-y-1/2 left-0 right-0 z-30 flex justify-center w-full px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[1100px]"
        >
          <HeroSearchBar />
        </motion.div>
      </div>
    </section>
  );
}
