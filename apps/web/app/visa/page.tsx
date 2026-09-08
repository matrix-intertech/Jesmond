import { StaticPageLayout } from "../../components/ui/StaticPageLayout";

export const metadata = {
  title: "Student Visa Resources | Jesmond",
  description: "Information about the Subclass 500 Student Visa for Australia.",
};

export default function VisaPage() {
  return (
    <StaticPageLayout
      title="Student Visa Resources"
      subtitle="Understand the basics of the Australian Student Visa (Subclass 500)."
    >
      <h2>The Subclass 500 Visa</h2>
      <p>
        To study in Australia, you will need to apply for a Student Visa (Subclass 500). This visa allows you to live, work, and study in Australia for up to 5 years in line with your enrollment.
      </p>

      <h2>Key Requirements</h2>
      <ul>
        <li><strong>Confirmation of Enrollment (CoE):</strong> You must have a CoE from an Australian education provider before applying.</li>
        <li><strong>Genuine Student (GS) Requirement:</strong> You must prove you are coming to Australia temporarily to gain a quality education.</li>
        <li><strong>English Language Proficiency:</strong> You may need to provide evidence of your English language skills (e.g., IELTS, TOEFL).</li>
        <li><strong>Financial Capacity:</strong> You must show you have enough money to cover your travel, tuition, and living expenses.</li>
        <li><strong>Health and Character:</strong> You must meet the health and character requirements, which includes holding Overseas Student Health Cover (OSHC).</li>
      </ul>

      <h2>Work Rights</h2>
      <p>
        Once your course has commenced, the Student Visa generally allows you to work up to <strong>48 hours per fortnight</strong> while your course is in session, and unlimited hours during recognized course breaks.
      </p>

      <h2>Official Resources</h2>
      <p>
        Always rely on the official Australian Government Department of Home Affairs website for the most accurate and up-to-date visa information.
      </p>
      <ul>
        <li><a href="https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500" target="_blank" rel="noopener noreferrer">Department of Home Affairs - Subclass 500</a></li>
        <li><a href="https://www.studyaustralia.gov.au/" target="_blank" rel="noopener noreferrer">Study Australia</a></li>
      </ul>
    </StaticPageLayout>
  );
}
