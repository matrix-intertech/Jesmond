"use client";

import { useCart } from "@/providers/CartProvider";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, subtotal, updateQuantity, removeItem } = useCart();
  const router = useRouter();

  return (
    <>
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[120] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-brand-orange rounded-full flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <h2 className="text-xl font-bold text-brand-navy">Your Cart</h2>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-slate-400 hover:text-brand-navy hover:bg-slate-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <ShoppingBag size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-brand-navy">Cart is empty</h3>
                    <p className="text-slate-500 mt-1">Looks like you haven't added anything yet.</p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 px-6 py-2 bg-brand-navy text-white rounded-full font-medium hover:bg-slate-800 transition"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 relative shrink-0">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-brand-navy leading-tight">{item.name}</h4>
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <p className="text-brand-orange font-bold mt-1">
                            ${(item.unitPrice / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                            <button
                              disabled={item.quantity <= 1}
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="p-1.5 text-slate-500 hover:text-brand-navy disabled:opacity-50"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center font-medium text-sm text-brand-navy">
                              {item.quantity}
                            </span>
                            <button
                              disabled={item.quantity >= item.maxQuantity}
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="p-1.5 text-slate-500 hover:text-brand-navy disabled:opacity-50"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {item.quantity >= item.maxQuantity && (
                            <span className="text-xs text-brand-orange font-medium">Max reached</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="text-xl font-bold text-brand-navy">
                    ${(subtotal / 100).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    router.push("/retail/checkout");
                  }}
                  className="w-full py-4 bg-brand-orange text-white rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
