import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const cities = await prisma.city.findMany({
    where: { name: { equals: resolvedParams.slug, mode: 'insensitive' } },
    include: { state: true, suburbs: true }
  });

  if (cities.length === 0) return notFound();

  // If uniquely resolvable, redirect to the new state-scoped hierarchy
  if (cities.length === 1) {
    const city = cities[0];
    const stateSlug = city.state.normalizedName || city.state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const citySlug = city.normalizedName || city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    redirect(`/states/${stateSlug}/${citySlug}`);
  }

  // Disambiguation UI
  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <Link href="/states" className="text-sm font-semibold text-indigo-600 hover:underline mb-8 inline-block">&larr; View all States</Link>
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Multiple locations found for "{resolvedParams.slug}"
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-12">Please select the state you are looking for.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cities.map(city => {
            const stateSlug = city.state.normalizedName || city.state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const citySlug = city.normalizedName || city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return (
              <Link key={city.id} href={`/states/${stateSlug}/${citySlug}`} className="group p-6 border border-slate-200 rounded-2xl hover:border-indigo-600 transition-all flex flex-col items-start justify-between min-h-[140px]">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{city.name}</h3>
                  <p className="text-slate-500">{city.state.name}</p>
                </div>
                <span className="text-sm font-semibold text-indigo-600 mt-4 group-hover:underline">View City &rarr;</span>
              </Link>
            );
          })}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}