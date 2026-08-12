"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const METRICS = [
  { value: "18k+", label: "Students Helped" },
  { value: "420+", label: "Verified Properties" },
  { value: "35+", label: "Universities" },
  { value: "4.9★", label: "Average Rating" },
];

const TRUST_PILLARS = [
  {
    title: "100% Verified Providers.",
    description: "Every property on Jesmond is managed by a certified, legally vetted Australian accommodation provider. No scams, no fake listings."
  },
  {
    title: "Zero Hidden Fees.",
    description: "Transparent pricing is our mandate. The weekly rent you see is exactly what you pay. We don't charge booking fees or student surcharges."
  },
  {
    title: "Secure Australian Payments.",
    description: "Your bonds and rent are processed securely via local bank gateways, ensuring full compliance with Australian tenancy laws."
  }
];

export function TrustExperience() {
  return (
    <section className="w-full bg-slate-900 py-32 border-t border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
        
        {/* Editorial Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mb-24"
        >
          <h2 className="text-[3rem] lg:text-[5rem] font-medium text-white tracking-[-0.04em] leading-[1.05] mb-8" style={{ fontFamily: 'var(--font-outfit)' }}>
            Built for students. <br className="hidden md:block" />
            Backed by certainty.
          </h2>
          <p className="text-xl lg:text-2xl text-slate-400 font-light max-w-2xl leading-relaxed">
            Moving to a new city is stressful enough. Booking your accommodation shouldn't be. 
            We've built Australia's most trusted student housing platform.
          </p>
        </motion.div>

        {/* Magazine Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left: Cinematic Editorial Image (Spans 5 cols) */}
          <motion.div 
            initial={{ opacity: 0, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="col-span-1 lg:col-span-5 relative h-[600px] lg:h-[800px] rounded-[24px] overflow-hidden bg-slate-800 group"
          >
            <Image 
              src="/assets/trust_editorial.png"
              alt="Student studying in an Australian library"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out opacity-80"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            {/* Cinematic depth gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-slate-900/40 mix-blend-multiply" />
            
            {/* Overlay Quote */}
            <div className="absolute bottom-8 left-8 right-8 z-10">
              <div className="w-12 h-1 bg-indigo-500 mb-6" />
              <p className="text-2xl text-white font-medium leading-snug tracking-tight mb-4">
                "The only platform that actually verified the property before I arrived in Melbourne."
              </p>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                — Sarah T., Monash University
              </p>
            </div>
          </motion.div>

          {/* Right: Data & Trust Statements (Spans 7 cols) */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-between">
            
            {/* Massive Metrics Block */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="grid grid-cols-2 gap-x-8 gap-y-12 mb-20 lg:mb-0"
            >
              {METRICS.map((metric, idx) => (
                <div key={idx} className="border-l border-slate-700 pl-6">
                  <p className="text-4xl lg:text-[4rem] font-medium text-white tracking-tighter leading-none mb-4">
                    {metric.value}
                  </p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                    {metric.label}
                  </p>
                </div>
              ))}
            </motion.div>

            {/* Editorial Trust Pillars */}
            <div className="flex flex-col gap-10 mt-12 lg:mt-0">
              {TRUST_PILLARS.map((pillar, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + (idx * 0.1) }}
                  className="pb-10 border-b border-slate-800 last:border-b-0 last:pb-0"
                >
                  <h3 className="text-2xl font-semibold text-white tracking-tight mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-lg text-slate-400 font-light leading-relaxed max-w-xl">
                    {pillar.description}
                  </p>
                </motion.div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
