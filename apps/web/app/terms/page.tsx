import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Terms of Service | Jesmond",
  description: "Terms and conditions for using the Jesmond platform.",
};

export default function TermsPage() {
  return (
    <StaticPageLayout
      title="Terms of Service"
      subtitle="Last updated: October 1, 2024"
    >
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing and using the Jesmond platform ("Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Jesmond provides a marketplace platform connecting verified student accommodation providers ("Providers") with students looking for housing ("Students"). Jesmond is not a real estate agent or a property manager. We simply facilitate the connection and application process.
      </p>

      <h2>3. User Accounts</h2>
      <p>
        To access certain features of the Platform, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password.
      </p>

      <h2>4. Booking and Applications</h2>
      <p>
        Submitting an application through the Platform does not guarantee a room. Providers retain the right to review and accept or reject applications based on their own criteria. Jesmond does not dictate the lease terms, which are agreed upon directly between the Student and the Provider.
      </p>

      <h2>5. Provider Responsibilities</h2>
      <p>
        Providers agree to ensure all listings are accurate, up-to-date, and comply with all applicable Australian state and federal laws, including consumer protection and residential tenancy laws.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Jesmond shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, good-will, or other intangible losses, resulting from your access to or use of or inability to access or use the Platform.
      </p>
    </StaticPageLayout>
  );
}
