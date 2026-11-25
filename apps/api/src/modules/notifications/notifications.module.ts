import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationsService } from './notifications.service';
import { NotificationOutboxService } from './services/notification-outbox.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [NotificationsService, NotificationOutboxService],
  exports: [NotificationsService, NotificationOutboxService],
})
export class NotificationsModule {}
