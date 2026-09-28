import { Module } from '@nestjs/common';
import { StudentActionsController } from './student-actions.controller';
import { StudentActionsService } from './student-actions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [StudentActionsController],
  providers: [StudentActionsService],
  exports: [StudentActionsService],
})
export class StudentActionsModule {}
