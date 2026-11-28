import { Suspense } from "react";
import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import {
  PricingCatalogClient,
  PricingCatalogSkeleton,
} from "../../components/subscriptions/PricingCatalogClient";

export const metadata = {
  title: {
    absolute: "Business Pricing & Plans | Jesmond",
  },
  description:
    "Profile-specific plans and entitlements for organizations on Jesmond.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <div data-theme="business" className="min-h-screen bg-[#1A100A] text-[#FFF9EF]">
      <GlobalNav />
      <main className="pb-24">
        <section className="bg-[#120D09] border-b border-[rgba(214,166,79,0.22)] pt-32 pb-20 px-6 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,138,50,0.16),_transparent_60%)]" />
          <div className="max-w-[800px] mx-auto text-center relative z-10">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-medium text-[#FFF9EF] mb-6 tracking-tight"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              Plans &amp; Pricing
            </h1>
            <p className="text-lg md:text-xl text-[#C9B69C] max-w-2xl mx-auto font-light leading-relaxed">
              Choose the plan tailored to your organization profile on Jesmond.
            </p>
          </div>
        </section>

        <Suspense fallback={<PricingCatalogSkeleton />}>
          <PricingCatalogClient />
        </Suspense>
      </main>
      <EditorialFooter />
    </div>
  );
}
