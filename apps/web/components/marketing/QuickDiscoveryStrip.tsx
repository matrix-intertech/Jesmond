"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const CATEGORIES = [
  {
    title: "Popular Universities",
    items: [
      { label: "Monash University", href: "/search?uni=monash" },
      { label: "University of Melbourne", href: "/search?uni=unimelb" },
      { label: "UNSW Sydney", href: "/search?uni=unsw" },
      { label: "RMIT", href: "/search?uni=rmit" },
    ]
  },
  {
    title: "Room Types",
    items: [
      { label: "Private Studio", href: "/search?type=studio" },
      { label: "En-suite Room", href: "/search?type=ensuite" },
      { label: "Shared Room", href: "/search?type=shared" },
      { label: "Entire Apartment", href: "/search?type=apartment" },
    ]
  },
  {
    title: "Budget & Move-in",
    items: [
      { label: "Under $300/wk", href: "/search?maxPrice=300" },
      { label: "Premium ($500+)", href: "/search?minPrice=500" },
      { label: "Semester 1 (Feb)", href: "/search?moveIn=sem1" },
      { label: "Available Now", href: "/search?moveIn=immediate" },
    ]
  }
];

export function QuickDiscoveryStrip() {
  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-16 border-t border-slate-200/60 relative z-10 bg-surface-muted">
      
      <div className="flex flex-col md:flex-row gap-12 lg:gap-24">
        {CATEGORIES.map((category, idx) => (
          <motion.div 
            key={category.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="flex-1"
          >
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              {category.title}
            </h4>
            
            <div className="flex flex-wrap gap-3">
              {category.items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group relative px-5 py-2.5 bg-white border border-slate-200 rounded-full text-[13px] font-medium text-slate-600 hover:text-brand-navy hover:border-slate-300 transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]"
                >
                  <span className="relative z-10">{item.label}</span>
                  {/* Subtle hover gradient background */}
                  <div className="absolute inset-0 bg-surface-muted/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      
    </section>
  );
}
