"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import MobileBottomNav from "./MobileBottomNav";
import { getCurrentUser, isBusinessHost, type User } from "@/utils/auth";

const hiddenPrefixes = [
 "/login",
 "/register",
 "/forgot-password",
 "/reset-password",
 "/business",
 "/auth/callback",
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
 const [isBusinessDomain, setIsBusinessDomain] = useState(false);

 useEffect(() => {
 setUser(getCurrentUser());
 setIsBusinessDomain(isBusinessHost());
 }, []);

 if (isBusinessDomain) {
 return null;
 }

 if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
 return null;
 }

 if (!user && protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
 return null;
 }

 return <MobileBottomNav role={user?.role as any} />;
}
