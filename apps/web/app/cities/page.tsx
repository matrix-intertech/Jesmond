import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";

export default async function CitiesPage() {
  const cities = await prisma.city.findMany({ include: { state: true } });

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Explore Cities
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-12">Find student housing in Australia's most vibrant cities.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cities.map((city) => (
            <Link key={city.id} href={`/cities/${city.name.toLowerCase()}`} className="group border border-slate-200 rounded-[24px] p-8 hover:shadow-lg transition-all">
              <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{city.name}</h2>
              <p className="text-slate-500 mb-4">{city.state.name}</p>
              <div className="mt-8 flex items-center text-sm font-semibold text-indigo-600">
                View properties <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}