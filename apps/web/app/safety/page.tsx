import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "Student Safety Guide & Emergency Contacts | Jesmond",
  },
  description:
    "Essential safety guide for international students in Australia. Emergency contact numbers (000), campus security protocols, beach safety, and rental scam prevention.",
  alternates: {
    canonical: "/safety",
  },
  openGraph: {
    title: "Student Safety Guide & Emergency Contacts | Jesmond",
    description:
      "Essential safety guide for international students in Australia. Emergency contact numbers (000), campus security protocols, beach safety, and rental scam prevention.",
    url: "/safety",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Student Safety Guide & Emergency Contacts | Jesmond",
    description:
      "Essential safety guide for international students in Australia. Emergency contact numbers (000), campus security protocols, beach safety, and rental scam prevention.",
  },
};

const faqs = [
  {
    question: "What number do I call for an emergency in Australia?",
    answer:
      "For any life-threatening emergency (Police, Fire, or Ambulance), dial 000 immediately. The call is free from all mobile phones and landlines, even if your phone has no SIM card or prepaid credit.",
  },
  {
    question: "How can students avoid rental accommodation scams in Australia?",
    answer:
      "Never transfer money via untraceable methods (cryptocurrency, Western Union) before verifying the provider's Australian Business Number (ABN) and legal lease contract. All residential rental bonds must be lodged with state tenancy authorities (such as the RTBA in Victoria or RBO in NSW) rather than paid into an individual's personal account.",
  },
  {
    question: "What should I do if caught in a rip current at an Australian beach?",
    answer:
      "Do not panic and do not try to swim directly back against the current to shore. Float calmly, raise one arm high into the air to attract the attention of surf lifesavers, and swim parallel to the beach to escape the rip.",
  },
  {
    question: "Is free mental health support available for international students in Australia?",
    answer:
      "Yes. International students can contact Lifeline on 13 11 14 (available 24/7 for crisis support), Beyond Blue on 1300 22 4636, or their university's on-campus student counseling services.",
  },
];

export default function SafetyPage() {
  return (
    <StaticPageLayout
      title="Student Safety Guide"
      subtitle="Australia is widely recognized as one of the safest study destinations in the world. Review essential emergency services, campus security, and practical safety tips."
    >
      <JsonLd data={getFaqSchema(faqs)} />

      <h2>Critical Emergency Contacts</h2>
      <p>
        In Australia, emergency services are consolidated into a single primary contact number:
      </p>
      <ul>
        <li><strong>000 (Triple Zero):</strong> Police, Fire Brigade, and Ambulance for life-threatening or immediate emergencies. Free from any phone.</li>
        <li><strong>131 444:</strong> Police Assistance Line for non-urgent reporting (such as theft or property damage where immediate response is not required).</li>
        <li><strong>1800 333 000:</strong> Crime Stoppers for anonymous crime reporting.</li>
        <li><strong>13 11 14:</strong> Lifeline for 24/7 crisis support and mental health suicide prevention.</li>
        <li><strong>1800 737 732:</strong> 1800RESPECT for national domestic, family, and sexual violence counseling.</li>
      </ul>

      <h2>Campus Security & University Protocols</h2>
      <p>
        Australian university campuses maintain dedicated 24/7 security personnel. Key campus safety services include:
      </p>
      <ul>
        <li><strong>Security Escort Services:</strong> If you are studying late in libraries or research laboratories, security escorts are available upon request to accompany you safely to your on-campus room, transit stop, or vehicle.</li>
        <li><strong>SafeZone Mobile App:</strong> Many Australian universities (including Monash, USYD, and RMIT) utilize the free SafeZone app, allowing students to trigger emergency alerts or request first aid instantly.</li>
        <li><strong>Emergency Call Points:</strong> Prominently lit emergency pillars with direct push-to-talk buttons are placed along main pedestrian walkways across Australian campuses.</li>
      </ul>

      <h2>Accommodation Security Standards</h2>
      <p>
        Jesmond verifies every accommodation provider to ensure student housing meets rigorous safety and tenancy benchmarks:
      </p>
      <ul>
        <li><strong>Access Control:</strong> Purpose-Built Student Accommodation (PBSA) buildings utilize electronic keycard access for main entrances, elevators, and individual bedroom suites.</li>
        <li><strong>CCTV & Staffing:</strong> 24-hour on-site management, reception desks, and monitored CCTV in communal corridors and entryways.</li>
        <li><strong>Fire Safety Compliance:</strong> Annual fire alarm inspections, certified smoke detectors, and clearly marked emergency evacuation stairwells in accordance with Australian Building Codes.</li>
      </ul>

      <h2>Beach, Water & Environmental Safety</h2>
      <p>
        Australian coastal waters are scenic but can have strong undertows and rip currents. To stay safe:
      </p>
      <ul>
        <li><strong>Always Swim Between the Flags:</strong> Only swim at patrolled beaches between the red and yellow flags. Surf lifesavers monitor this designated zone continuously.</li>
        <li><strong>Rip Current Awareness:</strong> If caught in a rip, do not battle the current. Float, conserve your energy, and signal for help by raising one arm.</li>
        <li><strong>Sun Protection:</strong> Australia has high UV index levels. Practice the <em>Slip, Slop, Slap, Seek, Slide</em> routine with broad-spectrum SPF 50+ sunscreen, a hat, and sunglasses.</li>
      </ul>

      <h2>Rental & Financial Scam Awareness</h2>
      <p>
        International students can sometimes be targeted by rental fraud on unverified classifieds platforms. Stay alert to common warning signs:
      </p>
      <ul>
        <li>Never wire money or pay deposits to landlords who refuse to verify their identity through an Australian Business Number (ABN) or Australian Company Number (ACN).</li>
        <li>Beware of rent prices that are drastically lower than market averages for prime inner-city locations.</li>
        <li>Verify that your bond deposit will be lodged with the statutory state authority (such as the RTBA in Victoria or RBO in New South Wales).</li>
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

      <h2>Helpful Resources for Students</h2>
      <ul>
        <li><Link href="/guide">Accommodation Guide</Link> — Learn how to choose secure student housing.</li>
        <li><Link href="/cost">Cost of Living</Link> — Budgeting for medical cover and living expenses.</li>
        <li><Link href="/moving">Moving to Australia</Link> — Essential arrival checklist and setup.</li>
        <li><Link href="/support">Jesmond Support Center</Link> — Direct support for accommodation issues.</li>
      </ul>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Explore Verified Secure Housing
        </Link>
      </p>
    </StaticPageLayout>
  );
}
