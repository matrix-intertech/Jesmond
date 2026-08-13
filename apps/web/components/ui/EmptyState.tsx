// apps/web/components/ui/EmptyState.tsx
"use client";

import { ReactNode } from "react";

/**
 * EmptyState – display when a collection has no items.
 * Props:
 *   icon: optional inline SVG element
 *   title: required string
 *   description: optional string
 *   action?: { label: string; href: string } – optional primary action button
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {icon && <div className="text-slate-400">{icon}</div>}
      <h2 className="text-xl font-outfit font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-600 max-w-md text-center">{description}</p>}
      {action && (
        <a
          href={action.href}
          className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
