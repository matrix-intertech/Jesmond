import type { Metadata } from "next";
import StudentLayoutClient from "../student/StudentLayoutClient";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default function StudentGroupLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutClient>{children}</StudentLayoutClient>;
}
