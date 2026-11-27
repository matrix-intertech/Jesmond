import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { JesmondBusinessLogo } from '@/components/branding/JesmondBusinessLogo';

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
    <div className="min-h-dvh w-full flex flex-col bg-[#1A100A] text-[#FFF9EF] font-sans selection:bg-[#EA8A32] selection:text-[#120D09] overflow-x-hidden">
      {/* Full-Width Enterprise Header */}
      <header className="w-full border-b border-[rgba(214,166,79,0.22)] bg-[#120D09]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full px-3 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center min-w-0">
            <Link href="/business/login" className="flex items-center group min-w-0">
              <JesmondBusinessLogo />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/50 border border-[#D6A64F]/30 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D6A64F]" />
              <span>Isolated Enterprise Portal</span>
            </div>
            <a
              href="https://jesmond.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] sm:text-xs text-[#C9B69C] hover:text-[#FFF9EF] flex items-center gap-1 transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[#24160D] border border-transparent hover:border-[rgba(214,166,79,0.22)] whitespace-nowrap"
            >
              <span>Jesmond Portal</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#D6A64F]" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area — Full Width */}
      <main className="flex-1 w-full flex flex-col justify-center">{children}</main>

      {/* Full-Width Enterprise Footer */}
      <footer className="w-full border-t border-[rgba(214,166,79,0.22)] bg-[#120D09] pt-4 sm:pt-5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-xs text-[#C9B69C]">
        <div className="w-full px-4 sm:px-8 lg:px-12 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:hidden pb-2.5 border-b border-[rgba(214,166,79,0.14)] w-full">
            <JesmondBusinessLogo size="sm" />
            <p className="text-[11px] text-[#C9B69C] text-right">
              Partner Portal
            </p>
          </div>
          <nav
            aria-label="Business portal legal and support links"
            className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-0 sm:gap-x-6 sm:order-2"
          >
            <Link
              href="/terms"
              className="inline-flex min-h-[44px] sm:min-h-0 items-center px-1.5 sm:px-0 whitespace-nowrap hover:text-[#F3D69A] transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-[44px] sm:min-h-0 items-center px-1.5 sm:px-0 whitespace-nowrap hover:text-[#F3D69A] transition-colors"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:support@jesmond.com.au"
              className="inline-flex min-h-[44px] sm:min-h-0 items-center px-1.5 sm:px-0 whitespace-nowrap hover:text-[#F3D69A] transition-colors"
            >
              Business Support
            </a>
          </nav>
          <p className="text-center sm:text-left sm:order-1">
            &copy; {new Date().getFullYear()} Jesmond Holdings Pty Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
