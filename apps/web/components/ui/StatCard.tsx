// apps/web/components/ui/StatCard.tsx
"use client";

import { ReactNode } from "react";

/**
 * StatCard – compact metric card used on dashboards.
 *
 * Props:
 * label: short label describing the metric (e.g., "Total Properties")
 * value: primary value to display (string or number). Must be a real value from API.
 * icon?: optional inline SVG element displayed on the left side
 * description?: optional smaller text, e.g., "Updated 5 min ago"
 * loading?: when true shows a skeleton placeholder instead of content
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
 <div className="flex min-w-0 items-center gap-3 sm:gap-4 rounded-xl bg-surface p-3.5 sm:p-4 shadow-sm border border-border-strong">
 {loading ? (
 // Skeleton for icon/value when loading
 <div className="animate-pulse flex w-full gap-3 sm:gap-4">
 <div className="rounded bg-secondary w-8 h-8 shrink-0" />
 <div className="flex-1 space-y-2 py-1 min-w-0">
 <div className="h-4 bg-secondary rounded w-3/4" />
 <div className="h-6 bg-secondary rounded w-1/2" />
 </div>
 </div>
 ) : (
 <>
 {icon && <div className="flex-shrink-0 text-text-secondary">{icon}</div>}
 <div className="min-w-0 flex-1">
 <p className="text-xs sm:text-sm text-text-secondary font-medium uppercase tracking-wider leading-snug break-words">
 {label}
 </p>
 <p className="mt-1 text-xl sm:text-2xl font-semibold text-primary truncate">
 {value}
 </p>
 {description && (
 <p className="mt-1 text-xs text-text-muted break-words">{description}</p>
 )}
 </div>
 </>
 )}
 </div>
 );
}
