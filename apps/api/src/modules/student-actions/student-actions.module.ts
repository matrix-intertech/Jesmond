import { Module } from '@nestjs/common';
import { StudentActionsController } from './student-actions.controller';
import { StudentActionsService } from './student-actions.service';

@Module({
  controllers: [StudentActionsController],
  providers: [StudentActionsService],
  exports: [StudentActionsService],
})
export class StudentActionsModule {}
