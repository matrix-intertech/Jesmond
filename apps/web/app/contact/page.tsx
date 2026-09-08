import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Contact Us | Jesmond",
  description: "Get in touch with the Jesmond team.",
};

export default function ContactPage() {
  return (
    <StaticPageLayout
      title="Get in Touch"
      subtitle="We're here to help you with any questions or support you need."
    >
      <h2>Student Support</h2>
      <p>
        If you are a student looking for help with an application, finding a room, or managing your account:
      </p>
      <ul>
        <li>Email: students@jesmond.com.au</li>
        <li>Phone: +61 2 8000 0000</li>
        <li>Hours: Monday – Friday, 9:00 AM – 5:00 PM (AEST)</li>
      </ul>

      <h2>Provider Support</h2>
      <p>
        If you are an accommodation provider, property manager, or real estate agent looking to list properties or manage your portal:
      </p>
      <ul>
        <li>Email: partners@jesmond.com.au</li>
        <li>Phone: +61 2 8000 0001</li>
        <li>Hours: Monday – Friday, 8:30 AM – 6:00 PM (AEST)</li>
      </ul>

      <h2>Head Office</h2>
      <p>
        <strong>Jesmond Australia Pty Ltd</strong><br />
        Level 10, 100 Harris Street<br />
        Pyrmont NSW 2009<br />
        Australia
      </p>

      <h2>Press & Media</h2>
      <p>
        For all media inquiries, please contact our PR team at media@jesmond.com.au.
      </p>
    </StaticPageLayout>
  );
}
