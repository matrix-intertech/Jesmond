import { GlobalNav } from "../../../../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../../../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";
import EmptyState from "../../../../../components/ui/EmptyState";
import { notFound } from "next/navigation";
import { SafeImage } from "../../../../../components/ui/SafeImage";
import { formatLocation } from "../../../../../utils/location";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ stateSlug: string, citySlug: string, suburbSlug: string }> }) {
  const { stateSlug, citySlug, suburbSlug } = await params;
  const suburb = await prisma.suburb.findFirst({
    where: {
      normalizedName: suburbSlug,
      city: { normalizedName: citySlug },
      state: { normalizedName: stateSlug }
    },
    include: { city: true, state: true }
  });

  if (!suburb) return { title: "Suburb Not Found" };

  return {
    title: `Student Accommodation in ${suburb.name}, ${suburb.city?.name || ''}, ${suburb.state.name} | Jesmond`,
    description: `Find premium student housing and properties in ${suburb.name}, ${suburb.city?.name || ''}, ${suburb.state.name}.`,
  };
}

export default async function SuburbPage({ params }: { params: Promise<{ stateSlug: string, citySlug: string, suburbSlug: string }> }) {
  const { stateSlug, citySlug, suburbSlug } = await params;
  let suburb = null;
  let properties: any[] = [];
  let error = false;

  try {
    // Attempt exact lookup first
    suburb = await prisma.suburb.findFirst({
      where: {
        normalizedName: suburbSlug,
        city: { normalizedName: citySlug },
        state: { normalizedName: stateSlug }
      },
      include: { city: true, state: true }
    });

    // Fallback logic
    if (!suburb) {
      const allSuburbs = await prisma.suburb.findMany({
        include: { city: true, state: true }
      });
      suburb = allSuburbs.find(s =>
        (s.normalizedName === suburbSlug || s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === suburbSlug) &&
        (s.city && (s.city.normalizedName === citySlug || s.city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === citySlug)) &&
        (s.state.normalizedName === stateSlug || s.state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === stateSlug)
      ) || null;
    }

    if (suburb) {
      properties = await prisma.property.findMany({
        where: { suburbId: suburb.id, status: 'PUBLISHED' },
        include: {
          media: {
            orderBy: { displayOrder: 'asc' },
            take: 1
          },
          roomTypes: {
            select: { pricePerWeek: true }
          },
          organization: { select: { status: true } }
        }
      });
    }
  } catch (e) {
    console.error("Failed to fetch suburb and properties:", e);
    error = true;
  }

  if (!error && !suburb) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">

        {/* Breadcrumb */}
        <nav className="mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-slate-500">
            <li>
              <Link href="/" className="hover:text-brand-orange transition-colors">Home</Link>
            </li>
            <li><span className="mx-2 text-slate-300">/</span></li>
            <li>
              <Link href="/states" className="hover:text-brand-orange transition-colors">States</Link>
            </li>
            <li><span className="mx-2 text-slate-300">/</span></li>
            <li>
              <Link href={`/states/${stateSlug}`} className="hover:text-brand-orange transition-colors">{suburb?.state.name}</Link>
            </li>
            {suburb?.city && (
              <>
                <li><span className="mx-2 text-slate-300">/</span></li>
                <li>
                  <Link href={`/states/${stateSlug}/${citySlug}`} className="hover:text-brand-orange transition-colors">{suburb.city.name}</Link>
                </li>
              </>
            )}
            <li><span className="mx-2 text-slate-300">/</span></li>
            <li className="text-brand-navy font-medium" aria-current="page">
              {suburb?.name}
            </li>
          </ol>
        </nav>

        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 mb-6 text-[11px] font-bold tracking-[0.2em] uppercase text-brand-orange bg-brand-orange/10 border border-indigo-100 rounded-full">
            {suburb?.city ? `${suburb.city.name}, ${suburb.state.name}` : suburb?.state.name}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-brand-navy mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
            Properties in {suburb?.name}
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Discover student homes in {suburb?.name}.
          </p>
        </div>

        {error ? (
          <div className="bg-white border border-red-100 rounded-[24px] p-12 text-center max-w-2xl mx-auto shadow-sm">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r="1" />
            </svg>
            <h2 className="text-2xl font-semibold text-brand-navy mb-2">Service Temporarily Unavailable</h2>
            <p className="text-slate-500 mb-6">We're currently experiencing issues loading our locations. Please check back shortly.</p>
            <Link href="/" className="inline-block px-6 py-3 bg-brand-navy text-white rounded-xl hover:bg-brand-navy/90 transition-colors">
              Return Home
            </Link>
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[24px] p-12 max-w-2xl mx-auto shadow-sm">
            <EmptyState
              title={`No properties found in ${suburb!.name}`}
              description="We're currently expanding our network. Check back soon for new properties."
              action={suburb!.city ? { label: `View All Suburbs in ${suburb!.city.name}`, href: `/states/${stateSlug}/${citySlug}` } : { label: "View All States", href: "/states" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((prop) => {
              const image = (prop.media && prop.media.length > 0) ? prop.media[0].url : '/assets/property-placeholder.png';
              // Formatting location: Suburb, City, State or Suburb, State
              const locationStr = formatLocation({
                suburb: { name: suburb!.name, city: suburb!.city },
                state: suburb!.state
              });
              const verified = prop.organization?.status === 'VERIFIED';
              const minPrice = prop.roomTypes?.length > 0
                ? Math.min(...prop.roomTypes.map((rt: any) => rt.pricePerWeek / 100))
                : null;

              return (
                <Link
                  key={prop.id}
                  href={`/property/${prop.id}`}
                  className="flex flex-col bg-white rounded-[24px] overflow-hidden border border-slate-200 hover:border-brand-orange transition group relative cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="relative w-full h-[240px] shrink-0 bg-slate-100">
                    <SafeImage src={image} alt={prop.name} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
                    {verified && (
                      <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm">
                         Verified
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col justify-between flex-grow">
                    <div>
                      <h3 className="text-xl font-bold text-brand-navy mb-1 group-hover:text-brand-orange transition-colors">{prop.name}</h3>
                      <p className="text-sm font-medium text-slate-500 mb-4">{locationStr}</p>
                    </div>
                    <div className="mt-4 flex justify-between items-end">
                      {minPrice ? (
                        <p className="text-2xl font-bold text-brand-navy tracking-tight">${minPrice}<span className="text-sm font-medium text-slate-500">/wk</span></p>
                      ) : (
                        <p className="text-lg font-bold text-brand-navy tracking-tight">Price on request</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
