"use client";

import { CartProvider } from "@/providers/CartProvider";
import { CartDrawer } from "@/components/retail/CartDrawer";
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function RetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* We reuse the GlobalNav, it is fixed to top, so we add padding */}
        <GlobalNav />
        <div className="pt-[104px] flex-1 flex flex-col">
          {children}
        </div>
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
