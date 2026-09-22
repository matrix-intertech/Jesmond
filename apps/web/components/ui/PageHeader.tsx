// apps/web/components/ui/PageHeader.tsx
"use client";

import Link from "next/link";
import { ReactNode } from "react";

/**
 * PageHeader – reusable header for dashboard pages.
 *
 * Props:
 *   title:            Main page title (required)
 *   description?:     Subtitle / description under the title
 *   breadcrumb?:      Optional breadcrumb navigation (array of { href, label })
 *   primaryAction?:   Optional primary action – renders a button that links somewhere
 *   secondaryAction?: Optional secondary action – renders a button that links somewhere
 *
 * The component uses the existing Tailwind‑based design system (colors, typography,
 * spacing, rounded corners) to stay visually consistent with Header, Sidebar and
 * ConfirmationDialog.
 */
export interface ActionProps {
  label: string;
  href: string;
  // Optional click handler for client‑side actions – if omitted the button is a link.
  onClick?: () => void;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  primaryAction?: ActionProps;
  secondaryAction?: ActionProps;
  onBack?: () => void;
}

export default function PageHeader({
  title,
  description,
  breadcrumb,
  primaryAction,
  secondaryAction,
  onBack,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex overflow-x-auto text-sm text-slate-500" aria-label="breadcrumb">
          <ol className="inline-flex items-center space-x-2">
            {breadcrumb.map((item, idx) => (
              <li key={idx} className="flex items-center">
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
                {idx < breadcrumb.length - 1 && (
                  <svg
                    className="w-3 h-3 mx-2 text-slate-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M7.05 4.05a.75.75 0 011.06 0L13 8.94l-4.89 4.89a.75.75 0 11-1.06-1.06L10.88 9.5 7.05 5.66a.75.75 0 010-1.06z" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Title & description */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button onClick={onBack} className="text-sm font-semibold text-brand-orange hover:underline mb-2 block">&larr; Back</button>
          )}
          <h1 className="break-words font-outfit text-2xl font-semibold text-brand-navy sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-base text-slate-600">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {(primaryAction || secondaryAction) && (
          <div className="flex w-full flex-col gap-3 sm:mt-0 sm:w-auto sm:flex-row sm:items-center">
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                onClick={secondaryAction.onClick as any}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-brand-navy transition hover:bg-surface-muted"
              >
                {secondaryAction.label}
              </Link>
            )}
            {primaryAction && (
              <Link
                href={primaryAction.href}
                onClick={primaryAction.onClick as any}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-navy/90"
              >
                {primaryAction.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
