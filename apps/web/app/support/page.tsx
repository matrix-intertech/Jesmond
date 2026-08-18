import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import Link from "next/link";

export default function SupportPage() {
  const faqCategories = [
    { title: "Finding Accommodation", desc: "Tips for searching, viewing properties, and comparing options.", icon: "home" },
    { title: "Students", desc: "Account setup, applications, and moving in.", icon: "user" },
    { title: "Providers", desc: "Listing properties, managing rooms, and processing applications.", icon: "briefcase" },
    { title: "Applications", desc: "Understanding the review process, lease agreements, and terms.", icon: "document" },
    { title: "Account & Security", desc: "Passwords, 2FA, data privacy, and managing your profile.", icon: "shield" },
    { title: "Payments", desc: "Rent, bond, fees, invoices, and billing history.", icon: "credit-card" }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <GlobalNav />
      <main className="pb-24">

        {/* Support Hero with Search Mockup */}
        <section className="bg-slate-900 pt-32 pb-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-slate-900 pointer-events-none"></div>
          <div className="max-w-[800px] mx-auto text-center relative z-10">
            <h1 className="text-4xl md:text-5xl font-medium text-white mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
              How can we help?
            </h1>
            <p className="text-lg text-slate-300 mb-10">
              Search our knowledge base or browse categories below.
            </p>

            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:text-slate-900 transition-all shadow-lg backdrop-blur-md"
                placeholder="Search for articles, guides, or help topics..."
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
                  Search
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Categories Grid */}
        <section className="max-w-[1000px] mx-auto px-6 -mt-8 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqCategories.map((cat, idx) => (
              <div key={idx} className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer group">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {/* Simplified icon representation for aesthetic */}
                    {cat.icon === "home" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                    {cat.icon === "user" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                    {cat.icon === "briefcase" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    {cat.icon === "document" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    {cat.icon === "shield" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    {cat.icon === "credit-card" && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{cat.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{cat.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Support CTA */}
        <section className="mt-24 max-w-[800px] mx-auto px-6">
          <div className="bg-indigo-50 rounded-[32px] p-10 md:p-14 text-center border border-indigo-100">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>Can't find what you're looking for?</h2>
            <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
              Our support team is here to help. Reach out to us directly and we'll get back to you as soon as possible.
            </p>
            <Link href="/contact" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors">
              Contact Support
            </Link>
          </div>
        </section>

      </main>
      <EditorialFooter />
    </div>
  );
}
