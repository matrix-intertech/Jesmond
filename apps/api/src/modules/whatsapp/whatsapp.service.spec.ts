import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import {
  WHATSAPP_JOB_NAME,
  WHATSAPP_QUEUE_NAME,
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from './constants/whatsapp.constants';
import { WhatsAppNotificationStatus } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let prisma: PrismaService;
  let msg91Provider: Msg91Provider;
  let templateService: WhatsAppTemplateService;
  let logService: WhatsAppLogService;
  let queueMock: any;

  const mockApprovedTemplate = {
    event: WhatsAppEvent.AUTH_REGISTER_OTP,
    templateName: 'jesmond_auth_register_otp',
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['otp'],
    description: 'Registration OTP',
  };

  const mockPendingTemplate = {
    event: WhatsAppEvent.ORDER_CONFIRMED,
    templateName: 'jesmond_order_confirmed',
    status: WhatsAppTemplateStatus.PENDING_APPROVAL,
    language: 'en',
    requiredVariables: ['order_number', 'customer_name'],
    description: 'Order confirmed',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: Msg91Provider,
          useValue: {
            normalizePhoneNumber: jest.fn((phone: string) => {
              if (phone === '0412345678' || phone === '+61412345678') {
                return { normalized: '61412345678', isValid: true };
              }
              if (phone === 'invalid') {
                return { normalized: '', isValid: false, reason: 'Invalid format' };
              }
              return { normalized: phone.replace(/\D/g, ''), isValid: true };
            }),
            sendTemplateMessage: jest.fn(),
          },
        },
        {
          provide: WhatsAppTemplateService,
          useValue: {
            getTemplate: jest.fn(),
            validateVariables: jest.fn(),
            formatComponents: jest.fn(),
          },
        },
        {
          provide: WhatsAppLogService,
          useValue: {
            createLog: jest.fn(),
            updateSuccess: jest.fn(),
            updateFailure: jest.fn(),
            findByIdempotencyKey: jest.fn(),
          },
        },
        {
          provide: getQueueToken(WHATSAPP_QUEUE_NAME),
          useValue: queueMock,
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    prisma = module.get<PrismaService>(PrismaService);
    msg91Provider = module.get<Msg91Provider>(Msg91Provider);
    templateService = module.get<WhatsAppTemplateService>(WhatsAppTemplateService);
    logService = module.get<WhatsAppLogService>(WhatsAppLogService);
  });

  describe('User Consent & Opt-Out', () => {
    it('should skip sending and return SKIPPED when user has whatsappNotifications=false', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        whatsappNotifications: false,
      });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        userId: 'usr-opted-out',
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('SKIPPED');
      expect(result.skippedReason).toBe('USER_OPTED_OUT');
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });

    it('should allow sending when user has whatsappNotifications=true', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        whatsappNotifications: true,
      });
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: true,
        missing: [],
      });
      (templateService.formatComponents as jest.Mock).mockReturnValue({
        body_1: { type: 'text', value: '123456' },
      });
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-1' });
      (msg91Provider.sendTemplateMessage as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        userId: 'usr-consented',
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(WhatsAppNotificationStatus.SENT);
      expect(msg91Provider.sendTemplateMessage).toHaveBeenCalled();
    });
  });

  describe('Idempotency Behavior', () => {
    it('should not resend when an existing SENT log matches the idempotencyKey', async () => {
      (logService.findByIdempotencyKey as jest.Mock).mockResolvedValue({
        id: 'log-existing-1',
        status: WhatsAppNotificationStatus.SENT,
        providerMessageId: 'msg-prev-77',
      });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        idempotencyKey: 'idem-auth-otp-123',
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(true);
      expect(result.logId).toBe('log-existing-1');
      expect(result.providerMessageId).toBe('msg-prev-77');
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });
  });

  describe('Template Approval Enforcement', () => {
    it('should NEVER send using an unapproved/pending template and mark log as FAILED', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockPendingTemplate,
      );
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-failed-tpl' });

      const result = await service.sendNotification({
        event: WhatsAppEvent.ORDER_CONFIRMED,
        recipient: '0412345678',
        variables: { order_number: 'ORD-1', customer_name: 'John' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(WhatsAppNotificationStatus.FAILED);
      expect(result.error).toContain('is not approved');
      expect(logService.updateFailure).toHaveBeenCalledWith(
        'log-failed-tpl',
        expect.stringContaining('is not approved'),
        false,
        true,
      );
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });

    it('should handle missing template definition cleanly', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(null);
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-missing-tpl' });

      const result = await service.sendNotification({
        event: 'UNKNOWN_EVENT' as any,
        recipient: '0412345678',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(WhatsAppNotificationStatus.FAILED);
      expect(result.error).toContain('No template definition found');
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });
  });

  describe('Variable & Phone Validation', () => {
    it('should reject dispatch if required variables are missing', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: false,
        missing: ['otp'],
      });
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-var-fail' });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required variables');
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });

    it('should reject dispatch if recipient phone number is invalid', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: true,
        missing: [],
      });
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-phone-fail' });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: 'invalid',
        variables: { otp: '123456' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid format');
      expect(msg91Provider.sendTemplateMessage).not.toHaveBeenCalled();
    });
  });

  describe('Success & Provider Error Dispatch', () => {
    beforeEach(() => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: true,
        missing: [],
      });
      (templateService.formatComponents as jest.Mock).mockReturnValue({
        body_1: { type: 'text', value: '654321' },
      });
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-dispatch' });
    });

    it('should log success when provider dispatches successfully', async () => {
      (msg91Provider.sendTemplateMessage as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'msg-9900',
      });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        variables: { otp: '654321' },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(WhatsAppNotificationStatus.SENT);
      expect(result.providerMessageId).toBe('msg-9900');
      expect(logService.updateSuccess).toHaveBeenCalledWith(
        'log-dispatch',
        'msg-9900',
      );
    });

    it('should record failure and return error when provider fails', async () => {
      (msg91Provider.sendTemplateMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'MSG91 HTTP 500: Internal Server Error',
      });

      const result = await service.sendNotification({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        variables: { otp: '654321' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(WhatsAppNotificationStatus.FAILED);
      expect(result.error).toContain('Internal Server Error');
      expect(logService.updateFailure).toHaveBeenCalledWith(
        'log-dispatch',
        'MSG91 HTTP 500: Internal Server Error',
        false,
        true,
      );
    });
  });

  describe('Asynchronous Queue Dispatch (sendNotificationAsync)', () => {
    it('should enqueue job to BullMQ queue and create QUEUED log', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (logService.createLog as jest.Mock).mockResolvedValue({ id: 'log-queue-1' });

      const result = await service.sendNotificationAsync({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        variables: { otp: '112233' },
        idempotencyKey: 'idem-queue-1',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(WhatsAppNotificationStatus.QUEUED);
      expect(result.logId).toBe('log-queue-1');
      expect(queueMock.add).toHaveBeenCalledWith(
        WHATSAPP_JOB_NAME,
        expect.objectContaining({
          event: WhatsAppEvent.AUTH_REGISTER_OTP,
          recipient: '0412345678',
          logId: 'log-queue-1',
        }),
        expect.objectContaining({
          jobId: 'idem-queue-1',
          attempts: 3,
        }),
      );
    });
  });

  describe('Worker Execution & Retry Handling (executeDelivery)', () => {
    it('should update log with attempt count and throw on retryable provider failure', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: true,
        missing: [],
      });
      (templateService.formatComponents as jest.Mock).mockReturnValue({});
      (msg91Provider.sendTemplateMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Network glitch',
      });

      await expect(
        service.executeDelivery(
          {
            event: WhatsAppEvent.AUTH_REGISTER_OTP,
            recipient: '0412345678',
            variables: { otp: '123' },
            logId: 'log-worker-1',
          },
          1, // attempt 1
        ),
      ).rejects.toThrow('Network glitch');

      expect(logService.updateFailure).toHaveBeenCalledWith(
        'log-worker-1',
        'Network glitch',
        true,
        false, // not final failure on attempt 1
      );
    });

    it('should mark as final failure when attempts reach 3', async () => {
      (templateService.getTemplate as jest.Mock).mockReturnValue(
        mockApprovedTemplate,
      );
      (templateService.validateVariables as jest.Mock).mockReturnValue({
        isValid: true,
        missing: [],
      });
      (templateService.formatComponents as jest.Mock).mockReturnValue({});
      (msg91Provider.sendTemplateMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Final timeout',
      });

      await expect(
        service.executeDelivery(
          {
            event: WhatsAppEvent.AUTH_REGISTER_OTP,
            recipient: '0412345678',
            variables: { otp: '123' },
            logId: 'log-worker-1',
          },
          3, // attempt 3
        ),
      ).rejects.toThrow('Final timeout');

      expect(logService.updateFailure).toHaveBeenCalledWith(
        'log-worker-1',
        'Final timeout',
        true,
        true, // final failure on attempt 3
      );
    });
  });
});

