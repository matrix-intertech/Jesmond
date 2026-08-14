import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFeaturesController } from './admin-features.controller';
import { FeatureFlagService } from './feature-flag.service';
import { AdminApplicationsController } from './admin-applications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [PrismaModule, ApplicationsModule],
  controllers: [AdminController, AdminFeaturesController, AdminApplicationsController],
  providers: [AdminService, FeatureFlagService],
  exports: [AdminService, FeatureFlagService],
})
export class AdminModule {}
