import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFeaturesController } from './admin-features.controller';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, AdminFeaturesController],
  providers: [AdminService, FeatureFlagService],
  exports: [AdminService, FeatureFlagService],
})
export class AdminModule {}
