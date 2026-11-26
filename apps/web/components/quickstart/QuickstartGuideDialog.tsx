'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CheckCircle2, Play, RotateCcw, X } from 'lucide-react';
import { useQuickstart } from './QuickstartProvider';

export function QuickstartGuideDialog() {
  const ctx = useQuickstart();
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  useEffect(() => {
    if (!ctx?.isGuideOpen) return;
    if (ctx.visibleSections.length > 0) {
      setSelectedSectionId(ctx.visibleSections[0].id);
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ctx.closeGuide();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [ctx?.isGuideOpen, ctx?.visibleSections]);

  if (!ctx || !ctx.config || !ctx.isGuideOpen || typeof document === 'undefined') return null;

  const { config, visibleSections, onboardingState, closeGuide, startTutorial } = ctx;
  const activeSection =
    visibleSections.find((s) => s.id === selectedSectionId) || visibleSections[0];

  const statusLabel =
    onboardingState?.status === 'COMPLETED'
      ? 'Completed'
      : onboardingState?.status === 'SKIPPED'
        ? 'Skipped'
        : onboardingState?.status === 'IN_PROGRESS'
          ? 'In Progress'
          : 'Not Started';

  const hasStartedBefore =
    onboardingState?.status === 'COMPLETED' || onboardingState?.status === 'SKIPPED';

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickstart-guide-title"
      data-testid="quickstart-guide-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeGuide();
      }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-surface border border-border-strong shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle bg-surface-muted/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/10 text-accent">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Quickstart Guide</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface border border-border text-text-secondary">
                {onboardingState?.status === 'COMPLETED' && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                )}
                <span>Tutorial: {statusLabel}</span>
              </span>
            </div>
            <h2
              id="quickstart-guide-title"
              className="text-lg sm:text-xl font-bold font-outfit text-primary truncate"
            >
              {config.title}
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              {config.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            aria-label="Close Quickstart Guide"
            data-testid="quickstart-guide-close"
            className="p-2 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-primary transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body: Section Tabs + Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {visibleSections.length > 1 && (
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Guide sections"
            >
              {visibleSections.map((section) => {
                const isSelected = activeSection?.id === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-surface-muted text-text-secondary hover:text-primary'
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          )}

          {activeSection && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted/20 p-5 space-y-3">
              <h3 className="text-base font-bold text-primary">
                {activeSection.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {activeSection.summary}
              </p>
              <ul className="space-y-2 pt-1">
                {activeSection.bullets.map((bullet, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-primary"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer: Start / Restart Interactive Tutorial */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-4 border-t border-border-subtle bg-surface-muted/30">
          <p className="text-xs text-text-secondary">
            Interactive walkthrough ({ctx.activeSteps.length} steps)
          </p>
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={closeGuide}
              className="px-4 py-2 rounded-xl border border-border-strong text-xs sm:text-sm font-semibold text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void startTutorial()}
              data-testid="quickstart-start-tutorial-btn"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent hover:brightness-105 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
            >
              {hasStartedBefore ? (
                <>
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Restart Interactive Tutorial</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" aria-hidden="true" />
                  <span>Start Interactive Tutorial</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
