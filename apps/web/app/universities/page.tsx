import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";
import EmptyState from "../../components/ui/EmptyState";

export const dynamic = "force-dynamic";

interface CampusWithLocation {
  id: string;
  name: string;
  suburb: { name: string; city: { name: string } } | null;
}

interface UniversityWithCampuses {
  id: string;
  name: string;
  slug: string;
  campuses: CampusWithLocation[];
}

export default async function UniversitiesPage() {
  let universities: UniversityWithCampuses[] = [];
  let error = false;

  try {
    universities = await prisma.university.findMany({
      include: {
        campuses: {
          include: { suburb: { include: { city: true } } }
        }
      }
    });
  } catch (e) {
    console.error("Failed to fetch universities:", e);
    error = true;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 mb-6 text-[11px] font-bold tracking-[0.2em] uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full">
            Study Destinations
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-slate-900 mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
            Find your university in Australia
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Explore premium student accommodation near Australia's top universities. Live close to campus and focus on what matters.
          </p>
        </div>

        {error ? (
          <div className="bg-white border border-red-100 rounded-[24px] p-12 text-center max-w-2xl mx-auto shadow-sm">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r="1" />
            </svg>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Service Temporarily Unavailable</h2>
            <p className="text-slate-500 mb-6">We're currently experiencing issues loading our university database. Please check back shortly.</p>
            <Link href="/" className="inline-block px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors">
              Return Home
            </Link>
          </div>
        ) : universities.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[24px] p-12 max-w-2xl mx-auto shadow-sm">
            <EmptyState
              title="No universities found"
              description="We're currently expanding our network. Check back soon for new university locations."
              action={{ label: "View all cities", href: "/cities" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {universities.map((uni: UniversityWithCampuses) => (
              <Link key={uni.id} href={`/universities/${uni.slug}`} className="group bg-white border border-slate-200 rounded-[24px] p-8 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{uni.name}</h2>
                  <p className="text-slate-500 mb-6 text-sm">{uni.campuses.length} {uni.campuses.length === 1 ? 'Campus' : 'Campuses'}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {uni.campuses.slice(0, 3).map((c: CampusWithLocation) => {
                      const cityName = c.suburb?.city?.name ?? 'Unknown Location';
                      return (
                        <span key={c.id} className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full border border-slate-100 font-medium">
                          {c.name} ({cityName})
                        </span>
                      );
                    })}
                    {uni.campuses.length > 3 && (
                      <span className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full border border-slate-100 font-medium">
                        +{uni.campuses.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-6">
                  <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    Explore Accommodation
                  </span>
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
