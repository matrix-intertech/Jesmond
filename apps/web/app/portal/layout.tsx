import type { Metadata } from "next";
import PortalLayoutClient from "./PortalLayoutClient";

export const metadata: Metadata = {
  title: {
    absolute: "Partner Portal & Management Dashboard | Jesmond",
  },
  description: "Manage student accommodation listings, tenant applications, and retail operations on Jesmond.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
