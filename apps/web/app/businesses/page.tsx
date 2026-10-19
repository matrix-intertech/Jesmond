import { getApiUrl } from "@/utils/api";
import { RetailStoreList } from "@/components/retail/RetailStoreList";
import { Briefcase } from "lucide-react";

export const metadata = {
  title: "Local Businesses | Jesmond",
  description: "Discover and search local businesses — food, retail, services and more.",
  alternates: {
    canonical: "/businesses",
  },
  openGraph: {
    title: "Local Businesses | Jesmond",
    description: "Discover and search local businesses — food, retail, services and more.",
    url: "/businesses",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  category?: string;
  suburb?: string;
  page?: string;
  verifiedOnly?: string;
  openNow?: string;
};

async function getStores(params: SearchParams) {
  try {
    const url = new URL(`${getApiUrl()}/api/v1/retail/marketplace/stores`);
    if (params.q)           url.searchParams.set("q", params.q);
    if (params.category && params.category !== "ALL")
                            url.searchParams.set("category", params.category);
    if (params.suburb && params.suburb !== "ALL")
                            url.searchParams.set("suburb", params.suburb);
    if (params.page)        url.searchParams.set("page", params.page);

    // Default state: Verified only is OFF
    if (params.verifiedOnly === "true") {
      url.searchParams.set("verifiedOnly", "true");
    } else if (params.verifiedOnly === "false") {
      url.searchParams.set("verifiedOnly", "false");
    }

    // Default state: Open now filter is OFF (show all eligible businesses regardless of hours)
    // Only apply the open-now filter when explicitly set to "true"
    if (params.openNow === "true") {
      url.searchParams.set("openNow", "true");
    } else if (params.openNow === "false") {
      url.searchParams.set("openNow", "false");
    }
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw : (raw.data ?? []);
    const meta = Array.isArray(raw)
      ? { total: data.length, page: 1, limit: 20, totalPages: Math.ceil(data.length / 20) }
      : (raw.meta ?? { total: data.length, page: 1, limit: 20, totalPages: Math.ceil(data.length / 20) });
    return { data, meta };
  } catch (err) {
    console.error("Failed to fetch businesses", err);
    return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  }
}

export default async function BusinessesDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const result = await getStores(resolvedParams);

  const currentCategory = resolvedParams.category || "ALL";
  const currentSuburb   = resolvedParams.suburb || "ALL";
  const currentPage     = parseInt(resolvedParams.page || "1", 10);

  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-muted text-accent font-bold text-sm rounded-full mb-6">
            <Briefcase size={16} /> Businesses Directory
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight leading-tight">
            Discover Local <span className="text-accent">Businesses</span> Near You.
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            Browse our partnered businesses, from retail and food to mechanics and services. Connect with what you need locally.
          </p>
        </div>
      </div>

      <RetailStoreList
        initialStores={result.data ?? []}
        meta={result.meta}
        currentCategory={currentCategory}
        currentSuburb={currentSuburb}
        currentPage={currentPage}
        initialQ={resolvedParams.q || ""}
        initialVerifiedOnly={resolvedParams.verifiedOnly === "true"}
        initialOpenNow={resolvedParams.openNow === "true"}
      />
    </div>
  );
}
