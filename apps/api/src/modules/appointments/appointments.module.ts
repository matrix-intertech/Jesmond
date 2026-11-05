import { Module } from '@nestjs/common';
import { AppointmentsController } from './controllers/appointments.controller';
import { BusinessAppointmentsController } from './controllers/business-appointments.controller';
import { AppointmentsService } from './services/appointments.service';
import { AvailabilityService } from './services/availability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { AppointmentWhatsAppService } from './services/appointment-whatsapp.service';
import { AppointmentEmailService } from './services/appointment-email.service';

@Module({
  imports: [PrismaModule, NotificationsModule, WhatsAppModule, EmailModule],
  controllers: [AppointmentsController, BusinessAppointmentsController],
  providers: [
    AppointmentsService,
    AvailabilityService,
    AppointmentWhatsAppService,
    AppointmentEmailService,
  ],
  exports: [
    AppointmentsService,
    AvailabilityService,
    AppointmentWhatsAppService,
    AppointmentEmailService,
  ],
})
export class AppointmentsModule { }
