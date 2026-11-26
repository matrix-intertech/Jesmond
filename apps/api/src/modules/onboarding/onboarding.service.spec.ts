import { BadRequestException } from '@nestjs/common';
import { DashboardOnboardingStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const mockPrisma = {
    dashboardOnboarding: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OnboardingService(mockPrisma as any);
  });

  it('returns NOT_STARTED default scoped to authenticated userId when no record exists', async () => {
    mockPrisma.dashboardOnboarding.findUnique.mockResolvedValue(null);

    const res = await service.getStateForDashboard('usr-1', 'retail');
    expect(mockPrisma.dashboardOnboarding.findUnique).toHaveBeenCalledWith({
      where: {
        userId_dashboardId: {
          userId: 'usr-1',
          dashboardId: 'RETAIL',
        },
      },
    });
    expect(res.userId).toBe('usr-1');
    expect(res.dashboardId).toBe('RETAIL');
    expect(res.status).toBe(DashboardOnboardingStatus.NOT_STARTED);
  });

  it('rejects unknown dashboard identifiers', async () => {
    await expect(
      service.getStateForDashboard('usr-1', 'UNKNOWN_PORTAL'),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists COMPLETED and SKIPPED timestamps per user and dashboard independently', async () => {
    mockPrisma.dashboardOnboarding.upsert.mockImplementation(
      async ({ create }: any) => ({ id: 'ob-1', ...create }),
    );

    const completed = await service.upsertState('usr-1', 'STUDENT', {
      status: DashboardOnboardingStatus.COMPLETED,
      tutorialVersion: 1,
      lastCompletedStep: 5,
    });
    expect(completed.status).toBe(DashboardOnboardingStatus.COMPLETED);
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.skippedAt).toBeNull();

    const skipped = await service.upsertState('usr-1', 'ADMIN', {
      status: DashboardOnboardingStatus.SKIPPED,
      tutorialVersion: 1,
      lastCompletedStep: 1,
    });
    expect(skipped.status).toBe(DashboardOnboardingStatus.SKIPPED);
    expect(skipped.skippedAt).toBeInstanceOf(Date);
    expect(skipped.completedAt).toBeNull();
  });

  it('lists only records belonging to the authenticated userId', async () => {
    mockPrisma.dashboardOnboarding.findMany.mockResolvedValue([]);
    await service.listStatesForUser('usr-2');
    expect(mockPrisma.dashboardOnboarding.findMany).toHaveBeenCalledWith({
      where: { userId: 'usr-2' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('resets dashboard onboarding to IN_PROGRESS at step 0', async () => {
    mockPrisma.dashboardOnboarding.upsert.mockImplementation(
      async ({ create }: any) => ({ id: 'ob-2', ...create }),
    );
    const res = await service.resetState('usr-1', 'MECHANICS', 1);
    expect(res.status).toBe(DashboardOnboardingStatus.IN_PROGRESS);
    expect(res.lastCompletedStep).toBe(0);
  });
});
