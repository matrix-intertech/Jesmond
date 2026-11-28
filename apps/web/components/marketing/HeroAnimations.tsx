"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function HeroAnimatedMetrics({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.4 }}
      className="inline-flex max-w-full justify-start items-center mt-2 bg-primary/40 backdrop-blur-md rounded-2xl p-4 sm:px-8 sm:py-5 border border-white/10 shadow-xl"
    >
      {children}
    </motion.div>
  );
}

export function HeroAnimatedBadges({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="flex flex-col gap-4 w-full sm:w-auto items-start lg:items-end"
    >
      {children}
    </motion.div>
  );
}
