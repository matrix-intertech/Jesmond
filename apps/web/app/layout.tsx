import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import AppViewportWrapper from "@/components/layout/AppViewportWrapper";
import StudentMobileBottomNavGate from "@/components/layout/StudentMobileBottomNavGate";
import { PushNotificationInitializer } from "@/components/notifications/PushNotificationInitializer";
import { getSiteUrl } from "@/utils/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jesmond | Accommodation, Retail & Local Services",
    template: "%s | Jesmond",
  },
  description:
    "Jesmond connects customers with verified accommodation, local retail stores, and essential services across Australia.",
  openGraph: {
    title: "Jesmond | Accommodation, Retail & Local Services",
    description:
      "Jesmond connects customers with verified accommodation, local retail stores, and essential services across Australia.",
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
    title: "Jesmond | Accommodation, Retail & Local Services",
    description:
      "Jesmond connects customers with verified accommodation, local retail stores, and essential services across Australia.",
  },
  icons: {
    icon: [
      { url: "/assets/icon.svg", type: "image/svg+xml" },
      { url: "/assets/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reqHeaders = await headers();
  const isBusinessPortal = reqHeaders.get("x-portal") === "business";

  return (
    <html
      lang="en"
      data-theme={isBusinessPortal ? "business" : undefined}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-outfit antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:font-bold focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white transition-all"
        >
          Skip to main content
        </a>
        <PushNotificationInitializer />
        <AppViewportWrapper>{children}</AppViewportWrapper>
        <StudentMobileBottomNavGate />
      </body>
    </html>
  );
}
