"use client";

import { useFoodCart } from "@/providers/FoodCartProvider";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { isAuthenticated, getAccessToken } from "@/utils/auth";
import Image from "next/image";

export default function FoodCheckoutPage() {
  const { items, branchId, subtotal, clearCart, businessName } = useFoodCart();
  const router = useRouter();

  const [fulfillmentType, setFulfillmentType] = useState<"TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [address, setAddress] = useState({
    name: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const idempotencyKeyRef = useRef<string>(
    `food_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/food/checkout`);
      return;
    }

    if (!branchId || items.length === 0) {
      router.push('/businesses');
      return;
    }
  }, [branchId, items, router]);

  const handlePlaceOrder = async () => {
    if (submitting) return;

    if (fulfillmentType === 'DELIVERY') {
      if (!address.name || !address.phone || !address.addressLine1 || !address.city || !address.postalCode) {
        setError("Please fill in all required delivery fields.");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const token = getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const payload = {
        branchId,
        fulfillmentType,
        deliveryAddress: fulfillmentType === 'DELIVERY' ? address : undefined,
        items: items.map(i => ({
          foodMenuItemId: i.foodMenuItemId,
          quantity: i.quantity,
        })),
      };

      const res = await fetch(`${apiUrl}/api/v1/food/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const order = await res.json();
        clearCart();
        router.push(`/food/orders/${order.id}/confirmation`);
      } else {
        const errData = await res.json().catch(() => ({ message: 'Checkout failed.' }));
        setError(errData.message || "Failed to place order. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!branchId || items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  const total = subtotal;

  return (
    <div className="flex-1 max-w-[1000px] w-full mx-auto px-6 sm:px-12 py-12">
      <Link href={`/businesses/store/${branchId}`} className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors font-medium mb-8">
        <ArrowLeft size={18} /> Back to Menu
      </Link>

      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-surface-muted text-accent rounded-xl flex items-center justify-center">
          <CheckCircle size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-primary">Food Checkout</h1>
          {businessName && <p className="text-text-secondary font-medium">{businessName}</p>}
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
          <AlertTriangle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold">Error</h4>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h2 className="text-xl font-bold text-primary mb-4">Fulfillment</h2>
            <div className="bg-surface rounded-3xl border border-border-strong overflow-hidden shadow-sm p-6 space-y-6">
              <div className="flex gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="fulfillment" checked={fulfillmentType === 'TAKEAWAY'} onChange={() => setFulfillmentType('TAKEAWAY')} className="w-5 h-5 text-accent" />
                  <span className="font-medium text-primary">Takeaway</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="fulfillment" checked={fulfillmentType === 'DELIVERY'} onChange={() => setFulfillmentType('DELIVERY')} className="w-5 h-5 text-accent" />
                  <span className="font-medium text-primary">Delivery</span>
                </label>
              </div>

              {fulfillmentType === 'DELIVERY' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-strong/50">
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full" placeholder="Name *" value={address.name} onChange={e => setAddress({...address, name: e.target.value})} />
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full" placeholder="Phone *" value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} />
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full sm:col-span-2" placeholder="Address Line 1 *" value={address.addressLine1} onChange={e => setAddress({...address, addressLine1: e.target.value})} />
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full sm:col-span-2" placeholder="Address Line 2 (Optional)" value={address.addressLine2} onChange={e => setAddress({...address, addressLine2: e.target.value})} />
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full" placeholder="City *" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                  <input className="px-4 py-3 bg-surface-muted rounded-xl border border-border-strong focus:outline-none focus:border-accent w-full" placeholder="Postal Code *" value={address.postalCode} onChange={e => setAddress({...address, postalCode: e.target.value})} />
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-4">Order Items</h2>
            <div className="bg-surface rounded-3xl border border-border-strong overflow-hidden shadow-sm">
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.foodMenuItemId} className="p-4 sm:p-6 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-surface-muted overflow-hidden relative shrink-0">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">No Image</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-primary line-clamp-1">{item.name}</h4>
                      <p className="text-sm text-text-secondary">Qty: {item.quantity} × ${(item.unitPrice / 100).toFixed(2)}</p>
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

          <section className="bg-surface-muted rounded-2xl p-6 border border-border-strong/50">
            <p className="text-sm text-text-secondary">
              <strong>Note:</strong> Payment is not required online. 
              Payment method for this order will be <span className="font-bold">{fulfillmentType === 'DELIVERY' ? 'CASH ON DELIVERY' : 'CASH AT TAKEAWAY'}</span>.
            </p>
          </section>
        </div>

        <div>
          <div className="bg-primary text-white rounded-3xl p-6 sm:p-8 sticky top-[120px] shadow-2xl shadow-brand-navy/20">
            <h3 className="text-xl font-bold mb-6">Order Summary</h3>

            <div className="space-y-4 mb-6 text-text-muted font-medium">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-white">${(subtotal / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-primary/50 mb-8 flex justify-between items-center">
              <span className="text-lg text-text-muted font-medium">Total</span>
              <span className="text-3xl font-extrabold text-accent">
                ${(total / 100).toFixed(2)}
              </span>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="w-full py-4 bg-accent hover:bg-accent text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-orange-500/25 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="animate-spin" size={20} /> Placing Order...</>
              ) : (
                'Place Order'
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
