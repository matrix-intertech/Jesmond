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
    <main className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      {/* Top Header / Filter Bar */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 w-full max-w-[1440px] mx-auto justify-between">
          <Link href="/" className="font-bold text-xl tracking-tighter flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded-lg">J</div>
            <span className="hidden sm:block">Jesmond.</span>
          </Link>
          
          <div className="flex-grow max-w-2xl mx-8">
            <div className="h-12 bg-slate-100 rounded-full flex items-center px-4 gap-3 text-slate-500 hover:bg-slate-200/50 transition-colors cursor-pointer border border-slate-200/50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-sm font-medium flex-grow truncate">{resolvedParams.city || 'Search Melbourne, Sydney...'}</span>
              <div className="hidden md:flex gap-2">
                <span className="px-3 py-1 bg-white rounded-full text-xs font-semibold shadow-sm">Dates</span>
                <span className="px-3 py-1 bg-white rounded-full text-xs font-semibold shadow-sm">Guests</span>
              </div>
            </div>
          </div>

          <div className="w-8" /> {/* Balance spacer */}
        </div>
      </header>

      {/* Main Split Layout */}
      <Suspense fallback={<div className="p-8 text-slate-500 font-medium">Loading search engine...</div>}>
        <SearchClient initialParams={resolvedParams} />
      </Suspense>
    </main>
  );
}
