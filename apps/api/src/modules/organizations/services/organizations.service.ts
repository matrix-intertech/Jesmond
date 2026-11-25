import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import {
  BusinessCategory,
  OrgType,
  OrgStatus,
  UserRole,
  AccountStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

export interface CreateOrganizationInput {
  name: string;
  type?: OrgType;
  businessCategory?: BusinessCategory;
  onboardingToken?: string;
  abn?: string;
  phone?: string;
  address?: string;
  settings?: Record<string, any>;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  // In-memory fallback map for non-Redis / isolated unit test environments
  private readonly fallbackNonceMap = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService,
  ) {}

  /**
   * Initiates business onboarding for an eligible, verified user.
   * - Enforces verified, active account status (prevents unverified users from initiating).
   * - Checks that the user does not already own an active organization.
   * - Issues a short-lived (15 min), cryptographically signed onboarding ticket.
   * - Stores the single-use nonce in Redis for atomic burn-on-consumption.
   */
  async initiateBusinessOnboarding(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgStaffRoles: {
          where: { deletedAt: null },
          include: { organization: true },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('User account not found');
    }

    if (!user.emailVerified || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Account must be email-verified and active to initiate business onboarding.',
      );
    }

    const activeStaff = user.orgStaffRoles.filter(
      (s) => !s.deletedAt && s.organization && !s.organization.deletedAt,
    );

    if (activeStaff.length > 0) {
      throw new ConflictException(
        'User already belongs to an active business organization.',
      );
    }

    // Generate cryptographically secure single-use nonce
    const nonce = crypto.randomBytes(24).toString('base64url');
    const redisKey = `onboarding:nonce:${nonce}`;
    const ttlSeconds = 900; // 15 minutes
    const isProduction = process.env.NODE_ENV === 'production';

    if (this.redisService) {
      try {
        await this.redisService.set(redisKey, { userId: user.id }, ttlSeconds);
      } catch (err: any) {
        this.logger.warn(
          `Failed to store onboarding nonce in Redis: ${err.message}`,
        );
        if (isProduction) {
          throw new ServiceUnavailableException(
            'Distributed cache service is currently unavailable. Please try again shortly.',
          );
        }
      }
    } else if (isProduction) {
      throw new ServiceUnavailableException(
        'Redis cache service required for secure onboarding in production environment.',
      );
    }

    // In-memory fallback map strictly restricted to non-production test environments
    if (!isProduction) {
      this.fallbackNonceMap.set(nonce, {
        userId: user.id,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }

    const onboardingToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: 'business_onboarding',
        nonce,
      },
      { expiresIn: '15m' },
    );

    return {
      onboardingToken,
      expiresIn: ttlSeconds,
    };
  }

  /**
   * Creates an organization for a verified authenticated user in the Business Portal onboarding flow.
   * - Enforces verified, active account status (prevents unverified bypass).
   * - Validates server-issued onboarding token for non-admin callers (prevents header spoofing).
   * - Atomically burns token nonce (single-use replay protection).
   * - Restricts role escalation: grants OrgStaff ADMIN strictly for the new organization.
   * - Safely and idempotently handles concurrent creation attempts via transaction.
   * - Prevents overwriting or hijacking existing organizations.
   * - Preserves the original user ID.
   */
  async createOrganizationForUser(
    userId: string,
    dto: CreateOrganizationInput,
    callerRole?: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgStaffRoles: {
          where: { deletedAt: null },
          include: { organization: true },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('User account not found');
    }

    // 1. Enforce verified and active account status
    if (!user.emailVerified || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Account must be email-verified and active to create or register an organization.',
      );
    }

    const isAdmin =
      callerRole === UserRole.ADMIN ||
      callerRole === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN;

    // 2. Server-verified onboarding authorization condition (non-admins must provide valid onboardingToken)
    if (!isAdmin) {
      if (!dto.onboardingToken) {
        throw new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        );
      }

      let payload: any;
      try {
        payload = this.jwtService.verify(dto.onboardingToken);
      } catch (err: any) {
        throw new ForbiddenException(
          'Invalid or expired business onboarding token.',
        );
      }

      if (
        payload.purpose !== 'business_onboarding' ||
        payload.sub !== user.id ||
        !payload.nonce
      ) {
        throw new ForbiddenException('Unauthorized business onboarding token.');
      }

      // Atomic single-use consumption: Burn the nonce to prevent replays
      let validNonce = false;
      const redisKey = `onboarding:nonce:${payload.nonce}`;
      const isProduction = process.env.NODE_ENV === 'production';

      if (this.redisService) {
        try {
          const stored = await this.redisService.getDel<any>(redisKey);
          if (stored && stored.userId === user.id) {
            validNonce = true;
          }
        } catch (err: any) {
          this.logger.warn(
            `Redis getDel error on onboarding nonce: ${err.message}`,
          );
          if (isProduction) {
            throw new ServiceUnavailableException(
              'Distributed cache service is currently unavailable. Please try again shortly.',
            );
          }
        }
      } else if (isProduction) {
        throw new ServiceUnavailableException(
          'Redis cache service required for secure onboarding in production environment.',
        );
      }

      // In-memory fallback map strictly restricted to non-production test environments
      if (!validNonce && !isProduction) {
        const entry = this.fallbackNonceMap.get(payload.nonce);
        if (entry && entry.expiresAt > Date.now() && entry.userId === user.id) {
          this.fallbackNonceMap.delete(payload.nonce);
          validNonce = true;
        }
      }

      if (!validNonce) {
        throw new ForbiddenException(
          'Business onboarding token has already been consumed or has expired.',
        );
      }
    }

    // 3. Check if user already owns an active organization
    const activeStaff = user.orgStaffRoles.filter(
      (s) => !s.deletedAt && s.organization && !s.organization.deletedAt,
    );

    if (activeStaff.length > 0) {
      return activeStaff[0].organization;
    }

    const isAccommodation =
      dto.businessCategory === BusinessCategory.RENTALS ||
      (dto.businessCategory as any) === 'ACCOMMODATION';

    const orgType =
      dto.type || (isAccommodation ? OrgType.PROVIDER : OrgType.RETAIL);

    const businessCategory = isAccommodation
      ? BusinessCategory.RENTALS
      : dto.businessCategory ||
        (dto.type === OrgType.PROVIDER
          ? BusinessCategory.RENTALS
          : BusinessCategory.RETAIL);

    return this.prisma.$transaction(async (tx) => {
      // Re-query within transaction to prevent race conditions from concurrent calls
      const currentStaff = await tx.orgStaff.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
          organization: { deletedAt: null },
        },
        include: { organization: true },
      });

      if (currentStaff?.organization) {
        return currentStaff.organization;
      }

      const org = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          type: orgType,
          businessCategory,
          status: OrgStatus.PENDING,
          abn: dto.abn ? dto.abn.replace(/\s+/g, '') : undefined,
          settings: dto.settings || (dto.address || dto.phone ? {
            address: dto.address || undefined,
            phone: dto.phone || undefined,
          } : undefined),
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

      // Update user role to ORG_STAFF if user was previously STUDENT
      if (user.role === UserRole.STUDENT) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: UserRole.ORG_STAFF },
        });
      }

      return org;
    });
  }
}
