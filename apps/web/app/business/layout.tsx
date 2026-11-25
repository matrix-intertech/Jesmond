import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ShieldCheck, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Business Portal | Jesmond Partner & Commercial Platform',
  description:
    'Dedicated management portal for student accommodation providers, retail merchants, dining establishments, and service partners on Jesmond.',
  robots: { index: false, follow: false },
};

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-brand-purple selection:text-white">
      {/* Top Professional Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/business/login" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-outfit font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                  Jesmond <span className="text-xs px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/30 font-semibold uppercase tracking-wider">Business</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Enterprise & Partner Platform</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Isolated Enterprise Portal</span>
            </div>
            <a
              href="https://jesmond.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <span>Student Portal</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">{children}</main>

      {/* Enterprise Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Jesmond Holdings Pty Ltd. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <Link href="/terms" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:support@jesmond.com.au" className="hover:text-slate-400 transition-colors">
              Business Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
