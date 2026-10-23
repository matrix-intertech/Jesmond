import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: {
    absolute: "Accessibility Statement & Standards | Jesmond",
  },
  description:
    "Jesmond is committed to digital accessibility and WCAG 2.1 AA standards for students, accommodation seekers, and partners across Australia.",
  alternates: {
    canonical: "/accessibility",
  },
  openGraph: {
    title: "Accessibility Statement & Standards | Jesmond",
    description:
      "Jesmond is committed to digital accessibility and WCAG 2.1 AA standards for students, accommodation seekers, and partners across Australia.",
    url: "/accessibility",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Accessibility Statement & Standards | Jesmond",
    description:
      "Jesmond is committed to digital accessibility and WCAG 2.1 AA standards for students, accommodation seekers, and partners across Australia.",
  },
};

export default function AccessibilityPage() {
  return (
    <StaticPageLayout
      title="Accessibility Statement"
      subtitle="Committed to providing an inclusive, accessible web experience for all students and partners."
    >
      <h2>Our Digital Accessibility Commitment</h2>
      <p>
        Jesmond is dedicated to ensuring digital accessibility for individuals with disabilities. We continually improve the user experience of our marketplace platform by applying relevant accessibility standards and best practices across modern assistive technologies.
      </p>

      <h2>Conformance Standards (WCAG 2.1 Level AA)</h2>
      <p>
        The Web Content Accessibility Guidelines (WCAG) define requirements for designers and developers to improve accessibility for people with disabilities. It outlines three levels of conformance: Level A, Level AA, and Level AAA.
      </p>
      <p>
        Jesmond aims to conform with <strong>WCAG 2.1 Level AA</strong> across all core student search, accommodation discovery, and account flows. Key measures include:
      </p>
      <ul>
        <li><strong>Keyboard Navigation:</strong> All interactive elements, including search filters, forms, and navigation menus, are operable via keyboard tab navigation.</li>
        <li><strong>Color Contrast:</strong> Text colors and UI controls meet or exceed standard contrast ratios (at least 4.5:1 for normal text).</li>
        <li><strong>Screen Reader Support:</strong> Form controls include accessible labels and ARIA attributes for screen readers.</li>
        <li><strong>Semantic HTML:</strong> Pages use proper heading hierarchies (H1 through H3) and semantic landmarks.</li>
      </ul>

      <h2>Feedback & Accessibility Assistance</h2>
      <p>
        We welcome your feedback on the accessibility of Jesmond. If you encounter any accessibility barriers while using our website or portal, please let us know:
      </p>
      <ul>
        <li><strong>Email:</strong> accessibility@jesmond.com.au</li>
        <li><strong>Phone:</strong> +61 2 8000 0000</li>
        <li><strong>Mailing Address:</strong> Accessibility Team, Jesmond Australia Pty Ltd, Level 10, 100 Harris Street, Pyrmont NSW 2009</li>
      </ul>
      <p>
        We aim to respond to accessibility inquiries and remediation requests within two business days.
      </p>

      <h2>Browser & Assistive Technology Compatibility</h2>
      <p>
        Jesmond is tested for compatibility with current versions of major web browsers (Chrome, Firefox, Safari, Edge) alongside modern screen readers such as NVDA, JAWS, and VoiceOver. For optimal performance, we recommend keeping your browser updated to the latest release.
      </p>
    </StaticPageLayout>
  );
}
