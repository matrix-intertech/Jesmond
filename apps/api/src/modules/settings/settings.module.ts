import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ProviderSettingsController } from './provider-settings.controller';
import { ProviderSettingsService } from './provider-settings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, ProviderSettingsController],
  providers: [SettingsService, ProviderSettingsService],
  exports: [SettingsService, ProviderSettingsService],
})
export class SettingsModule {}
