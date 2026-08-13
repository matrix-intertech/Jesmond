// apps/web/components/ui/ErrorState.tsx
"use client";

import { ReactNode } from "react";

/**
 * ErrorState – UI shown when a data fetch fails.
 * Props:
 *   title: required error title
 *   description?: optional details
 *   onRetry: callback invoked when the user clicks the retry button
 */
export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry: () => void;
}

export default function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {/* Simple error icon */}
      <svg
        className="w-12 h-12 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <circle cx="12" cy="16" r="1" />
      </svg>
      <h2 className="text-xl font-outfit font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-sm text-slate-600 max-w-md text-center">{description}</p>}
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
      >
        Try Again
      </button>
    </div>
  );
}
