import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Sign in to Jesmond | Student & Partner Account",
  },
  description: "Sign in to your Jesmond account to manage accommodation bookings and partner listings.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
