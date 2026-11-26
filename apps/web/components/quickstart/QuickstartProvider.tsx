'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@/utils/auth';
import {
  DashboardId,
  DashboardOnboardingRecord,
  DashboardQuickstartConfig,
  hasQuickstartAccess,
  QuickstartGuideSection,
  resetDashboardOnboardingState,
  resolveDashboardId,
  TutorialStepDef,
  updateDashboardOnboardingState,
  fetchDashboardOnboardingState,
} from '@/utils/quickstart';
import { QUICKSTART_CONFIGS } from '@/utils/quickstart-content';
import { QuickstartGuideDialog } from './QuickstartGuideDialog';
import { InteractiveTutorial } from './InteractiveTutorial';

interface QuickstartContextValue {
  dashboardId: DashboardId | null;
  config: DashboardQuickstartConfig | null;
  visibleSections: QuickstartGuideSection[];
  activeSteps: TutorialStepDef[];
  onboardingState: DashboardOnboardingRecord | null;
  isGuideOpen: boolean;
  isTutorialActive: boolean;
  currentStepIndex: number;
  isSaving: boolean;
  saveError: string | null;
  openGuide: () => void;
  closeGuide: () => void;
  startTutorial: () => Promise<void>;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  skipTutorial: () => Promise<void>;
  exitTutorial: () => Promise<void>;
  completeTutorial: () => Promise<void>;
  retrySave: () => Promise<void>;
}

const QuickstartContext = createContext<QuickstartContextValue | null>(null);

export function useQuickstart(): QuickstartContextValue | null {
  return useContext(QuickstartContext);
}

export function QuickstartProvider({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  const dashboardId = useMemo(() => resolveDashboardId(user, pathname), [user, pathname]);
  const config = dashboardId ? QUICKSTART_CONFIGS[dashboardId] || null : null;

  const visibleSections = useMemo(
    () =>
      config
        ? config.sections.filter((s) =>
            hasQuickstartAccess(user, s.requiredPermissions, s.requiredCapabilities),
          )
        : [],
    [config, user],
  );

  const activeSteps = useMemo(
    () =>
      config
        ? config.steps.filter((s) =>
            hasQuickstartAccess(user, s.requiredPermissions, s.requiredCapabilities),
          )
        : [],
    [config, user],
  );

  const [onboardingState, setOnboardingState] =
    useState<DashboardOnboardingRecord | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingSaveAction, setPendingSaveAction] = useState<'COMPLETED' | 'SKIPPED' | null>(null);

  // Load persisted onboarding state whenever authenticated user or dashboard changes
  useEffect(() => {
    if (!user?.id || !dashboardId) {
      setOnboardingState(null);
      setIsTutorialActive(false);
      return;
    }
    let active = true;

    void fetchDashboardOnboardingState(dashboardId).then((record) => {
      if (!active || !record) return;
      setOnboardingState(record);
      if (record.status === 'NOT_STARTED' && activeSteps.length > 0) {
        setCurrentStepIndex(0);
        setSaveError(null);
        setPendingSaveAction(null);
        setIsTutorialActive(true);
      } else {
        setIsTutorialActive(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id, dashboardId, activeSteps.length]);

  const openGuide = useCallback(() => {
    setIsTutorialActive(false);
    setSaveError(null);
    setIsGuideOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
  }, []);

  const startTutorial = useCallback(async () => {
    if (!dashboardId || !config || activeSteps.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setPendingSaveAction(null);
    setIsGuideOpen(false);
    setCurrentStepIndex(0);
    setIsTutorialActive(true);

    if (activeSteps[0]?.route && activeSteps[0].route !== pathname) {
      router.push(activeSteps[0].route);
    }

    try {
      const updated = await resetDashboardOnboardingState(
        dashboardId,
        config.tutorialVersion,
      );
      if (updated) {
        setOnboardingState(updated);
      }
    } finally {
      setIsSaving(false);
    }
  }, [activeSteps, config, dashboardId, isSaving, pathname, router]);

  const persistTerminalState = useCallback(
    async (action: 'COMPLETED' | 'SKIPPED') => {
      if (!dashboardId || !config || isSaving) return;
      setIsSaving(true);
      setSaveError(null);
      setPendingSaveAction(action);

      const stepToSave =
        action === 'COMPLETED' ? Math.max(0, activeSteps.length - 1) : currentStepIndex;

      try {
        const updated = await updateDashboardOnboardingState(dashboardId, {
          status: action,
          tutorialVersion: config.tutorialVersion,
          lastCompletedStep: stepToSave,
        });

        if (!updated) {
          setSaveError(
            'Unable to save your tutorial progress. Please check your connection and retry.',
          );
          return;
        }

        setOnboardingState(updated);
        setPendingSaveAction(null);
        setSaveError(null);
        setIsTutorialActive(false);
      } finally {
        setIsSaving(false);
      }
    },
    [activeSteps.length, config, currentStepIndex, dashboardId, isSaving],
  );

  const completeTutorial = useCallback(async () => {
    await persistTerminalState('COMPLETED');
  }, [persistTerminalState]);

  const skipTutorial = useCallback(async () => {
    await persistTerminalState('SKIPPED');
  }, [persistTerminalState]);

  const exitTutorial = useCallback(async () => {
    await persistTerminalState('SKIPPED');
  }, [persistTerminalState]);

  const retrySave = useCallback(async () => {
    if (!pendingSaveAction) return;
    await persistTerminalState(pendingSaveAction);
  }, [pendingSaveAction, persistTerminalState]);

  const nextStep = useCallback(async () => {
    if (isSaving || !dashboardId || !config) return;
    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= activeSteps.length) {
      await completeTutorial();
      return;
    }
    const nextDef = activeSteps[nextIdx];
    if (nextDef?.route && nextDef.route !== pathname) {
      router.push(nextDef.route);
    }
    setSaveError(null);
    setCurrentStepIndex(nextIdx);
    void updateDashboardOnboardingState(dashboardId, {
      status: 'IN_PROGRESS',
      tutorialVersion: config.tutorialVersion,
      lastCompletedStep: nextIdx,
    });
  }, [
    activeSteps,
    completeTutorial,
    config,
    currentStepIndex,
    dashboardId,
    isSaving,
    pathname,
    router,
  ]);

  const prevStep = useCallback(() => {
    if (currentStepIndex <= 0 || isSaving) return;
    const prevIdx = currentStepIndex - 1;
    const prevDef = activeSteps[prevIdx];
    if (prevDef?.route && prevDef.route !== pathname) {
      router.push(prevDef.route);
    }
    setSaveError(null);
    setCurrentStepIndex(prevIdx);
  }, [activeSteps, currentStepIndex, isSaving, pathname, router]);

  const value = useMemo<QuickstartContextValue>(
    () => ({
      dashboardId,
      config,
      visibleSections,
      activeSteps,
      onboardingState,
      isGuideOpen,
      isTutorialActive,
      currentStepIndex,
      isSaving,
      saveError,
      openGuide,
      closeGuide,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      exitTutorial,
      completeTutorial,
      retrySave,
    }),
    [
      activeSteps,
      closeGuide,
      completeTutorial,
      config,
      currentStepIndex,
      dashboardId,
      exitTutorial,
      isGuideOpen,
      isSaving,
      isTutorialActive,
      nextStep,
      onboardingState,
      openGuide,
      prevStep,
      retrySave,
      saveError,
      skipTutorial,
      startTutorial,
      visibleSections,
    ],
  );

  return (
    <QuickstartContext.Provider value={value}>
      {children}
      <QuickstartGuideDialog />
      <InteractiveTutorial />
    </QuickstartContext.Provider>
  );
}
