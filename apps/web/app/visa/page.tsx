import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";
import { JsonLd, getFaqSchema } from "@/components/seo/JsonLd";

export const metadata = {
  title: {
    absolute: "Student Visa 500 Guide & Work Rights | Jesmond Australia",
  },
  description:
    "Essential guide to Australia's Student Visa (Subclass 500). Requirements, 48-hour fortnightly work rights, Genuine Student criteria, and OSHC health cover.",
  alternates: {
    canonical: "/visa",
  },
  openGraph: {
    title: "Student Visa 500 Guide & Work Rights | Jesmond Australia",
    description:
      "Essential guide to Australia's Student Visa (Subclass 500). Requirements, 48-hour fortnightly work rights, Genuine Student criteria, and OSHC health cover.",
    url: "/visa",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Student Visa 500 Guide & Work Rights | Jesmond Australia",
    description:
      "Essential guide to Australia's Student Visa (Subclass 500). Requirements, 48-hour fortnightly work rights, Genuine Student criteria, and OSHC health cover.",
  },
};

const faqs = [
  {
    question: "How many hours can international students work in Australia?",
    answer:
      "Under Condition 8105 of the Student Visa (Subclass 500), students are permitted to work up to 48 hours per fortnight while university is in session, and unlimited hours during officially recognized semester breaks.",
  },
  {
    question: "What is the Genuine Student (GS) requirement?",
    answer:
      "The Genuine Student requirement evaluates whether an applicant genuinely intends to obtain a quality Australian education and understands course outcomes, career pathways, and living obligations in Australia.",
  },
  {
    question: "Is Overseas Student Health Cover (OSHC) mandatory?",
    answer:
      "Yes. International students must maintain continuous OSHC from an approved Australian health insurance provider (such as Medibank, Bupa, Allianz Care, or nib) for the entire duration of their stay.",
  },
  {
    question: "Can I bring family members on a Subclass 500 visa?",
    answer:
      "Yes. Immediate family members (such as a spouse, de facto partner, or dependent children) can be included as secondary applicants on your student visa application.",
  },
];

export default function VisaPage() {
  return (
    <StaticPageLayout
      title="Student Visa Resources"
      subtitle="Understand the key criteria, work entitlements, and health cover requirements for Australia's Student Visa (Subclass 500)."
    >
      <JsonLd data={getFaqSchema(faqs)} />

      <h2>The Subclass 500 Student Visa</h2>
      <p>
        The Student Visa (Subclass 500) allows international students to participate in an eligible course of tertiary study in Australia, travel in and out of the country, and work during term sessions. Visas are granted for up to five years depending on the duration of your enrolled course.
      </p>

      <h2>Core Eligibility Requirements</h2>
      <ul>
        <li><strong>Confirmation of Enrolment (CoE):</strong> You must be accepted into a registered Commonwealth Register of Institutions and Courses for Overseas Students (CRICOS) course before lodging your visa application.</li>
        <li><strong>Genuine Student (GS) Standard:</strong> Effective 23 March 2024, the Genuine Student criterion replaced the former Genuine Temporary Entrant (GTE) requirement to focus on genuine academic intent, course value, and career trajectory.</li>
        <li><strong>Financial Capacity:</strong> Evidence of meeting the annual living expense threshold (updated by Home Affairs on 10 May 2024 to AUD $29,710/year) plus return travel and remaining tuition fees.</li>
        <li><strong>English Language Proficiency:</strong> Standardized test scores (such as IELTS Academic, PTE Academic, or TOEFL iBT) meeting Australian Home Affairs minimum benchmarks.</li>
        <li><strong>Overseas Student Health Cover (OSHC):</strong> Proof of active health insurance covering medical consultations, hospitalization, and emergency ambulance services throughout your stay.</li>
      </ul>

      <h2>Work Rights and Conditions (Condition 8105)</h2>
      <p>
        Once your course commences, your student visa grants you the legal right to work up to <strong>48 hours per fortnight</strong> during active study periods (effective 1 July 2023 under revised Condition 8105). During scheduled university vacations (such as the summer break between November and February), you may work unlimited hours.
      </p>
      <p>
        All workers in Australia, including international students, are entitled to basic workplace protections and the National Minimum Wage under the Fair Work Act.
      </p>

      <h2>Frequently Asked Questions</h2>
      <div className="space-y-6 mt-6">
        {faqs.map((faq, index) => (
          <div key={index} className="border-b border-border-subtle pb-4">
            <h3 className="text-lg font-semibold text-primary">{faq.question}</h3>
            <p className="mt-2 text-text-secondary">{faq.answer}</p>
          </div>
        ))}
      </div>

      <h2>Official Australian Government Resources</h2>
      <p>
        For legal updates, processing times, and policy announcements, always reference official government departments:
      </p>
      <ul>
        <li><a href="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500" target="_blank" rel="noopener noreferrer">Department of Home Affairs — Subclass 500 Overview</a></li>
        <li><a href="https://www.studyaustralia.gov.au/" target="_blank" rel="noopener noreferrer">Study Australia — Australian Government Student Portal</a></li>
        <li><a href="https://www.fairwork.gov.au/" target="_blank" rel="noopener noreferrer">Fair Work Ombudsman — International Student Workplace Rights</a></li>
      </ul>

      <h2>Related Guides</h2>
      <ul>
        <li><Link href="/cost">Cost of Living</Link> — Financial requirements and weekly expense budgets.</li>
        <li><Link href="/moving">Moving to Australia</Link> — Pre-departure checklist, banking, and TFN.</li>
        <li><Link href="/safety">Student Safety</Link> — Emergency contacts (000) and campus support.</li>
      </ul>

      <p className="mt-8">
        <Link href="/search" className="font-semibold px-6 py-3 bg-accent text-white rounded-xl no-underline hover:bg-accent transition-colors inline-block">
          Find Verified Accommodation
        </Link>
      </p>
    </StaticPageLayout>
  );
}
