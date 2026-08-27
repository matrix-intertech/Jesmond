"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export default function POSPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  
  // Manual add item state
  const [addId, setAddId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addQty, setAddQty] = useState("1");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addId || !addPrice || !addQty) return;
    
    const item = {
      productId: addId,
      quantity: parseInt(addQty),
      unitPrice: Math.round(parseFloat(addPrice) * 100),
    };

    setCart([...cart, item]);
    setAddId("");
    setAddPrice("");
    setAddQty("1");
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !branchId) {
      setError("Branch ID and at least one item are required to checkout.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");
    
    const token = getAccessToken();
    try {
      const payload: any = {
        branchId,
        items: cart,
      };
      if (terminalId) payload.terminalId = terminalId;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        setSuccess("Order placed successfully!");
        setCart([]);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Checkout failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const totalCents = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 -m-2 p-2">
      {/* Left Area: Product Search / Add */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-brand-navy">POS Product Grid (Disabled)</h2>
        </div>
        <div className="p-6 flex-1 flex flex-col">
          <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 text-sm">
            <strong>API Limitation:</strong> The backend does not support fetching products. Please add items manually below using exact Product IDs.
          </div>
          
          <form onSubmit={handleAddItem} className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-brand-navy">Manual Item Entry</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product ID</label>
              <input required type="text" value={addId} onChange={e => setAddId(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm font-mono" placeholder="Enter valid UUID" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
                <input required type="number" step="0.01" min="0" value={addPrice} onChange={e => setAddPrice(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                <input required type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm" />
              </div>
            </div>
            <button type="submit" className="w-full py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition">
              Add to Cart
            </button>
          </form>
        </div>
      </div>

      {/* Right Area: Cart & Checkout */}
      <div className="w-full md:w-96 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-brand-navy text-white rounded-t-xl">
          <h2 className="text-lg font-bold">Current Sale</h2>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Cart is empty
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.map((item, idx) => (
                <li key={idx} className="bg-white p-3 rounded shadow-sm border border-slate-100 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold text-brand-navy truncate w-32" title={item.productId}>{item.productId}</span>
                    <span className="text-xs text-slate-500">Qty: {item.quantity}</span>
                  </div>
                  <span className="font-medium text-brand-navy">${(item.unitPrice / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 space-y-4">
          <div className="flex justify-between items-center font-bold text-lg text-brand-navy">
            <span>Total</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <input required type="text" value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm font-mono" placeholder="Branch ID (Required)" />
            <input type="text" value={terminalId} onChange={e => setTerminalId(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm font-mono" placeholder="Terminal ID (Optional)" />
          </div>

          {error && <div className="p-2 bg-rose-50 text-rose-700 rounded text-xs">{error}</div>}
          {success && <div className="p-2 bg-emerald-50 text-emerald-700 rounded text-xs">{success}</div>}

          <button 
            onClick={handleCheckout} 
            disabled={loading || cart.length === 0}
            className="w-full py-4 bg-brand-orange text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-lg shadow-sm"
          >
            {loading ? 'Processing...' : 'Charge'}
          </button>
        </div>
      </div>
    </div>
  );
}
