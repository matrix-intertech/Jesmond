import { GlobalNav } from "../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";
import EmptyState from "../../../components/ui/EmptyState";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = await params;
  const state = await prisma.state.findFirst({
    where: { normalizedName: stateSlug }
  });

  if (!state) return { title: "State Not Found" };

  return {
    title: `${state.name} Student Accommodation | Jesmond`,
    description: `Find premium student housing in ${state.name}, Australia.`,
  };
}

export default async function StatePage({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = await params;
  let state = null;
  let error = false;

  try {
    state = await prisma.state.findFirst({
      where: {
        normalizedName: stateSlug
      },
      include: {
        cities: {
          include: {
            _count: {
              select: { suburbs: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    // Fallback if normalizedName isn't perfectly populated
    if (!state) {
      const allStates = await prisma.state.findMany({
        include: {
          cities: {
            include: {
              _count: { select: { suburbs: true } }
            },
            orderBy: { name: 'asc' }
          }
        }
      });
      state = allStates.find(s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === stateSlug) || null;
    }

  } catch (e) {
    console.error("Failed to fetch state:", e);
    error = true;
  }

  if (!error && !state) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">

        {/* Breadcrumb */}
        <nav className="mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-slate-500">
            <li>
              <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
            </li>
            <li>
              <span className="mx-2 text-slate-300">/</span>
            </li>
            <li>
              <Link href="/states" className="hover:text-indigo-600 transition-colors">States</Link>
            </li>
            <li>
              <span className="mx-2 text-slate-300">/</span>
            </li>
            <li className="text-slate-900 font-medium" aria-current="page">
              {state?.name}
            </li>
          </ol>
        </nav>

        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 mb-6 text-[11px] font-bold tracking-[0.2em] uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full">
            Explore {state?.name}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-slate-900 mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
            Cities in {state?.name}
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Find premium student housing in the best cities across {state?.name}.
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
            <p className="text-slate-500 mb-6">We're currently experiencing issues loading our locations. Please check back shortly.</p>
            <Link href="/" className="inline-block px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors">
              Return Home
            </Link>
          </div>
        ) : state!.cities.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[24px] p-12 max-w-2xl mx-auto shadow-sm">
            <EmptyState
              title={`No cities found in ${state!.name}`}
              description="We're currently expanding our network. Check back soon for new locations."
              action={{ label: "View All States", href: "/states" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {state!.cities.map((city) => (
              <Link key={city.id} href={`/states/${stateSlug}/${city.normalizedName || city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="group bg-white border border-slate-200 rounded-[24px] p-8 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{city.name}</h2>
                  <p className="text-slate-500 font-medium">
                    {city._count.suburbs} {city._count.suburbs === 1 ? 'Suburb' : 'Suburbs'}
                  </p>
                </div>
                <div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-6">
                  <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    Explore Suburbs
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
