import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterProviderDto, RegisterStudentDto, LoginDto, VerifyEmailDto, ResendOtpDto } from '../dtos/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole, AccountStatus, OrgType } from '@prisma/client';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}



  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async registerProvider(dto: RegisterProviderDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          type: dto.organizationType,
          status: 'PENDING',
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
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
          role: UserRole.ORG_STAFF,
          permissions: ['*'],
        },
      });

      return { user, org };
    });

    await this.emailService.sendVerificationOtp(result.user.email, otp);

    return {
      message: 'Verification code sent',
      requiresEmailVerification: true,
      email: result.user.email,
    };
  }

  async registerStudent(dto: RegisterStudentDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        emailVerified: false,
        emailVerificationToken: otpHash,
        emailVerificationExpiresAt: otpExpiresAt,
        emailOtpLastSentAt: new Date(),
        emailOtpAttempts: 0,
      },
    });

    await this.emailService.sendVerificationOtp(user.email, otp);

    return {
      message: 'Verification code sent',
      requiresEmailVerification: true,
      email: user.email,
    };
  }

  async login(dto: LoginDto) {
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

    if (user.accountStatus === AccountStatus.SUSPENDED || user.accountStatus === AccountStatus.DEACTIVATED) {
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

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    const organizationId = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organizationId : undefined;

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

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { orgStaffRoles: true },
    });

    if (!user) throw new UnauthorizedException('Invalid verification code');
    if (user.emailVerified) throw new ConflictException('Email already verified');

    if (user.emailOtpAttempts >= 5) {
      throw new UnauthorizedException('Maximum verification attempts reached. Please request a new code.');
    }
    if (!user.emailVerificationToken || !user.emailVerificationExpiresAt) {
      throw new UnauthorizedException('No active verification code found.');
    }
    if (user.emailVerificationExpiresAt < new Date()) {
      throw new UnauthorizedException('Verification code has expired. Please request a new code.');
    }

    // Atomically increment attempts BEFORE comparing to prevent concurrent bypass
    const updatedUserAtomic = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailOtpAttempts: { increment: 1 } },
    });

    if (updatedUserAtomic.emailOtpAttempts > 5) {
      throw new UnauthorizedException('Maximum verification attempts reached. Please request a new code.');
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

    const payload = { sub: updatedUser.id, email: updatedUser.email, role: updatedUser.role };
    const access_token = this.jwtService.sign(payload);
    const organizationId = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organizationId : undefined;

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
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) return { message: 'If an account exists, a verification code was sent.' };
    if (user.emailVerified) throw new ConflictException('Email already verified');

    if (user.emailOtpLastSentAt) {
      const diffSeconds = (Date.now() - user.emailOtpLastSentAt.getTime()) / 1000;
      if (diffSeconds < 60) {
        throw new ConflictException(`Please wait ${Math.ceil(60 - diffSeconds)} seconds before requesting a new code.`);
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

    return { message: 'If an account exists, a verification code was sent.' };
  }
}
