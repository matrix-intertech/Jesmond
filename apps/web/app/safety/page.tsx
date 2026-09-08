import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Safety Guide | Jesmond",
  description: "Important safety information and emergency contacts for students in Australia.",
};

export default function SafetyPage() {
  return (
    <StaticPageLayout
      title="Student Safety Guide"
      subtitle="Australia is generally a very safe country, but it's important to know how to stay secure and who to contact in an emergency."
    >
      <h2>Emergency Contacts</h2>
      <p>
        In a life-threatening emergency, always dial <strong>000</strong>. This number connects you to Police, Fire, and Ambulance services. It is free from any phone, even if you don't have credit.
      </p>
      <ul>
        <li><strong>000</strong> - Police, Fire, Ambulance (Life-threatening emergencies)</li>
        <li><strong>131 444</strong> - Police Assistance Line (For non-emergencies)</li>
        <li><strong>1800 333 000</strong> - Crime Stoppers (To report crime anonymously)</li>
      </ul>

      <h2>Campus Security</h2>
      <p>
        Most university campuses have 24/7 security teams. Make sure you save your university's security phone number in your contacts. Many universities also offer free security escort services if you are studying late at the library and need to walk to your car or accommodation.
      </p>

      <h2>Accommodation Security</h2>
      <p>
        Jesmond only lists verified Purpose-Built Student Accommodation (PBSA) and trusted providers. Most of these buildings feature:
      </p>
      <ul>
        <li>Secure keycard or fob access</li>
        <li>24/7 onsite staff or security</li>
        <li>CCTV monitoring in common areas</li>
      </ul>
      <p>
        Always ensure your room door is locked when you leave, and never let strangers follow you into secure areas of your building (tailgating).
      </p>

      <h2>Water Safety</h2>
      <p>
        Australian beaches are beautiful but can be dangerous due to strong currents (rips). Always swim at patrolled beaches and <strong>only swim between the red and yellow flags</strong>. If you get caught in a rip, do not panic or swim against it. Raise your hand to signal for help.
      </p>

      <h2>Sun Safety</h2>
      <p>
        The sun in Australia is incredibly strong. Always remember to Slip, Slop, Slap, Seek, and Slide:
      </p>
      <ul>
        <li><strong>Slip</strong> on a shirt</li>
        <li><strong>Slop</strong> on sunscreen (SPF 50+)</li>
        <li><strong>Slap</strong> on a hat</li>
        <li><strong>Seek</strong> shade</li>
        <li><strong>Slide</strong> on sunglasses</li>
      </ul>
    </StaticPageLayout>
  );
}
