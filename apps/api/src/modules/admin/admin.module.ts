import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFeaturesController } from './admin-features.controller';
import { FeatureFlagService } from './feature-flag.service';
import { AdminApplicationsController } from './admin-applications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';

@Module({
  imports: [PrismaModule, ApplicationsModule],
  controllers: [AdminController, AdminFeaturesController, AdminApplicationsController, AdminSettingsController],
  providers: [AdminService, FeatureFlagService, AdminSettingsService],
  exports: [AdminService, FeatureFlagService, AdminSettingsService],
})
export class AdminModule {}
