"use client";

import RetailGuard from "@/components/retail/RetailGuard";

export default function RetailPortalLayout({ children }: { children: React.ReactNode }) {
  // We use RetailGuard at the root of /portal/retail to enforce basic RETAIL type checks.
  // Specific modules will use RetailGuard internally with requirePermissions.
  return (
    <RetailGuard>
      {children}
    </RetailGuard>
  );
}
