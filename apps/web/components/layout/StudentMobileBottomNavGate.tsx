"use client";

import { useEffect, useState } from "react";
import MobileBottomNav from "./MobileBottomNav";
import { getCurrentUser } from "@/utils/auth";

export default function StudentMobileBottomNavGate() {
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    setIsStudent(getCurrentUser()?.role === "STUDENT");
  }, []);

  if (!isStudent) return null;

  return <MobileBottomNav role="STUDENT" />;
}
