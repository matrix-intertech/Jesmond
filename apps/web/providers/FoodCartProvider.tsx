"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type FoodCartItem = {
  foodMenuItemId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
};

type FoodCartState = {
  branchId: string | null;
  businessName: string | null;
  items: FoodCartItem[];
  subtotal: number;
};

type FoodCartContextType = FoodCartState & {
  addItem: (branchId: string, businessName: string, item: Omit<FoodCartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (foodMenuItemId: string) => void;
  updateQuantity: (foodMenuItemId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
};

const FoodCartContext = createContext<FoodCartContextType | undefined>(undefined);

export function FoodCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FoodCartState>({ branchId: null, businessName: null, items: [], subtotal: 0 });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("jesmond_food_cart");
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse food cart", e);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("jesmond_food_cart", JSON.stringify(state));
    }
  }, [state, isInitialized]);

  const addItem = (branchId: string, businessName: string, item: Omit<FoodCartItem, 'quantity'> & { quantity?: number }) => {
    setState((prev) => {
      let currentItems = prev.items;
      if (prev.branchId !== null && prev.branchId !== branchId) {
        if (!window.confirm("Adding items from a different business will clear your current cart. Continue?")) {
          return prev;
        }
        currentItems = [];
      }

      const existingIndex = currentItems.findIndex(i => i.foodMenuItemId === item.foodMenuItemId);
      let newItems = [...currentItems];
      const addQty = item.quantity || 1;

      if (existingIndex >= 0) {
        const existing = newItems[existingIndex];
        const newQty = existing.quantity + addQty;
        newItems[existingIndex] = { ...existing, quantity: newQty };
      } else {
        newItems.push({ ...item, quantity: addQty });
      }

      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

      setIsCartOpen(true);
      return { branchId, businessName, items: newItems, subtotal };
    });
  };

  const removeItem = (foodMenuItemId: string) => {
    setState((prev) => {
      const newItems = prev.items.filter(i => i.foodMenuItemId !== foodMenuItemId);
      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      return {
        branchId: newItems.length === 0 ? null : prev.branchId,
        businessName: newItems.length === 0 ? null : prev.businessName,
        items: newItems,
        subtotal
      };
    });
  };

  const updateQuantity = (foodMenuItemId: string, quantity: number) => {
    setState((prev) => {
      const newItems = prev.items.map(i => {
        if (i.foodMenuItemId === foodMenuItemId) {
          return { ...i, quantity: Math.max(1, quantity) };
        }
        return i;
      });
      const subtotal = newItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      return { ...prev, items: newItems, subtotal };
    });
  };

  const clearCart = () => {
    setState({ branchId: null, businessName: null, items: [], subtotal: 0 });
  };

  return (
    <FoodCartContext.Provider value={{ ...state, addItem, removeItem, updateQuantity, clearCart, isCartOpen, setIsCartOpen }}>
      {children}
    </FoodCartContext.Provider>
  );
}

export function useFoodCart() {
  const context = useContext(FoodCartContext);
  if (context === undefined) {
    throw new Error("useFoodCart must be used within a FoodCartProvider");
  }
  return context;
}
