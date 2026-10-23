import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "International Student Accommodation & Guide | Jesmond",
  },
  description:
    "Comprehensive guide for international students studying in Australia. Compare verified PBSA accommodation, understand rental bonds, and prepare for arrival.",
  alternates: {
    canonical: "/international",
  },
  openGraph: {
    title: "International Student Accommodation & Guide | Jesmond",
    description:
      "Comprehensive guide for international students studying in Australia. Compare verified PBSA accommodation, understand rental bonds, and prepare for arrival.",
    url: "/international",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "International Student Accommodation & Guide | Jesmond",
    description:
      "Comprehensive guide for international students studying in Australia. Compare verified PBSA accommodation, understand rental bonds, and prepare for arrival.",
  },
};

const faqs = [
  {
    question: "Can I book student accommodation in Australia before arriving?",
    answer:
      "Yes. Most international students secure their accommodation online prior to departure. Through Jesmond, every listed provider undergoes strict identity and property verification, allowing you to review room types, lease contracts, and virtual tours with confidence before flying.",
  },
  {
    question: "What is Purpose-Built Student Accommodation (PBSA)?",
    answer:
      "PBSA properties are residential buildings designed specifically for university students. They typically offer furnished private or shared rooms, bundled utilities (water, gas, electricity, high-speed Wi-Fi), secure keycard access, and communal facilities like study lounges, gyms, and laundry.",
  },
  {
    question: "How do rental bonds work for international students in Australia?",
    answer:
      "A rental bond is a security deposit (usually 4 weeks' rent) paid at the start of your tenancy. In Australia, the bond is legally required to be lodged with an independent state government authority (such as the RTBA in Victoria or RBO in NSW), rather than kept directly in the landlord's personal account.",
  },
  {
    question: "What documents do international students need to apply for housing?",
    answer:
      "To apply for student housing, you generally need your passport, Confirmation of Enrolment (CoE) or university acceptance letter, Student Visa (Subclass 500) confirmation, and emergency contact details.",
  },
];

export default function InternationalPage() {
  return (
    <StaticPageLayout
      title="International Student Guide"
      subtitle="Everything you need to find safe, verified student housing and settle smoothly into university life in Australia."
    >
      <JsonLd data={getFaqSchema(faqs)} />

      <h2>Finding Safe Student Housing in Australia</h2>
      <p>
        Moving to a new country for higher education is an exciting milestone, but securing reliable housing from abroad can be daunting. Australia has strict residential tenancy laws that protect international students, and understanding the options available ensures a seamless transition.
      </p>
      <p>
        Jesmond provides a verified marketplace where accommodation providers are thoroughly vetted for business legitimacy (ABN/ACN), property ownership, and safety compliance before their listings become active.
      </p>

      <h2>Comparing Australian Student Accommodation Types</h2>
      <div className="overflow-x-auto my-6">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-strong text-primary">
              <th className="py-3 pr-4 font-semibold">Housing Type</th>
              <th className="py-3 px-4 font-semibold">Typical Weekly Rent</th>
              <th className="py-3 px-4 font-semibold">Utilities Included</th>
              <th className="py-3 pl-4 font-semibold">Best Suited For</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Purpose-Built Student Accommodation (PBSA)</td>
              <td className="py-3 px-4">$350 – $650+</td>
              <td className="py-3 px-4 text-emerald-600 font-medium">Yes (All-inclusive)</td>
              <td className="py-3 pl-4">First-year & international students seeking community and security</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Shared Apartments / Flatshares</td>
              <td className="py-3 px-4">$220 – $400</td>
              <td className="py-3 px-4">Split among tenants</td>
              <td className="py-3 pl-4">Budget-conscious students comfortable managing bills together</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">University On-Campus Colleges</td>
              <td className="py-3 px-4">$400 – $750</td>
              <td className="py-3 px-4 text-emerald-600 font-medium">Yes (Often meals included)</td>
              <td className="py-3 pl-4">Students wanting immediate campus proximity and catered meals</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Private Rental Studios / 1-Beds</td>
              <td className="py-3 px-4">$450 – $700+</td>
              <td className="py-3 px-4">Usually excluded</td>
              <td className="py-3 pl-4">Independent students or couples desiring complete privacy</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Pre-Arrival Relocation Checklist</h2>
      <p>
        Before boarding your flight to Australia, ensure you have completed the following essential milestones:
      </p>
      <ul>
        <li><strong>Confirm Your Visa (Subclass 500):</strong> Verify that your visa grant notice is active, and review your student visa conditions (including work rights and mandatory Overseas Student Health Cover).</li>
        <li><strong>Secure Your Lease:</strong> Finalize your lease agreement and obtain your written tenancy agreement (e.g. Form 1 in Victoria, Standard Form Agreement in NSW).</li>
        <li><strong>Arrange Airport Transit:</strong> Check whether your university or PBSA operator offers a free airport pickup service from Sydney (SYD), Melbourne (MEL), Brisbane (BNE), or Perth (PER).</li>
        <li><strong>Prepare Financial Documentation:</strong> Carry copies of your Confirmation of Enrolment (CoE), proof of tuition payment, and initial accommodation deposit receipts in your carry-on luggage.</li>
      </ul>

      <h2>Frequently Asked Questions</h2>
      <div className="space-y-6 mt-6">
        {faqs.map((faq, index) => (
          <div key={index} className="border-b border-border-subtle pb-4">
            <h3 className="text-lg font-semibold text-primary">{faq.question}</h3>
            <p className="mt-2 text-text-secondary">{faq.answer}</p>
          </div>
        ))}
      </div>

      <h2>Helpful Guides & Resources</h2>
      <ul>
        <li><Link href="/guide">Accommodation Guide</Link> — Detailed tenancy laws, lease terms, and inspection advice.</li>
        <li><Link href="/cost">Cost of Living</Link> — Accurate weekly budgets across Sydney, Melbourne, and Brisbane.</li>
        <li><Link href="/visa">Student Visa Resources</Link> — Genuine Student criteria and 48-hour fortnightly work rights.</li>
        <li><Link href="/moving">Moving to Australia</Link> — Biosecurity, airport arrival, SIM cards, and TFN applications.</li>
        <li><Link href="/safety">Safety Guide</Link> — Australian emergency numbers (000), beach safety, and campus security.</li>
      </ul>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Explore Verified Accommodations
        </Link>
      </p>
    </StaticPageLayout>
  );
}
