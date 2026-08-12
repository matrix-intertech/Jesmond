import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const city = await prisma.city.findFirst({
    where: { name: { equals: resolvedParams.slug, mode: 'insensitive' } },
    include: { state: true, suburbs: true }
  });

  if (!city) return notFound();

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <Link href="/cities" className="text-sm font-semibold text-indigo-600 hover:underline mb-8 inline-block">&larr; Back to Cities</Link>
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          {city.name}
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-12">{city.state.name}</p>
        <Link href={`/search?city=${city.name}`} className="px-8 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors">
          Search properties in {city.name}
        </Link>
      </main>
      <EditorialFooter />
    </div>
  );
}