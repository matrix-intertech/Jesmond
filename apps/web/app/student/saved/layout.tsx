import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Saved Properties | Student Portal | Jesmond",
  },
  description: "View and manage your saved student properties on Jesmond.",
  robots: { index: false, follow: false },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
