import { StaticPageLayout } from "../../components/ui/StaticPageLayout";
import Link from "next/link";

export const metadata = {
  title: {
    absolute: "Contact Jesmond | Student & Provider Support",
  },
  description:
    "Get in touch with the Jesmond team. Contact our student support desk, accommodation provider relations team, or Sydney headquarters.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Jesmond | Student & Provider Support",
    description:
      "Get in touch with the Jesmond team. Contact our student support desk, accommodation provider relations team, or Sydney headquarters.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact Jesmond | Student & Provider Support",
    description:
      "Get in touch with the Jesmond team. Contact our student support desk, accommodation provider relations team, or Sydney headquarters.",
  },
};

export default function ContactPage() {
  return (
    <StaticPageLayout
      title="Get in Touch"
      subtitle="We're here to assist students, accommodation providers, and university partners across Australia."
    >
      <h2>Student Support Desk</h2>
      <p>
        If you are an international or domestic student seeking assistance with accommodation applications, booking confirmations, or account navigation:
      </p>
      <ul>
        <li><strong>Email:</strong> students@jesmond.com.au</li>
        <li><strong>Phone:</strong> +61 2 8000 0000</li>
        <li><strong>Hours:</strong> Monday – Friday, 9:00 AM – 5:00 PM (AEST)</li>
        <li><strong>Self-Service:</strong> Explore our <Link href="/support">Help & Support Center</Link> for instant answers to common questions.</li>
      </ul>

      <h2>Provider & Partner Relations</h2>
      <p>
        If you are a Purpose-Built Student Accommodation (PBSA) operator, real estate agency, or private landlord inquiring about listing properties or verification:
      </p>
      <ul>
        <li><strong>Email:</strong> partners@jesmond.com.au</li>
        <li><strong>Phone:</strong> +61 2 8000 0001</li>
        <li><strong>Hours:</strong> Monday – Friday, 8:30 AM – 6:00 PM (AEST)</li>
        <li><strong>Listing Inquiries:</strong> Learn about our partner tiers on the <Link href="/pricing">Provider Pricing</Link> page.</li>
      </ul>

      <h2>Australian Headquarters</h2>
      <p>
        <strong>Jesmond Australia Pty Ltd</strong><br />
        Level 10, 100 Harris Street<br />
        Pyrmont NSW 2009<br />
        Australia
      </p>

      <h2>Media & Press Enquiries</h2>
      <p>
        For media, academic research, and partnership inquiries, please contact our corporate communications office at media@jesmond.com.au.
      </p>
    </StaticPageLayout>
  );
}
