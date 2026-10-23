import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "Cost of Living in Australia for Students | Jesmond",
  },
  description:
    "Complete breakdown of student living costs in Australia. Compare average weekly expenses, university accommodation rent, and official financial requirements.",
  alternates: {
    canonical: "/cost",
  },
  openGraph: {
    title: "Cost of Living in Australia for Students | Jesmond",
    description:
      "Complete breakdown of student living costs in Australia. Compare average weekly expenses, university accommodation rent, and official financial requirements.",
    url: "/cost",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Cost of Living in Australia for Students | Jesmond",
    description:
      "Complete breakdown of student living costs in Australia. Compare average weekly expenses, university accommodation rent, and official financial requirements.",
  },
};

const faqs = [
  {
    question: "What is the official minimum living cost requirement for an Australian student visa?",
    answer:
      "Under Department of Home Affairs regulations updated on 10 May 2024, international applicants for the Student Visa (Subclass 500) must demonstrate evidence of financial capacity of at least AUD $29,710 per year to cover living expenses.",
  },
  {
    question: "Which Australian cities have the most affordable student housing?",
    answer:
      "While Sydney and Melbourne are typically the most expensive cities for student rentals, cities such as Adelaide, Brisbane, and Perth offer comparatively lower median weekly rents and accessible public transport concessions.",
  },
  {
    question: "Are utilities typically included in Australian student accommodation?",
    answer:
      "In Purpose-Built Student Accommodation (PBSA), utilities such as electricity, water, heating, and unlimited high-speed Wi-Fi are almost always included in the weekly rent. In private rentals or sharehouses, utilities are usually billed separately.",
  },
  {
    question: "Can international students work to support their living costs in Australia?",
    answer:
      "Yes. Student Visa (Subclass 500) holders are permitted to work up to 48 hours per fortnight during university terms, and unlimited hours during scheduled semester breaks, at or above the Australian National Minimum Wage.",
  },
];

export default function CostPage() {
  return (
    <StaticPageLayout
      title="Cost of Living in Australia"
      subtitle="Understand official financial requirements, weekly living expenses, and budgeting strategies across Australian university cities."
    >
      <JsonLd data={getFaqSchema(faqs)} />

      <h2>Official Visa Financial Requirements</h2>
      <p>
        To obtain an Australian Student Visa (Subclass 500), the Australian Department of Home Affairs requires international applicants to demonstrate sufficient funds to cover tuition, travel, and living costs.
      </p>
      <p>
        Under official Australian Department of Home Affairs regulations updated on 10 May 2024, the minimum 12-month living cost evidentiary benchmark is <strong>AUD $29,710 per year</strong> for a primary student applicant. Having this financial foundation ensures you can focus on your studies without undue financial pressure.
      </p>

      <h2>Average Weekly Student Expenses Overview</h2>
      <p>
        Weekly expenses vary based on your choice of city, accommodation type, and lifestyle habits. On average, university students in Australia spend between <strong>$450 and $850 AUD per week</strong> in total living expenses.
      </p>

      <div className="overflow-x-auto my-6">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-strong text-primary">
              <th className="py-3 pr-4 font-semibold">Expense Category</th>
              <th className="py-3 px-4 font-semibold">Weekly Range (AUD)</th>
              <th className="py-3 pl-4 font-semibold">Key Considerations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Accommodation (PBSA / Shared Flat)</td>
              <td className="py-3 px-4">$220 – $600+</td>
              <td className="py-3 pl-4">PBSA includes all utilities and amenities; sharehouse rents exclude bills</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Groceries & Cooking at Home</td>
              <td className="py-3 px-4">$120 – $220</td>
              <td className="py-3 pl-4">Shopping at major supermarkets (Coles, Woolworths, Aldi)</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Public Transit (Bus, Train, Tram)</td>
              <td className="py-3 px-4">$30 – $60</td>
              <td className="py-3 pl-4">Concessions apply in Victoria, Queensland, SA, WA, and ACT</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Mobile Phone & Internet</td>
              <td className="py-3 px-4">$10 – $25</td>
              <td className="py-3 pl-4">Prepaid student SIM plans (5G data bundles)</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-primary">Personal & Entertainment</td>
              <td className="py-3 px-4">$60 – $140</td>
              <td className="py-3 pl-4">Dining out, fitness, movies, and student social clubs</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>City-by-City Cost Comparison</h2>
      <ul>
        <li><strong>Sydney & Melbourne:</strong> Leading academic hubs with vibrant metropolitan lifestyles. Median PBSA rent ranges from $380 to $650/week, with higher general dining costs.</li>
        <li><strong>Brisbane & Gold Coast:</strong> Subtropical climate with moderate living costs. Median student rent ranges from $280 to $480/week, with integrated Translink public transit.</li>
        <li><strong>Adelaide & Perth:</strong> Highly affordable study destinations offering lower median accommodation prices ($230 to $420/week) and generous tertiary student transport discounts.</li>
      </ul>

      <h2>Practical Money-Saving Tips for Students</h2>
      <ul>
        <li><strong>Choose All-Inclusive PBSA:</strong> Purpose-Built Student Accommodation bundles electricity, water, air conditioning, and high-speed Wi-Fi into a single weekly rent, eliminating unexpected utility bills and setup deposits.</li>
        <li><strong>Leverage Student ID Discounts:</strong> Keep your digital or physical university student card handy. Most Australian cinemas, museums, public transit authorities, software vendors, and retailers offer 10% to 30% discounts.</li>
        <li><strong>Understand Your Work Rights:</strong> Australian Student Visa holders can legally work up to 48 hours per fortnight during semester terms and unlimited hours during breaks, helping offset day-to-day living costs.</li>
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

      <h2>Related Student Resources</h2>
      <ul>
        <li><Link href="/guide">Accommodation Guide</Link> — Understanding rental bonds, leases, and student rights.</li>
        <li><Link href="/international">International Student Guide</Link> — Essential guidance for overseas arrivals.</li>
        <li><Link href="/visa">Visa Resources</Link> — Subclass 500 requirements and work entitlements.</li>
        <li><Link href="/moving">Moving Checklist</Link> — Relocation planning, banking, and SIM cards.</li>
      </ul>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Find Housing Within Your Budget
        </Link>
      </p>
    </StaticPageLayout>
  );
}
