"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number; // in cents
  isActive: boolean;
  category: Category | null;
  quantity: number; // stock quantity
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // in cents
  availableStock: number;
  sku: string;
}

interface PosTerminal {
  id: string;
  name: string;
  externalId: string | null;
  provider: string | null;
  branchId: string;
}

export default function POSPage() {
  const router = useRouter();
  
  // State
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchName, setBranchName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [terminals, setTerminals] = useState<PosTerminal[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT_CARD">("CASH");
  const [amountReceived, setAmountReceived] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");

  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"IDLE" | "WAITING" | "PAID" | "FAILED">("IDLE");
  const [providerRequestId, setProviderRequestId] = useState("");

  // Fetch branches for the authenticated user's organization
  const fetchBranches = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        if (data.length > 0 && !branchId) {
          setBranchId(data[0].id);
          setBranchName(data[0].name);
        }
      }
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  };

  // Fetch terminals list
  const fetchTerminals = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/terminals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTerminals(data);
      }
    } catch (e) {
      console.error("Failed to load terminals", e);
    }
  };

  // Fetch catalog products for the selected branch
  const fetchCatalog = async (branch: string) => {
    if (!branch) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError("");
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/catalog?branchId=${branch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'Failed to fetch catalog');
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
        }
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchTerminals();
  }, []);

  useEffect(() => {
    fetchCatalog(branchId);
    setCart([]); // Clear cart when branch changes
  }, [branchId]);

  // Extract unique categories from loaded products
  const categories = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category?.name) {
        list.add(p.category.name);
      }
    });
    return ["All", ...Array.from(list)];
  }, [products]);

  // Filter products by search query and category tab selection
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Category filter
      if (selectedCategory !== "All" && p.category?.name !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesSku && !matchesBarcode) {
          return false;
        }
      }
      return true;
    });
  }, [products, searchQuery, selectedCategory]);

  // Filter terminals for current branch
  const branchTerminals = useMemo(() => {
    return terminals.filter(t => t.branchId === branchId);
  }, [terminals, branchId]);

  useEffect(() => {
    if (branchTerminals.length > 0) {
      setSelectedTerminalId(branchTerminals[0].id);
    } else {
      setSelectedTerminalId("");
    }
  }, [branchTerminals]);

  // Add a product to the cart
  const handleAddToCart = (product: Product) => {
    if (product.quantity <= 0) return; // Disallow out-of-stock items

    setCart(prevCart => {
      const existing = prevCart.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          setError(`Cannot add more. Only ${product.quantity} items are available in stock.`);
          return prevCart;
        }
        setError("");
        return prevCart.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      setError("");
      return [
        ...prevCart,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice,
          availableStock: product.quantity,
          sku: product.sku
        }
      ];
    });
  };

  // Adjust cart item quantity directly
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.productId !== productId) return item;
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null; // Filters out items with quantity <= 0
        if (newQty > item.availableStock) {
          setError(`Cannot adjust. Only ${item.availableStock} items are available in stock.`);
          return item;
        }
        setError("");
        return { ...item, quantity: newQty };
      }).filter((item): item is CartItem => item !== null);
    });
  };

  const totalCents = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  // Trigger checkout drawer
  const openCheckoutFlow = () => {
    if (cart.length === 0) {
      setError("Add at least one item to cart to checkout.");
      return;
    }
    setError("");
    setCheckoutError("");
    setCheckoutSuccess("");
    setAmountReceived("");
    setPaymentMethod("CASH");
    setPaymentStatus("IDLE");
    setCurrentOrder(null);
    setProviderRequestId(`req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    setCheckoutOpen(true);
  };

  // Initiate backend order creation & checkout
  const handleCheckoutSubmit = async () => {
    setCheckoutLoading(true);
    setCheckoutError("");
    setCheckoutSuccess("");

    const token = getAccessToken();
    const payload: any = {
      branchId,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      paymentMethod,
      providerRequestId
    };

    if (paymentMethod === "CASH") {
      const centsReceived = Math.round(parseFloat(amountReceived) * 100);
      if (isNaN(centsReceived) || centsReceived < totalCents) {
        setCheckoutError("Cash received must be equal to or greater than the total amount.");
        setCheckoutLoading(false);
        return;
      }
      payload.amountReceived = centsReceived;
    } else {
      if (!selectedTerminalId) {
        setCheckoutError("A terminal must be selected for card transactions.");
        setCheckoutLoading(false);
        return;
      }
      payload.terminalId = selectedTerminalId;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const order = await res.json();
        setCurrentOrder(order);
        if (paymentMethod === "CASH") {
          setPaymentStatus("PAID");
          setCheckoutSuccess("Sale Completed successfully!");
          setCart([]);
          fetchCatalog(branchId);
        } else {
          setPaymentStatus("WAITING");
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setCheckoutError(errJson.message || "Failed to create order");
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Network error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Cancel checkout and rollback inventory
  const handleCancelCheckout = async () => {
    if (!currentOrder) {
      setCheckoutOpen(false);
      return;
    }

    setCheckoutLoading(true);
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${currentOrder.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCheckoutOpen(false);
        setCurrentOrder(null);
        setPaymentStatus("IDLE");
        fetchCatalog(branchId);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setCheckoutError(errJson.message || "Failed to cancel order");
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Network error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Retry card payment
  const handleRetryPayment = async () => {
    if (!currentOrder) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    const newRequestId = `req_retry_${Date.now()}`;
    const token = getAccessToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/payments/retry`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId: currentOrder.id,
          paymentMethod,
          terminalId: selectedTerminalId,
          providerRequestId: newRequestId
        })
      });

      if (res.ok) {
        setPaymentStatus("WAITING");
        setProviderRequestId(newRequestId);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setCheckoutError(errJson.message || "Payment retry failed");
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Network error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Polling order status to detect webhook completion (max 5 minutes)
  useEffect(() => {
    if (paymentStatus !== "WAITING" || !currentOrder) return;

    const MAX_POLL_MS = 5 * 60 * 1000; // 5 minutes
    const startedAt = Date.now();

    let intervalId = setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setPaymentStatus("FAILED");
        setCheckoutError("Payment confirmation timed out. Please contact support or retry.");
        clearInterval(intervalId);
        return;
      }

      const token = getAccessToken();
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/retail/orders/${currentOrder.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const order = await res.json();
          setCurrentOrder(order);
          if (order.status === "COMPLETED") {
            setPaymentStatus("PAID");
            setCheckoutSuccess("Card payment succeeded!");
            setCart([]);
            fetchCatalog(branchId);
            clearInterval(intervalId);
          } else {
            const hasFailedPayment = order.payments?.some((p: any) => p.status === "FAILED");
            if (hasFailedPayment) {
              setPaymentStatus("FAILED");
              setCheckoutError("Terminal reported card transaction failure.");
              clearInterval(intervalId);
            }
          }
        }
      } catch (e) {
        console.error("Error polling order status", e);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [paymentStatus, currentOrder]);

  /**
   * SANDBOX SIMULATOR
   * Posts to the dedicated backend sandbox endpoint which generates valid
   * provider HMAC signatures internally and routes through the real
   * processWebhook service. No fake signatures are sent from the browser.
   * This endpoint is blocked in production (NODE_ENV=production → 403).
   */
  const handleSimulateWebhook = async (success: boolean) => {
    if (!currentOrder || !currentOrder.payments || currentOrder.payments.length === 0) return;
    const payment = currentOrder.payments[currentOrder.payments.length - 1];
    const provider = payment.provider || "STRIPE";
    const transactionId = payment.transactionId || "";
    const token = getAccessToken();

    if (!transactionId) {
      setCheckoutError("No transaction ID available to simulate webhook.");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/retail/pos/sandbox/simulate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ provider, transactionId, success }),
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setCheckoutError(errJson.message || "Failed to trigger sandbox webhook");
      }
    } catch (e: any) {
      setCheckoutError(e.message || "Network error sending simulation");
    }
  };

  const cashReceivedVal = parseFloat(amountReceived);
  const changeDue = !isNaN(cashReceivedVal) ? cashReceivedVal - (totalCents / 100) : 0;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 -m-2 p-2 bg-slate-50 relative">
      {/* Left Area: Product Selector / Catalog */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Header with Search and Branch Selection */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <h2 className="text-lg font-bold text-brand-navy whitespace-nowrap">Catalog POS</h2>
            <select
              value={branchId}
              onChange={(e) => {
                const selected = branches.find(b => b.id === e.target.value);
                setBranchId(e.target.value);
                setBranchName(selected?.name || '');
              }}
              className="text-sm font-semibold text-brand-navy border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:ring-1 focus:ring-brand-orange focus:border-brand-orange cursor-pointer"
            >
              {branches.length === 0 ? (
                <option value="">Loading branches...</option>
              ) : (
                branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm text-slate-800 bg-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Category filtering tabs */}
        {products.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-100 flex gap-2 overflow-x-auto bg-white">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-brand-navy text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Catalog Grid Area */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 h-36">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4 pt-4"></div>
                </div>
              ))}
            </div>
          ) : !branchId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Select a branch to start selling.</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="font-semibold text-brand-navy">No products available for this branch.</h3>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>No products match your search.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const isOutOfStock = product.quantity <= 0;
                const isLowStock = !isOutOfStock && product.quantity <= 10;
                return (
                  <div
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className={`border rounded-xl p-4 flex flex-col justify-between h-36 transition shadow-sm cursor-pointer hover:border-brand-orange hover:shadow-md ${
                      isOutOfStock ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-brand-navy text-sm line-clamp-2" title={product.name}>
                          {product.name}
                        </h4>
                      </div>
                      <p className="text-slate-400 text-xs font-semibold mt-1">SKU: {product.sku}</p>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <span className="font-bold text-brand-navy">${(product.sellingPrice / 100).toFixed(2)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isOutOfStock ? 'bg-rose-100 text-rose-800' :
                        isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isOutOfStock ? 'Out of stock' :
                         isLowStock ? `Low Stock (${product.quantity})` : `In stock (${product.quantity})`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Cart & Checkout Sidebar */}
      <div className="w-full md:w-96 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-brand-navy text-white rounded-t-xl">
          <h2 className="text-lg font-bold">Current Sale</h2>
        </div>
        
        {/* Cart Item list */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Cart is empty
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.map((item) => (
                <li key={item.productId} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-semibold text-xs text-brand-navy truncate" title={item.productName}>
                      {item.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">SKU: {item.sku}</span>
                    <span className="text-xs text-brand-navy font-bold mt-1">
                      ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold text-brand-navy min-w-[20px] text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Total & Checkout trigger button */}
        <div className="p-4 border-t border-slate-200 space-y-4">
          <div className="flex justify-between items-center font-bold text-lg text-brand-navy">
            <span>Total</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>

          {error && <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold border border-rose-100">{error}</div>}

          <button
            onClick={openCheckoutFlow}
            disabled={cart.length === 0}
            className="w-full py-4 bg-brand-orange text-white font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-lg shadow-sm"
          >
            Review & Pay
          </button>
        </div>
      </div>

      {/* Checkout Drawer / Modal Overlay */}
      {checkoutOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="p-6 bg-brand-navy text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">POS Checkout</h3>
                <p className="text-xs text-slate-300">Authorize and complete the transaction</p>
              </div>
              <button
                onClick={handleCancelCheckout}
                className="text-slate-200 hover:text-white text-sm font-semibold bg-slate-800 px-3 py-1.5 rounded-lg transition"
              >
                Close / Cancel
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Grand Total Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Amount Due</span>
                <span className="text-3xl font-black text-brand-navy">${(totalCents / 100).toFixed(2)}</span>
              </div>

              {paymentStatus === "IDLE" && (
                <>
                  {/* Select Payment Method */}
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-brand-navy">Choose Payment Method</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setPaymentMethod("CASH")}
                        className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${
                          paymentMethod === "CASH"
                            ? "border-brand-orange bg-orange-50/50 text-brand-orange font-bold shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                        }`}
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>CASH</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod("CREDIT_CARD")}
                        className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition ${
                          paymentMethod === "CREDIT_CARD"
                            ? "border-brand-orange bg-orange-50/50 text-brand-orange font-bold shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                        }`}
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span>CARD / EFTPOS</span>
                      </button>
                    </div>
                  </div>

                  {/* CASH Workflow Inputs */}
                  {paymentMethod === "CASH" && (
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-brand-navy">Amount Received ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-lg font-bold"
                          placeholder="e.g. 50.00"
                        />
                      </div>

                      {changeDue >= 0 && amountReceived && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center text-emerald-800 font-bold text-sm">
                          <span>Change to Customer:</span>
                          <span className="text-lg">${changeDue.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD Workflow Inputs */}
                  {paymentMethod === "CREDIT_CARD" && (
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-brand-navy">Select Terminal</label>
                        {branchTerminals.length === 0 ? (
                          <div className="p-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-100">
                            No active POS terminals registered for this branch. Create a terminal under settings or choose cash.
                          </div>
                        ) : (
                          <select
                            value={selectedTerminalId}
                            onChange={(e) => setSelectedTerminalId(e.target.value)}
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-orange focus:ring-brand-orange text-sm cursor-pointer"
                          >
                            {branchTerminals.map(term => (
                              <option key={term.id} value={term.id}>
                                {term.name} ({term.provider})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs p-3 rounded-lg flex items-center gap-2">
                        <span>SANDBOX MODE ACTIVE</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Card Waiting screen */}
              {paymentStatus === "WAITING" && currentOrder && (
                <div className="space-y-6 text-center py-8">
                  <div className="inline-block relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-brand-orange border-t-transparent animate-spin"></div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-lg font-bold text-brand-navy">Waiting for card payment...</h4>
                    <p className="text-sm text-slate-500 font-mono text-xs">Order ID: {currentOrder.id}</p>
                    <p className="text-xs text-slate-400">Terminal transaction initialized. Waiting for webhook confirmation.</p>
                  </div>

                  {/* Sandbox Simulator Buttons */}
                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/50 space-y-3">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">Sandbox Simulator Controls</div>
                    <p className="text-[11px] text-amber-700">Trigger mock webhook notifications to complete or fail card checkout instantly:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSimulateWebhook(true)}
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        Trigger Success Event
                      </button>
                      <button
                        onClick={() => handleSimulateWebhook(false)}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        Trigger Failure Event
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Success state */}
              {paymentStatus === "PAID" && currentOrder && (
                <div className="text-center py-6 space-y-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-brand-navy">Payment Successful!</h4>
                    <p className="text-xs text-slate-500 font-mono">Receipt: {currentOrder.orderNumber}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Method</span>
                      <span className="font-bold text-brand-navy">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Total Paid</span>
                      <span className="font-bold text-brand-navy">${(currentOrder.total / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Branch</span>
                      <span className="font-bold text-brand-navy">{branchName || 'Selected Branch'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Timestamp</span>
                      <span className="font-bold text-brand-navy font-mono text-xs">{new Date(currentOrder.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error messages */}
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
                  {checkoutError}
                </div>
              )}
              {checkoutSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg">
                  {checkoutSuccess}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              {paymentStatus === "IDLE" && (
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={checkoutLoading || (paymentMethod === "CASH" && changeDue < 0) || (paymentMethod === "CREDIT_CARD" && !selectedTerminalId)}
                  className="w-full py-4 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 text-lg"
                >
                  {checkoutLoading ? "Processing..." : "Confirm Payment"}
                </button>
              )}

              {paymentStatus === "FAILED" && (
                <div className="space-y-3">
                  <button
                    onClick={handleRetryPayment}
                    className="w-full py-3 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-lg shadow-sm transition"
                  >
                    Retry Payment
                  </button>
                  <button
                    onClick={() => {
                      setPaymentStatus("IDLE");
                      setCheckoutError("");
                    }}
                    className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
                  >
                    Choose Different Method
                  </button>
                </div>
              )}

              {paymentStatus === "PAID" && (
                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="w-full py-4 bg-brand-navy hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm transition text-lg"
                >
                  New Sale
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
