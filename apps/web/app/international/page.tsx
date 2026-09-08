import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: "International Students | Jesmond",
  description: "Dedicated resources and accommodation for international students studying in Australia.",
};

export default function InternationalPage() {
  return (
    <StaticPageLayout 
      title="International Students" 
      subtitle="Everything you need to find safe, verified student housing in Australia — from anywhere in the world."
    >
      <h2>Booking from Overseas</h2>
      <p>
        We understand that finding accommodation in a country you've never visited can be stressful. Jesmond was built specifically to solve this problem. Every property on our platform is <strong>verified</strong> — meaning the photos are accurate, the provider is legitimate, and the rooms are real.
      </p>
      <p>
        You can browse, compare, and apply for accommodation entirely online. No need to fly to Australia first.
      </p>

      <h2>Why Jesmond for International Students?</h2>
      <ul>
        <li><strong>100% Verified Providers:</strong> We check every provider's ABN, identity, and property ownership before they can list. No scams.</li>
        <li><strong>Transparent Pricing:</strong> Prices are displayed in AUD per week. No hidden fees or surprise charges on arrival.</li>
        <li><strong>Secure Applications:</strong> Your personal data is encrypted and only shared with the provider you apply to.</li>
        <li><strong>Student Support:</strong> Our team is available via email and phone to help you through the process.</li>
      </ul>

      <h2>Helpful Resources</h2>
      <ul>
        <li><Link href="/guide">Accommodation Guide</Link> — Types of housing, what to look for, and how to apply.</li>
        <li><Link href="/visa">Visa Resources</Link> — Understanding the Student Visa (Subclass 500).</li>
        <li><Link href="/moving">Moving to Australia</Link> — A complete pre-departure checklist.</li>
        <li><Link href="/cost">Cost of Living</Link> — Budgeting for your time in Australia.</li>
        <li><Link href="/safety">Safety Guide</Link> — Emergency contacts and staying safe.</li>
      </ul>

      <h2>Start Your Search</h2>
      <p>
        Find verified accommodation near your university. Filter by city, budget, and room type.
      </p>
      <p className="mt-4">
        <Link href="/search" className="font-semibold px-6 py-3 bg-brand-orange text-white rounded-xl no-underline hover:bg-orange-600 transition-colors inline-block">
          Find Accommodation
        </Link>
      </p>
    </StaticPageLayout>
  );
}
