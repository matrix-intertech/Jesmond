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
 className="fixed inset-0 bg-surface-muted/40 backdrop-blur-sm z-[110]"
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
 className="fixed top-0 right-0 h-full w-full max-w-md bg-surface shadow-2xl z-[120] flex flex-col"
 >
 <div className="flex items-center justify-between p-6 border-b border-border-subtle">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-surface-orange text-accent rounded-full flex items-center justify-center">
 <ShoppingBag size={20} />
 </div>
 <h2 className="text-xl font-bold text-primary">Your Cart</h2>
 </div>
 <button
 onClick={() => setIsCartOpen(false)}
 className="p-2 text-text-muted hover:text-primary hover:bg-surface-lavender rounded-full transition-colors"
 >
 <X size={20} />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
 {items.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
 <div className="w-20 h-20 bg-surface-lavender rounded-full flex items-center justify-center text-text-muted">
 <ShoppingBag size={32} />
 </div>
 <div>
 <h3 className="text-lg font-semibold text-primary">Cart is empty</h3>
 <p className="text-text-secondary mt-1">Looks like you haven't added anything yet.</p>
 </div>
 <button
 onClick={() => setIsCartOpen(false)}
 className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-surface-muted transition"
 >
 Continue Shopping
 </button>
 </div>
 ) : (
 <div className="space-y-6">
 {items.map((item) => (
 <div key={item.productId} className="flex gap-4">
 <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-muted relative shrink-0">
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
 <h4 className="font-semibold text-primary leading-tight">{item.name}</h4>
 <button
 onClick={() => removeItem(item.productId)}
 className="text-text-muted hover:text-red-500 transition-colors"
 >
 <X size={16} />
 </button>
 </div>
 <p className="text-accent font-bold mt-1">
 ${(item.unitPrice / 100).toFixed(2)}
 </p>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center bg-surface-lavender rounded-lg border border-border-strong">
 <button
 disabled={item.quantity <= 1}
 onClick={() => updateQuantity(item.productId, item.quantity - 1)}
 className="p-1.5 text-text-secondary hover:text-primary disabled:opacity-50"
 >
 <Minus size={14} />
 </button>
 <span className="w-8 text-center font-medium text-sm text-primary">
 {item.quantity}
 </span>
 <button
 disabled={item.quantity >= item.maxQuantity}
 onClick={() => updateQuantity(item.productId, item.quantity + 1)}
 className="p-1.5 text-text-secondary hover:text-primary disabled:opacity-50"
 >
 <Plus size={14} />
 </button>
 </div>
 {item.quantity >= item.maxQuantity && (
 <span className="text-xs text-accent font-medium">Max reached</span>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {items.length > 0 && (
 <div className="p-6 bg-surface border-t border-border-subtle shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
 <div className="flex items-center justify-between mb-6">
 <span className="text-text-secondary font-medium">Subtotal</span>
 <span className="text-xl font-bold text-primary">
 ${(subtotal / 100).toFixed(2)}
 </span>
 </div>
 <button
 onClick={() => {
 setIsCartOpen(false);
 router.push("/retail/checkout");
 }}
 className="w-full py-4 bg-accent text-white rounded-xl font-bold text-lg hover:bg-accent transition-colors shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2"
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
