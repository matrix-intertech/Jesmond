"use client";

import { useEffect, useState } from "react";
import MobileBottomNav from "./MobileBottomNav";
import { getCurrentUser, type User } from "@/utils/auth";

export default function StudentMobileBottomNavGate() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (!user) return null;

  return <MobileBottomNav role={user.role as any} />;
}
