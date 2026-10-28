import { Suspense } from "react";
import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";
import { SUPPORT_ARTICLES } from "./support-data";
import { SupportClient } from "./SupportClient";

export const metadata = {
  title: {
    absolute: "Help & Support | Jesmond Assistance Center",
  },
  description:
    "Get help with finding student accommodation, managing your bookings, account settings, and using Jesmond.",
  alternates: {
    canonical: "/support",
  },
  openGraph: {
    title: "Help & Support | Jesmond Assistance Center",
    description:
      "Get help with finding student accommodation, managing your bookings, account settings, and using Jesmond.",
    url: "/support",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Help & Support | Jesmond",
    description:
      "Get help with finding student accommodation, managing your bookings, and using Jesmond.",
  },
};

export default function SupportPage() {
  const supportFaqs = SUPPORT_ARTICLES.slice(0, 8).map((article) => ({
    question: article.title,
    answer: article.content,
  }));

  return (
    <div className="min-h-screen bg-surface-muted">
      <JsonLd data={getFaqSchema(supportFaqs)} />
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className="pb-24 outline-none">
        <Suspense
          fallback={
            <div className="bg-primary pt-32 pb-24 px-6 text-center text-white">
              <div className="max-w-[800px] mx-auto">
                <h1
                  className="text-4xl md:text-5xl font-medium text-white mb-6"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  How can we help?
                </h1>
                <p className="text-lg text-text-muted mb-10">
                  Search our knowledge base or browse categories below.
                </p>
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                </div>
              </div>
            </div>
          }
        >
          <SupportClient />
        </Suspense>
      </main>
      <EditorialFooter />
    </div>
  );
}
