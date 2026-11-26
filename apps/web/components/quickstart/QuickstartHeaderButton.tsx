'use client';

import React from 'react';
import { CircleHelp } from 'lucide-react';
import { useQuickstart } from './QuickstartProvider';

export function QuickstartHeaderButton() {
  const ctx = useQuickstart();
  if (!ctx || !ctx.config) return null;

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={ctx.openGuide}
        data-testid="quickstart-header-btn"
        aria-label="Quickstart Guide"
        title="Quickstart Guide"
        className="relative flex items-center justify-center w-9 h-9 rounded-full border border-border-strong/70 bg-surface-muted/70 hover:bg-surface-muted text-text-secondary hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <CircleHelp className="w-4 h-4" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-white shadow-md z-50"
      >
        Quickstart Guide
      </span>
    </div>
  );
}
