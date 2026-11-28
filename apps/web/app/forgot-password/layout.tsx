import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Forgot Password | Jesmond Account Recovery",
  },
  description: "Reset your Jesmond customer or partner account password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
