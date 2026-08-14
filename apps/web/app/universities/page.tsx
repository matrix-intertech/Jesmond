import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";
export const dynamic = "force-dynamic";
import Image from "next/image";

interface CampusWithLocation {
  id: string;
  name: string;
  suburb: { name: string; city: { name: string } };
}

interface UniversityWithCampuses {
  id: string;
  name: string;
  slug: string;
  campuses: CampusWithLocation[];
}

export default async function UniversitiesPage() {
  const universities = await prisma.university.findMany({
    include: {
      campuses: {
        include: { suburb: { include: { city: true } } }
      }
    }
  });

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Discover Universities
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-12">
          Find premium student accommodation near Australia's top universities.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {universities.map((uni: UniversityWithCampuses) => (
            <Link key={uni.id} href={`/universities/${uni.slug}`} className="group border border-slate-200 rounded-[24px] p-8 hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{uni.name}</h2>
                <p className="text-slate-500 mb-4">{uni.campuses.length} Campuses</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {uni.campuses.slice(0,3).map((c: CampusWithLocation) => (
                    <span key={c.id} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{c.name} ({c.suburb.city.name})</span>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-indigo-600">
                View Accommodation 
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
