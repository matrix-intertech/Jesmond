import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StorageService } from '../properties/core/storage.service';
import { AbnLookupService } from './services/abn-lookup.service';
import { RequirementsEngineService } from './services/requirements-engine.service';
import { BusinessCredentialsService } from './business-credentials.service';
import { BusinessCredentialsController } from './business-credentials.controller';
import { AdminCredentialsService } from './admin-credentials.service';
import { AdminCredentialsController } from './admin-credentials.controller';

@Module({
  imports: [PrismaModule, RedisModule, SubscriptionsModule],
  controllers: [
    BusinessCredentialsController,
    AdminCredentialsController,
  ],
  providers: [
    StorageService,
    AbnLookupService,
    RequirementsEngineService,
    BusinessCredentialsService,
    AdminCredentialsService,
  ],
  exports: [
    BusinessCredentialsService,
    AdminCredentialsService,
    RequirementsEngineService,
    AbnLookupService,
  ],
})
export class CredentialsModule {}
