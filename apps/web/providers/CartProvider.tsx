"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
};

type CartState = {
  branchId: string | null;
  items: CartItem[];
  subtotal: number;
};

type CartContextType = CartState & {
  addItem: (branchId: string, item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ branchId: null, items: [], subtotal: 0 });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("jesmond_retail_cart");
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save to local storage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("jesmond_retail_cart", JSON.stringify(state));
    }
  }, [state, isInitialized]);

  const addItem = (branchId: string, item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setState((prev) => {
      // If adding from a different branch, clear cart first
      let currentItems = prev.items;
      if (prev.branchId !== null && prev.branchId !== branchId) {
        if (!window.confirm("Adding items from a different store will clear your current cart. Continue?")) {
          return prev;
        }
        currentItems = [];
      }

      const existingIndex = currentItems.findIndex(i => i.productId === item.productId);
      let newItems = [...currentItems];
      const addQty = item.quantity || 1;

      if (existingIndex >= 0) {
        const existing = newItems[existingIndex];
        const newQty = Math.min(existing.quantity + addQty, existing.maxQuantity);
        newItems[existingIndex] = { ...existing, quantity: newQty };
      } else {
        newItems.push({ ...item, quantity: addQty });
      }

      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

      setIsCartOpen(true); // Open cart when item is added
      return { branchId, items: newItems, subtotal };
    });
  };

  const removeItem = (productId: string) => {
    setState((prev) => {
      const newItems = prev.items.filter(i => i.productId !== productId);
      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      return {
        branchId: newItems.length === 0 ? null : prev.branchId,
        items: newItems,
        subtotal
      };
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setState((prev) => {
      const newItems = prev.items.map(i => {
        if (i.productId === productId) {
          return { ...i, quantity: Math.min(Math.max(1, quantity), i.maxQuantity) };
        }
        return i;
      });
      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      return { ...prev, items: newItems, subtotal };
    });
  };

  const clearCart = () => {
    setState({ branchId: null, items: [], subtotal: 0 });
  };

  // Prevent hydration mismatch by returning null until initialized if needed,
  // but to prevent layout shift, just render children.

  return (
    <CartContext.Provider value={{ ...state, addItem, removeItem, updateQuantity, clearCart, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
