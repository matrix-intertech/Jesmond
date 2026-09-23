import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import StudentMobileBottomNavGate from "@/components/layout/StudentMobileBottomNavGate";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Jesmond",
  description: "Jesmond Provider and Admin Portal",
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
        <div className="pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
        <StudentMobileBottomNavGate />
      </body>
    </html>
  );
}
