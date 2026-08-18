import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as qrcode from 'qrcode';
const { authenticator } = require('otplib');

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, accountStatus: true,
      }
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: any) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
        select: {
          id: true, email: true, firstName: true, lastName: true, role: true, accountStatus: true,
        }
      });
    } catch (e) {
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  async getSecurity(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true }
    });
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: 'desc' }
    });
    return { mfaEnabled: user?.mfaEnabled, sessions };
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Jesmond', secret);

    // Store temporarily. A more robust implementation would use a temporary cache/Redis.
    // For now, save to the user record but keep mfaEnabled false.
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret }
    });

    const qrDataUrl = await qrcode.toDataURL(otpauth);
    return { qrDataUrl, secret };
  }

  async verify2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new BadRequestException('MFA setup not initiated');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!isValid) throw new UnauthorizedException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true }
    });

    return { success: true, message: 'MFA successfully enabled' };
  }

  async disable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!isValid) throw new UnauthorizedException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null }
    });

    return { success: true, message: 'MFA successfully disabled' };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true }
    });
    return { success: true };
  }

  async getNotifications(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotifications: true, smsNotifications: true, pushNotifications: true }
    });
    return user;
  }

  async updateNotifications(userId: string, data: any) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailNotifications: data.emailNotifications,
        smsNotifications: data.smsNotifications,
        pushNotifications: data.pushNotifications,
      },
      select: { emailNotifications: true, smsNotifications: true, pushNotifications: true }
    });
  }

  async requestAccountDeletion(userId: string, data: { reason?: string }) {
    const existing = await this.prisma.accountDeletionRequest.findUnique({ where: { userId } });
    if (existing && existing.status === 'PENDING') {
      throw new BadRequestException('A deletion request is already pending for this account.');
    }

    if (existing) {
      await this.prisma.accountDeletionRequest.delete({ where: { userId } });
    }

    return await this.prisma.accountDeletionRequest.create({
      data: {
        userId,
        reason: data.reason
      }
    });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgStaffRoles: { include: { organization: true } },
        sessions: {
          select: { deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true, isRevoked: true }
        },
        accountDeletionRequest: true,
      }
    });

    if (!user) throw new NotFoundException('User not found');

    // Strip sensitive fields
    const { password, mfaSecret, emailVerificationToken, ...safeUser } = user;

    return {
      exportedAt: new Date(),
      user: safeUser,
    };
  }
}
