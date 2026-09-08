import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: "Cost of Living in Australia | Jesmond",
  description: "A guide to understanding the cost of living for international students in Australia.",
};

export default function CostPage() {
  return (
    <StaticPageLayout
      title="Cost of Living"
      subtitle="Understand the financial requirements and typical expenses for students living in Australia."
    >
      <h2>Government Requirements</h2>
      <p>
        The Australian Government requires international students to demonstrate they have access to sufficient funds to cover their living costs, tuition, and travel expenses. As of recent updates, the minimum required living cost for a single student is approximately <strong>$24,505 AUD per year</strong>.
      </p>

      <h2>Typical Weekly Expenses</h2>
      <p>
        Living costs vary significantly depending on the city you choose and your lifestyle. Sydney and Melbourne are generally the most expensive, while Brisbane, Adelaide, and Perth are more affordable.
      </p>
      <ul>
        <li><strong>Accommodation:</strong> $200 – $600+ (PBSA usually includes bills and internet)</li>
        <li><strong>Groceries and eating out:</strong> $140 – $280</li>
        <li><strong>Gas, electricity (if not included in rent):</strong> $10 – $20</li>
        <li><strong>Phone and internet:</strong> $15 – $30</li>
        <li><strong>Public transport:</strong> $30 – $60</li>
        <li><strong>Entertainment:</strong> $80 – $150</li>
      </ul>

      <h2>Tips for Saving Money</h2>
      <ul>
        <li><strong>Choose PBSA:</strong> Purpose-Built Student Accommodation often bundles utilities, internet, and gym access into the rent, saving you from unexpected bills and joining fees.</li>
        <li><strong>Student Discounts:</strong> Always carry your student ID. Many cinemas, museums, and retailers offer generous student discounts.</li>
        <li><strong>Cook at Home:</strong> Eating out in Australia is relatively expensive. Buying groceries at supermarkets (Coles, Woolworths, Aldi) and cooking your own meals will significantly reduce your weekly spend.</li>
      </ul>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-brand-orange text-white rounded-xl no-underline hover:bg-orange-600 transition-colors inline-block">
          Find Affordable Housing
        </Link>
      </p>
    </StaticPageLayout>
  );
}
