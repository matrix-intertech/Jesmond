import { getApiUrl } from "@/utils/api";
import { RetailStoreList } from "@/components/retail/RetailStoreList";
import { Briefcase } from "lucide-react";

export const metadata = {
  title: "Local Businesses",
  description: "Discover and connect with local businesses in the Jesmond community.",
};

async function getStores(category?: string) {
  try {
    const url = new URL(`${getApiUrl()}/api/v1/retail/marketplace/stores`);
    if (category && category !== 'ALL') {
      url.searchParams.append('category', category);
    }
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 } // Revalidate every minute
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch businesses", err);
    return [];
  }
}

export default async function BusinessesDiscoveryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const currentCategory = resolvedSearchParams.category || 'ALL';
  const stores = await getStores(currentCategory);

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

      <RetailStoreList initialStores={stores} currentCategory={currentCategory} />
    </div>
  );
}
