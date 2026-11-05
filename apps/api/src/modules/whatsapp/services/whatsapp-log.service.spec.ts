import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppLogService } from './whatsapp-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppNotificationStatus } from '@prisma/client';

describe('WhatsAppLogService', () => {
  let service: WhatsAppLogService;
  let prisma: PrismaService;

  const mockPrisma = {
    whatsAppNotificationLog: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppLogService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WhatsAppLogService>(WhatsAppLogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Metadata Sanitization (Security & Privacy)', () => {
    it('should redact sensitive fields matching OTP, password, token, secret patterns', () => {
      const sensitiveMetadata = {
        orderId: 'ORD-1234',
        otp: '849201',
        userPassword: 'secretpassword',
        resetToken: 'jwt.token.here',
        pinCode: '9999',
        authKey: 'msg91-auth-secret',
        nested: {
          verificationCode: '4321',
          safeField: 'safeValue',
        },
        items: [
          { name: 'Burger', secretCode: 'disc50' },
          { name: 'Fries' },
        ],
      };

      const sanitized = service.sanitizeMetadata(sensitiveMetadata);

      expect(sanitized).toBeDefined();
      expect(sanitized?.orderId).toBe('ORD-1234');
      expect(sanitized?.otp).toBe('[REDACTED]');
      expect(sanitized?.userPassword).toBe('[REDACTED]');
      expect(sanitized?.resetToken).toBe('[REDACTED]');
      expect(sanitized?.pinCode).toBe('[REDACTED]');
      expect(sanitized?.authKey).toBe('[REDACTED]');
      expect(sanitized?.nested.verificationCode).toBe('[REDACTED]');
      expect(sanitized?.nested.safeField).toBe('safeValue');
      expect(sanitized?.items[0].secretCode).toBe('[REDACTED]');
      expect(sanitized?.items[0].name).toBe('Burger');
      expect(sanitized?.items[1].name).toBe('Fries');
    });

    it('should return undefined when metadata is undefined or null', () => {
      expect(service.sanitizeMetadata(undefined)).toBeUndefined();
      expect(service.sanitizeMetadata(null)).toBeUndefined();
    });
  });

  describe('Database Operations', () => {
    it('should create log entry with sanitized metadata', async () => {
      mockPrisma.whatsAppNotificationLog.create.mockResolvedValue({
        id: 'log-101',
        eventType: 'AUTH_REGISTER_OTP',
        recipient: '61412345678',
        templateId: 'jesmond_auth_register_otp',
        status: WhatsAppNotificationStatus.PENDING,
        attemptCount: 1,
      });

      const log = await service.createLog({
        eventType: 'AUTH_REGISTER_OTP',
        recipient: '61412345678',
        templateId: 'jesmond_auth_register_otp',
        metadata: {
          source: 'registration_flow',
          otp: '123456', // Must be sanitized
        },
      });

      expect(log.id).toBe('log-101');
      expect(mockPrisma.whatsAppNotificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'AUTH_REGISTER_OTP',
          recipient: '61412345678',
          templateId: 'jesmond_auth_register_otp',
          status: WhatsAppNotificationStatus.PENDING,
          attemptCount: 1,
          metadata: {
            source: 'registration_flow',
            otp: '[REDACTED]',
          },
        }),
      });
    });

    it('should update log on provider success with SENT status and providerMessageId', async () => {
      mockPrisma.whatsAppNotificationLog.update.mockResolvedValue({
        id: 'log-101',
        status: WhatsAppNotificationStatus.SENT,
        providerMessageId: 'msg91-req-7788',
        failureReason: null,
      });

      const updated = await service.updateSuccess('log-101', 'msg91-req-7788');

      expect(updated.status).toBe(WhatsAppNotificationStatus.SENT);
      expect(mockPrisma.whatsAppNotificationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-101' },
        data: {
          status: WhatsAppNotificationStatus.SENT,
          providerMessageId: 'msg91-req-7788',
          failureReason: null,
        },
      });
    });

    it('should update log on provider failure with error reason', async () => {
      mockPrisma.whatsAppNotificationLog.update.mockResolvedValue({
        id: 'log-101',
        status: WhatsAppNotificationStatus.FAILED,
        failureReason: 'Rate limit exceeded',
      });

      await service.updateFailure('log-101', 'Rate limit exceeded', true, true);

      expect(mockPrisma.whatsAppNotificationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-101' },
        data: {
          status: WhatsAppNotificationStatus.FAILED,
          failureReason: 'Rate limit exceeded',
          attemptCount: { increment: 1 },
        },
      });
    });

    it('should lookup log by idempotency key', async () => {
      mockPrisma.whatsAppNotificationLog.findUnique.mockResolvedValue({
        id: 'log-existing',
        idempotencyKey: 'idem-key-123',
        status: WhatsAppNotificationStatus.SENT,
      });

      const found = await service.findByIdempotencyKey('idem-key-123');
      expect(found?.id).toBe('log-existing');
      expect(mockPrisma.whatsAppNotificationLog.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'idem-key-123' },
      });
    });
  });
});

