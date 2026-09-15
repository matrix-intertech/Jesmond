import { getApiUrl } from "@/utils/api";
import { StoreCard } from "@/components/retail/StoreCard";
import { Search, ShoppingBag, Store } from "lucide-react";

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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-brand-orange font-bold text-sm rounded-full mb-6">
            <ShoppingBag size={16} /> Retail Marketplace
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-brand-navy tracking-tight leading-tight">
            Discover Student <span className="text-brand-orange">Essentials</span> Near You.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Browse our partnered retail stores, from groceries to textbooks, tailored for student life. Order for pickup or delivery right to your accommodation.
          </p>
        </div>
      </div>

      <div className="relative mb-12">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Search for stores by name or location..."
          className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg focus:outline-none focus:border-brand-orange focus:ring-4 focus:ring-orange-50 transition-all text-brand-navy font-medium"
        />
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
            <Store size={32} />
          </div>
          <h3 className="text-2xl font-bold text-brand-navy">No stores available</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            We couldn't find any retail stores near your location right now. Please check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store: any) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}
