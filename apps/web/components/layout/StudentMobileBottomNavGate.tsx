"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import MobileBottomNav from "./MobileBottomNav";
import { getCurrentUser, type User } from "@/utils/auth";

const hiddenPrefixes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const protectedPrefixes = [
  "/admin",
  "/messages",
  "/my-orders",
  "/portal",
  "/settings",
  "/student",
];

export default function StudentMobileBottomNavGate() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  if (!user && protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return <MobileBottomNav role={user?.role as any} />;
}
