import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: "Accommodation Guide | Jesmond",
  description: "Your complete guide to finding and securing student accommodation in Australia.",
};

export default function GuidePage() {
  return (
    <StaticPageLayout
      title="Student Accommodation Guide"
      subtitle="Everything you need to know about finding, securing, and moving into your new home in Australia."
    >
      <h2>Types of Student Accommodation</h2>
      <p>
        When studying in Australia, there are several accommodation options to consider. Jesmond specializes in <strong>Purpose-Built Student Accommodation (PBSA)</strong>, which offers the best balance of community, convenience, and security.
      </p>
      <ul>
        <li><strong>Purpose-Built Student Accommodation (PBSA):</strong> Specifically designed for students, offering private or shared rooms with fantastic communal facilities like gyms, cinemas, and study spaces. Highly recommended for international and domestic students alike.</li>
        <li><strong>Residential Colleges:</strong> Typically located on-campus and often include meals, academic support, and strong traditions.</li>
        <li><strong>Private Rentals:</strong> Renting a house or apartment directly from a landlord or real estate agent. This option offers more independence but requires you to manage your own bills and furniture.</li>
        <li><strong>Homestay:</strong> Living with a local Australian family. A great way to immerse yourself in the culture and improve English skills.</li>
      </ul>

      <h2>When to Start Looking</h2>
      <p>
        The student housing market in Australia is highly competitive, especially in major cities like Sydney and Melbourne. We strongly recommend starting your search <strong>at least 3-4 months before your semester begins</strong>.
      </p>

      <h2>What to Consider</h2>
      <ul>
        <li><strong>Budget:</strong> Ensure you account for rent, utilities (if not included), food, transport, and lifestyle expenses. PBSA often includes utilities and internet in the weekly rent.</li>
        <li><strong>Location:</strong> Consider the commute time to your university, access to public transport, and the local neighborhood vibe.</li>
        <li><strong>Contract Length:</strong> Most student accommodations offer 6-month or 12-month leases aligned with the university semesters.</li>
      </ul>

      <h2>Securing Your Room</h2>
      <p>
        To secure a room on Jesmond, you'll need to create an account, complete your profile with verified student details, and submit an application. You may be required to pay a holding deposit and provide proof of enrollment.
      </p>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-brand-orange text-white rounded-xl no-underline hover:bg-orange-600 transition-colors inline-block">
          Start Your Search
        </Link>
      </p>
    </StaticPageLayout>
  );
}
