// apps/web/components/ui/StatusBadge.tsx
"use client";

import { ReactNode } from "react";

/**
 * StatusBadge – displays a compact, accessible badge for item status.
 *
 * Supported status values (exact strings):
 *   DRAFT, PENDING_APPROVAL, PUBLISHED, PENDING_REVIEW,
 *   APPROVED, REJECTED, SOLD_OUT, ENABLED, DISABLED
 *
 * The component maps each status to a restrained color palette that matches the
 * existing Jesmond design system (using Tailwind gray/blue/green/red shades).
 * It renders a <span> with appropriate aria-label for screen readers.
 */
export interface StatusBadgeProps {
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "PUBLISHED"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "SOLD_OUT"
    | "ENABLED"
    | "DISABLED";
}

const statusStyles: Record<StatusBadgeProps["status"], { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  PENDING_APPROVAL: { bg: "bg-yellow-100", text: "text-yellow-800" },
  PUBLISHED: { bg: "bg-green-100", text: "text-green-800" },
  PENDING_REVIEW: { bg: "bg-indigo-100", text: "text-indigo-800" },
  APPROVED: { bg: "bg-green-100", text: "text-green-800" },
  REJECTED: { bg: "bg-red-100", text: "text-red-800" },
  SOLD_OUT: { bg: "bg-gray-200", text: "text-gray-800" },
  ENABLED: { bg: "bg-blue-100", text: "text-blue-800" },
  DISABLED: { bg: "bg-gray-200", text: "text-gray-800" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles["DRAFT"];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
      aria-label={`status ${status}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
