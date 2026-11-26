'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useQuickstart } from './QuickstartProvider';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function InteractiveTutorial() {
  const ctx = useQuickstart();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isTargetHiddenOffscreen, setIsTargetHiddenOffscreen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 120,
    left: 24,
  });

  const currentStep =
    ctx && ctx.isTutorialActive ? ctx.activeSteps[ctx.currentStepIndex] : undefined;

  const setCenteredFallback = useCallback((offscreenNav: boolean) => {
    setTargetRect(null);
    setIsTargetHiddenOffscreen(offscreenNav);
    const cardW = Math.min(360, window.innerWidth - 32);
    setTooltipPos({
      top: Math.max(24, Math.round(window.innerHeight / 2 - 120)),
      left: Math.max(16, Math.round((window.innerWidth - cardW) / 2)),
    });
  }, []);

  const measureAndPosition = useCallback(() => {
    if (!currentStep || typeof window === 'undefined') {
      setTargetRect(null);
      setIsTargetHiddenOffscreen(false);
      return;
    }

    const el = document.querySelector<HTMLElement>(currentStep.targetSelector);
    if (!el) {
      setCenteredFallback(false);
      return;
    }

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      setCenteredFallback(currentStep.targetSelector.startsWith('nav '));
      return;
    }

    const rect = el.getBoundingClientRect();
    const isZeroSize = rect.width === 0 && rect.height === 0;
    const isHorizontallyOffscreen =
      rect.right <= 4 || rect.left >= window.innerWidth - 4;

    if (isZeroSize || isHorizontallyOffscreen) {
      setCenteredFallback(currentStep.targetSelector.startsWith('nav '));
      return;
    }

    setIsTargetHiddenOffscreen(false);

    // Scroll into view if target is outside vertical viewport
    if (rect.top < 16 || rect.bottom > window.innerHeight - 16) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const pad = 6;
    const highlight: TargetRect = {
      top: Math.max(4, rect.top - pad),
      left: Math.max(4, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    setTargetRect(highlight);

    const cardW = Math.min(360, window.innerWidth - 32);
    const cardH = 220;
    const placement = currentStep.placement || 'bottom';

    let top = highlight.top + highlight.height + 12;
    let left = highlight.left;

    if (placement === 'right' && highlight.left + highlight.width + cardW + 24 < window.innerWidth) {
      left = highlight.left + highlight.width + 14;
      top = highlight.top;
    } else if (placement === 'top' || highlight.top + highlight.height + cardH + 24 > window.innerHeight) {
      if (highlight.top - cardH - 14 > 16) {
        top = highlight.top - cardH - 14;
      }
    }

    left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - cardH - 16));
    setTooltipPos({ top, left });
  }, [currentStep]);

  useEffect(() => {
    if (!ctx?.isTutorialActive || !currentStep) return;

    const timer = setTimeout(measureAndPosition, 60);
    window.addEventListener('resize', measureAndPosition, { passive: true });
    window.addEventListener('scroll', measureAndPosition, { passive: true });
    window.addEventListener('transitionend', measureAndPosition, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void ctx.exitTutorial();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureAndPosition);
      window.removeEventListener('scroll', measureAndPosition);
      window.removeEventListener('transitionend', measureAndPosition);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ctx, currentStep, measureAndPosition]);

  if (!ctx || !ctx.isTutorialActive || !currentStep || typeof document === 'undefined') {
    return null;
  }

  const totalSteps = ctx.activeSteps.length;
  const stepNum = ctx.currentStepIndex + 1;
  const isLast = stepNum >= totalSteps;
  const progressPct = Math.round((stepNum / totalSteps) * 100);

  return createPortal(
    <div
      className="fixed inset-0 z-[220] pointer-events-none"
      data-testid="interactive-tutorial-overlay"
      aria-live="polite"
    >
      {/* Subtle non-blocking highlight ring around target element */}
      {targetRect && (
        <div
          aria-hidden="true"
          data-testid="tutorial-spotlight-ring"
          style={{
            position: 'fixed',
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          className="rounded-xl ring-2 ring-accent shadow-[0_0_0_9999px_rgba(15,23,42,0.38)] transition-all duration-200"
        />
      )}

      {/* Tutorial Tooltip Card */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`Tutorial step ${stepNum} of ${totalSteps}: ${currentStep.title}`}
        data-testid="interactive-tutorial-card"
        style={{
          position: 'fixed',
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: 'min(360px, calc(100vw - 32px))',
        }}
        className="pointer-events-auto rounded-2xl bg-surface border border-border-strong shadow-2xl p-5 space-y-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span data-testid="tutorial-step-counter">
              Step {stepNum} of {totalSteps}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void ctx.exitTutorial()}
            aria-label="Exit Tutorial"
            data-testid="tutorial-exit-btn"
            className="p-1 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div>
          <h3 className="text-base font-bold font-outfit text-primary">
            {currentStep.title}
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
            {currentStep.description}
          </p>
          {isTargetHiddenOffscreen && (
            <p
              data-testid="tutorial-mobile-nav-hint"
              className="text-[11px] font-medium text-accent mt-2"
            >
              Open the navigation menu (top-left) to view this section.
            </p>
          )}
        </div>

        {ctx.saveError && (
          <div
            role="alert"
            data-testid="tutorial-save-error"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-center justify-between gap-2"
          >
            <span>{ctx.saveError}</span>
            <button
              type="button"
              disabled={ctx.isSaving}
              onClick={() => void ctx.retrySave()}
              data-testid="tutorial-retry-btn"
              className="shrink-0 px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={ctx.isSaving}
            onClick={() => void ctx.skipTutorial()}
            data-testid="tutorial-skip-btn"
            className="text-xs font-semibold text-text-secondary hover:text-primary disabled:opacity-50 transition-colors"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center gap-2">
            {ctx.currentStepIndex > 0 && (
              <button
                type="button"
                disabled={ctx.isSaving}
                onClick={ctx.prevStep}
                data-testid="tutorial-prev-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-strong text-xs font-semibold text-primary hover:bg-surface-muted disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Previous</span>
              </button>
            )}
            <button
              type="button"
              disabled={ctx.isSaving}
              onClick={() => void ctx.nextStep()}
              data-testid="tutorial-next-btn"
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-accent hover:brightness-105 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all"
            >
              <span>{isLast ? 'Finish' : 'Next'}</span>
              {!isLast && <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
