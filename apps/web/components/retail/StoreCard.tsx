import Link from "next/link";
import { Store, MapPin, Navigation, Clock } from "lucide-react";

type StoreCardProps = {
  store: {
    id: string;
    name: string;
    deliveryEnabled: boolean;
    takeawayEnabled: boolean;
    distance?: number;
    availability?: {
      available: boolean;
      label: string;
    };
  };
};

export function StoreCard({ store }: StoreCardProps) {
  return (
    <Link href={`/retail/store/${store.id}`} className="group block">
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-brand-orange group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-brand-navy group-hover:text-orange-600 transition-colors">
                {store.name}
              </h3>
              <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                <MapPin size={14} />
                <span>Nearby Location</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {store.availability?.available === false ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full border border-slate-200">
              <Store size={12} /> {store.availability.label}
            </span>
          ) : (
            <>
              {store.deliveryEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                  <Navigation size={12} /> Delivery Available
                </span>
              )}
              {store.takeawayEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                  <Clock size={12} /> Takeaway
                </span>
              )}
              {!store.deliveryEnabled && !store.takeawayEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                  <Store size={12} /> In-Store Only
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
