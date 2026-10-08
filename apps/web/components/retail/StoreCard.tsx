import Link from "next/link";
import { Store, MapPin, Navigation, Clock, Phone, Info } from "lucide-react";

type StoreCardProps = {
  store: {
    id: string;
    name: string;
    deliveryEnabled: boolean;
    takeawayEnabled: boolean;
    address?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    distance?: number;
    availability?: {
      available: boolean;
      label: string;
    };
    organization?: {
      name: string;
      businessCategory?: string;
    };
  };
};

export function StoreCard({ store }: StoreCardProps) {
  const category = store.organization?.businessCategory || 'RETAIL';
  const isCommerce = category === 'RETAIL';

  return (
    <Link href={`/retail/store/${store.id}`} className="group block">
      <div className="bg-surface rounded-2xl p-6 border border-border-strong/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-surface-orange rounded-xl flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors">
                {store.name || store.organization?.name}
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                  {category}
                </span>

                {store.address && (
                  <div className="flex items-center gap-1.5 text-text-secondary text-sm">
                    <MapPin size={14} />
                    <span className="truncate max-w-[200px]">{store.address}</span>
                  </div>
                )}
                {!store.address && (
                  <div className="flex items-center gap-1.5 text-text-secondary text-sm">
                    <MapPin size={14} />
                    <span>Location hidden</span>
                  </div>
                )}

                {store.phone && (
                  <div className="flex items-center gap-1.5 text-text-secondary text-sm">
                    <Phone size={14} />
                    <span>{store.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {store.availability?.available === false ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-muted text-text-secondary text-xs font-bold uppercase tracking-wider rounded-full border border-border-strong">
              <Store size={12} /> {store.availability.label}
            </span>
          ) : (
            <>
              {isCommerce ? (
                <>
                  {store.deliveryEnabled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                      <Navigation size={12} /> Delivery Available
                    </span>
                  )}
                  {store.takeawayEnabled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-info-bg text-brand-purple text-xs font-semibold rounded-full border border-border-strong">
                      <Clock size={12} /> Takeaway
                    </span>
                  )}
                  {!store.deliveryEnabled && !store.takeawayEnabled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-lavender text-text-secondary text-xs font-semibold rounded-full border border-border-strong">
                      <Store size={12} /> In-Store Only
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-lavender text-text-secondary text-xs font-semibold rounded-full border border-border-strong">
                  <Info size={12} /> Contact / View Details
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
