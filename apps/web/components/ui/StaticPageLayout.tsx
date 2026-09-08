import { GlobalNav } from "../marketing/GlobalNav";
import { EditorialFooter } from "../marketing/EditorialFooter";
import { ReactNode } from "react";

interface StaticPageLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function StaticPageLayout({ title, subtitle, children }: StaticPageLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-muted">
      <GlobalNav />
      
      {/* Header */}
      <section className="bg-brand-navy pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-orange via-brand-navy to-brand-navy pointer-events-none"></div>
        <div className="max-w-[800px] mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
            {title}
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
            {subtitle}
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[800px] mx-auto px-6 py-16 lg:py-24">
        <div className="bg-white rounded-[24px] p-8 md:p-12 lg:p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
          {/* Manually mimicking prose styling for generic content */}
          <div className="space-y-6 text-slate-600 leading-relaxed text-lg [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-brand-navy [&>h2]:mt-10 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-brand-navy [&>h3]:mt-8 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:mb-2 [&>a]:text-brand-orange hover:[&>a]:text-orange-600 [&>a]:underline">
            {children}
          </div>
        </div>
      </main>

      <EditorialFooter />
    </div>
  );
}
