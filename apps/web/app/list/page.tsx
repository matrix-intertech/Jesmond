import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: "List Your Property | Jesmond",
  description: "Partner with Jesmond to list your student accommodation and reach verified students.",
};

export default function ListPage() {
  return (
    <StaticPageLayout
      title="List Your Property"
      subtitle="Reach thousands of verified students looking for quality accommodation in Australia."
    >
      <h2>Why List with Jesmond?</h2>
      <p>
        Jesmond connects accommodation providers directly with verified, enrolled students. Our platform handles the heavy lifting — from student verification and application management to secure payment processing — so you can focus on providing great housing.
      </p>

      <h2>How It Works</h2>
      <ul>
        <li><strong>1. Create a Provider Account:</strong> Register on Jesmond and complete the verification process. We'll verify your business registration and property ownership.</li>
        <li><strong>2. Add Your Properties:</strong> Upload property details, room types, photos, amenities, and pricing through our intuitive Provider Portal.</li>
        <li><strong>3. Receive Applications:</strong> Verified students apply directly through the platform. You can review, approve, or reject applications from your dashboard.</li>
        <li><strong>4. Manage & Grow:</strong> Track occupancy, manage your calendar, and gain insights into demand for your properties.</li>
      </ul>

      <h2>What You'll Need</h2>
      <ul>
        <li>A valid Australian Business Number (ABN) or Australian Company Number (ACN).</li>
        <li>Proof of property ownership or management authority.</li>
        <li>High-quality photos and accurate descriptions of your accommodation.</li>
      </ul>

      <h2>Ready to Get Started?</h2>
      <p>
        Create a free provider account and start listing your properties today. Our team is available to help you through the onboarding process.
      </p>
      <p className="mt-4 flex flex-col sm:flex-row gap-4">
        <Link href="/register" className="font-semibold px-6 py-3 bg-brand-orange text-white rounded-xl no-underline hover:bg-orange-600 transition-colors inline-block text-center">
          Create Provider Account
        </Link>
        <Link href="/contact" className="font-semibold px-6 py-3 bg-white text-brand-navy border border-slate-200 rounded-xl no-underline hover:bg-surface-muted transition-colors inline-block text-center">
          Contact Sales
        </Link>
      </p>
    </StaticPageLayout>
  );
}
