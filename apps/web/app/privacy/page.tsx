import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Privacy Policy | Jesmond",
  description: "How Jesmond collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <StaticPageLayout
      title="Privacy Policy"
      subtitle="Last updated: October 1, 2024"
    >
      <h2>1. Introduction</h2>
      <p>
        At Jesmond, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our platform.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li><strong>Personal Information:</strong> Name, email address, phone number, and date of birth when you register for an account.</li>
        <li><strong>Application Information:</strong> Passport details, visa status, university enrollment details, and financial proof required by providers for tenancy applications.</li>
        <li><strong>Usage Data:</strong> Information about how you use our platform, including IP address, browser type, pages visited, and search queries.</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>
        We use the information we collect to:
      </p>
      <ul>
        <li>Provide, operate, and maintain our platform.</li>
        <li>Process and manage your accommodation applications.</li>
        <li>Communicate with you, including sending updates, security alerts, and support messages.</li>
        <li>Improve and personalize your experience on the platform.</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>4. Sharing Your Information</h2>
      <p>
        We only share your information with:
      </p>
      <ul>
        <li><strong>Accommodation Providers:</strong> When you submit an application, we share your application profile with the specific provider you applied to.</li>
        <li><strong>Service Providers:</strong> Third-party vendors that help us operate our platform (e.g., hosting, email delivery, analytics).</li>
        <li><strong>Legal Authorities:</strong> If required by law or to protect our rights and the safety of our users.</li>
      </ul>

      <h2>5. Data Security</h2>
      <p>
        We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You have the right to access, correct, or delete your personal information. You can manage your information directly from your Account Settings. If you wish to completely delete your account, please contact our support team.
      </p>
    </StaticPageLayout>
  );
}
