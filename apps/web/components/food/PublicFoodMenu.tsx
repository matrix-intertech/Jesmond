"use client";

import { useState, useEffect } from "react";
import { useFoodCart } from "@/providers/FoodCartProvider";
import { Plus, ShoppingBag, Check } from "lucide-react";

interface FoodMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  displayOrder: number;
}

interface FoodMenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  items: FoodMenuItem[];
}

interface FoodMenu {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categories: FoodMenuCategory[];
}

export default function PublicFoodMenu({ branchId, businessName }: { branchId: string; businessName?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menus, setMenus] = useState<FoodMenu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  const foodCart = useFoodCart();

  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/food/menu/public/${branchId}`);
        if (!res.ok) {
          throw new Error('Failed to load menu');
        }
        const data = await res.json();
        setMenus(data);
        if (data.length > 0) {
          setActiveMenuId(data[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching menu');
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [branchId]);

  const handleAddToCart = (item: FoodMenuItem) => {
    foodCart.addItem(branchId, businessName || 'Food Business', {
      foodMenuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice: item.price,
    });

    // Show brief "Added" feedback
    setAddedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItems(prev => ({ ...prev, [item.id]: false }));
    }, 1500);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-text-secondary animate-pulse">
        Loading menu...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
        <p className="font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-white text-sm font-medium rounded-lg shadow-sm border"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (menus.length === 0) {
    return (
      <div className="py-16 px-4 bg-surface-muted rounded-3xl text-center border border-border-strong/50">
        <h3 className="text-xl font-bold text-primary">Menu not available</h3>
        <p className="mt-2 text-text-secondary">This business hasn't published their menu yet.</p>
      </div>
    );
  }

  const activeMenu = menus.find((m) => m.id === activeMenuId);
  if (!activeMenu) return null;

  const cartItemCount = foodCart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Floating cart indicator */}
      {cartItemCount > 0 && (
        <button
          onClick={() => foodCart.setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 bg-accent text-white rounded-2xl shadow-2xl shadow-orange-500/30 hover:scale-105 transition-transform font-bold text-lg lg:hidden"
        >
          <ShoppingBag size={22} />
          <span>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</span>
          <span className="text-white/80">•</span>
          <span>${(foodCart.subtotal / 100).toFixed(2)}</span>
        </button>
      )}

      {menus.length > 1 && (
        <div role="tablist" aria-label="Menu Selection" className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 no-scrollbar">
          {menus.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={activeMenuId === m.id}
              aria-controls={`menu-panel-${m.id}`}
              onClick={() => setActiveMenuId(m.id)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeMenuId === m.id
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-surface text-text-secondary border border-border-strong hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel" id={`menu-panel-${activeMenuId || ''}`}>
        <h2 className="text-3xl font-extrabold text-primary mb-2">{activeMenu.name}</h2>
        {activeMenu.description && (
          <p className="text-text-secondary mb-6 max-w-2xl">{activeMenu.description}</p>
        )}

        {/* Category Navigation */}
        {activeMenu.categories && activeMenu.categories.length > 0 && (
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md py-4 border-b border-border-strong mb-8 -mx-6 px-6 sm:-mx-12 sm:px-12 lg:-mx-16 lg:px-16 overflow-x-auto no-scrollbar flex gap-3">
            {activeMenu.categories.map((cat) => (
              <a
                key={cat.id}
                href={`#category-${cat.id}`}
                className="whitespace-nowrap px-4 py-2 rounded-lg bg-surface-muted text-text-primary text-sm font-semibold hover:bg-surface-hover hover:text-primary transition-colors border border-transparent hover:border-border-strong"
              >
                {cat.name}
              </a>
            ))}
          </div>
        )}

        <div className="space-y-12">
          {!activeMenu.categories || activeMenu.categories.length === 0 ? (
            <p className="text-text-secondary">No items available in this menu.</p>
          ) : (
            activeMenu.categories.map((cat) => (
              <div key={cat.id} id={`category-${cat.id}`} className="scroll-mt-24">
                <h3 className="text-2xl font-bold text-primary mb-6 border-b border-border pb-2">{cat.name}</h3>
                
                {(!cat.items || cat.items.length === 0) ? (
                  <p className="text-sm text-text-secondary italic">No items currently available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cat.items.map((item) => (
                      <div key={item.id} className="group bg-surface rounded-2xl overflow-hidden border border-border-strong/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all flex flex-col h-full">
                        {item.imageUrl ? (
                          <div className="relative aspect-video w-full bg-surface-muted overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="relative aspect-video w-full bg-surface-muted flex items-center justify-center border-b border-border-strong/50">
                            <span className="text-text-muted/50 font-medium text-sm">No Image</span>
                          </div>
                        )}
                        <div className="p-5 flex flex-col flex-grow">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <h4 className="font-bold text-lg text-primary leading-tight group-hover:text-accent transition-colors break-words">
                              {item.name}
                            </h4>
                            <span className="font-extrabold text-lg text-primary shrink-0">
                              ${(item.price / 100).toFixed(2)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-text-secondary line-clamp-3 mt-1">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-auto pt-4">
                            {item.isActive ? (
                              <button
                                onClick={() => handleAddToCart(item)}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                                  addedItems[item.id]
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-orange-500/20 active:scale-95'
                                }`}
                              >
                                {addedItems[item.id] ? (
                                  <><Check size={18} /> Added</>
                                ) : (
                                  <><Plus size={18} /> Add to Cart</>
                                )}
                              </button>
                            ) : (
                              <div className="w-full text-center px-4 py-3 rounded-xl bg-surface-muted text-text-muted font-medium text-sm border border-border-strong/50">
                                Currently Unavailable
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
