import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Verification Process | Jesmond",
  description: "Learn how Jesmond verifies student accommodation providers.",
};

export default function VerificationPage() {
  return (
    <StaticPageLayout
      title="Our Verification Process"
      subtitle="How we ensure every property on Jesmond is safe, legitimate, and student-ready."
    >
      <h2>Why We Verify</h2>
      <p>
        The student housing market can sometimes be difficult to navigate, especially for international students booking from overseas. Scams and misleading listings are unfortunately common on unmoderated platforms. At Jesmond, we solve this by strictly verifying every provider before they can list a property.
      </p>

      <h2>The Verification Steps</h2>
      <ul>
        <li><strong>Business Registration Check:</strong> We verify the provider's Australian Business Number (ABN) or Australian Company Number (ACN) with the Australian Securities and Investments Commission (ASIC).</li>
        <li><strong>Identity Verification:</strong> We verify the identity of the company directors or authorized representatives using strict KYC (Know Your Customer) protocols.</li>
        <li><strong>Property Ownership & Management Authority:</strong> We require proof that the provider either owns the property or has the legal authority to manage and lease it.</li>
        <li><strong>Compliance Check:</strong> We ensure the provider adheres to local state tenancy laws and holds student bonds securely through the relevant state authority (e.g., RTBA in Victoria, Fair Trading in NSW).</li>
      </ul>

      <h2>What "Verified Partner" Means</h2>
      <p>
        When you see the <strong>Verified Partner</strong> badge on a listing, it means the property is managed by a certified provider who has passed our rigorous vetting process. You can book with certainty, knowing the room exists, the photos are accurate, and your funds are handled securely.
      </p>
    </StaticPageLayout>
  );
}
