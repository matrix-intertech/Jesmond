import { getApiUrl } from "@/utils/api";
import { ProductCard } from "@/components/retail/ProductCard";
import { Store, Navigation, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getStoreCatalog(branchId: string) {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/stores/${branchId}/catalog`, {
      cache: 'no-store' // Don't aggressively cache inventory counts
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch store catalog');
    }
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch store catalog", err);
    return null;
  }
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const data = await getStoreCatalog(branchId);

  if (!data || !data.branch) {
    notFound();
  }

  const { branch, catalog } = data;

  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-8">
      <Link href="/retail" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-orange transition-colors font-medium mb-8">
        <ArrowLeft size={18} /> Back to Stores
      </Link>

      <div className="bg-white rounded-3xl p-8 lg:p-10 border border-slate-200/60 shadow-sm mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-brand-navy rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-navy/20 shrink-0">
              <Store size={36} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">{branch.name}</h1>
              <p className="text-slate-500 font-medium mt-1">Jesmond Retail Partner</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {branch.deliveryEnabled && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl border border-green-100">
                <Navigation size={18} /> Delivery
              </div>
            )}
            {branch.takeawayEnabled && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-100">
                <Clock size={18} /> Takeaway
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-brand-navy">Store Catalog</h2>
        <p className="text-slate-500 mt-1">Browse items and add available stock to your cart</p>
      </div>

      {catalog.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-12 text-center border border-slate-200/60">
          <h3 className="text-xl font-bold text-brand-navy">Catalog empty</h3>
          <p className="text-slate-500 mt-2">This store has no available products right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {catalog.map((item: any) => {
            const inv = {
              productId: item.id,
              quantity: item.availableQuantity,
              reservedQuantity: 0,
              product: item
            };
            return <ProductCard key={item.id} inventory={inv} branchId={branch.id} />;
          })}
        </div>
      )}
    </div>
  );
}
