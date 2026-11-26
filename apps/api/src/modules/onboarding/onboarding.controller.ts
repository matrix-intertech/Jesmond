import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import {
  ResetDashboardOnboardingDto,
  UpsertDashboardOnboardingDto,
} from './dtos/onboarding.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('dashboards')
  async listMyDashboards(@Request() req: any) {
    return this.onboardingService.listStatesForUser(req.user.id);
  }

  @Get('dashboards/:dashboardId')
  async getDashboardState(
    @Request() req: any,
    @Param('dashboardId') dashboardId: string,
  ) {
    return this.onboardingService.getStateForDashboard(req.user.id, dashboardId);
  }

  @Put('dashboards/:dashboardId')
  async upsertDashboardState(
    @Request() req: any,
    @Param('dashboardId') dashboardId: string,
    @Body() dto: UpsertDashboardOnboardingDto,
  ) {
    return this.onboardingService.upsertState(req.user.id, dashboardId, dto);
  }

  @Post('dashboards/:dashboardId/reset')
  async resetDashboardState(
    @Request() req: any,
    @Param('dashboardId') dashboardId: string,
    @Body() body?: ResetDashboardOnboardingDto,
  ) {
    return this.onboardingService.resetState(
      req.user.id,
      dashboardId,
      body?.tutorialVersion ?? 1,
    );
  }
}
