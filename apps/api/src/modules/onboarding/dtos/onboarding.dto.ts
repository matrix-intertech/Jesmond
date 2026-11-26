import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DashboardOnboardingStatus } from '@prisma/client';

export class UpsertDashboardOnboardingDto {
  @IsEnum(DashboardOnboardingStatus)
  status!: DashboardOnboardingStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  tutorialVersion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastCompletedStep?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  dashboardId?: string;
}

export class ResetDashboardOnboardingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  tutorialVersion?: number;
}
