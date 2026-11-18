// apps/web/components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getDashboardHeading, User } from "@/utils/auth";
import { NotificationDropdown } from "../notifications/NotificationDropdown";

interface HeaderProps {
  user?: User | null;
}

export default function Header({ user: propUser }: HeaderProps) {
  const [user, setUser] = useState<User | null>(propUser ?? null);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      setUser(getCurrentUser());
    }
  }, [propUser]);

  useEffect(() => {
    const handleStorage = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const effectiveUser = user ?? propUser ?? (typeof window !== "undefined" ? getCurrentUser() : null);
  const heading = getDashboardHeading(effectiveUser);

  return (
    <header className="flex items-center justify-between bg-surface/80 backdrop-blur-md border-b border-border-strong/60 px-4 sm:px-6 h-[76px] sticky top-0 z-20">
      <div className="flex items-center gap-3 pl-12 lg:pl-0 min-w-0">
        <h2
          data-testid="dashboard-header-title"
          className="text-lg sm:text-xl md:text-2xl font-bold font-outfit text-primary tracking-tight truncate"
        >
          {heading}
        </h2>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <NotificationDropdown />
      </div>
    </header>
  );
}
