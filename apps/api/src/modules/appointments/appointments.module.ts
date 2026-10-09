import { Module } from '@nestjs/common';
import { AppointmentsController } from './controllers/appointments.controller';
import { BusinessAppointmentsController } from './controllers/business-appointments.controller';
import { AppointmentsService } from './services/appointments.service';
import { AvailabilityService } from './services/availability.service';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AppointmentsController, BusinessAppointmentsController],
  providers: [AppointmentsService, AvailabilityService],
  exports: [AppointmentsService, AvailabilityService],
})
export class AppointmentsModule {}
