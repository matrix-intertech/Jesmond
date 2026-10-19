"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { StoreCard } from "@/components/retail/StoreCard";
import { Search, Briefcase, ChevronLeft, ChevronRight, CheckCircle, Clock, MapPin } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/api";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type RetailStoreListProps = {
  initialStores: any[];
  meta: Meta;
  currentCategory: string;
  currentSuburb?: string;
  currentPage: number;
  initialQ: string;
  initialVerifiedOnly: boolean;
  initialOpenNow: boolean;
};

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "ALL",       label: "All" },
  { id: "FOOD",      label: "Food & Dining" },
  { id: "RETAIL",    label: "Retail" },
  { id: "MECHANICS", label: "Mechanics" },
  { id: "SERVICES",  label: "Services" },
  { id: "RENTALS",   label: "Rentals" },
];

const SUBURBS = [
  { id: "ALL",                label: "All Suburbs" },
  { id: "Jesmond",            label: "Jesmond" },
  { id: "Newcastle",          label: "Newcastle" },
  { id: "Callaghan",          label: "Callaghan" },
  { id: "Wallsend",           label: "Wallsend" },
  { id: "Lambton",            label: "Lambton" },
  { id: "Birmingham Gardens", label: "Birmingham Gardens" },
];

const DEBOUNCE_MS = 500;

// ──────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ──────────────────────────────────────────────────────────────────────────────

function StoreSkeleton() {
  return (
    <div className="bg-surface rounded-2xl p-6 border border-border-strong/60 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-secondary rounded-xl shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-secondary rounded w-3/4" />
          <div className="h-3 bg-secondary rounded w-1/2" />
          <div className="h-3 bg-secondary rounded w-2/3" />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <div className="h-6 w-20 bg-secondary rounded-full" />
        <div className="h-6 w-24 bg-secondary rounded-full" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

export function RetailStoreList({
  initialStores,
  meta: initialMeta,
  currentCategory,
  currentSuburb = "ALL",
  currentPage,
  initialQ,
  initialVerifiedOnly,
  initialOpenNow,
}: RetailStoreListProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const urlParams  = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ── Local state ────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput]       = useState(initialQ);
  const [activeQ, setActiveQ]               = useState(initialQ);
  const [category, setCategory]             = useState(currentCategory);
  const [suburb, setSuburb]                 = useState(currentSuburb);
  const [verifiedOnly, setVerifiedOnly]     = useState(initialVerifiedOnly);
  const [openNow, setOpenNow]               = useState(initialOpenNow);
  const [page, setPage]                     = useState(currentPage);

  const [stores, setStores]                 = useState<any[]>(initialStores);
  const [meta, setMeta]                     = useState<Meta>(initialMeta);
  const [isLoading, setIsLoading]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const debounceTimer    = useRef<NodeJS.Timeout | null>(null);
  const abortRef         = useRef<AbortController | null>(null);
  const isSyncingFromUrl = useRef(false);

  // ── URL sync helper ────────────────────────────────────────────────────────
  const pushToUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const current = new URLSearchParams(urlParams.toString());
      let changed = false;

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          if (current.has(key)) { current.delete(key); changed = true; }
        } else {
          if (current.get(key) !== value) { current.set(key, value); changed = true; }
        }
      }
      if (changed) {
        startTransition(() => {
          router.push(`${pathname}?${current.toString()}`, { scroll: false });
        });
      }
    },
    [router, pathname, urlParams],
  );

  // ── Sync URL params -> state on browser Back/Forward navigation ────────────
  useEffect(() => {
    const urlQ = urlParams.get("q") || "";
    const urlCat = urlParams.get("category") || "ALL";
    const urlSuburb = urlParams.get("suburb") || "ALL";
    const urlVerified = urlParams.get("verifiedOnly") === "true";
    const urlOpen = urlParams.get("openNow") === "true";
    const rawPage = parseInt(urlParams.get("page") || "1", 10);
    const urlP = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

    const needsSync =
      urlQ !== activeQ ||
      urlCat !== category ||
      urlSuburb !== suburb ||
      urlVerified !== verifiedOnly ||
      urlOpen !== openNow ||
      urlP !== page;

    if (needsSync) {
      isSyncingFromUrl.current = true;
      setSearchInput(urlQ);
      setActiveQ(urlQ);
      setCategory(urlCat);
      setSuburb(urlSuburb);
      setVerifiedOnly(urlVerified);
      setOpenNow(urlOpen);
      setPage(urlP);
    }
  }, [urlParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch from API ─────────────────────────────────────────────────────────
  const fetchStores = useCallback(
    async (params: {
      q: string;
      category: string;
      suburb: string;
      verifiedOnly: boolean;
      openNow: boolean;
      page: number;
    }) => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL(`${getApiUrl()}/api/v1/retail/marketplace/stores`);
        if (params.q)                  url.searchParams.set("q", params.q);
        if (params.category !== "ALL") url.searchParams.set("category", params.category);
        if (params.suburb !== "ALL")   url.searchParams.set("suburb", params.suburb);
        if (params.verifiedOnly)       url.searchParams.set("verifiedOnly", "true");
        else                           url.searchParams.set("verifiedOnly", "false");
        url.searchParams.set("openNow", String(params.openNow));
        url.searchParams.set("page",    String(params.page));
        url.searchParams.set("limit",   "20");

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw : (raw.data ?? []);
        const metaInfo = Array.isArray(raw)
          ? { total: data.length, page: 1, limit: 20, totalPages: Math.ceil(data.length / 20) }
          : (raw.meta ?? { total: data.length, page: 1, limit: 20, totalPages: Math.ceil(data.length / 20) });
        setStores(data);
        setMeta(metaInfo);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError("Failed to load businesses. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ── Debounced search trigger ───────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setActiveQ(searchInput);
    }, DEBOUNCE_MS);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchInput]);

  // ── Fetch whenever active filters change ──────────────────────────────────
  useEffect(() => {
    fetchStores({ q: activeQ, category, suburb, verifiedOnly, openNow, page });
  }, [activeQ, category, suburb, verifiedOnly, openNow, page, fetchStores]);

  // ── URL param sync (on filter changes — reset to page 1 except pagination) ─
  useEffect(() => {
    if (isSyncingFromUrl.current) {
      isSyncingFromUrl.current = false;
      return;
    }

    pushToUrl({
      q:            activeQ || null,
      category:     category !== "ALL" ? category : null,
      suburb:       suburb !== "ALL" ? suburb : null,
      verifiedOnly: verifiedOnly ? "true" : null,   // default=false (OFF), only in URL when true
      openNow:      openNow ? "true" : null,        // default=false (OFF), only in URL when true
      page:         page > 1 ? String(page) : null,
    });
  }, [activeQ, category, suburb, verifiedOnly, openNow, page]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter change helpers (reset page to 1) ───────────────────────────────
  const handleCategoryChange = (cat: string) => { setCategory(cat); setPage(1); };
  const handleSuburbChange   = (sub: string) => { setSuburb(sub); setPage(1); };
  const handleVerifiedToggle  = ()            => { setVerifiedOnly((v) => !v); setPage(1); };
  const handleOpenNowToggle   = ()            => { setOpenNow((o) => !o); setPage(1); };
  const handleClearAll        = () => {
    setSearchInput(""); setActiveQ(""); setCategory("ALL"); setSuburb("ALL");
    setVerifiedOnly(false); setOpenNow(false); setPage(1);
  };

  const showingSearch = activeQ.length > 0;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-muted">
          <Search size={20} />
        </div>
        <input
          id="business-search"
          type="text"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          placeholder="Search businesses, food menus, dishes, services…"
          aria-label="Search businesses"
          className="w-full pl-12 pr-6 py-4 bg-surface border-2 border-border-strong rounded-2xl text-lg focus:outline-none focus:border-accent focus:ring-4 focus:ring-orange-50 transition-all text-primary font-medium placeholder:text-text-muted"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(""); setPage(1); }}
            aria-label="Clear search"
            className="absolute inset-y-0 right-4 flex items-center text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {/* Category pills */}
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            aria-pressed={category === cat.id}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              category === cat.id
                ? "bg-accent text-white shadow-sm"
                : "bg-surface border border-border-strong text-text-secondary hover:bg-surface-muted hover:border-accent/40"
            }`}
          >
            {cat.label}
          </button>
        ))}

        {/* Suburb selector */}
        <div className="relative">
          <select
            id="suburb-filter"
            value={suburb}
            onChange={(e) => handleSuburbChange(e.target.value)}
            aria-label="Filter by suburb"
            className="appearance-none bg-surface border border-border-strong text-text-primary text-sm font-semibold rounded-full pl-4 pr-9 py-2 hover:bg-surface-muted hover:border-accent/40 focus:outline-none focus:border-accent transition-all cursor-pointer"
          >
            {SUBURBS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted">
            <MapPin size={14} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Verified only toggle (default: OFF) */}
          <button
            onClick={handleVerifiedToggle}
            aria-pressed={verifiedOnly}
            title="Show verified businesses only"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
              verifiedOnly
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-surface border-border-strong text-text-secondary hover:bg-surface-muted"
            }`}
          >
            <CheckCircle size={14} />
            Verified only
          </button>

          {/* Open now toggle (default: ON) */}
          <button
            onClick={handleOpenNowToggle}
            aria-pressed={openNow}
            title="Show only currently open businesses"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
              openNow
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-surface border-border-strong text-text-secondary hover:bg-surface-muted"
            }`}
          >
            <Clock size={14} />
            Open now
          </button>

          {/* Clear all */}
          {(showingSearch || category !== "ALL" || suburb !== "ALL" || verifiedOnly || openNow) && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-sm font-semibold text-text-secondary hover:text-primary transition-colors underline underline-offset-2"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-medium text-text-secondary">
          {isLoading
            ? "Searching…"
            : `${meta.total} business${meta.total !== 1 ? "es" : ""} found${showingSearch ? ` for "${activeQ}"` : ""}`}
        </p>
        {isPending && (
          <span className="text-xs text-text-muted animate-pulse">Updating…</span>
        )}
      </div>

      {/* ── Loading state ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <StoreSkeleton key={i} />)}
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {!isLoading && error && (
        <div className="bg-surface rounded-3xl p-12 text-center border border-red-200">
          <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">Something went wrong</h3>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => fetchStores({ q: activeQ, category, suburb, verifiedOnly, openNow, page })}
            className="px-6 py-2 bg-accent text-white rounded-full font-semibold hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!isLoading && !error && stores.length === 0 && (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border-strong">
          <div className="w-20 h-20 bg-surface-lavender text-text-muted rounded-full flex items-center justify-center mx-auto mb-6">
            {showingSearch ? <Search size={32} /> : <Briefcase size={32} />}
          </div>
          {showingSearch ? (
            <>
              <h3 className="text-2xl font-bold text-primary">No matches found</h3>
              <p className="text-text-secondary mt-2 max-w-md mx-auto">
                No businesses or menu items match <strong>"{activeQ}"</strong>. Try a different keyword or clear the search.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-primary">No businesses available</h3>
              <p className="text-text-secondary mt-2 max-w-md mx-auto">
                We couldn't find any businesses matching your filters. Try adjusting your selections.
              </p>
            </>
          )}
          <button
            onClick={handleClearAll}
            className="mt-6 px-6 py-2 bg-accent text-white rounded-full font-semibold hover:bg-accent/90 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Store grid ──────────────────────────────────────────────────── */}
      {!isLoading && !error && stores.length > 0 && (
        <>
          {/* When ALL category, group by category section */}
          {category === "ALL" && !showingSearch ? (
            <div className="space-y-12">
              {CATEGORIES.filter((c) => c.id !== "ALL").map((cat) => {
                const catStores = stores.filter(
                  (s) => s.organization?.businessCategory === cat.id,
                );
                if (catStores.length === 0) return null;
                return (
                  <section key={cat.id} aria-label={cat.label}>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-primary">{cat.label}</h2>
                      {catStores.length >= 6 && (
                        <button
                          onClick={() => handleCategoryChange(cat.id)}
                          className="text-accent hover:underline font-medium text-sm"
                        >
                          View all {cat.label} →
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {catStores.slice(0, 6).map((store) => (
                        <StoreCard key={store.id} store={store} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {meta.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-between gap-4 border-t border-border-strong pt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border-strong rounded-xl text-sm font-medium text-text-primary hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <span className="text-sm font-medium text-text-secondary">
                Page {meta.page} of {meta.totalPages}
                <span className="hidden sm:inline"> · {meta.total} results</span>
              </span>

              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border-strong rounded-xl text-sm font-medium text-text-primary hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
