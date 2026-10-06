"use client";

import { useState } from "react";
import { StoreCard } from "@/components/retail/StoreCard";
import { Search, Store } from "lucide-react";

type RetailStoreListProps = {
  stores: any[];
};

export function RetailStoreList({ stores }: RetailStoreListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStores = stores.filter((store) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const branchName = store.name?.toLowerCase() || "";
    const orgName = store.organization?.name?.toLowerCase() || "";
    const address = store.address?.toLowerCase() || "";
    
    return branchName.includes(query) || orgName.includes(query) || address.includes(query);
  });

  return (
    <>
      <div className="relative mb-12">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-muted">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for stores by name or location..."
          className="w-full pl-12 pr-6 py-4 bg-surface border-2 border-border-strong rounded-2xl text-lg focus:outline-none focus:border-accent focus:ring-4 focus:ring-orange-50 transition-all text-primary font-medium"
        />
      </div>

      {stores.length === 0 ? (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border-strong">
          <div className="w-20 h-20 bg-surface-lavender text-text-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Store size={32} />
          </div>
          <h3 className="text-2xl font-bold text-primary">No stores available</h3>
          <p className="text-text-secondary mt-2 max-w-md mx-auto">
            We couldn't find any retail stores near your location right now. Please check back later.
          </p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border-strong">
          <div className="w-20 h-20 bg-surface-lavender text-text-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} />
          </div>
          <h3 className="text-2xl font-bold text-primary">No matching stores</h3>
          <p className="text-text-secondary mt-2 max-w-md mx-auto">
            We couldn't find any stores matching "{searchQuery}". Please try a different search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store: any) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </>
  );
}
