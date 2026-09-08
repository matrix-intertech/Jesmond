import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Accessibility | Jesmond",
  description: "Jesmond's commitment to digital accessibility.",
};

export default function AccessibilityPage() {
  return (
    <StaticPageLayout
      title="Accessibility Statement"
      subtitle="Committed to providing an inclusive experience for all students."
    >
      <h2>Our Commitment</h2>
      <p>
        Jesmond is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
      </p>

      <h2>Conformance Status</h2>
      <p>
        The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA. Jesmond is partially conformant with WCAG 2.1 level AA. Partially conformant means that some parts of the content do not fully conform to the accessibility standard.
      </p>

      <h2>Feedback</h2>
      <p>
        We welcome your feedback on the accessibility of Jesmond. Please let us know if you encounter accessibility barriers on our platform so we can work to resolve them.
      </p>
      <ul>
        <li>Email: accessibility@jesmond.com.au</li>
        <li>Phone: 1300 JES MOND</li>
      </ul>
      <p>
        We try to respond to feedback within 2 business days.
      </p>

      <h2>Compatibility with Browsers and Assistive Technology</h2>
      <p>
        Jesmond is designed to be compatible with standard assistive technologies. However, it may not display optimally on older browsers. We recommend using the latest versions of Chrome, Safari, Firefox, or Edge.
      </p>
    </StaticPageLayout>
  );
}
