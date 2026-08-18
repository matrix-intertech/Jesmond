import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SafeImage } from "../../../components/ui/SafeImage";

import { SaveButton } from "../../../components/student/SaveButton";
import { PropertyActions } from "../../../components/student/PropertyActions";
import { formatLocation } from "../../../utils/location";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  let property;
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/public/${resolvedParams.id}`, { cache: 'no-store' });
  
  if (res.status === 404 || res.status === 400) {
    return notFound();
  }
  
  if (!res.ok) {
    throw new Error(`Failed to fetch property details: ${res.statusText}`);
  }
  
  property = await res.json();

  if (!property) return notFound();

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-12 min-h-[70vh]">
        <Link href="/search" className="text-sm font-semibold text-indigo-600 hover:underline mb-8 inline-block">&larr; Back to Search</Link>
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl md:text-5xl font-medium text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>
                {property.name}
              </h1>
              <SaveButton propertyId={property.id} />
            </div>
            <p className="text-lg text-slate-500">{formatLocation({ address: property.address, suburb: property.suburb, state: property.suburb.state, city: property.suburb.city })}</p>
          </div>
          <div className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700">Managed by {property.organization.name}</div>
        </div>
        
        <div className="relative w-full h-[500px] rounded-[32px] overflow-hidden mb-16 bg-slate-100">
          <SafeImage 
            src={(property.media.length > 0) ? property.media[0].url : '/assets/property-placeholder.png'} 
            alt={property.name} 
            fill 
            sizes="100vw"
            className="object-cover" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About this property</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{property.description}</p>
          </div>
          <div className="flex flex-col gap-6">
            <PropertyActions propertyId={property.id} roomTypes={property.roomTypes} />
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}