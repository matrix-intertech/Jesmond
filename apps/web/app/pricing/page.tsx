import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "Provider Pricing & Accommodation Listing Plans | Jesmond",
  },
  description:
    "Transparent pricing for student accommodation providers and PBSA operators listing on Jesmond. No lock-in contracts or hidden fees.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Provider Pricing & Accommodation Listing Plans | Jesmond",
    description:
      "Transparent pricing for student accommodation providers and PBSA operators listing on Jesmond. No lock-in contracts or hidden fees.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Provider Pricing & Accommodation Listing Plans | Jesmond",
    description:
      "Transparent pricing for student accommodation providers and PBSA operators listing on Jesmond.",
  },
};

const faqs = [
  {
    question: "How does the Starter listing tier work?",
    answer:
      "The Starter plan allows independent accommodation providers to list up to 3 properties on the Jesmond marketplace at zero upfront cost. You receive verified property badges, direct student inquiries, and full access to the provider portal.",
  },
  {
    question: "What documents are required for provider verification?",
    answer:
      "To protect university students from fraudulent listings, providers must supply a valid Australian Business Number (ABN) or Australian Company Number (ACN), proof of identity for authorized representatives, and evidence of property management authorization or title.",
  },
  {
    question: "Can property managers and PBSA operators integrate external software?",
    answer:
      "Yes. Enterprise partners have access to property management software (PMS) webhooks and REST APIs to synchronize room availability, real-time pricing, and tenancy applications.",
  },
  {
    question: "Are there any lock-in contracts or cancellation penalties?",
    answer:
      "No. Jesmond operate on flexible month-to-month terms. Providers can upgrade, downgrade, or pause listings at any time without cancellation penalties.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <JsonLd data={getFaqSchema(faqs)} />
      <GlobalNav />
      <main className="pb-24">

        {/* Hero */}
        <section className="bg-primary pt-32 pb-20 px-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-orange via-brand-navy to-brand-navy pointer-events-none"></div>
          <div className="max-w-[800px] mx-auto text-center relative z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto font-light leading-relaxed">
              No hidden fees. No lock-in contracts. Connect directly with domestic and international students across Australia.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-[1100px] mx-auto px-6 -mt-10 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Starter */}
            <div className="bg-surface rounded-[24px] p-8 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
              <h3 className="text-lg font-bold text-primary mb-2">Starter</h3>
              <p className="text-text-secondary text-sm mb-6">For small providers just getting started.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">Free</span>
                <span className="text-text-muted text-sm ml-2">to list</span>
              </div>
              <ul className="space-y-3 text-sm text-text-secondary mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Up to 3 property listings
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Standard search placement
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Direct student messaging
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Basic inquiry analytics
                </li>
              </ul>
              <Link href="/register" className="w-full text-center py-3 rounded-xl border border-border-strong text-primary font-semibold hover:bg-surface-muted transition-colors">
                Get Started
              </Link>
            </div>

            {/* Growth / Professional */}
            <div className="bg-surface rounded-[24px] p-8 border-2 border-accent shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">Professional</h3>
              <p className="text-text-secondary text-sm mb-6">For growing accommodation businesses and boutique operators.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">$99</span>
                <span className="text-text-muted text-sm ml-2">/ month</span>
              </div>
              <ul className="space-y-3 text-sm text-text-secondary mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Up to 15 property listings
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Priority placement in search
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Advanced analytics & reporting
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Dedicated account manager
                </li>
              </ul>
              <Link href="/register" className="w-full text-center py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent transition-colors shadow-lg">
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-surface rounded-[24px] p-8 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
              <h3 className="text-lg font-bold text-primary mb-2">Enterprise</h3>
              <p className="text-text-secondary text-sm mb-6">For large-scale PBSA operators and multi-building portfolios.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">Custom</span>
              </div>
              <ul className="space-y-3 text-sm text-text-secondary mb-8 flex-1">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Everything in Professional
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  PMS / API integrations
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Volume portfolio pricing
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  SLA & 24/7 priority support
                </li>
              </ul>
              <Link href="/contact" className="w-full text-center py-3 rounded-xl border border-border-strong text-primary font-semibold hover:bg-surface-muted transition-colors">
                Contact Sales
              </Link>
            </div>

          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="max-w-[900px] mx-auto px-6 mt-24">
          <div className="bg-surface rounded-[24px] p-8 md:p-12 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="text-3xl font-semibold text-primary mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
              Provider Questions & Answers
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-border-subtle pb-4">
                  <h3 className="text-lg font-semibold text-primary">{faq.question}</h3>
                  <p className="mt-2 text-text-secondary leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <EditorialFooter />
    </div>
  );
}
