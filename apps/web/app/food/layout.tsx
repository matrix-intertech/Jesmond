import type { Metadata } from "next";
import FoodLayoutClient from "./FoodLayoutClient";

export const metadata: Metadata = {
  title: "Food Orders",
  robots: { index: false, follow: false },
};

export default function FoodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FoodLayoutClient>{children}</FoodLayoutClient>;
}
