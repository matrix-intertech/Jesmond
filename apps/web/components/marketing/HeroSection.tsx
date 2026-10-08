"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { HeroSearchBar } from "./HeroSearchBar";

import Link from "next/link";

interface FeaturedPropertyData {
 id: string;
 name: string;
 location: string;
 imageUrl: string | null;
}

export function HeroSection({ featuredProperty, verifiedPropertyCount = 0 }: { featuredProperty?: FeaturedPropertyData | null, verifiedPropertyCount?: number }) {
  const formatPropertyCount = (count: number) => {
    if (count < 100) return null;
    const rounded = Math.floor(count / 100) * 100;
    if (rounded < 1000) return `${rounded}+`;
    return `${(rounded / 1000).toFixed(rounded % 1000 === 0 ? 0 : 1).replace('.0', '')}k+`;
  };
  const displayCount = formatPropertyCount(verifiedPropertyCount);
 return (
 <section className="relative w-full min-h-[600px] lg:h-[720px] flex flex-col justify-center pb-24 lg:pb-0 pt-24 mt-16">

 {/* 1. FULL-BLEED BACKGROUND IMAGE */}
 <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
 <Image
 src={featuredProperty?.imageUrl || "/assets/user_hero_bg.jpg"}
 alt="Jesmond Student Accommodation"
 fill
 sizes="100vw"
 className="object-cover object-[center_60%]"
 priority
 />
 </div>

 {/* 2. SUBTLE OVERLAY FOR READABILITY */}
 <div className="absolute inset-0 z-10 bg-gradient-to-b from-brand-indigo/50 via-brand-purple/20 to-brand-indigo/60" />

 {/* 3. CONTENT OVERLAY */}
 <div className="relative z-20 w-full max-w-[1440px] mx-auto px-4 sm:px-12 lg:px-16 pt-8 pb-16">
 <div className="grid grid-cols-12 gap-6 sm:gap-8 items-end">

 {/* Left Side: Typography & Metrics */}
 <div className="col-span-12 lg:col-span-8 flex flex-col items-start text-left">
 <motion.div
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
 >
 <h2 className="text-accent font-[family-name:var(--font-outfit)] text-sm tracking-[0.2em] uppercase font-bold mb-4">
 Australia's Premium Network
 </h2>
 </motion.div>

 <motion.h1
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
 className="max-w-full text-[2.5rem] sm:text-[4rem] lg:text-[5rem] font-bold text-white tracking-tight leading-[1.05] mb-6 sm:max-w-3xl drop-shadow-lg"
 style={{ fontFamily: 'var(--font-outfit)' }}
 >
 Find your perfect student home.
 </motion.h1>

 <motion.p
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
 className="max-w-full text-base sm:text-xl text-white/90 mb-8 sm:mb-10 sm:max-w-2xl leading-relaxed font-light drop-shadow-md"
 >
 Discover verified purpose-built student accommodation. Book securely with zero hidden fees.
 </motion.p>

 {/* Trust Metrics */}
 {displayCount && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 1, delay: 0.4 }}
 className="inline-flex max-w-full justify-start items-center mt-2 bg-primary/40 backdrop-blur-md rounded-2xl p-4 sm:px-8 sm:py-5 border border-white/10 shadow-xl"
 >
 <div className="text-center sm:text-left">
 <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{displayCount}</p>
 <p className="text-[10px] sm:text-xs text-white/70 font-semibold tracking-widest uppercase mt-1">Verified Properties</p>
 </div>
 </motion.div>
 )}
 </div>

 {/* Right Side: Badges */}
 <div className="col-span-12 lg:col-span-4 flex flex-col items-start lg:items-end justify-end gap-3 pb-2 pt-8 lg:pt-0">
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.8 }}
 className="flex flex-col gap-4 w-full sm:w-auto items-start lg:items-end"
 >
 <div className="max-w-full bg-surface/10 backdrop-blur-md rounded-full px-4 sm:px-5 py-2 border border-white/20 shadow-lg flex items-center gap-2 font-medium text-white text-sm whitespace-nowrap">
 <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
 Verified Listings
 </div>

 {featuredProperty && (
 <Link href={`/property/${featuredProperty.id}`} className="block w-full max-w-[260px]">
 <div className="bg-primary/60 backdrop-blur-md hover:bg-primary/80 transition-colors text-white rounded-xl p-4 border border-white/10 shadow-lg flex items-center gap-4 w-full cursor-pointer">
 <div className="w-10 h-10 bg-surface/20 rounded-full flex flex-shrink-0 items-center justify-center overflow-hidden relative">
 {featuredProperty.imageUrl ? (
 <Image src={featuredProperty.imageUrl} alt={featuredProperty.name} fill className="object-cover" />
 ) : (
 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
 )}
 </div>
 <div className="overflow-hidden">
 <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-0.5">Featured Property</p>
 <p className="text-sm font-medium truncate" title={featuredProperty.name}>{featuredProperty.name}</p>
 <p className="text-xs text-white/70 truncate" title={featuredProperty.location}>{featuredProperty.location}</p>
 </div>
 </div>
 </Link>
 )}
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
