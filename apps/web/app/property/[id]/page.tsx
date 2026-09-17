import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SafeImage } from "../../../components/ui/SafeImage";
import PropertyMap from "../../../components/ui/PropertyMap";

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
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 pt-32 pb-12 min-h-[70vh]">
        <Link href="/search" className="text-sm font-semibold text-brand-orange hover:underline mb-8 inline-block">&larr; Back to Search</Link>
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl md:text-5xl font-medium text-brand-navy" style={{ fontFamily: 'var(--font-outfit)' }}>
                {property.name}
              </h1>
              <SaveButton propertyId={property.id} />
            </div>
            <p className="text-lg text-slate-500">{formatLocation({ address: property.address, suburb: property.suburb, state: property.suburb.state, city: property.suburb.city })}</p>
          </div>
          <div className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700">Managed by {property.provider?.name || "Property Provider"}</div>
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
            <h2 className="text-2xl font-bold text-brand-navy mb-4">About this property</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{property.description}</p>

            {/* Property Overview */}
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="text-xl font-bold text-brand-navy mb-4">Property Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-slate-500 block">Property Type</span><span className="font-semibold text-slate-700">{property.propertyType || 'Not specified'}</span></div>
                <div><span className="text-slate-500 block">Offering</span><span className="font-semibold text-slate-700">{property.offeringType?.replace(/_/g, ' ') || 'Not specified'}</span></div>
                <div><span className="text-slate-500 block">Furnishing</span><span className="font-semibold text-slate-700">{property.furnishingType?.replace(/_/g, ' ') || 'Not specified'}</span></div>
              </div>
            </div>

            {/* Property Configuration */}
            {(property.configuration?.bedrooms || property.configuration?.bathrooms || property.configuration?.parkingSpaces || property.configuration?.balconies || property.configuration?.livingAreas || property.configuration?.kitchens) && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-brand-navy mb-4">Configuration</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  {property.configuration.bedrooms && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.bedrooms}</span> Bedrooms</div>}
                  {property.configuration.bathrooms && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.bathrooms}</span> Bathrooms</div>}
                  {property.configuration.parkingSpaces && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.parkingSpaces}</span> Parking Spaces</div>}
                  {property.configuration.balconies && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.balconies}</span> Balconies</div>}
                  {property.configuration.livingAreas && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.livingAreas}</span> Living Areas</div>}
                  {property.configuration.kitchens && <div className="bg-slate-100 px-3 py-2 rounded-lg"><span className="font-semibold">{property.configuration.kitchens}</span> Kitchens</div>}
                </div>
              </div>
            )}

            {/* Availability */}
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="text-xl font-bold text-brand-navy mb-4">Availability</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-slate-500 block">Available From</span><span className="font-semibold text-slate-700">{property.availableFrom ? new Date(property.availableFrom).toLocaleDateString() : 'Not specified'}</span></div>
                <div><span className="text-slate-500 block">Minimum Stay</span><span className="font-semibold text-slate-700">{property.minimumStay ? `${property.minimumStay} ${property.minimumStayUnit}` : 'Not specified'}</span></div>
                <div><span className="text-slate-500 block">Maximum Stay</span><span className="font-semibold text-slate-700">{property.maximumStay ? `${property.maximumStay} ${property.maximumStayUnit}` : 'No Maximum Stay'}</span></div>
                {property.listingType === 'CO_LIVING' && <div><span className="text-slate-500 block">Maximum Occupancy</span><span className="font-semibold text-slate-700">{property.maximumOccupancy ? `${property.maximumOccupancy} people` : 'Not specified'}</span></div>}
              </div>
            </div>

            {/* House Rules */}
            {property.houseRule && (
              <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="text-xl font-bold text-brand-navy mb-4">House Rules</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {property.houseRule.smoking && <div><span className="text-slate-500 block">Smoking</span><span className="font-semibold text-slate-700">{property.houseRule.smoking.replace(/_/g, ' ')}</span></div>}
                  {property.houseRule.pets && <div><span className="text-slate-500 block">Pets</span><span className="font-semibold text-slate-700">{property.houseRule.pets.replace(/_/g, ' ')}</span></div>}
                  {property.houseRule.parties && <div><span className="text-slate-500 block">Parties</span><span className="font-semibold text-slate-700">{property.houseRule.parties.replace(/_/g, ' ')}</span></div>}
                  {property.houseRule.guests && <div><span className="text-slate-500 block">Guests</span><span className="font-semibold text-slate-700">{property.houseRule.guests.replace(/_/g, ' ')}</span></div>}
                  {(property.houseRule.quietHoursStart || property.houseRule.quietHoursEnd) && <div><span className="text-slate-500 block">Quiet Hours</span><span className="font-semibold text-slate-700">{property.houseRule.quietHoursStart} - {property.houseRule.quietHoursEnd}</span></div>}
                </div>
                {property.houseRule.additionalRules && <p className="mt-4 text-sm text-slate-600 whitespace-pre-wrap">{property.houseRule.additionalRules}</p>}
              </div>
            )}

            {property.listingType === 'CO_LIVING' && property.residents && property.residents.length > 0 && (
              <div className="mt-12">
                <h3 className="text-2xl font-bold text-brand-navy mb-6">Current Residents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {property.residents.map((resident: any) => (
                    <div key={resident.id} className="flex gap-4 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-200 shrink-0">
                        {resident.photoUrl ? (
                          <SafeImage src={resident.photoUrl} alt={resident.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xl">{resident.name.charAt(0)}</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{resident.name}</h4>
                        <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2">
                          {resident.age && <span>{resident.age} yrs</span>}
                          {resident.occupation && <span>• {resident.occupation}</span>}
                          {resident.ethnicity && <span>• {resident.ethnicity}</span>}
                        </div>
                        {resident.shortBio && <p className="text-sm text-slate-600 mt-2 line-clamp-2">{resident.shortBio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-16">
              <h2 className="text-2xl font-bold text-brand-navy mb-4">Location</h2>
              <p className="text-slate-600 mb-6">{formatLocation({ address: property.address, suburb: property.suburb, state: property.suburb.state, city: property.suburb.city })}</p>

              <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-slate-200">
                <PropertyMap
                  properties={[{
                    id: property.id,
                    name: property.name,
                    lat: property.lat,
                    lng: property.lng
                  }]}
                  interactive={true}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <PropertyActions 
              propertyId={property.id} 
              roomTypes={property.roomTypes} 
              showContactDetails={property.showContactDetails} 
              providerContact={property.providerContact} 
            />
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}