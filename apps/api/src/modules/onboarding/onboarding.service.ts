import { BadRequestException, Injectable } from '@nestjs/common';
import { DashboardOnboardingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDashboardOnboardingDto } from './dtos/onboarding.dto';

const VALID_DASHBOARD_IDS = new Set([
  'STUDENT',
  'ADMIN',
  'SUPER_ADMIN',
  'ACCOMMODATION',
  'RETAIL',
  'FOOD',
  'MECHANICS',
  'SERVICES',
  'RENTALS',
  'SETTINGS',
]);

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeDashboardId(dashboardId: string): string {
    const clean = (dashboardId || '').trim().toUpperCase();
    if (!VALID_DASHBOARD_IDS.has(clean)) {
      throw new BadRequestException(`Invalid dashboard identifier: ${dashboardId}`);
    }
    return clean;
  }

  async listStatesForUser(userId: string) {
    return this.prisma.dashboardOnboarding.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getStateForDashboard(userId: string, dashboardId: string) {
    const cleanId = this.normalizeDashboardId(dashboardId);
    const existing = await this.prisma.dashboardOnboarding.findUnique({
      where: {
        userId_dashboardId: {
          userId,
          dashboardId: cleanId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return {
      id: null,
      userId,
      dashboardId: cleanId,
      tutorialVersion: 1,
      status: DashboardOnboardingStatus.NOT_STARTED,
      lastCompletedStep: 0,
      completedAt: null,
      skippedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  async upsertState(
    userId: string,
    dashboardId: string,
    dto: UpsertDashboardOnboardingDto,
  ) {
    const cleanId = this.normalizeDashboardId(dashboardId);
    const now = new Date();
    const version = dto.tutorialVersion ?? 1;
    const lastStep = dto.lastCompletedStep ?? 0;

    const completedAt =
      dto.status === DashboardOnboardingStatus.COMPLETED ? now : null;
    const skippedAt =
      dto.status === DashboardOnboardingStatus.SKIPPED ? now : null;

    return this.prisma.dashboardOnboarding.upsert({
      where: {
        userId_dashboardId: {
          userId,
          dashboardId: cleanId,
        },
      },
      create: {
        userId,
        dashboardId: cleanId,
        tutorialVersion: version,
        status: dto.status,
        lastCompletedStep: lastStep,
        completedAt,
        skippedAt,
      },
      update: {
        tutorialVersion: version,
        status: dto.status,
        lastCompletedStep: lastStep,
        completedAt:
          dto.status === DashboardOnboardingStatus.COMPLETED
            ? now
            : dto.status === DashboardOnboardingStatus.NOT_STARTED
              ? null
              : undefined,
        skippedAt:
          dto.status === DashboardOnboardingStatus.SKIPPED
            ? now
            : dto.status === DashboardOnboardingStatus.NOT_STARTED
              ? null
              : undefined,
      },
    });
  }

  async resetState(userId: string, dashboardId: string, tutorialVersion = 1) {
    return this.upsertState(userId, dashboardId, {
      status: DashboardOnboardingStatus.IN_PROGRESS,
      tutorialVersion,
      lastCompletedStep: 0,
    });
  }
}
