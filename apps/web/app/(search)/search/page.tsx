import { Suspense } from 'react';
import Link from 'next/link';
import { SearchClient } from '@/components/search/SearchClient';

export const metadata = {
  title: "Search Student Accommodation | Jesmond",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  // Pass the raw searchParams down to the client layout where URL syncing occurs
  return (
    <main className="min-h-screen bg-surface-muted flex flex-col h-screen overflow-hidden pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Top Header / Filter Bar */}
      <header className="min-h-20 shrink-0 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-6 lg:flex lg:items-center">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 sm:gap-4 lg:justify-between">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-tighter transition-opacity hover:opacity-80">
            <div className="w-8 h-8 bg-brand-navy text-white flex items-center justify-center rounded-lg">J</div>
            <span className="hidden sm:block">Jesmond.</span>
          </Link>
          
          <div className="min-w-0 flex-1 lg:mx-8 lg:max-w-2xl">
            <div className="h-12 bg-slate-100 rounded-full flex items-center px-4 gap-3 text-slate-500 hover:bg-slate-200/50 transition-colors cursor-pointer border border-slate-200/50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-sm font-medium flex-grow truncate">{resolvedParams.city || 'Search Melbourne, Sydney...'}</span>
              <div className="hidden md:flex gap-2">
                <span className="px-3 py-1 bg-white rounded-full text-xs font-semibold shadow-sm">Dates</span>
                <span className="px-3 py-1 bg-white rounded-full text-xs font-semibold shadow-sm">Guests</span>
              </div>
            </div>
          </div>

          <div className="hidden w-8 lg:block" /> {/* Balance spacer */}
        </div>
      </header>

      {/* Main Split Layout */}
      <Suspense fallback={<div className="p-8 text-slate-500 font-medium">Loading search engine...</div>}>
        <SearchClient initialParams={resolvedParams} />
      </Suspense>
    </main>
  );
}
