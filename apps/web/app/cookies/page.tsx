import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: {
    absolute: "Cookies Policy & Tracking Preferences | Jesmond",
  },
  description:
    "Learn how Jesmond uses cookies and tracking technologies to deliver verified accommodation services, secure logins, and analytics across Australia.",
  alternates: {
    canonical: "/cookies",
  },
  openGraph: {
    title: "Cookies Policy & Tracking Preferences | Jesmond",
    description:
      "Learn how Jesmond uses cookies and tracking technologies to deliver verified accommodation services, secure logins, and analytics across Australia.",
    url: "/cookies",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Cookies Policy & Tracking Preferences | Jesmond",
    description:
      "Learn how Jesmond uses cookies and tracking technologies to deliver verified accommodation services, secure logins, and analytics across Australia.",
  },
};

export default function CookiesPage() {
  return (
    <StaticPageLayout
      title="Cookies Policy"
      subtitle="Last updated: October 2024 — How Jesmond utilizes cookies, local storage, and tracking technologies."
    >
      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used by online platforms to ensure security, maintain user sessions, remember user preferences, and provide analytical reporting.
      </p>

      <h2>2. Categories of Cookies We Use</h2>
      <p>
        Jesmond classifies cookies into the following categories:
      </p>
      <ul>
        <li><strong>Strictly Necessary Cookies:</strong> Essential for you to browse the platform and use features such as student account authentication, CSRF security verification, and booking application submissions. Without these cookies, the core services cannot function.</li>
        <li><strong>Functional Cookies:</strong> Enable the platform to remember choices you make, such as selected city filters, preferred search dates, and currency or localization settings.</li>
        <li><strong>Performance and Analytics Cookies:</strong> Collect aggregated, anonymous data on how visitors interact with our pages, helping us identify broken links, measure page load speeds, and optimize user experience.</li>
        <li><strong>Security Cookies:</strong> Help identify and prevent potential security risks, automated abuse, and fraud on student applications.</li>
      </ul>

      <h2>3. Third-Party Integrations</h2>
      <p>
        In specific instances, we rely on trusted third-party providers who may place cookies or access local browser storage on our behalf:
      </p>
      <ul>
        <li><strong>Cloudflare:</strong> Used for DDoS protection, bot management, and secure Turnstile verification during account creation.</li>
        <li><strong>Stripe:</strong> Used to securely facilitate application fee or rent payments in compliance with PCI-DSS standards.</li>
        <li><strong>Mapbox / OpenStreetMap:</strong> Used to display interactive campus and property maps.</li>
      </ul>

      <h2>4. Managing and Disabling Cookies</h2>
      <p>
        You have the right to decide whether to accept or decline cookies. Most web browsers automatically accept cookies, but you can modify your browser settings to decline them or alert you when a cookie is placed.
      </p>
      <p>
        Please note that disabling strictly necessary cookies may prevent you from logging into your account, submitting applications, or accessing provider dashboard features.
      </p>

      <h2>5. Updates to This Policy</h2>
      <p>
        We may update this Cookies Policy periodically to reflect changes in our operational practices or legal requirements. Any modifications will be posted here with an updated revision date.
      </p>
    </StaticPageLayout>
  );
}
