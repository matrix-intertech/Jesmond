import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Create a Jesmond Account | Student Accommodation",
  },
  description: "Create your free Jesmond account to find, compare, and apply for verified student accommodation in Australia.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
