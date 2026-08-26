// apps/web/components/ui/StatCard.tsx
"use client";

import { ReactNode } from "react";

/**
 * StatCard – compact metric card used on dashboards.
 *
 * Props:
 *   label:       short label describing the metric (e.g., "Total Properties")
 *   value:       primary value to display (string or number). Must be a real value from API.
 *   icon?:      optional inline SVG element displayed on the left side
 *   description?: optional smaller text, e.g., "Updated 5 min ago"
 *   loading?:   when true shows a skeleton placeholder instead of content
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  loading?: boolean;
}

export default function StatCard({
  label,
  value,
  icon,
  description,
  loading = false,
}: StatCardProps) {
  return (
    <div className="flex items-center rounded-xl bg-white p-4 shadow-sm border border-gray-200 space-x-4">
      {loading ? (
        // Skeleton for icon/value when loading
        <div className="animate-pulse flex space-x-4">
          <div className="rounded bg-gray-200 w-8 h-8" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ) : (
        <>
          {icon && <div className="flex-shrink-0 text-slate-600">{icon}</div>}
          <div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-brand-navy">
              {value}
            </p>
            {description && (
              <p className="mt-1 text-xs text-slate-400">{description}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
