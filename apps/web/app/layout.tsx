import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import StudentMobileBottomNavGate from "@/components/layout/StudentMobileBottomNavGate";
import { PushNotificationInitializer } from "@/components/notifications/PushNotificationInitializer";
import { getSiteUrl } from "@/utils/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jesmond | Student Accommodation, Retail & Local Services",
    template: "%s | Jesmond",
  },
  description:
    "Jesmond connects students with verified accommodation, local retail stores, and essential services across Australia.",
  openGraph: {
    title: "Jesmond | Student Accommodation, Retail & Local Services",
    description:
      "Jesmond connects students with verified accommodation, local retail stores, and essential services across Australia.",
    url: siteUrl,
    siteName: "Jesmond",
    locale: "en_AU",
    type: "website",
    images: [
      {
        url: "/assets/logo_navbar.png",
        width: 140,
        height: 36,
        alt: "Jesmond",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jesmond | Student Accommodation, Retail & Local Services",
    description:
      "Jesmond connects students with verified accommodation, local retail stores, and essential services across Australia.",
  },
  icons: {
    icon: [
      { url: "/assets/icon.svg", type: "image/svg+xml" },
      { url: "/assets/icon.png" },
    ],
    apple: "/assets/icon.png",
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PushNotificationInitializer />
        <div className="pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
        <StudentMobileBottomNavGate />
      </body>
    </html>
  );
}
