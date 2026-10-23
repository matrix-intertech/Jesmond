import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "Moving to Australia | Student Relocation Checklist | Jesmond",
  },
  description:
    "Essential pre-departure checklist for international students moving to Australia. Covers biosecurity, student banking, TFN, transit passes, and housing setup.",
  alternates: {
    canonical: "/moving",
  },
  openGraph: {
    title: "Moving to Australia | Student Relocation Checklist | Jesmond",
    description:
      "Essential pre-departure checklist for international students moving to Australia. Covers biosecurity, student banking, TFN, transit passes, and housing setup.",
    url: "/moving",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Moving to Australia | Student Relocation Checklist | Jesmond",
    description:
      "Essential pre-departure checklist for international students moving to Australia. Covers biosecurity, student banking, TFN, transit passes, and housing setup.",
  },
};

const faqs = [
  {
    question: "What biosecurity rules apply when flying into Australia?",
    answer:
      "Australia has stringent biosecurity laws to protect its environment and agriculture. You must declare all food, plant material, seeds, and wooden items on your Incoming Passenger Card. Failure to declare items can lead to on-the-spot fines or visa cancellation.",
  },
  {
    question: "Can I open an Australian bank account before arriving?",
    answer:
      "Yes. Major Australian banks (such as Commonwealth Bank, ANZ, NAB, and Westpac) permit international students to open everyday student accounts online up to 3 months prior to arrival. You can transfer funds before departure and verify your identity in branch with your passport upon landing.",
  },
  {
    question: "How do I apply for an Australian Tax File Number (TFN)?",
    answer:
      "Once you physically arrive in Australia and your Student Visa (Subclass 500) is in effect, you can apply for a TFN for free online through the Australian Taxation Office (ATO) website. Your TFN is necessary to work legally and avoid being taxed at the maximum emergency rate.",
  },
  {
    question: "What electrical plug type does Australia use?",
    answer:
      "Australia uses Type I electrical plugs (three flat pins in a triangular shape, 230V, 50Hz). It is recommended to bring at least one universal Type I travel adapter for your electronic devices.",
  },
];

export default function MovingPage() {
  return (
    <StaticPageLayout
      title="Moving to Australia"
      subtitle="A step-by-step relocation guide and practical checklist for international students preparing for study Down Under."
    >
      <JsonLd data={getFaqSchema(faqs)} />

      <h2>1. Pre-Departure Checklist (3 Months to 1 Month Before)</h2>
      <p>
        Moving to Australia involves systematic preparation. Organizing your visa documents, healthcare, and housing early prevents last-minute disruptions.
      </p>
      <ul>
        <li><strong>Student Visa (Subclass 500):</strong> Verify that your visa grant notice is confirmed and note your visa conditions (8105 work limitation, 8501 health cover).</li>
        <li><strong>Overseas Student Health Cover (OSHC):</strong> Ensure your OSHC policy covers the full duration of your visa from your intended arrival date.</li>
        <li><strong>Secure Verified Accommodation:</strong> Finalize housing before departure. Explore <Link href="/search">Jesmond</Link> for verified PBSA listings to avoid overseas deposit scams.</li>
        <li><strong>Digital & Physical Records:</strong> Prepare copies of your Confirmation of Enrolment (CoE), academic transcripts, vaccination records, and valid passport.</li>
      </ul>

      <h2>2. Packing & Australian Biosecurity Rules</h2>
      <p>
        Australia enforces rigorous border biosecurity measures governed by the Department of Agriculture, Fisheries and Forestry. On your flight, you will receive an <em>Incoming Passenger Card</em>. Always declare any food, teas, traditional medicines, animal products, or wooden goods. If in doubt, declare it — declaration prevents heavy fines.
      </p>
      <p>
        Pack versatile clothing appropriate for your host city. Melbourne and Hobart experience cold winters requiring thermal layers and waterproof jackets, while Brisbane and Darwin have warm, humid subtropical climates year-round.
      </p>

      <h2>3. First 48 Hours in Australia</h2>
      <ul>
        <li><strong>Airport Transfer:</strong> Check if your university or PBSA operator offers complimentary airport pickup. Alternatively, airport trains and licensed rideshares operate at all international terminals.</li>
        <li><strong>Local SIM / eSIM:</strong> Obtain an Australian mobile plan upon landing (Telstra, Optus, or Vodafone networks) for seamless local 5G data connectivity.</li>
        <li><strong>Activate Banking:</strong> Visit a local branch of your selected Australian bank with your passport and student ID to complete physical identity verification and receive your debit card.</li>
        <li><strong>Apply for a Tax File Number (TFN):</strong> Submit your free TFN application on the Australian Taxation Office (ATO) portal once you are on Australian soil.</li>
      </ul>

      <h2>4. State-by-State Public Transport Cards</h2>
      <p>
        Australia’s capital cities operate tap-and-go contactless transit cards. Depending on your study destination, obtain the corresponding card:
      </p>
      <ul>
        <li><strong>New South Wales (Sydney):</strong> Opal Card (contactless credit/debit card also accepted).</li>
        <li><strong>Victoria (Melbourne):</strong> Myki Card (available on Android via Google Wallet or physical card).</li>
        <li><strong>Queensland (Brisbane):</strong> Translink Go Card.</li>
        <li><strong>South Australia (Adelaide):</strong> MetroCard.</li>
        <li><strong>Western Australia (Perth):</strong> SmartRider (tertiary concession available upon student enrollment).</li>
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

      <h2>Helpful Resources for New Students</h2>
      <ul>
        <li><Link href="/cost">Cost of Living Guide</Link> — Realistic budgets and weekly expense breakdowns.</li>
        <li><Link href="/safety">Student Safety Guide</Link> — Emergency contacts (000), beach safety, and campus support.</li>
        <li><Link href="/visa">Visa Resources</Link> — Subclass 500 conditions and work rights.</li>
        <li><Link href="/universities">Australian University Directory</Link> — Explore campuses across Australia.</li>
      </ul>

      <p className="mt-8">
        <Link href="/universities" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Explore University Hubs
        </Link>
      </p>
    </StaticPageLayout>
  );
}
