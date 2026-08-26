"use client";

import { motion } from "framer-motion";

const TRUST_PILLARS = [
  {
    title: "100% Verified Providers.",
    description: "Every property on Jesmond is managed by a certified, legally vetted Australian accommodation provider. No scams, no fake listings.",
    icon: (
      <svg className="w-8 h-8 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    )
  },
  {
    title: "Zero Hidden Fees.",
    description: "Transparent pricing is our mandate. The weekly rent you see is exactly what you pay. We don't charge booking fees or student surcharges.",
    icon: (
      <svg className="w-8 h-8 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )
  },
  {
    title: "Secure Australian Payments.",
    description: "Your bonds and rent are processed securely via local bank gateways, ensuring full compliance with Australian tenancy laws.",
    icon: (
      <svg className="w-8 h-8 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
    )
  }
];

export function TrustExperience() {
  return (
    <section className="relative w-full py-24 lg:py-32 bg-white">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-brand-orange font-[family-name:var(--font-outfit)] text-sm tracking-[0.2em] uppercase font-bold mb-4">
              Built for students
            </h2>
            <h3 className="text-[2.5rem] lg:text-[3.5rem] font-bold text-brand-navy tracking-tight leading-[1.1] mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
              Backed by certainty.
            </h3>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Moving to a new city is stressful enough. Booking your accommodation shouldn't be. 
              We've built Australia's most trusted student housing platform.
            </p>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRUST_PILLARS.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-surface-muted border border-slate-100 rounded-[24px] p-8 hover:shadow-[0_20px_40px_-15px_rgba(7,22,61,0.05)] hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h4 className="text-xl font-bold text-brand-navy mb-4 tracking-tight">{feature.title}</h4>
              <p className="text-slate-600 leading-relaxed font-medium">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Metrics Banner */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20 bg-brand-navy rounded-[32px] p-12 relative overflow-hidden"
        >
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 text-center md:text-left divide-x divide-white/10">
            <div className="px-4">
              <p className="text-4xl lg:text-5xl font-bold text-white mb-2">18k+</p>
              <p className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Students Helped</p>
            </div>
            <div className="px-4 lg:pl-12">
              <p className="text-4xl lg:text-5xl font-bold text-white mb-2">420+</p>
              <p className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Verified Properties</p>
            </div>
            <div className="px-4 lg:pl-12">
              <p className="text-4xl lg:text-5xl font-bold text-white mb-2">35+</p>
              <p className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Universities</p>
            </div>
            <div className="px-4 lg:pl-12">
              <p className="text-4xl lg:text-5xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-1">
                4.9<svg className="w-6 h-6 text-yellow-400 pb-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              </p>
              <p className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Average Rating</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
