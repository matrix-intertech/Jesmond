import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  UserRole,
  AccountStatus,
  OrgType,
  BusinessCategory,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';

describe('Account Creation Notification System', () => {
  let authService: AuthService;
  let emailService: EmailService;
  let prismaService: any;
  let mockTransporter: any;

  const mockDate = new Date('2026-10-29T07:30:00.000Z');

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-test-123' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
        update: jest.fn(),
      },
      orgStaff: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        EmailService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    emailService = module.get<EmailService>(EmailService);
    emailService.setTransporter(mockTransporter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EmailService Unit Tests', () => {
    it('should send notification to both required recipients', async () => {
      const payload = {
        id: 'usr-abc-123',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '412345678',
        countryCode: '+61',
        role: UserRole.STUDENT,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      const result =
        await emailService.sendAccountCreationNotification(payload);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.to).toEqual([
        'jb.narang@matrixonline.in',
        'it.team@matrixonline.in',
      ]);
    });

    it('should include all required available user fields and mark missing optional fields as "Not provided"', async () => {
      const payload = {
        id: 'usr-missing-fields',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: null,
        countryCode: null,
        role: null,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      await emailService.sendAccountCreationNotification(payload);

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('usr-missing-fields');
      expect(mailOptions.html).toContain('Jane Smith');
      expect(mailOptions.html).toContain('jane@example.com');
      // Phone number not provided
      expect(mailOptions.html).toContain('Phone Number');
      expect(mailOptions.html).toContain('Not provided');
      // Location not provided
      expect(mailOptions.html).toContain('Location');
      expect(mailOptions.text).toContain('Location: Not provided');
      // Created at timestamp formatted with timezone
      expect(mailOptions.html).toContain('Australia/Sydney');
    });

    it('should never include secrets, passwords, OTPs, or session tokens in email content', async () => {
      const payload = {
        id: 'usr-secure-check',
        email: 'secure@example.com',
        firstName: 'Alice',
        lastName: 'Security',
        phone: '123456789',
        countryCode: '+1',
        role: UserRole.ORG_STAFF,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      await emailService.sendAccountCreationNotification(payload);

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      const combined = `${mailOptions.subject} ${mailOptions.text} ${mailOptions.html}`;

      expect(combined.toLowerCase()).not.toContain('password');
      expect(combined.toLowerCase()).not.toContain('argon2');
      expect(combined.toLowerCase()).not.toContain('bcrypt');
      expect(combined.toLowerCase()).not.toContain('token');
      expect(combined.toLowerCase()).not.toContain('cookie');
      expect(combined.toLowerCase()).not.toContain('secret');
      expect(combined.toLowerCase()).not.toContain('otp');
    });

    it('should prevent duplicate notifications via idempotency check for retried invocations', async () => {
      const payload = {
        id: 'usr-idempotent-1',
        email: 'repeat@example.com',
        firstName: 'Repeat',
        lastName: 'User',
        phone: '987654321',
        countryCode: '+61',
        role: UserRole.STUDENT,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      const firstSend =
        await emailService.sendAccountCreationNotification(payload);
      expect(firstSend).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      // Second invocation with same user ID (idempotency triggered)
      const secondSend =
        await emailService.sendAccountCreationNotification(payload);
      expect(secondSend).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1); // Still 1, NOT called again
    });

    it('should handle SMTP failure safely without throwing', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('Connection timeout to smtp.office365.com'),
      );

      const payload = {
        id: 'usr-smtp-fail',
        email: 'fail@example.com',
        firstName: 'Fail',
        lastName: 'Test',
        phone: '00000000',
        countryCode: '+61',
        role: UserRole.STUDENT,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      const result =
        await emailService.sendAccountCreationNotification(payload);
      expect(result).toBe(false);
    });

    it('should atomically prevent duplicate notifications using Redis SET NX lock', async () => {
      const mockRedisClient = {
        set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
      };
      const mockRedisService = {
        client: mockRedisClient,
        del: jest.fn().mockResolvedValue(undefined),
      };

      const emailServiceWithRedis = new EmailService(mockRedisService as any);
      emailServiceWithRedis.setTransporter(mockTransporter);

      const payload = {
        id: 'usr-redis-atomic-1',
        email: 'atomic@example.com',
        firstName: 'Atomic',
        lastName: 'Lock',
        phone: '11223344',
        countryCode: '+61',
        role: UserRole.STUDENT,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      // First call acquires atomic lock
      const firstRes = await emailServiceWithRedis.sendAccountCreationNotification(payload);
      expect(firstRes).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'notification:account_created:usr-redis-atomic-1',
        expect.any(String),
        'EX',
        2592000,
        'NX',
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      // Second concurrent/retry call where Redis SET NX returns null (already locked)
      // Create new instance to bypass in-memory cache and test pure Redis SET NX behavior
      const secondInstance = new EmailService(mockRedisService as any);
      secondInstance.setTransporter(mockTransporter);

      const secondRes = await secondInstance.sendAccountCreationNotification(payload);
      expect(secondRes).toBe(true);
      // sendMail should NOT be called again
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should release Redis lock if SMTP sending fails to permit safe retry', async () => {
      const mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK'),
      };
      const mockRedisService = {
        client: mockRedisClient,
        del: jest.fn().mockResolvedValue(undefined),
      };

      const emailServiceWithRedis = new EmailService(mockRedisService as any);
      emailServiceWithRedis.setTransporter(mockTransporter);

      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('Temporary Microsoft SMTP timeout'),
      );

      const payload = {
        id: 'usr-retry-permit',
        email: 'retry@example.com',
        firstName: 'Retry',
        lastName: 'Lock',
        phone: '55667788',
        countryCode: '+61',
        role: UserRole.STUDENT,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
        location: null,
      };

      const result = await emailServiceWithRedis.sendAccountCreationNotification(payload);
      expect(result).toBe(false);

      // Redis lock should be deleted so that a retry can succeed
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'notification:account_created:usr-retry-permit',
      );
    });

    it('should verify SMTP connection using verifySmtpConnection', async () => {
      const isConnected = await emailService.verifySmtpConnection();
      expect(isConnected).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    });
  });

  describe('AuthService Provider Registration Flow', () => {
    const providerDto = {
      email: 'provider@matrixonline.in',
      password: 'StrongPassword123!',
      firstName: 'Org',
      lastName: 'Leader',
      countryCode: '+61',
      phone: '0400111222',
      dateOfBirth: '1990-01-01',
      organizationName: 'Matrix Services',
      organizationType: OrgType.PROVIDER,
      businessCategory: BusinessCategory.SERVICES,
    };

    it('should trigger notification to both recipients after provider account successfully persists', async () => {
      const createdUser = {
        id: 'usr-provider-1',
        email: providerDto.email.toLowerCase(),
        firstName: providerDto.firstName,
        lastName: providerDto.lastName,
        phone: providerDto.phone,
        countryCode: providerDto.countryCode,
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.organization.create.mockResolvedValue({ id: 'org-1' });
      prismaService.user.create.mockResolvedValue(createdUser);
      prismaService.orgStaff.create.mockResolvedValue({ id: 'staff-1' });

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      const response = await authService.registerProvider(providerDto);

      expect(response.requiresEmailVerification).toBe(true);
      expect(spyNotification).toHaveBeenCalledTimes(1);
      expect(spyNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr-provider-1',
          email: 'provider@matrixonline.in',
          firstName: 'Org',
          lastName: 'Leader',
          phone: '0400111222',
          countryCode: '+61',
          role: UserRole.ORG_STAFF,
          location: null,
        }),
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['jb.narang@matrixonline.in', 'it.team@matrixonline.in'],
        }),
      );
    });

    it('should send NO notification when registration fails (database error before commit)', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.$transaction.mockRejectedValueOnce(
        new Error('Database unique constraint failed'),
      );

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      await expect(authService.registerProvider(providerDto)).rejects.toThrow(
        'Database unique constraint failed',
      );

      expect(spyNotification).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should send NO notification on duplicate registration attempt (already verified email)', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'usr-existing-verified',
        email: providerDto.email.toLowerCase(),
        emailVerified: true,
        orgStaffRoles: [],
      });

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      await expect(authService.registerProvider(providerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(spyNotification).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should NOT produce duplicate notification when registration is retried for an unverified user', async () => {
      // Unverified user retrying signup
      prismaService.user.findUnique.mockResolvedValue({
        id: 'usr-unverified-retry',
        email: providerDto.email.toLowerCase(),
        emailVerified: false,
        orgStaffRoles: [{ organizationId: 'org-old' }],
      });
      prismaService.user.update.mockResolvedValue({
        id: 'usr-unverified-retry',
        email: providerDto.email.toLowerCase(),
      });
      prismaService.organization.update.mockResolvedValue({ id: 'org-old' });

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      const res = await authService.registerProvider(providerDto);
      expect(res.requiresEmailVerification).toBe(true);

      // Notification must NOT be triggered on retry of existing user
      expect(spyNotification).not.toHaveBeenCalled();
    });

    it('should NOT roll back or fail account creation if SMTP delivery fails', async () => {
      const createdUser = {
        id: 'usr-provider-smtp-fail',
        email: providerDto.email.toLowerCase(),
        firstName: providerDto.firstName,
        lastName: providerDto.lastName,
        phone: providerDto.phone,
        countryCode: providerDto.countryCode,
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.organization.create.mockResolvedValue({ id: 'org-1' });
      prismaService.user.create.mockResolvedValue(createdUser);
      prismaService.orgStaff.create.mockResolvedValue({ id: 'staff-1' });

      // Mock SMTP notification failure
      jest
        .spyOn(emailService, 'sendAccountCreationNotification')
        .mockRejectedValueOnce(
          new Error('SMTP connection refused: 554 5.2.252'),
        );

      // Account registration must still succeed
      const response = await authService.registerProvider(providerDto);
      expect(response.requiresEmailVerification).toBe(true);
      expect(response.email).toBe(providerDto.email.toLowerCase());
    });
  });

  describe('AuthService Student Registration Flow', () => {
    const studentDto = {
      email: 'student@matrixonline.in',
      password: 'StrongStudentPassword123!',
      firstName: 'Student',
      lastName: 'Scholar',
      countryCode: '+61',
      phone: '0411222333',
      dateOfBirth: '2004-05-15',
    };

    it('should trigger notification to both recipients after student account successfully persists', async () => {
      const createdStudent = {
        id: 'usr-student-1',
        email: studentDto.email.toLowerCase(),
        firstName: studentDto.firstName,
        lastName: studentDto.lastName,
        phone: studentDto.phone,
        countryCode: studentDto.countryCode,
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(createdStudent);

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      const response = await authService.registerStudent(studentDto);

      expect(response.requiresEmailVerification).toBe(true);
      expect(spyNotification).toHaveBeenCalledTimes(1);
      expect(spyNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr-student-1',
          email: 'student@matrixonline.in',
          firstName: 'Student',
          lastName: 'Scholar',
          phone: '0411222333',
          countryCode: '+61',
          role: UserRole.STUDENT,
        }),
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['jb.narang@matrixonline.in', 'it.team@matrixonline.in'],
        }),
      );
    });

    it('should send NO notification on duplicate student registration', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'usr-student-verified',
        email: studentDto.email.toLowerCase(),
        emailVerified: true,
      });

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      await expect(authService.registerStudent(studentDto)).rejects.toThrow(
        ConflictException,
      );

      expect(spyNotification).not.toHaveBeenCalled();
    });

    it('should NOT produce duplicate notification when student registration is retried', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'usr-student-retry',
        email: studentDto.email.toLowerCase(),
        emailVerified: false,
      });
      prismaService.user.update.mockResolvedValue({
        id: 'usr-student-retry',
        email: studentDto.email.toLowerCase(),
      });

      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      const response = await authService.registerStudent(studentDto);
      expect(response.requiresEmailVerification).toBe(true);

      // Notification must NOT be triggered on retry
      expect(spyNotification).not.toHaveBeenCalled();
    });

    it('should NOT roll back student creation if SMTP delivery fails', async () => {
      const createdStudent = {
        id: 'usr-student-smtp-fail',
        email: studentDto.email.toLowerCase(),
        firstName: studentDto.firstName,
        lastName: studentDto.lastName,
        phone: studentDto.phone,
        countryCode: studentDto.countryCode,
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        timezone: 'Australia/Sydney',
        createdAt: mockDate,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(createdStudent);

      jest
        .spyOn(emailService, 'sendAccountCreationNotification')
        .mockRejectedValueOnce(new Error('SMTP server down'));

      const response = await authService.registerStudent(studentDto);
      expect(response.requiresEmailVerification).toBe(true);
      expect(response.email).toBe(studentDto.email.toLowerCase());
    });
  });

  describe('Non-registration authentication actions', () => {
    it('should NOT trigger notification during login', async () => {
      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      // AuthService.login does not call sendAccountCreationNotification
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'pass',
        }),
      ).rejects.toThrow();

      expect(spyNotification).not.toHaveBeenCalled();
    });

    it('should NOT trigger notification during resendOtp', async () => {
      const spyNotification = jest.spyOn(
        emailService,
        'sendAccountCreationNotification',
      );

      prismaService.user.findUnique.mockResolvedValue(null);
      const res = await authService.resendOtp({
        email: 'test@example.com',
      });

      expect(res.message).toContain('verification code was sent');
      expect(spyNotification).not.toHaveBeenCalled();
    });
  });
});
