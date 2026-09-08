import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import Link from "next/link";

export const metadata = {
  title: "Provider Pricing | Jesmond",
  description: "Transparent pricing for accommodation providers listing on Jesmond.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <GlobalNav />
      <main className="pb-24">

        {/* Hero */}
        <section className="bg-brand-navy pt-32 pb-20 px-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-orange via-brand-navy to-brand-navy pointer-events-none"></div>
          <div className="max-w-[800px] mx-auto text-center relative z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
              No hidden fees. No lock-in contracts. Pay only when students book through Jesmond.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-[1100px] mx-auto px-6 -mt-10 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Starter */}
            <div className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
              <h3 className="text-lg font-bold text-brand-navy mb-2">Starter</h3>
              <p className="text-slate-500 text-sm mb-6">For small providers just getting started.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-brand-navy">Free</span>
                <span className="text-slate-400 text-sm ml-2">to list</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Up to 3 property listings
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Application management
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Basic analytics
                </li>
              </ul>
              <Link href="/register" className="w-full text-center py-3 rounded-xl border border-slate-200 text-brand-navy font-semibold hover:bg-surface-muted transition-colors">
                Get Started
              </Link>
            </div>

            {/* Professional — Highlighted */}
            <div className="bg-brand-navy rounded-[24px] p-8 border border-brand-navy shadow-xl flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-orange text-white text-xs font-bold rounded-full uppercase tracking-wider">Most Popular</span>
              <h3 className="text-lg font-bold text-white mb-2">Professional</h3>
              <p className="text-slate-300 text-sm mb-6">For growing accommodation providers.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">5%</span>
                <span className="text-slate-300 text-sm ml-2">per booking</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-200 mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Unlimited listings
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Priority placement in search
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Advanced analytics & reporting
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-brand-orange flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Dedicated account manager
                </li>
              </ul>
              <Link href="/register" className="w-full text-center py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-orange-600 transition-colors shadow-lg">
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
              <h3 className="text-lg font-bold text-brand-navy mb-2">Enterprise</h3>
              <p className="text-slate-500 text-sm mb-6">For large-scale PBSA operators.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-brand-navy">Custom</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Everything in Professional
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Custom API integrations
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Volume-based pricing
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  SLA & priority support
                </li>
              </ul>
              <Link href="/contact" className="w-full text-center py-3 rounded-xl border border-slate-200 text-brand-navy font-semibold hover:bg-surface-muted transition-colors">
                Contact Sales
              </Link>
            </div>

          </div>
        </section>

      </main>
      <EditorialFooter />
    </div>
  );
}
