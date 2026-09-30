"use client";

import { useCart } from "@/providers/CartProvider";
import Image from "next/image";
import { Plus, Check, AlertCircle } from "lucide-react";
import { useState } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  sellingPrice: number;
};

type Inventory = {
  productId: string;
  quantity: number;
  reservedQuantity: number;
  product: Product;
};

export function ProductCard({ inventory, branchId, storeIsActive = true }: { inventory: Inventory, branchId: string, storeIsActive?: boolean }) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);

  const product = inventory.product;
  const availableQty = inventory.quantity - inventory.reservedQuantity;

  // Find if already in cart to determine max addition
  const cartItem = items.find(i => i.productId === product.id);
  const qtyInCart = cartItem ? cartItem.quantity : 0;

  const canAdd = storeIsActive && availableQty > qtyInCart;

  const handleAdd = () => {
    if (!canAdd) return;

    addItem(branchId, {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl, // Image is mandatory per Phase 1 backend implementation
      unitPrice: product.sellingPrice,
      maxQuantity: availableQty,
      quantity: 1
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-strong/60 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
      <div className="relative aspect-square w-full bg-surface-muted overflow-hidden">
        {/* Backend enforces imageUrl to not be null, but we defensively fall back if needed */}
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted flex-col gap-2">
            <AlertCircle size={24} />
            <span className="text-xs font-medium uppercase tracking-wider">No Image</span>
          </div>
        )}

        {availableQty <= 5 && availableQty > 0 && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-md">
            Only {availableQty} left
          </div>
        )}

        {!storeIsActive ? (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="px-4 py-1.5 bg-surface-muted text-white text-sm font-bold uppercase tracking-wider rounded-full shadow-lg">
              Currently Unavailable
            </div>
          </div>
        ) : availableQty <= 0 && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="px-4 py-1.5 bg-surface-muted text-white text-sm font-bold uppercase tracking-wider rounded-full shadow-lg">
              Out of stock
            </div>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h4 className="font-bold text-primary text-lg leading-tight line-clamp-2 mb-1">
          {product.name}
        </h4>
        <p className="text-text-muted text-xs font-medium mb-4">{product.sku}</p>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-xl font-extrabold text-accent">
            ${(product.sellingPrice / 100).toFixed(2)}
          </span>

          <button
            onClick={handleAdd}
            disabled={!canAdd || availableQty <= 0 || !storeIsActive}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              added
                ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                : canAdd
                  ? "bg-primary text-white hover:bg-accent hover:shadow-lg hover:shadow-orange-500/20 active:scale-95"
                  : "bg-surface-muted text-text-muted cursor-not-allowed"
            }`}
          >
            {added ? <Check size={18} /> : <Plus size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
