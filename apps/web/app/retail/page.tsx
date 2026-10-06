import { getApiUrl } from "@/utils/api";
import { RetailStoreList } from "@/components/retail/RetailStoreList";
import { ShoppingBag } from "lucide-react";

export const metadata = {
  title: "Local Retail Stores",
  description: "Shop from local stores and retailers connected to the Jesmond community.",
};

async function getStores() {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/stores`, {
      next: { revalidate: 60 } // Revalidate every minute
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch stores", err);
    return [];
  }
}

export default async function RetailDiscoveryPage() {
  const stores = await getStores();

  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-muted text-accent font-bold text-sm rounded-full mb-6">
            <ShoppingBag size={16} /> Retail Marketplace
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight leading-tight">
            Discover Student <span className="text-accent">Essentials</span> Near You.
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            Browse our partnered retail stores, from groceries to textbooks, tailored for student life. Order for pickup or delivery right to your accommodation.
          </p>
        </div>
      </div>

      <RetailStoreList stores={stores} />
    </div>
  );
}
