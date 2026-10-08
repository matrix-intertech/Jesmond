import { getApiUrl } from "@/utils/api";
import { ProductCard } from "@/components/retail/ProductCard";
import { Store, Navigation, Clock, ArrowLeft, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicFoodMenu from "@/components/food/PublicFoodMenu";

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

export async function generateMetadata({ params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { branchId } = await params;
    const data = await getStoreCatalog(branchId);
    const name = data?.branch?.name || data?.branch?.organization?.name;
    if (!name) return { title: "Business Profile" };

    const category = data?.branch?.organization?.businessCategory || 'RETAIL';

    if (category === 'FOOD') {
      return {
        title: `${name} | Food & Menu | Jesmond`,
        description: `View the menu and details for ${name}.`,
      };
    }

    return {
      title: `${name} — Local Business`,
      description: `View details for ${name}.`,
    };
  } catch {
    return { title: "Business Profile" };
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
  const category = branch.organization?.businessCategory || 'RETAIL';
  const isCommerce = category === 'RETAIL';

  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-8">
      <Link href="/businesses" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors font-medium mb-8">
        <ArrowLeft size={18} /> Back to Businesses
      </Link>

      {!branch.isActive && (
        <div className="mb-8 p-4 bg-surface-muted border border-border-strong rounded-xl text-center text-text-secondary font-bold uppercase tracking-wider">
          Currently Unavailable
        </div>
      )}

      <div className="bg-surface rounded-3xl p-8 lg:p-10 border border-border-strong/60 shadow-sm mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-surface-orange rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-navy/20 shrink-0">
              <Store size={36} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight">
                {branch.name || branch.organization?.name}
              </h1>
              <p className="text-text-secondary font-medium mt-1">Jesmond {category} Partner</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isCommerce && (
              <>
                {branch.deliveryEnabled && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl border border-green-100">
                    <Navigation size={18} /> Delivery
                  </div>
                )}
                {branch.takeawayEnabled && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-info-bg text-brand-purple font-bold rounded-xl border border-border-strong">
                    <Clock size={18} /> Takeaway
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border-strong/50 pt-8 relative">
          <h3 className="font-semibold text-primary">Business Information</h3>
          {branch.address && (
            <div className="flex items-center gap-2 text-text-secondary">
              <MapPin size={18} className="text-accent" />
              <span>{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-2 text-text-secondary">
              <Phone size={18} className="text-accent" />
              <span>{branch.phone}</span>
            </div>
          )}
        </div>
      </div>

      {isCommerce && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-primary">Catalog</h2>
            <p className="text-text-secondary mt-1">Browse items and add available stock to your cart</p>
          </div>

          {catalog.length === 0 ? (
            <div className="bg-surface-lavender rounded-3xl p-12 text-center border border-border-strong/60">
              <h3 className="text-xl font-bold text-primary">Catalog empty</h3>
              <p className="text-text-secondary mt-2">This business has no available products right now.</p>
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
                return <ProductCard key={item.id} inventory={inv} branchId={branch.id} storeIsActive={branch.isActive} />;
              })}
            </div>
          )}
        </>
      )}

      {category === 'FOOD' && (
        <div className="mt-12">
          <PublicFoodMenu branchId={branch.id} businessName={branch.name || branch.organization?.name || 'Food Business'} />
        </div>
      )}
    </div>
  );
}
