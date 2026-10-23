import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Reset Password | Jesmond Account Security",
  },
  description: "Set a new secure password for your Jesmond account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
