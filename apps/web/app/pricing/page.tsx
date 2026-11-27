import { Suspense } from "react";
import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { PricingCatalogClient } from "../../components/subscriptions/PricingCatalogClient";

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
    <div className="min-h-screen bg-surface-muted">
      <GlobalNav />
      <main className="pb-24">
        <section className="bg-primary pt-32 pb-20 px-6 relative overflow-hidden">
          <div className="max-w-[800px] mx-auto text-center relative z-10">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 tracking-tight"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              Plans &amp; Pricing
            </h1>
            <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto font-light leading-relaxed">
              Choose the plan tailored to your organization profile on Jesmond.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="max-w-[1100px] mx-auto px-6 py-16 text-center text-text-secondary">
              Loading pricing...
            </div>
          }
        >
          <PricingCatalogClient />
        </Suspense>
      </main>
      <EditorialFooter />
    </div>
  );
}
