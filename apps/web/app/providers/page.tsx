import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";
import EmptyState from "../../components/ui/EmptyState";

export const dynamic = "force-dynamic";

interface OrganizationRecord {
  id: string;
  name: string;
}

export default async function ProvidersPage() {
  let providers: OrganizationRecord[] = [];
  let error = false;

  try {
    providers = await prisma.organization.findMany({ where: { type: 'PROVIDER', status: 'VERIFIED' } });
  } catch (e) {
    console.error("Failed to fetch providers:", e);
    error = true;
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <GlobalNav />
      <main className="pb-24">
        {/* Premium Hero Section */}
        <section className="relative w-full py-24 lg:py-32 bg-white overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 relative z-10 text-center max-w-4xl mx-auto">
            <span className="inline-block px-3 py-1 mb-6 text-[11px] font-bold tracking-[0.2em] uppercase text-brand-orange bg-brand-orange/10 border border-indigo-100 rounded-full">
              For Accommodation Providers
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-medium text-brand-navy mb-8 tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--font-outfit)' }}>
              Partner with Jesmond
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Reach thousands of students looking for premium accommodation. Manage your properties, receive verified applications, and grow your occupancy seamlessly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/portal" className="px-8 py-4 bg-brand-navy text-white rounded-xl hover:bg-brand-navy/90 transition-colors font-medium shadow-lg w-full sm:w-auto">
                Provider Portal
              </Link>
              <Link href="/contact" className="px-8 py-4 bg-white text-brand-navy border border-slate-200 rounded-xl hover:bg-surface-muted transition-colors font-medium w-full sm:w-auto">
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="w-16 h-16 mx-auto bg-brand-orange/10 text-brand-orange rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-3">Reach Students</h3>
              <p className="text-slate-500">List your properties where verified students are actively searching for their next home.</p>
            </div>
            <div>
              <div className="w-16 h-16 mx-auto bg-brand-orange/10 text-brand-orange rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-3">Manage Properties</h3>
              <p className="text-slate-500">A powerful dashboard to manage your room inventory, pricing, and amenities in real-time.</p>
            </div>
            <div>
              <div className="w-16 h-16 mx-auto bg-brand-orange/10 text-brand-orange rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-3">Verified Applications</h3>
              <p className="text-slate-500">Receive secure, verified applications directly into your portal, streamlining your booking workflow.</p>
            </div>
          </div>
        </section>

        {/* Verified Providers Section */}
        <section className="py-24 bg-white max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 border-t border-slate-200">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-medium text-brand-navy mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
              Trusted Partners
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Discover properties managed by Australia's most trusted student accommodation providers.
            </p>
          </div>

          {error ? (
            <div className="bg-surface-muted border border-red-100 rounded-[24px] p-12 text-center max-w-2xl mx-auto shadow-sm">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <circle cx="12" cy="16" r="1" />
              </svg>
              <h3 className="text-2xl font-semibold text-brand-navy mb-2">Service Temporarily Unavailable</h3>
              <p className="text-slate-500 mb-6">We're currently experiencing issues loading our provider database. Please check back shortly.</p>
              <Link href="/" className="inline-block px-6 py-3 bg-brand-navy text-white rounded-xl hover:bg-brand-navy/90 transition-colors">
                Return Home
              </Link>
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-surface-muted border border-slate-200 rounded-[24px] p-12 max-w-2xl mx-auto shadow-sm">
              <EmptyState
                title="No providers found"
                description="We're currently onboarding new partners. Check back soon."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {providers.map((provider: OrganizationRecord) => (
                <div key={provider.id} className="group bg-surface-muted border border-slate-200 rounded-[24px] p-8 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between items-start">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xl mb-6 shadow-sm">
                    {provider.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-brand-navy mb-2">{provider.name}</h3>
                    <div className="mt-4 inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-emerald-100">
                      <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Verified Partner
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <EditorialFooter />
    </div>
  );
}
