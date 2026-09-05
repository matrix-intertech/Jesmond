import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import ComingSoon from "../../../components/ui/ComingSoon";

import { formatLocation } from "../../../utils/location";

interface CampusWithLocation {
  id: string;
  name: string;
  suburb: {
    name: string;
    city?: { name: string } | null;
    state?: { name: string; code: string } | null;
  };
}

export default async function UniversityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;

  const universitiesFeature = await prisma.featureFlag.findUnique({ where: { key: 'UNIVERSITIES' } });
  if (universitiesFeature && !universitiesFeature.enabled) {
    return <ComingSoon featureName="Universities" />;
  }

  const uni = await prisma.university.findUnique({
    where: { slug: resolvedParams.slug },
    include: { campuses: { include: { suburb: { include: { city: true, state: true } } } } }
  });

  if (!uni) return notFound();

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <Link href="/universities" className="text-sm font-semibold text-brand-orange hover:underline mb-8 inline-block">&larr; Back to Universities</Link>
        <h1 className="text-4xl md:text-5xl font-medium text-brand-navy mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          {uni.name}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {uni.campuses.map((c: CampusWithLocation) => (
            <div key={c.id} className="border border-slate-200 rounded-[24px] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-brand-navy">{c.name}</h3>
                <p className="text-slate-500 mt-2">{formatLocation({ suburb: c.suburb, state: c.suburb.state, city: c.suburb.city })}</p>
              </div>
              <Link href={`/search?city=${c.suburb?.city?.name || c.suburb?.name}`} className="mt-6 px-6 py-2 bg-brand-navy text-white rounded-full font-semibold text-center hover:bg-brand-navy/90 transition-colors">
                Find properties near campus
              </Link>
            </div>
          ))}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}