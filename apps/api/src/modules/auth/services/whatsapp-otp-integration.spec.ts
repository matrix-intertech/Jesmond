/**
 * Phase 2 — WhatsApp OTP Integration Tests
 *
 * Tests the integration between AuthService / WhatsAppAuthOtpService and
 * the WhatsApp notification system.
 *
 * All MSG91 calls are mocked. No real messages are sent.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppAuthOtpService } from './whatsapp-auth-otp.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { WhatsAppNotificationStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / factories
// ─────────────────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    phone: '412345678',
    countryCode: '61',
    whatsappNotifications: true,
    emailVerified: true,
    loginOtpToken: null,
    loginOtpExpiresAt: null,
    loginOtpAttempts: 0,
    loginOtpLastSentAt: null,
    ...overrides,
  };
}

function makeApprovedTemplate(event: WhatsAppEvent) {
  return {
    event,
    templateName: `jesmond_${event.toLowerCase()}`,
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['otp'],
    description: 'Test template',
  };
}

function makePendingTemplate(event: WhatsAppEvent) {
  return {
    ...makeApprovedTemplate(event),
    status: WhatsAppTemplateStatus.PENDING_APPROVAL,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsAppAuthOtpService unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('WhatsAppAuthOtpService', () => {
  let service: WhatsAppAuthOtpService;
  let whatsAppService: jest.Mocked<WhatsAppService>;
  let templateService: jest.Mocked<WhatsAppTemplateService>;
  let msg91Provider: jest.Mocked<Msg91Provider>;

  const mockSendAsync = jest.fn().mockResolvedValue({
    success: true,
    status: WhatsAppNotificationStatus.QUEUED,
  });

  beforeEach(async () => {
    mockSendAsync.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppAuthOtpService,
        {
          provide: WhatsAppService,
          useValue: {
            sendNotificationAsync: mockSendAsync,
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
      ],
    }).compile();

    service = module.get<WhatsAppAuthOtpService>(WhatsAppAuthOtpService);
    whatsAppService = module.get(WhatsAppService);
    templateService = module.get(WhatsAppTemplateService);
    msg91Provider = module.get(Msg91Provider);
  });

  describe('sendRegistrationOtp', () => {
    it('should enqueue WhatsApp OTP when template is approved and phone is valid', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.sendRegistrationOtp(makeUser(), '123456');

      expect(result.sent).toBe(true);
      expect(result.channel).toBe('whatsapp');
      expect(mockSendAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.AUTH_REGISTER_OTP,
          recipient: '61412345678',
          userId: 'user-123',
          variables: { otp: '123456' },
        }),
      );
    });

    it('should skip delivery when template is PENDING_APPROVAL', async () => {
      templateService.getTemplate.mockReturnValue(
        makePendingTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.sendRegistrationOtp(makeUser(), '123456');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('pending');
      expect(mockSendAsync).not.toHaveBeenCalled();
    });

    it('should skip delivery when phone is null', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '',
        isValid: false,
        reason: 'Phone number is required',
      });

      const result = await service.sendRegistrationOtp(
        makeUser({ phone: null }),
        '123456',
      );

      expect(result.sent).toBe(false);
      expect(mockSendAsync).not.toHaveBeenCalled();
    });

    it('should skip delivery when phone is invalid', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: 'not-a-phone',
        isValid: false,
        reason: 'Invalid phone format',
      });

      const result = await service.sendRegistrationOtp(
        makeUser({ phone: 'not-a-phone' }),
        '123456',
      );

      expect(result.sent).toBe(false);
      expect(mockSendAsync).not.toHaveBeenCalled();
    });

    it('should not include OTP value in idempotencyKey (should use event+userId+timestamp)', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      await service.sendRegistrationOtp(makeUser(), '999888');

      const callArg = mockSendAsync.mock.calls[0][0];
      // idempotencyKey must NOT contain the OTP value
      expect(callArg.idempotencyKey).not.toContain('999888');
      // But it should contain the event and userId
      expect(callArg.idempotencyKey).toContain('AUTH_REGISTER_OTP');
      expect(callArg.idempotencyKey).toContain('user-123');
    });

    it('should handle WhatsAppService errors gracefully (not throw)', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });
      mockSendAsync.mockRejectedValueOnce(new Error('Queue unavailable'));

      // Should not throw
      const result = await service.sendRegistrationOtp(makeUser(), '123456');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Queue unavailable');
    });
  });

  describe('sendLoginOtp', () => {
    it('should enqueue WhatsApp login OTP when template is approved', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_LOGIN_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.sendLoginOtp(makeUser(), '654321');

      expect(result.sent).toBe(true);
      expect(mockSendAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.AUTH_LOGIN_OTP,
          recipient: '61412345678',
        }),
      );
    });

    it('should skip login OTP when template is PENDING_APPROVAL', async () => {
      templateService.getTemplate.mockReturnValue(
        makePendingTemplate(WhatsAppEvent.AUTH_LOGIN_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.sendLoginOtp(makeUser(), '654321');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('pending');
    });
  });

  describe('sendPasswordResetOtp', () => {
    it('should enqueue password reset WhatsApp OTP when template is approved', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_PASSWORD_RESET_OTP),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.sendPasswordResetOtp(makeUser(), '111222');

      expect(result.sent).toBe(true);
      expect(mockSendAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.AUTH_PASSWORD_RESET_OTP,
        }),
      );
    });
  });

  describe('Phone normalization', () => {
    it('should combine countryCode + phone into a single E.164-ready string', async () => {
      templateService.getTemplate.mockReturnValue(
        makeApprovedTemplate(WhatsAppEvent.AUTH_REGISTER_OTP),
      );
      // Capture the input to normalizePhoneNumber
      msg91Provider.normalizePhoneNumber.mockImplementation((phone: string) => {
        // Simulate actual normalizer behavior
        const cleaned = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
        return { normalized: cleaned, isValid: true };
      });

      await service.sendRegistrationOtp(
        makeUser({ countryCode: '61', phone: '0412345678' }),
        '123456',
      );

      // The combined string passed to normalizer should start with '61'
      expect(msg91Provider.normalizePhoneNumber).toHaveBeenCalledWith(
        expect.stringMatching(/^61/),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AuthService integration tests (WhatsApp OTP delivery)
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService — WhatsApp OTP integration', () => {
  let authService: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let emailService: jest.Mocked<EmailService>;
  let whatsAppOtp: jest.Mocked<WhatsAppAuthOtpService>;

  const mockSendRegistrationOtp = jest
    .fn()
    .mockResolvedValue({ sent: true, channel: 'whatsapp' });
  const mockSendLoginOtp = jest
    .fn()
    .mockResolvedValue({ sent: true, channel: 'whatsapp' });
  const mockSendPasswordResetOtp = jest
    .fn()
    .mockResolvedValue({ sent: true, channel: 'whatsapp' });

  // Shared user fixture
  const baseUser = makeUser({
    id: 'user-abc',
    password: '$2b$10$hashedpassword', // bcrypt hash placeholder
    firstName: 'Test',
    lastName: 'User',
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    mfaEnabled: false,
    mfaSecret: null,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    emailOtpAttempts: 0,
    emailOtpLastSentAt: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    passwordResetOtpAttempts: 0,
    passwordResetLastSentAt: null,
    orgStaffRoles: [],
    timezone: 'Australia/Sydney',
    createdAt: new Date(),
  });

  function buildPrismaMock() {
    return {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        deleteMany: jest.fn(),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };
  }

  beforeEach(async () => {
    mockSendRegistrationOtp.mockClear();
    mockSendLoginOtp.mockClear();
    mockSendPasswordResetOtp.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: buildPrismaMock(),
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
            sendLoginOtp: jest.fn().mockResolvedValue(undefined),
            sendAccountCreationNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WhatsAppAuthOtpService,
          useValue: {
            sendRegistrationOtp: mockSendRegistrationOtp,
            sendLoginOtp: mockSendLoginOtp,
            sendPasswordResetOtp: mockSendPasswordResetOtp,
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
    whatsAppOtp = module.get(WhatsAppAuthOtpService);
  });

  // ── Registration OTP ──────────────────────────────────────────────────────

  describe('registerStudent — WhatsApp OTP', () => {
    const registerDto = {
      email: 'student@example.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Doe',
      countryCode: '61',
      phone: '412345678',
      dateOfBirth: '2000-01-01',
    };

    it('should fire WhatsApp OTP after successful registration (non-blocking)', async () => {
      const createdUser = { ...baseUser, email: registerDto.email };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // new user
      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);
      (emailService.sendVerificationOtp as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailService.sendAccountCreationNotification as jest.Mock).mockResolvedValue(
        undefined,
      );

      const response = await authService.registerStudent(registerDto);

      expect(response.requiresEmailVerification).toBe(true);
      // Email must still be sent
      expect(emailService.sendVerificationOtp).toHaveBeenCalledWith(
        createdUser.email,
        expect.any(String),
      );
      // WhatsApp OTP must be fired (fire-and-forget pattern)
      expect(mockSendRegistrationOtp).toHaveBeenCalledWith(
        expect.objectContaining({ id: createdUser.id }),
        expect.any(String), // OTP — do not assert its value here (would leak)
      );
    });

    it('should NOT return OTP in registration response', async () => {
      const createdUser = { ...baseUser, email: registerDto.email };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);

      const response = await authService.registerStudent(registerDto);

      // Response must not contain any OTP-like field
      expect(JSON.stringify(response)).not.toMatch(/\b\d{6}\b/);
      expect(response).not.toHaveProperty('otp');
      expect(response).not.toHaveProperty('code');
    });

    it('should send email even if WhatsApp OTP call rejects', async () => {
      const createdUser = { ...baseUser, email: registerDto.email };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);
      mockSendRegistrationOtp.mockRejectedValueOnce(
        new Error('WA service unavailable'),
      );

      // Should not throw even when WhatsApp fails
      const response = await authService.registerStudent(registerDto);

      expect(response.requiresEmailVerification).toBe(true);
      expect(emailService.sendVerificationOtp).toHaveBeenCalled();
    });
  });

  // ── Login OTP ─────────────────────────────────────────────────────────────

  describe('requestLoginOtp', () => {
    it('should store hashed OTP and fire WhatsApp delivery', async () => {
      const user = { ...baseUser };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...user,
        loginOtpToken: 'hashed',
      });

      const response = await authService.requestLoginOtp({
        email: 'test@example.com',
      });

      expect(response.message).toContain('verification code');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginOtpToken: expect.any(String), // hashed, not plaintext
            loginOtpExpiresAt: expect.any(Date),
            loginOtpAttempts: 0,
          }),
        }),
      );
      expect(mockSendLoginOtp).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id }),
        expect.any(String),
      );
    });

    it('should return generic message when user not found (enumeration prevention)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await authService.requestLoginOtp({
        email: 'nonexistent@example.com',
      });

      expect(response.message).toContain('verification code');
      expect(mockSendLoginOtp).not.toHaveBeenCalled();
    });

    it('should return generic message when user email is not verified', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        emailVerified: false,
      });

      const response = await authService.requestLoginOtp({
        email: 'test@example.com',
      });

      expect(response.message).toContain('verification code');
      expect(mockSendLoginOtp).not.toHaveBeenCalled();
    });

    it('should respect 60-second rate limit between OTP requests', async () => {
      const recentSentAt = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        loginOtpLastSentAt: recentSentAt,
      });

      // Should still return success message (silent rate-limit to prevent enumeration)
      const response = await authService.requestLoginOtp({
        email: 'test@example.com',
      });

      expect(response.message).toContain('verification code');
      // But must NOT update DB or send OTP again
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockSendLoginOtp).not.toHaveBeenCalled();
    });

    it('should require email or phone', async () => {
      await expect(authService.requestLoginOtp({})).rejects.toThrow(
        'Email or phone is required',
      );
    });
  });

  describe('verifyLoginOtp', () => {
    const otp = '123456';
    let otpHash: string;

    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      otpHash = await bcrypt.hash(otp, 10);
    });

    it('should return JWT on valid OTP', async () => {
      const user = {
        ...baseUser,
        loginOtpToken: otpHash,
        loginOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        loginOtpAttempts: 0,
        orgStaffRoles: [],
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...user,
        loginOtpToken: null,
        loginOtpAttempts: 1, // after increment
      });

      const response = await authService.verifyLoginOtp({ email: user.email, otp });

      expect(response).toHaveProperty('access_token');
      // OTP fields must be cleared
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginOtpToken: null,
            loginOtpExpiresAt: null,
            loginOtpAttempts: 0,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException on expired OTP', async () => {
      const user = {
        ...baseUser,
        loginOtpToken: otpHash,
        loginOtpExpiresAt: new Date(Date.now() - 1000), // expired
        loginOtpAttempts: 0,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(
        authService.verifyLoginOtp({ email: user.email, otp }),
      ).rejects.toThrow('expired');
    });

    it('should throw UnauthorizedException on invalid OTP', async () => {
      const user = {
        ...baseUser,
        loginOtpToken: otpHash,
        loginOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        loginOtpAttempts: 0,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      // After atomic increment
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...user,
        loginOtpAttempts: 1,
      });

      await expect(
        authService.verifyLoginOtp({ email: user.email, otp: '000000' }),
      ).rejects.toThrow('Invalid');
    });

    it('should lock out after 5 failed attempts', async () => {
      const user = {
        ...baseUser,
        loginOtpToken: otpHash,
        loginOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        loginOtpAttempts: 5, // already at max
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(
        authService.verifyLoginOtp({ email: user.email, otp }),
      ).rejects.toThrow('Maximum verification attempts');
    });

    it('should throw when no active OTP token exists (OTP reuse prevention)', async () => {
      const user = {
        ...baseUser,
        loginOtpToken: null, // already used / cleared
        loginOtpExpiresAt: null,
        loginOtpAttempts: 0,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(
        authService.verifyLoginOtp({ email: user.email, otp }),
      ).rejects.toThrow('No active verification code');
    });

    it('should require email or phone', async () => {
      await expect(authService.verifyLoginOtp({ otp })).rejects.toThrow(
        'Email or phone is required',
      );
    });
  });

  // ── Password Reset OTP ───────────────────────────────────────────────────

  describe('forgotPassword — WhatsApp OTP', () => {
    it('should fire WhatsApp password reset OTP after email (non-blocking)', async () => {
      const user = { ...baseUser };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(user);

      await authService.forgotPassword({ email: user.email });

      expect(emailService.sendPasswordResetOtp).toHaveBeenCalled();
      expect(mockSendPasswordResetOtp).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id }),
        expect.any(String),
      );
    });

    it('should not expose OTP in response or throw when WhatsApp fails', async () => {
      const user = { ...baseUser };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(user);
      mockSendPasswordResetOtp.mockRejectedValueOnce(
        new Error('MSG91 timeout'),
      );

      const response = await authService.forgotPassword({ email: user.email });

      // Auth flow must succeed even if WhatsApp fails
      expect(response.message).toContain('OTP has been sent');
      expect(JSON.stringify(response)).not.toMatch(/\b\d{6}\b/);
    });

    it('should not leak account existence (user not found)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await authService.forgotPassword({
        email: 'ghost@example.com',
      });

      expect(response.message).toContain('OTP has been sent');
      expect(mockSendPasswordResetOtp).not.toHaveBeenCalled();
    });
  });

  // ── Resend OTP ────────────────────────────────────────────────────────────

  describe('resendOtp — WhatsApp OTP', () => {
    it('should fire WhatsApp registration OTP on resend', async () => {
      const user = { ...baseUser, emailVerified: false, emailOtpLastSentAt: null };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(user);

      await authService.resendOtp({ email: user.email });

      expect(emailService.sendVerificationOtp).toHaveBeenCalled();
      expect(mockSendRegistrationOtp).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id }),
        expect.any(String),
      );
    });
  });
});

