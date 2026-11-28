import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Create a Jesmond Account | Customer Registration",
  },
  description: "Create your free Jesmond account to find, compare, and book verified accommodation, retail, and local services in Australia.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
