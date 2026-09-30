"use client";

import { useCart } from "@/providers/CartProvider";
import { getApiUrl } from "@/utils/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Clock, Store, CheckCircle, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { isAuthenticated, getAccessToken } from "@/utils/auth";
import Image from "next/image";

type BranchDetails = {
 id: string;
 name: string;
 deliveryEnabled: boolean;
 takeawayEnabled: boolean;
 isActive?: boolean;
};

export default function CheckoutPage() {
 const { items, branchId, subtotal, clearCart } = useCart();
 const router = useRouter();

 const [branch, setBranch] = useState<BranchDetails | null>(null);
 const [loading, setLoading] = useState(true);
 const [fulfillment, setFulfillment] = useState<'DELIVERY' | 'TAKEAWAY' | 'IN_STORE'>('IN_STORE');

 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
 // 1. Auth Check
 if (!isAuthenticated()) {
 router.push(`/login?redirect=/retail/checkout`);
 return;
 }

 // 2. Empty Cart Check
 if (!branchId || items.length === 0) {
 router.push('/retail');
 return;
 }

 // 3. Fetch branch capabilities
 const fetchBranch = async () => {
 try {
 const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/stores/${branchId}/catalog`);
 if (res.ok) {
 const data = await res.json();
 setBranch(data.branch);
 if (data.branch.isActive === false) {
 setError("Store is currently unavailable. Please remove items from your cart.");
 }
 // Set default fulfillment securely based on actual branch capabilities
 if (data.branch.deliveryEnabled) setFulfillment('DELIVERY');
 else if (data.branch.takeawayEnabled) setFulfillment('TAKEAWAY');
 else setFulfillment('IN_STORE');
 } else {
 setError("Store is currently unavailable.");
 }
 } catch (err) {
 setError("Network error fetching store details.");
 } finally {
 setLoading(false);
 }
 };

 fetchBranch();
 }, [branchId, items, router]);

 const handleCheckout = async () => {
 setSubmitting(true);
 setError("");

 try {
 const token = getAccessToken();
 const payload = {
 branchId,
 fulfillmentType: fulfillment,
 items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
 };

 const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/checkout`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify(payload)
 });

 if (res.ok) {
 const order = await res.json();
 clearCart();
 router.push(`/retail/order/${order.id}`);
 } else {
 const errData = await res.json();
 setError(errData.message || "Checkout failed. Items might be out of stock.");
 }
 } catch (err) {
 setError("Network error during checkout.");
 } finally {
 setSubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="flex-1 flex items-center justify-center min-h-[50vh]">
 <Loader2 className="animate-spin text-accent" size={48} />
 </div>
 );
 }

 if (!branch || items.length === 0) return null;

 const deliveryFee = fulfillment === 'DELIVERY' ? 500 : 0; // Flat $5 matching backend
 const total = subtotal + deliveryFee;

 return (
 <div className="flex-1 max-w-[1000px] w-full mx-auto px-6 sm:px-12 py-12">
 <Link href={`/retail/store/${branchId}`} className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors font-medium mb-8">
 <ArrowLeft size={18} /> Back to Catalog
 </Link>

 <div className="flex items-center gap-4 mb-10">
 <div className="w-12 h-12 bg-surface-muted text-accent rounded-xl flex items-center justify-center">
 <CheckCircle size={24} />
 </div>
 <div>
 <h1 className="text-3xl font-extrabold text-primary">Secure Checkout</h1>
 <p className="text-text-secondary font-medium">{branch.name}</p>
 </div>
 </div>

 {error && (
 <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
 <AlertTriangle className="shrink-0 mt-0.5" size={20} />
 <div>
 <h4 className="font-bold">Checkout Failed</h4>
 <p className="text-sm mt-1">{error}</p>
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
 {/* Left Col: Fulfillment & Items */}
 <div className="lg:col-span-2 space-y-10">

 <section>
 <h2 className="text-xl font-bold text-primary mb-4">How would you like your order?</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {branch.deliveryEnabled && (
 <label className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${fulfillment === 'DELIVERY' ? 'border-accent bg-surface-orange' : 'border-border-strong hover:border-border-strong bg-surface'}`}>
 <input type="radio" name="fulfillment" className="sr-only" checked={fulfillment === 'DELIVERY'} onChange={() => setFulfillment('DELIVERY')} />
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 text-primary font-bold">
 <Navigation size={18} className={fulfillment === 'DELIVERY' ? 'text-accent' : 'text-text-muted'} />
 Delivery
 </div>
 {fulfillment === 'DELIVERY' && <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white"><CheckCircle size={12} strokeWidth={4} /></div>}
 </div>
 <p className="text-sm text-text-secondary font-medium">Delivered to your room or flat</p>
 </label>
 )}

 {branch.takeawayEnabled && (
 <label className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${fulfillment === 'TAKEAWAY' ? 'border-accent bg-surface-orange' : 'border-border-strong hover:border-border-strong bg-surface'}`}>
 <input type="radio" name="fulfillment" className="sr-only" checked={fulfillment === 'TAKEAWAY'} onChange={() => setFulfillment('TAKEAWAY')} />
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 text-primary font-bold">
 <Clock size={18} className={fulfillment === 'TAKEAWAY' ? 'text-accent' : 'text-text-muted'} />
 Takeaway
 </div>
 {fulfillment === 'TAKEAWAY' && <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white"><CheckCircle size={12} strokeWidth={4} /></div>}
 </div>
 <p className="text-sm text-text-secondary font-medium">Pick up from {branch.name}</p>
 </label>
 )}

 {!branch.deliveryEnabled && !branch.takeawayEnabled && (
 <label className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all border-accent bg-surface-orange`}>
 <input type="radio" name="fulfillment" className="sr-only" checked={true} readOnly />
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 text-primary font-bold">
 <Store size={18} className="text-accent" />
 In-Store Only
 </div>
 <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white"><CheckCircle size={12} strokeWidth={4} /></div>
 </div>
 <p className="text-sm text-text-secondary font-medium">Purchase at {branch.name}</p>
 </label>
 )}
 </div>
 </section>

 <section>
 <h2 className="text-xl font-bold text-primary mb-4">Order Items</h2>
 <div className="bg-surface rounded-3xl border border-border-strong overflow-hidden shadow-sm">
 <ul className="divide-y divide-slate-100">
 {items.map((item) => (
 <li key={item.productId} className="p-4 sm:p-6 flex items-center gap-4">
 <div className="w-16 h-16 rounded-xl bg-surface-muted overflow-hidden relative shrink-0">
 <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
 </div>
 <div className="flex-1">
 <h4 className="font-bold text-primary line-clamp-1">{item.name}</h4>
 <p className="text-sm text-text-secondary">Qty: {item.quantity}</p>
 </div>
 <div className="text-right">
 <span className="font-extrabold text-primary">
 ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
 </span>
 </div>
 </li>
 ))}
 </ul>
 </div>
 </section>

 </div>

 {/* Right Col: Summary */}
 <div>
 <div className="bg-primary text-white rounded-3xl p-6 sm:p-8 sticky top-[120px] shadow-2xl shadow-brand-navy/20">
 <h3 className="text-xl font-bold mb-6">Order Summary</h3>

 <div className="space-y-4 mb-6 text-text-muted font-medium">
 <div className="flex justify-between">
 <span>Subtotal</span>
 <span className="text-white">${(subtotal / 100).toFixed(2)}</span>
 </div>
 {fulfillment === 'DELIVERY' && (
 <div className="flex justify-between">
 <span>Delivery Fee</span>
 <span className="text-white">${(deliveryFee / 100).toFixed(2)}</span>
 </div>
 )}
 </div>

 <div className="pt-6 border-t border-primary/50 mb-8 flex justify-between items-center">
 <span className="text-lg text-text-muted font-medium">Total</span>
 <span className="text-3xl font-extrabold text-accent">
 ${(total / 100).toFixed(2)}
 </span>
 </div>

 <button
 onClick={handleCheckout}
 disabled={submitting || branch.isActive === false}
 className="w-full py-4 bg-accent hover:bg-accent text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-orange-500/25 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
 >
 {submitting ? (
 <><Loader2 className="animate-spin" size={20} /> Processing...</>
 ) : (
 'Place Order securely'
 )}
 </button>
 <p className="text-center text-xs text-text-muted mt-4">
 By placing this order, you agree to Jesmond's Terms of Sale.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
