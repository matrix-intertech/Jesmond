import Link from "next/link";
import { GlobalNav } from "../marketing/GlobalNav";
import { EditorialFooter } from "../marketing/EditorialFooter";

export default function ComingSoon({ featureName }: { featureName: string }) {
  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      <GlobalNav />
      <main className="flex-grow flex items-center justify-center px-6 py-24">
        <div className="bg-white border border-slate-200 rounded-[24px] p-12 max-w-2xl w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-brand-navy mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
            Coming Soon
          </h1>
          <p className="text-lg text-slate-500 mb-8">
            The {featureName} feature is currently unavailable. Please check back soon.
          </p>
          <Link href="/" className="inline-block px-8 py-3 bg-brand-navy text-white rounded-full font-medium hover:bg-brand-navy/90 transition-colors">
            Return to Home
          </Link>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
