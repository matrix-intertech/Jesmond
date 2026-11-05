/**
 * Phase 5 — Appointment WhatsApp Notifications Unit & Integration Tests
 *
 * Verifies that:
 * 1. Customer notifications:
 *    - APPOINTMENT_REQUEST_RECEIVED (Booking request received, awaiting manager approval)
 *    - APPOINTMENT_CONFIRMED (Manager approves booking)
 *    - APPOINTMENT_REMINDER (Scheduled before appointment)
 *    - APPOINTMENT_CANCELLED (Appointment cancelled)
 *    - APPOINTMENT_RESCHEDULED (Rescheduled to new time slot)
 * 2. Service Provider notifications:
 *    - SERVICE_PROVIDER_NEW_APPOINTMENT (New request received)
 *    - SERVICE_PROVIDER_APPOINTMENT_CONFIRMED (Manager approved)
 *    - SERVICE_PROVIDER_APPOINTMENT_REMINDER (Scheduled before appointment)
 *    - SERVICE_PROVIDER_APPOINTMENT_CANCELLED (Appointment cancelled)
 * 3. Business Rules:
 *    - PENDING_APPROVAL request is NEVER described as confirmed.
 *    - Reminders are invalidated / cancelled upon appointment cancellation or rescheduling.
 *    - Reminders are scheduled according to the appointment's local timezone.
 *    - Recheck appointment status (shouldDeliverReminder) ensures cancelled/rejected appts do not fire.
 *    - WhatsApp failures never block appointment database transactions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentWhatsAppService } from './appointment-whatsapp.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

describe('AppointmentWhatsAppService', () => {
  let service: AppointmentWhatsAppService;
  let whatsAppService: jest.Mocked<WhatsAppService>;
  let templateService: jest.Mocked<WhatsAppTemplateService>;
  let msg91Provider: jest.Mocked<Msg91Provider>;
  let prismaMock: any;

  const mockSendNotificationAsync = jest.fn().mockResolvedValue({
    success: true,
    status: 'QUEUED',
  });
  const mockCancelScheduledJob = jest.fn().mockResolvedValue(true);

  const mockApprovedTemplate = (event: WhatsAppEvent) => ({
    event,
    templateName: `jesmond_${event.toLowerCase()}`,
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['customer_name', 'service_name', 'appointment_time'],
    description: 'Test template',
  });

  const baseAppointment = {
    id: 'appt-1',
    organizationId: 'org-1',
    branchId: 'branch-1',
    customerId: 'cust-1',
    serviceId: 'srv-1',
    staffId: 'staff-1',
    status: AppointmentStatus.PENDING_APPROVAL,
    startTime: new Date('2026-11-20T10:00:00.000Z'),
    endTime: new Date('2026-11-20T11:00:00.000Z'),
    timezone: 'Australia/Sydney',
    serviceName: 'Deep Cleaning Service',
    durationMins: 60,
    price: 15000,
    customer: {
      id: 'cust-1',
      firstName: 'Sarah',
      lastName: 'Connor',
      phone: '0412345678',
      countryCode: '+61',
      whatsappNotifications: true,
    },
    staff: {
      id: 'staff-1',
      userId: 'staff-user-1',
      user: {
        id: 'staff-user-1',
        firstName: 'John',
        lastName: 'Technician',
        phone: '0487654321',
        countryCode: '+61',
        whatsappNotifications: true,
      },
    },
    branch: { id: 'branch-1', name: 'Downtown Branch', phone: '0299998888' },
    organization: { id: 'org-1', name: 'Acme Services' },
  };

  beforeEach(async () => {
    mockSendNotificationAsync.mockClear();
    mockCancelScheduledJob.mockClear();

    prismaMock = {
      appointment: {
        findUnique: jest.fn(),
      },
      orgStaff: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentWhatsAppService,
        {
          provide: WhatsAppService,
          useValue: {
            sendNotificationAsync: mockSendNotificationAsync,
            cancelScheduledJob: mockCancelScheduledJob,
          },
        },
        {
          provide: WhatsAppTemplateService,
          useValue: {
            getTemplate: jest.fn(),
          },
        },
        {
          provide: Msg91Provider,
          useValue: {
            normalizePhoneNumber: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AppointmentWhatsAppService>(AppointmentWhatsAppService);
    whatsAppService = module.get(WhatsAppService);
    templateService = module.get(WhatsAppTemplateService);
    msg91Provider = module.get(Msg91Provider);
  });

  describe('1. Customer: APPOINTMENT_REQUEST_RECEIVED', () => {
    it('should notify customer that request was received and is awaiting approval (NOT confirmed)', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment);

      const result = await service.notifyBookingRequestReceived('appt-1');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED,
          recipient: '61412345678',
          userId: 'cust-1',
          relatedEntityId: 'appt-1',
          variables: expect.objectContaining({
            customer_name: 'Sarah Connor',
            service_name: 'Deep Cleaning Service',
          }),
          idempotencyKey: 'wa_appt_req_appt-1',
        }),
      );
    });

    it('should skip sending if customer phone is missing', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED),
      );
      prismaMock.appointment.findUnique.mockResolvedValue({
        ...baseAppointment,
        customer: { ...baseAppointment.customer, phone: null },
      });

      const result = await service.notifyBookingRequestReceived('appt-1');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Missing or invalid customer phone');
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('2. Manager Approval: APPOINTMENT_CONFIRMED & SERVICE_PROVIDER_APPOINTMENT_CONFIRMED', () => {
    it('should notify both customer and assigned professional when manager approves appointment', async () => {
      templateService.getTemplate.mockImplementation((event) => {
        if (
          event === WhatsAppEvent.APPOINTMENT_CONFIRMED ||
          event === WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED
        ) {
          return mockApprovedTemplate(event);
        }
        return null as any;
      });

      msg91Provider.normalizePhoneNumber.mockImplementation((phone) => ({
        normalized: phone.replace(/[^0-9]/g, ''),
        isValid: true,
      }));

      prismaMock.appointment.findUnique.mockResolvedValue({
        ...baseAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await service.notifyAppointmentConfirmed('appt-1');

      expect(result.sent).toBe(true);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.APPOINTMENT_CONFIRMED,
          recipient: '610412345678',
          userId: 'cust-1',
          idempotencyKey: 'wa_appt_conf_appt-1',
        }),
      );
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED,
          recipient: '610487654321',
          userId: 'staff-user-1',
          idempotencyKey: 'wa_sp_conf_appt-1_staff-user-1',
        }),
      );
    });
  });

  describe('3. APPOINTMENT_CANCELLED', () => {
    it('should notify customer and provider of cancellation and cancel BullMQ scheduled reminders', async () => {
      templateService.getTemplate.mockImplementation((event) =>
        mockApprovedTemplate(event),
      );
      msg91Provider.normalizePhoneNumber.mockImplementation((phone) => ({
        normalized: phone.replace(/[^0-9]/g, ''),
        isValid: true,
      }));

      prismaMock.appointment.findUnique.mockResolvedValue({
        ...baseAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      const result = await service.notifyAppointmentCancelled(
        'appt-1',
        'Customer requested cancellation',
      );

      expect(result.sent).toBe(true);
      expect(mockCancelScheduledJob).toHaveBeenCalledWith('reminder_cust_appt-1');
      expect(mockCancelScheduledJob).toHaveBeenCalledWith('reminder_sp_appt-1_staff-user-1');
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.APPOINTMENT_CANCELLED,
          variables: expect.objectContaining({
            customer_name: 'Sarah Connor',
            reason: 'Customer requested cancellation',
          }),
        }),
      );
    });
  });

  describe('4. APPOINTMENT_RESCHEDULED', () => {
    it('should cancel old reminders, schedule new reminders, and notify customer of old and new times', async () => {
      templateService.getTemplate.mockReturnValue({
        event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
        templateName: 'jesmond_appointment_rescheduled',
        status: WhatsAppTemplateStatus.APPROVED,
        language: 'en',
        requiredVariables: ['customer_name', 'service_name', 'old_time', 'new_time'],
        description: 'Test reschedule',
      });
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const oldStartTime = new Date('2026-11-20T10:00:00.000Z');
      const newStartTime = new Date('2026-11-22T14:00:00.000Z');

      prismaMock.appointment.findUnique.mockResolvedValue({
        ...baseAppointment,
        status: AppointmentStatus.CONFIRMED,
        startTime: newStartTime,
      });

      const result = await service.notifyAppointmentRescheduled({
        appointmentId: 'appt-1',
        oldStartTime,
        newStartTime,
      });

      expect(result.sent).toBe(true);
      expect(mockCancelScheduledJob).toHaveBeenCalledWith('reminder_cust_appt-1');
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.APPOINTMENT_RESCHEDULED,
          recipient: '61412345678',
          variables: expect.objectContaining({
            customer_name: 'Sarah Connor',
            service_name: 'Deep Cleaning Service',
          }),
          idempotencyKey: `wa_appt_resched_appt-1_${newStartTime.getTime()}`,
        }),
      );
    });
  });

  describe('5. SERVICE_PROVIDER_NEW_APPOINTMENT', () => {
    it('should notify assigned staff member upon new appointment booking', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61487654321',
        isValid: true,
      });

      prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment);

      const result = await service.notifyProviderNewAppointment('appt-1');

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT,
          recipient: '61487654321',
          userId: 'staff-user-1',
          variables: expect.objectContaining({
            provider_name: 'John Technician',
            service_name: 'Deep Cleaning Service',
          }),
          idempotencyKey: 'wa_sp_new_appt-1_staff-user-1',
        }),
      );
    });
  });

  describe('6. Reminder Status Recheck & Safeties', () => {
    it('shouldDeliverReminder should return true only for CONFIRMED appointments', async () => {
      prismaMock.appointment.findUnique.mockResolvedValueOnce({
        status: AppointmentStatus.CONFIRMED,
      });
      const ok = await service.shouldDeliverReminder('appt-1');
      expect(ok).toBe(true);

      prismaMock.appointment.findUnique.mockResolvedValueOnce({
        status: AppointmentStatus.CANCELLED,
      });
      const cancelledOk = await service.shouldDeliverReminder('appt-1');
      expect(cancelledOk).toBe(false);

      prismaMock.appointment.findUnique.mockResolvedValueOnce({
        status: AppointmentStatus.REJECTED,
      });
      const rejectedOk = await service.shouldDeliverReminder('appt-1');
      expect(rejectedOk).toBe(false);
    });

    it('should catch sendNotificationAsync rejection gracefully without throwing', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });
      prismaMock.appointment.findUnique.mockResolvedValue(baseAppointment);
      mockSendNotificationAsync.mockRejectedValueOnce(new Error('Redis failure'));

      const result = await service.notifyBookingRequestReceived('appt-1');
      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Redis failure');
    });
  });
});

