"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isBusinessHost } from "@/utils/auth";

export default function AppViewportWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isBusinessDomain, setIsBusinessDomain] = useState(false);

  useEffect(() => {
    setIsBusinessDomain(isBusinessHost());
  }, []);

  const isAdminRoute = pathname === "/admin" || pathname?.startsWith("/admin/");
  const isBusinessPortalContext =
    !isAdminRoute &&
    (isBusinessDomain ||
      pathname === "/business" ||
      pathname.startsWith("/business/") ||
      pathname === "/auth/callback");

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isBusinessPortalContext) {
      document.documentElement.setAttribute("data-theme", "business");
      document.documentElement.style.backgroundColor = "#1A100A";
      document.body.style.backgroundColor = "#1A100A";
    } else {
      if (pathname !== "/pricing") {
        document.documentElement.removeAttribute("data-theme");
      }
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    }
  }, [isBusinessPortalContext, pathname]);

  if (isBusinessPortalContext) {
    return <div className="min-h-dvh bg-[#1A100A]">{children}</div>;
  }

  return (
    <div className="pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      {children}
    </div>
  );
}
