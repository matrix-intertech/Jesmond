import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: "Moving to Australia | Jesmond",
  description: "Essential information for international students relocating to Australia.",
};

export default function MovingPage() {
  return (
    <StaticPageLayout
      title="Moving to Australia"
      subtitle="A comprehensive checklist and guide for international students preparing for their new life Down Under."
    >
      <h2>1. Before You Leave</h2>
      <ul>
        <li><strong>Student Visa (Subclass 500):</strong> Ensure your visa is approved and understand your work rights and conditions.</li>
        <li><strong>Overseas Student Health Cover (OSHC):</strong> It is mandatory to have health insurance covering the duration of your stay.</li>
        <li><strong>Accommodation:</strong> Secure your housing before arriving. Use <Link href="/search">Jesmond</Link> to book verified PBSA to avoid scams.</li>
        <li><strong>Flights & Airport Transfer:</strong> Book your flights and check if your university or accommodation provider offers an airport pickup service.</li>
      </ul>

      <h2>2. What to Pack</h2>
      <p>
        Australia has diverse climates depending on where you study. Melbourne can be cold in winter, while Brisbane remains warm year-round. Pack versatile layers, a good jacket, and comfortable walking shoes. Don't forget an international power adapter (Type I) and all your original important documents (Passport, Visa, CoE, OSHC details).
      </p>

      <h2>3. Arriving in Australia</h2>
      <ul>
        <li><strong>Customs and Quarantine:</strong> Australia has strict biosecurity laws. Do not bring fresh food, plant material, or animal products. Always declare any food or wooden items.</li>
        <li><strong>Getting a SIM Card:</strong> Pick up a prepaid SIM card at the airport (e.g., Telstra, Optus, or Vodafone) to stay connected immediately.</li>
      </ul>

      <h2>4. Setting Up Your Life</h2>
      <ul>
        <li><strong>Open a Bank Account:</strong> You can often start the process online before you arrive. Once in Australia, visit a branch with your passport and student ID to finalize it.</li>
        <li><strong>Tax File Number (TFN):</strong> If you plan to work, apply for a TFN online through the Australian Taxation Office (ATO) once you arrive.</li>
        <li><strong>Public Transport:</strong> Get a local transit card (e.g., Opal in Sydney, myki in Melbourne, Go Card in Brisbane) and check if you are eligible for student concessions.</li>
      </ul>

      <p className="mt-8">
        <Link href="/universities" className="font-semibold px-6 py-3 bg-brand-orange text-white rounded-xl no-underline hover:bg-orange-600 transition-colors inline-block">
          Explore University Hubs
        </Link>
      </p>
    </StaticPageLayout>
  );
}
