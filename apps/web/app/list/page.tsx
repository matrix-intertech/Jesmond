import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: {
    absolute: "List Your Property | Partner with Jesmond",
  },
  description: "Partner with Jesmond to list your verified student accommodation and reach thousands of domestic and international students.",
  alternates: {
    canonical: "/list",
  },
  openGraph: {
    title: "List Your Property | Partner with Jesmond",
    description: "Partner with Jesmond to list your verified student accommodation and reach thousands of domestic and international students.",
    url: "/list",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "List Your Property | Partner with Jesmond",
    description: "Partner with Jesmond to list your verified student accommodation.",
  },
};

export default function ListPage() {
  return (
    <StaticPageLayout
      title="List Your Property"
      subtitle="Reach thousands of verified students looking for quality accommodation in Australia."
    >
      <h2>Why List with Jesmond?</h2>
      <p>
        Jesmond connects accommodation providers directly with verified, enrolled students. Our platform handles the heavy lifting — from student verification and application management to secure communication — so you can focus on providing great housing.
      </p>

      <h2>How It Works</h2>
      <ul>
        <li><strong>1. Create a Provider Account:</strong> Register on Jesmond and complete the verification process. We'll verify your business registration and property ownership.</li>
        <li><strong>2. Add Your Properties:</strong> Upload property details, room types, photos, amenities, and pricing through our intuitive Provider Portal.</li>
        <li><strong>3. Receive Applications:</strong> Verified students apply directly through the platform. You can review, approve, or reject applications from your dashboard.</li>
        <li><strong>4. Seamless Communication:</strong> Message prospective tenants directly through the built-in platform chat.</li>
      </ul>

      <h2>Who Can List?</h2>
      <p>
        We partner with Purpose-Built Student Accommodation (PBSA) operators, university colleges, verified private landlords, and licensed real estate agencies managing student housing across Australia.
      </p>

      <p className="mt-8">
        <Link href="/portal" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Open Business Portal
        </Link>
      </p>
    </StaticPageLayout>
  );
}
