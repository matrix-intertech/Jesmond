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
 <div className="min-h-screen bg-surface-muted font-outfit">
 <GlobalNav />

 {/* Header */}
 <section className="static-page-hero bg-primary pt-32 pb-16 px-6 relative overflow-hidden">
 <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-orange via-transparent to-transparent pointer-events-none"></div>
 <div className="max-w-[800px] mx-auto text-center relative z-10">
 <h1 className="text-[36px] sm:text-[44px] lg:text-[46px] font-bold text-white mb-4 tracking-tight leading-[1.15] font-outfit">
 {title}
 </h1>
 <p className="text-sm font-normal text-white/80 max-w-2xl mx-auto leading-relaxed">
 {subtitle}
 </p>
 </div>
 </section>

 {/* Content */}
 <main id="main-content" tabIndex={-1} className="max-w-[800px] mx-auto px-6 py-12 lg:py-20 outline-none">
 <div className="bg-surface rounded-[24px] p-7 sm:p-10 md:p-12 lg:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border-strong">
 <div className="space-y-6 font-outfit text-text-secondary font-normal text-[16px] sm:text-[16.5px] leading-[1.75] [&>h2]:text-[21px] sm:[&>h2]:text-[24px] [&>h2]:font-semibold [&>h2]:leading-snug [&>h2]:text-text-primary [&>h2]:mt-10 [&>h2]:mb-3.5 [&>h2:first-child]:mt-0 [&>h3]:text-lg sm:[&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-text-primary [&>h3]:mt-8 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:text-[16px] [&>ul]:leading-[1.75] [&>ul>li]:mb-2.5 [&_strong]:text-text-primary [&_strong]:font-semibold [&>a]:text-accent hover:[&>a]:text-accent [&>a]:underline">
 {children}
 </div>
 </div>
 </main>

 <EditorialFooter />
 </div>
 );
}
