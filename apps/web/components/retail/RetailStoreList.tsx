"use client";

import { useState } from "react";
import { StoreCard } from "@/components/retail/StoreCard";
import { Search, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";

type RetailStoreListProps = {
  initialStores: any[];
  currentCategory: string;
};

const CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "RETAIL", label: "Retail" },
  { id: "FOOD", label: "Food" },
  { id: "MECHANICS", label: "Mechanics" },
  { id: "SERVICES", label: "Services" },
  { id: "RENTALS", label: "Rentals" },
];

export function RetailStoreList({ initialStores, currentCategory }: RetailStoreListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStores = initialStores.filter((store) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const branchName = store.name?.toLowerCase() || "";
    const orgName = store.organization?.name?.toLowerCase() || "";
    const address = store.address?.toLowerCase() || "";
    
    return branchName.includes(query) || orgName.includes(query) || address.includes(query);
  });

  const handleCategoryChange = (catId: string) => {
    if (catId === 'ALL') {
      router.push('/retail');
    } else {
      router.push(`/retail?category=${catId}`);
    }
  };

  const renderCategorySection = (catId: string, title: string) => {
    const storesInCat = filteredStores.filter(s => s.organization?.businessCategory === catId);
    if (storesInCat.length === 0) return null;

    // "sensible limited number of businesses" -> let's say up to 6
    const displayedStores = storesInCat.slice(0, 6);

    return (
      <div key={catId} className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-primary">{title}</h2>
          {storesInCat.length > 6 && (
            <button
              onClick={() => handleCategoryChange(catId)}
              className="text-accent hover:underline font-medium"
            >
              View All {title} &rarr;
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedStores.map((store: any) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`px-4 py-2 rounded-full font-medium transition-colors ${currentCategory === cat.id ? 'bg-accent text-white' : 'bg-surface border border-border-strong text-text-secondary hover:bg-surface-muted'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="relative mb-12">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-muted">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for businesses by name or location..."
          className="w-full pl-12 pr-6 py-4 bg-surface border-2 border-border-strong rounded-2xl text-lg focus:outline-none focus:border-accent focus:ring-4 focus:ring-orange-50 transition-all text-primary font-medium"
        />
      </div>

      {initialStores.length === 0 ? (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border-strong">
          <div className="w-20 h-20 bg-surface-lavender text-text-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase size={32} />
          </div>
          <h3 className="text-2xl font-bold text-primary">No businesses available yet.</h3>
          <p className="text-text-secondary mt-2 max-w-md mx-auto">
            We couldn't find any businesses in this category right now. Please check back later.
          </p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border-strong">
          <div className="w-20 h-20 bg-surface-lavender text-text-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} />
          </div>
          <h3 className="text-2xl font-bold text-primary">No matching businesses</h3>
          <p className="text-text-secondary mt-2 max-w-md mx-auto">
            We couldn't find any businesses matching "{searchQuery}". Please try a different search term.
          </p>
        </div>
      ) : (
        currentCategory === 'ALL' ? (
          <div>
            {CATEGORIES.filter(c => c.id !== 'ALL').map(cat => renderCategorySection(cat.id, cat.label))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStores.map((store: any) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )
      )}
    </>
  );
}
