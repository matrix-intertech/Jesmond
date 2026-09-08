import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Cookies Policy | Jesmond",
  description: "How Jesmond uses cookies and tracking technologies.",
};

export default function CookiesPage() {
  return (
    <StaticPageLayout
      title="Cookies Policy"
      subtitle="Last updated: October 1, 2024"
    >
      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide reporting information.
      </p>

      <h2>2. How We Use Cookies</h2>
      <p>
        Jesmond uses cookies for several reasons:
      </p>
      <ul>
        <li><strong>Essential Cookies:</strong> These are strictly necessary to provide you with the core functionality of our platform, such as logging into secure areas or processing applications.</li>
        <li><strong>Performance and Analytics Cookies:</strong> These help us understand how visitors interact with our platform by collecting and reporting information anonymously (e.g., Google Analytics).</li>
        <li><strong>Functionality Cookies:</strong> These allow the platform to remember choices you make (such as your user name, language, or the region you are in) and provide enhanced, more personal features.</li>
      </ul>

      <h2>3. Third-Party Cookies</h2>
      <p>
        In some special cases, we also use cookies provided by trusted third parties. For example, we use third-party payment gateways (like Stripe) that may set cookies to process your payments securely.
      </p>

      <h2>4. Managing Cookies</h2>
      <p>
        You have the right to decide whether to accept or reject cookies. You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our platform though your access to some functionality and areas may be restricted.
      </p>

      <p>
        For more detailed information on how to control cookies, please visit the help or settings menu of your specific browser.
      </p>
    </StaticPageLayout>
  );
}
