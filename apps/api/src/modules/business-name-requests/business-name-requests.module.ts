import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageService } from '../properties/core/storage.service';
import { BusinessNameRequestsController } from './business-name-requests.controller';
import { AdminNameRequestsController } from './admin-name-requests.controller';
import { BusinessNameRequestsService } from './business-name-requests.service';
import { AdminNameRequestsService } from './admin-name-requests.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    BusinessNameRequestsController,
    AdminNameRequestsController,
  ],
  providers: [
    StorageService,
    BusinessNameRequestsService,
    AdminNameRequestsService,
  ],
  exports: [
    BusinessNameRequestsService,
    AdminNameRequestsService,
  ],
})
export class BusinessNameRequestsModule {}
