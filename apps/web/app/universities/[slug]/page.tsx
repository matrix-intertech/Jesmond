import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function UniversityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const uni = await prisma.university.findUnique({
    where: { slug: resolvedParams.slug },
    include: { campuses: { include: { suburb: { include: { city: true } } } } }
  });

  if (!uni) return notFound();

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <Link href="/universities" className="text-sm font-semibold text-indigo-600 hover:underline mb-8 inline-block">&larr; Back to Universities</Link>
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          {uni.name}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {uni.campuses.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-[24px] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{c.name}</h3>
                <p className="text-slate-500 mt-2">{c.suburb.name}, {c.suburb.city.name}</p>
              </div>
              <Link href={`/search?city=${c.suburb.city.name}`} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-full font-semibold text-center hover:bg-slate-800 transition-colors">
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