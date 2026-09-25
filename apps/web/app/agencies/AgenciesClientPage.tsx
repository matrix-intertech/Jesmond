"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Building2, Users, Home, MapPin, ChevronRight } from 'lucide-react';

interface Agency {
  id: string;
  name: string;
  branding: any;
  _count: {
    staff: number;
    properties: number;
  };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AgenciesClientPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAgencies();
  }, [search, page]);

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/public?${params}`
      );
      if (res.ok) {
        const json = await res.json();
        setAgencies(json.data ?? []);
        setMeta(json.meta ?? null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAgencies();
  };

  const getBrandingColor = (branding: any) =>
    branding?.primaryColor || '#EA580C';

  const getLogo = (branding: any) => branding?.logoUrl || null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <span className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-orange-100 text-orange-700">
              Verified Agencies
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Student Accommodation Agencies
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Browse trusted agencies managing student accommodation across Australia. Each agency is verified and maintains a portfolio of quality properties.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mt-8 max-w-xl mx-auto flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search agencies…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 transition-colors shadow-sm"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Agency Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {meta && (
          <p className="text-sm text-gray-500 mb-6">
            Showing {agencies.length} of {meta.total} agencies
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-pulse"
              >
                <div className="h-28 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-24">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No agencies found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {search ? `No results for "${search}". Try a different search.` : 'No verified agencies are listed yet.'}
            </p>
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="mt-4 text-sm font-medium text-orange-600 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {agencies.map((agency) => {
              const logo = getLogo(agency.branding);
              const color = getBrandingColor(agency.branding);
              const initials = agency.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();

              return (
                <Link
                  key={agency.id}
                  href={`/agencies/${agency.id}`}
                  className="group rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-orange-200 transition-all duration-200 flex flex-col"
                >
                  {/* Card Header */}
                  <div
                    className="h-28 flex items-center justify-center relative"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={`${agency.name} logo`}
                        className="max-h-16 max-w-[140px] object-contain"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Verified
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                      {agency.name}
                    </h2>

                    <div className="mt-3 flex flex-col gap-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        {agency._count.properties} {agency._count.properties === 1 ? 'property' : 'properties'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        {agency._count.staff} {agency._count.staff === 1 ? 'member' : 'team members'}
                      </span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs font-medium text-orange-600 group-hover:text-orange-700">
                        View agency
                      </span>
                      <ChevronRight className="h-4 w-4 text-orange-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
