import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Saved Properties | Customer Portal | Jesmond",
  },
  description: "View and manage your saved properties on Jesmond.",
  robots: { index: false, follow: false },
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
