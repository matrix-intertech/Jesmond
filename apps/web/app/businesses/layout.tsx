"use client";

import { CartProvider } from "@/providers/CartProvider";
import { FoodCartProvider } from "@/providers/FoodCartProvider";
import { CartDrawer } from "@/components/retail/CartDrawer";
import { FoodCartDrawer } from "@/components/food/FoodCartDrawer";
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function RetailLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
 <CartProvider>
 <FoodCartProvider>
 <div className="min-h-screen bg-surface-lavender flex flex-col">
 {/* We reuse the GlobalNav, it is fixed to top, so we add padding */}
 <GlobalNav />
 <div className="pt-[104px] flex-1 flex flex-col">
 {children}
 </div>
 <CartDrawer />
 <FoodCartDrawer />
 </div>
 </FoodCartProvider>
 </CartProvider>
 );
}
