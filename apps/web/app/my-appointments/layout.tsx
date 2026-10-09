import type { Metadata } from "next";

export const metadata: Metadata = {
 title: "My Appointments",
 description: "View your upcoming and past appointments.",
 robots: { index: false, follow: false },
};

export default function MyAppointmentsLayout({ children }: { children: React.ReactNode }) {
 return <>{children}</>;
}
