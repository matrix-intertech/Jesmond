"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const QUICK_ACTIONS = [
  { label: "Search by University", href: "/universities" },
  { label: "Search by City", href: "/cities" },
  { label: "Available Now", href: "/search?availability=now" },
  { label: "Semester 1", href: "/search?semester=1" },
  { label: "Semester 2", href: "/search?semester=2" },
  { label: "International Students", href: "/international" },
];

export function FinalConversion() {
  return (
    <section className="w-full bg-white py-40 border-t border-slate-100 relative overflow-hidden">
      
      {/* Absolute minimal background grid for texture (Apple-style subtlety) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
      />

      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 relative z-10 flex flex-col items-center text-center">
        
        {/* Calm, Confident Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mb-12"
        >
          <h2 
            className="text-[3rem] lg:text-[4.5rem] font-medium text-slate-900 tracking-[-0.04em] leading-[1.1] mb-6"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Find your perfect <br className="hidden md:block" /> accommodation.
          </h2>
          <p className="text-xl text-slate-500 font-light max-w-2xl mx-auto leading-relaxed">
            Secure your housing early and arrive with confidence. 
            The simplest way to discover premium, verified student living in Australia.
          </p>
        </motion.div>

        {/* Primary Call to Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto gap-4 mb-24"
        >
          <Link href="/search">
            <button className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-4 text-lg font-semibold shadow-xl shadow-slate-900/10 transition-all duration-300 active:scale-95 flex items-center justify-center gap-2">
              Find Accommodation
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </Link>
          
          <Link href="/universities">
            <button className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-full px-8 py-4 text-lg font-semibold shadow-sm transition-all duration-300 active:scale-95 flex items-center justify-center">
              Explore Universities
            </button>
          </Link>
        </motion.div>

        {/* Quick Actions Footer - Editorial Style */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="w-full max-w-5xl border-t border-slate-100 pt-12"
        >
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-8 text-center">
            Quick Actions
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {QUICK_ACTIONS.map((action, idx) => (
              <Link 
                key={idx} 
                href={action.href}
                className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
