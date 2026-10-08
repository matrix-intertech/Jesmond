"use client";

import { FoodCartProvider } from "@/providers/FoodCartProvider";
import { FoodCartDrawer } from "@/components/food/FoodCartDrawer";
import { GlobalNav } from "@/components/marketing/GlobalNav";

export default function FoodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FoodCartProvider>
      <div className="min-h-screen bg-surface-lavender flex flex-col">
        <GlobalNav />
        <div className="pt-[104px] flex-1 flex flex-col">
          {children}
        </div>
        <FoodCartDrawer />
      </div>
    </FoodCartProvider>
  );
}
