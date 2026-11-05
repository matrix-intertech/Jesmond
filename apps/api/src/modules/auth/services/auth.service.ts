import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterProviderDto,
  RegisterStudentDto,
  LoginDto,
  VerifyEmailDto,
  ResendOtpDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
  RequestLoginOtpDto,
  VerifyLoginOtpDto,
} from '../dtos/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole, AccountStatus, OrgType } from '@prisma/client';
import { EmailService } from './email.service';
import { WhatsAppAuthOtpService } from './whatsapp-auth-otp.service';
import * as crypto from 'crypto';
const { authenticator } = require('otplib');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly whatsAppOtp: WhatsAppAuthOtpService,
  ) {}

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async verifyTurnstileToken(token: string): Promise<void> {
    if (!token) {
      throw new BadRequestException(
        'Security verification failed. Please try again.',
      );
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.warn(
        'TURNSTILE_SECRET_KEY is not configured. Bypassing check in development.',
      );
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          'Security verification failed. Please try again.',
        );
      }
      return;
    }

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: secretKey,
            response: token,
          }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        throw new BadRequestException(
          'Security verification failed. Please try again.',
        );
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      console.error('Turnstile verification error:', error.message);
      throw new BadRequestException(
        'Security verification failed. Please try again.',
      );
    }
  }

  async registerProvider(dto: RegisterProviderDto) {
    if (dto.turnstileToken) {
      await this.verifyTurnstileToken(dto.turnstileToken);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { orgStaffRoles: true },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new ConflictException('Email already in use.');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const isNewUser = !existingUser;
    let result;

    if (existingUser) {
      result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            firstName: dto.firstName,
            lastName: dto.lastName,
            countryCode: dto.countryCode,
            phone: dto.phone,
            ethnicity: dto.ethnicity,
            dateOfBirth: new Date(dto.dateOfBirth),
            role: UserRole.ORG_STAFF,
            emailVerificationToken: otpHash,
            emailVerificationExpiresAt: otpExpiresAt,
            emailOtpLastSentAt: new Date(),
            emailOtpAttempts: 0,
          },
        });

        if (existingUser.orgStaffRoles.length > 0) {
          const orgId = existingUser.orgStaffRoles[0].organizationId;
          const org = await tx.organization.update({
            where: { id: orgId },
            data: {
              name: dto.organizationName,
              type: dto.organizationType,
              businessCategory: dto.businessCategory,
            },
          });
          return { user, org };
        } else {
          const org = await tx.organization.create({
            data: {
              name: dto.organizationName,
              type: dto.organizationType,
              businessCategory: dto.businessCategory,
              status: 'PENDING',
            },
          });
          await tx.orgStaff.create({
            data: {
              userId: user.id,
              organizationId: org.id,
              role: UserRole.ADMIN,
              permissions: ['*'],
            },
          });
          return { user, org };
        }
      });
    } else {
      result = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: dto.organizationName,
            type: dto.organizationType,
            businessCategory: dto.businessCategory,
            status: 'PENDING',
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            firstName: dto.firstName,
            lastName: dto.lastName,
            countryCode: dto.countryCode,
            phone: dto.phone,
            ethnicity: dto.ethnicity,
            dateOfBirth: new Date(dto.dateOfBirth),
            role: UserRole.ORG_STAFF,
            accountStatus: AccountStatus.PENDING_VERIFICATION,
            emailVerified: false,
            emailVerificationToken: otpHash,
            emailVerificationExpiresAt: otpExpiresAt,
            emailOtpLastSentAt: new Date(),
            emailOtpAttempts: 0,
          },
        });

        await tx.orgStaff.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: UserRole.ADMIN,
            permissions: ['*'],
          },
        });

        return { user, org };
      });
    }

    await this.emailService.sendVerificationOtp(result.user.email, otp);

    // Fire-and-forget WhatsApp OTP (after email sent, non-blocking)
    this.whatsAppOtp.sendRegistrationOtp(result.user, otp).catch((err) =>
      this.logger.warn(`WA OTP register (provider) failed: ${err.message}`),
    );

    if (isNewUser) {
      try {
        await this.emailService.sendAccountCreationNotification({
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          phone: result.user.phone,
          countryCode: result.user.countryCode,
          role: result.user.role,
          timezone: result.user.timezone,
          createdAt: result.user.createdAt,
          location: null,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to dispatch account creation notification for user ID ${result.user.id}: ${errMsg}`,
        );
      }
    }

    return {
      message: 'Verification code sent',
      requiresEmailVerification: true,
      email: result.user.email,
    };
  }

  async registerStudent(dto: RegisterStudentDto) {
    if (dto.turnstileToken) {
      await this.verifyTurnstileToken(dto.turnstileToken);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        throw new ConflictException('Email already in use.');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const isNewUser = !existingUser;
    let user;

    if (existingUser) {
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          countryCode: dto.countryCode,
          phone: dto.phone,
          ethnicity: dto.ethnicity,
          dateOfBirth: new Date(dto.dateOfBirth),
          role: UserRole.STUDENT,
          emailVerificationToken: otpHash,
          emailVerificationExpiresAt: otpExpiresAt,
          emailOtpLastSentAt: new Date(),
          emailOtpAttempts: 0,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          countryCode: dto.countryCode,
          phone: dto.phone,
          ethnicity: dto.ethnicity,
          dateOfBirth: new Date(dto.dateOfBirth),
          role: UserRole.STUDENT,
          accountStatus: AccountStatus.PENDING_VERIFICATION,
          emailVerified: false,
          emailVerificationToken: otpHash,
          emailVerificationExpiresAt: otpExpiresAt,
          emailOtpLastSentAt: new Date(),
          emailOtpAttempts: 0,
        },
      });
    }

    await this.emailService.sendVerificationOtp(user.email, otp);

    // Fire-and-forget WhatsApp OTP (after email sent, non-blocking)
    this.whatsAppOtp.sendRegistrationOtp(user, otp).catch((err) =>
      this.logger.warn(`WA OTP register (student) failed: ${err.message}`),
    );

    if (isNewUser) {
      try {
        await this.emailService.sendAccountCreationNotification({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          countryCode: user.countryCode,
          role: user.role,
          timezone: user.timezone,
          createdAt: user.createdAt,
          location: null,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to dispatch account creation notification for user ID ${user.id}: ${errMsg}`,
        );
      }
    }

    return {
      message: 'Verification code sent',
      requiresEmailVerification: true,
      email: user.email,
    };
  }

  async login(
    dto: LoginDto,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        orgStaffRoles: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.accountStatus === AccountStatus.SUSPENDED ||
      user.accountStatus === AccountStatus.DEACTIVATED
    ) {
      throw new UnauthorizedException('Account is suspended or deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
        email: user.email,
      });
    }

    if (user.mfaEnabled) {
      const mfaPayload = { sub: user.id, mfaPending: true };
      const mfaToken = this.jwtService.sign(mfaPayload, { expiresIn: '5m' });
      return { mfaRequired: true, mfaToken };
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomBytes(32).toString('hex'), // Minimal placeholder for refresh token requirement
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Match 7d from JwtModule
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.userAgent,
      },
    });

    const activeRole =
      user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0] : undefined;
    const organizationId = activeRole?.organizationId;
    const orgType = activeRole?.organization?.type;
    const businessCategory = activeRole?.organization?.businessCategory;
    const orgRole = activeRole?.role;
    const permissions = activeRole?.permissions || [];
    const retailBranchId = activeRole?.retailBranchId;

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgType,
      sessionId: session.id,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId,
        orgType,
        businessCategory,
        orgRole,
        permissions,
        retailBranchId,
      },
    };
  }

  async login2fa(
    dto: { mfaToken: string; code: string },
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    let payload;
    try {
      payload = this.jwtService.verify(dto.mfaToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (!payload.mfaPending || !payload.sub) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        orgStaffRoles: {
          include: { organization: true },
        },
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not configured for this user');
    }

    const isValid = authenticator.verify({
      token: dto.code,
      secret: user.mfaSecret,
    });
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.userAgent,
      },
    });

    const finalPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    };
    const access_token = this.jwtService.sign(finalPayload);
    const organizationId =
      user.orgStaffRoles.length > 0
        ? user.orgStaffRoles[0].organizationId
        : undefined;

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId,
      },
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { orgStaffRoles: true },
    });

    if (!user) throw new UnauthorizedException('Invalid verification code');
    if (user.emailVerified)
      throw new ConflictException('Email already verified');

    if (user.emailOtpAttempts >= 5) {
      throw new UnauthorizedException(
        'Maximum verification attempts reached. Please request a new code.',
      );
    }
    if (!user.emailVerificationToken || !user.emailVerificationExpiresAt) {
      throw new UnauthorizedException('No active verification code found.');
    }
    if (user.emailVerificationExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Verification code has expired. Please request a new code.',
      );
    }

    // Atomically increment attempts BEFORE comparing to prevent concurrent bypass
    const updatedUserAtomic = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailOtpAttempts: { increment: 1 } },
    });

    if (updatedUserAtomic.emailOtpAttempts > 5) {
      throw new UnauthorizedException(
        'Maximum verification attempts reached. Please request a new code.',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.emailVerificationToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        accountStatus: AccountStatus.ACTIVE,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        emailOtpAttempts: 0,
      },
    });

    const session = await this.prisma.session.create({
      data: {
        userId: updatedUser.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.userAgent,
      },
    });

    // Wait, the include in line 363 does not include organization! Let's do it cleanly:
    const organizationId =
      user.orgStaffRoles.length > 0
        ? user.orgStaffRoles[0].organizationId
        : undefined;
    const orgTypeResult = organizationId
      ? (
          await this.prisma.organization.findUnique({
            where: { id: organizationId },
          })
        )?.type
      : undefined;

    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      orgType: orgTypeResult,
      sessionId: session.id,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      message: 'Email verified successfully',
      access_token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        organizationId,
        orgType: orgTypeResult,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email!.toLowerCase() },
    });

    if (!user)
      return { message: 'If an account exists, a verification code was sent.' };
    if (user.emailVerified)
      throw new ConflictException('Email already verified');

    if (user.emailOtpLastSentAt) {
      const diffSeconds =
        (Date.now() - user.emailOtpLastSentAt.getTime()) / 1000;
      if (diffSeconds < 60) {
        throw new ConflictException(
          `Please wait ${Math.ceil(60 - diffSeconds)} seconds before requesting a new code.`,
        );
      }
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: otpHash,
        emailVerificationExpiresAt: otpExpiresAt,
        emailOtpLastSentAt: new Date(),
        emailOtpAttempts: 0,
      },
    });

    await this.emailService.sendVerificationOtp(user.email, otp);

    // Fire-and-forget WhatsApp OTP (after email sent, non-blocking)
    this.whatsAppOtp.sendRegistrationOtp(user, otp).catch((err) =>
      this.logger.warn(`WA OTP resend failed: ${err.message}`),
    );

    return { message: 'If an account exists, a verification code was sent.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email!.toLowerCase() },
    });

    if (!user) {
      // Do not leak account existence
      return {
        message: 'If an account exists with this email, an OTP has been sent.',
      };
    }

    if (user.passwordResetLastSentAt) {
      const diffSeconds =
        (Date.now() - user.passwordResetLastSentAt.getTime()) / 1000;
      if (diffSeconds < 60) {
        // Return success immediately to not leak account existence while preventing spam
        return {
          message:
            'If an account exists with this email, an OTP has been sent.',
        };
      }
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: otpHash,
        passwordResetExpiresAt: otpExpiresAt,
        passwordResetLastSentAt: new Date(),
        passwordResetOtpAttempts: 0,
      },
    });

    await this.emailService.sendPasswordResetOtp(user.email, otp);

    // Fire-and-forget WhatsApp OTP (after email sent, non-blocking)
    this.whatsAppOtp.sendPasswordResetOtp(user, otp).catch((err) =>
      this.logger.warn(`WA OTP password-reset failed: ${err.message}`),
    );

    return {
      message: 'If an account exists with this email, an OTP has been sent.',
    };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email!.toLowerCase() },
    });

    if (!user) throw new UnauthorizedException('Invalid or expired OTP.');

    if (user.passwordResetOtpAttempts >= 5) {
      throw new UnauthorizedException(
        'Maximum attempts reached. Please request a new code.',
      );
    }

    if (!user.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (user.passwordResetExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const updatedUserAtomic = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetOtpAttempts: { increment: 1 } },
    });

    if (updatedUserAtomic.passwordResetOtpAttempts > 5) {
      throw new UnauthorizedException(
        'Maximum attempts reached. Please request a new code.',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.passwordResetToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    return { message: 'OTP verified successfully.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email!.toLowerCase() },
    });

    if (!user) throw new UnauthorizedException('Invalid or expired OTP.');

    if (user.passwordResetOtpAttempts >= 5) {
      throw new UnauthorizedException(
        'Maximum attempts reached. Please request a new code.',
      );
    }

    if (!user.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (user.passwordResetExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const updatedUserAtomic = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetOtpAttempts: { increment: 1 } },
    });

    if (updatedUserAtomic.passwordResetOtpAttempts > 5) {
      throw new UnauthorizedException(
        'Maximum attempts reached. Please request a new code.',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.passwordResetToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          passwordResetOtpAttempts: 0,
        },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    return { message: 'Password reset successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Login OTP (phone-based passwordless secondary login)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Initiates a phone-based OTP login.
   * - Accepts email OR phone as identifier
   * - Generates a 6-digit OTP, hashes it, stores with 10-min expiry
   * - Dispatches WhatsApp OTP (fire-and-forget)
   * - Always returns a generic message to prevent account enumeration
   */
  async requestLoginOtp(dto: RequestLoginOtpDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required.');
    }

    // Look up user by email or phone
    const user = dto.email
      ? await this.prisma.user.findUnique({
          where: { email: dto.email.toLowerCase() },
        })
      : await this.prisma.user.findFirst({
          where: { phone: dto.phone },
        });

    // Generic response — do not leak account existence
    if (!user) {
      return {
        message:
          'If an account exists, a verification code has been sent via WhatsApp.',
      };
    }

    // User must have verified their email before using login OTP
    if (!user.emailVerified) {
      return {
        message:
          'If an account exists, a verification code has been sent via WhatsApp.',
      };
    }

    // Enforce 60-second cooldown
    if (user.loginOtpLastSentAt) {
      const diffSeconds =
        (Date.now() - user.loginOtpLastSentAt.getTime()) / 1000;
      if (diffSeconds < 60) {
        return {
          message:
            'If an account exists, a verification code has been sent via WhatsApp.',
        };
      }
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginOtpToken: otpHash,
        loginOtpExpiresAt: otpExpiresAt,
        loginOtpLastSentAt: new Date(),
        loginOtpAttempts: 0,
      },
    });

    // Fire-and-forget WhatsApp OTP
    this.whatsAppOtp.sendLoginOtp(user, otp).catch((err) =>
      this.logger.warn(`WA login OTP failed: ${err.message}`),
    );

    // Fire-and-forget Email login OTP
    if (user.email) {
      this.emailService.sendLoginOtp(user.email, otp).catch((err) =>
        this.logger.warn(`Email login OTP failed: ${err.message}`),
      );
    }

    return {
      message:
        'If an account exists, a verification code has been sent via WhatsApp.',
    };
  }

  /**
   * Verifies the login OTP and issues a session + JWT.
   * - Accepts email OR phone as identifier
   * - Enforces max 5 attempts, 10-min expiry
   * - Clears OTP fields on success
   * - Returns the same JWT payload structure as login()
   */
  async verifyLoginOtp(
    dto: VerifyLoginOtpDto,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required.');
    }

    const user = dto.email
      ? await this.prisma.user.findUnique({
          where: { email: dto.email.toLowerCase() },
          include: {
            orgStaffRoles: {
              include: { organization: true },
            },
          },
        })
      : await this.prisma.user.findFirst({
          where: { phone: dto.phone },
          include: {
            orgStaffRoles: {
              include: { organization: true },
            },
          },
        });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    if (!user.loginOtpToken || !user.loginOtpExpiresAt) {
      throw new UnauthorizedException('No active verification code found.');
    }

    if (user.loginOtpExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Verification code has expired. Please request a new code.',
      );
    }

    if (user.loginOtpAttempts >= 5) {
      throw new UnauthorizedException(
        'Maximum verification attempts reached. Please request a new code.',
      );
    }

    // Atomically increment attempts BEFORE comparing to prevent concurrent bypass
    const updatedUserAtomic = await this.prisma.user.update({
      where: { id: user.id },
      data: { loginOtpAttempts: { increment: 1 } },
    });

    if (updatedUserAtomic.loginOtpAttempts > 5) {
      throw new UnauthorizedException(
        'Maximum verification attempts reached. Please request a new code.',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, user.loginOtpToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    // Success — clear OTP fields and create session
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginOtpToken: null,
        loginOtpExpiresAt: null,
        loginOtpAttempts: 0,
      },
    });

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.userAgent,
      },
    });

    const activeRole =
      user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0] : undefined;
    const organizationId = activeRole?.organizationId;
    const orgType = activeRole?.organization?.type;
    const businessCategory = activeRole?.organization?.businessCategory;
    const orgRole = activeRole?.role;
    const permissions = activeRole?.permissions || [];
    const retailBranchId = activeRole?.retailBranchId;

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgType,
      sessionId: session.id,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId,
        orgType,
        businessCategory,
        orgRole,
        permissions,
        retailBranchId,
      },
    };
  }
}
