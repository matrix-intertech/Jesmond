import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentEmailService } from './appointment-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';

describe('AppointmentEmailService', () => {
  let service: AppointmentEmailService;
  let prisma: any;
  let emailService: any;

  const mockAppointment = {
    id: 'appt-1',
    serviceName: 'Deep Tissue Massage',
    startTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h in future
    timezone: 'Australia/Sydney',
    customer: {
      id: 'cust-1',
      email: 'client@example.com',
      firstName: 'Emily',
      lastName: 'Clark',
    },
    staff: {
      userId: 'staff-user-1',
      user: {
        id: 'staff-user-1',
        email: 'therapist@example.com',
        firstName: 'Sarah',
        lastName: 'Jenkins',
      },
    },
    branch: {
      id: 'branch-1',
      name: 'Jesmond Wellness Center',
      organizationId: 'org-1',
    },
  };

  beforeEach(async () => {
    prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(mockAppointment),
      },
      orgStaff: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    emailService = {
      sendEmailAsync: jest.fn().mockResolvedValue({ success: true }),
      cancelScheduledJob: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AppointmentEmailService>(AppointmentEmailService);
  });

  describe('1. APPOINTMENT_REQUEST_RECEIVED', () => {
    it('should dispatch request received email to customer stating awaiting approval', async () => {
      const result = await service.notifyAppointmentRequestReceived('appt-1');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.APPOINTMENT_REQUEST_RECEIVED);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.APPOINTMENT_REQUEST_RECEIVED,
          recipient: 'client@example.com',
          variables: expect.objectContaining({
            customer_name: 'Emily Clark',
            service_name: 'Deep Tissue Massage',
          }),
          idempotencyKey: 'email_appt_req_appt-1',
        }),
      );
    });
  });

  describe('2. APPOINTMENT_CONFIRMED & SERVICE_PROVIDER_APPOINTMENT_CONFIRMED', () => {
    it('should dispatch confirmation email to customer and assigned professional, and schedule reminders', async () => {
      const result = await service.notifyAppointmentConfirmed('appt-1');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.APPOINTMENT_CONFIRMED);
      expect(result.recipientCount).toBe(2);

      // Customer confirmed
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.APPOINTMENT_CONFIRMED,
          recipient: 'client@example.com',
          variables: expect.objectContaining({
            customer_name: 'Emily Clark',
            service_name: 'Deep Tissue Massage',
          }),
          idempotencyKey: 'email_appt_conf_appt-1',
        }),
      );

      // Provider confirmed
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED,
          recipient: 'therapist@example.com',
          variables: expect.objectContaining({
            provider_name: 'Sarah Jenkins',
            service_name: 'Deep Tissue Massage',
          }),
          idempotencyKey: 'email_sp_conf_appt-1_staff-user-1',
        }),
      );

      // Scheduled 24h reminders (customer & provider)
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.APPOINTMENT_REMINDER,
          recipient: 'client@example.com',
          idempotencyKey: 'email_reminder_cust_appt-1',
        }),
      );
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER,
          recipient: 'therapist@example.com',
          idempotencyKey: 'email_reminder_sp_appt-1_staff-user-1',
        }),
      );
    });
  });

  describe('3. APPOINTMENT_CANCELLED & SERVICE_PROVIDER_APPOINTMENT_CANCELLED', () => {
    it('should cancel scheduled reminders and notify customer and provider', async () => {
      const result = await service.notifyAppointmentCancelled('appt-1', 'Client schedule conflict');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.APPOINTMENT_CANCELLED);
      expect(emailService.cancelScheduledJob).toHaveBeenCalledWith('email_reminder_cust_appt-1');
      expect(emailService.cancelScheduledJob).toHaveBeenCalledWith('email_reminder_sp_appt-1_staff-user-1');

      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.APPOINTMENT_CANCELLED,
          recipient: 'client@example.com',
          variables: expect.objectContaining({
            customer_name: 'Emily Clark',
            service_name: 'Deep Tissue Massage',
            reason: 'Client schedule conflict',
          }),
          idempotencyKey: 'email_appt_cancel_appt-1',
        }),
      );

      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED,
          recipient: 'therapist@example.com',
          variables: expect.objectContaining({
            provider_name: 'Sarah Jenkins',
            service_name: 'Deep Tissue Massage',
          }),
          idempotencyKey: 'email_sp_cancel_appt-1_staff-user-1',
        }),
      );
    });
  });

  describe('4. APPOINTMENT_RESCHEDULED', () => {
    it('should cancel old reminders, dispatch reschedule notice, and schedule new reminders', async () => {
      const oldTime = mockAppointment.startTime;
      const newTime = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const result = await service.notifyAppointmentRescheduled({
        appointmentId: 'appt-1',
        oldStartTime: oldTime,
        newStartTime: newTime,
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.APPOINTMENT_RESCHEDULED);
      expect(emailService.cancelScheduledJob).toHaveBeenCalledWith('email_reminder_cust_appt-1');

      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.APPOINTMENT_RESCHEDULED,
          recipient: 'client@example.com',
          variables: expect.objectContaining({
            customer_name: 'Emily Clark',
            service_name: 'Deep Tissue Massage',
          }),
        }),
      );
    });
  });

  describe('5. SERVICE_PROVIDER_NEW_APPOINTMENT', () => {
    it('should notify assigned staff member about new appointment request', async () => {
      const result = await service.notifyProviderNewAppointment('appt-1');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
          recipient: 'therapist@example.com',
          variables: expect.objectContaining({
            provider_name: 'Sarah Jenkins',
            service_name: 'Deep Tissue Massage',
          }),
          idempotencyKey: 'email_sp_new_appt-1_staff-user-1',
        }),
      );
    });
  });
});
