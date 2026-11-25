import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { SsoAuthorizeDto, SsoExchangeDto } from '../dtos/sso.dto';
import * as crypto from 'crypto';
import { AccountStatus, UserRole } from '@prisma/client';

export interface SsoStoredCode {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope?: string;
  createdAt: number;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  // In-memory fallback map for when Redis is offline or during isolated unit tests
  private readonly fallbackCodeMap = new Map<
    string,
    { data: SsoStoredCode; expiresAt: number }
  >();

  private readonly VALID_CLIENT_IDS = new Set([
    'jesmond-business-portal',
    'jesmond-student-portal',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService,
  ) {}

  /**
   * Retrieves the allowed list of redirect URIs based on configuration and defaults.
   */
  getAllowedRedirectUris(): string[] {
    const baseUris = [
      'https://business.jesmond.com.au/auth/callback',
      'https://jesmond.com.au/auth/callback',
      'http://localhost:3000/auth/callback',
      'http://business.localhost:3000/auth/callback',
      'http://127.0.0.1:3000/auth/callback',
    ];

    if (process.env.PORTAL_BUSINESS_URL) {
      try {
        const u = new URL('/auth/callback', process.env.PORTAL_BUSINESS_URL).toString();
        baseUris.push(u);
      } catch {}
    }
    if (process.env.PORTAL_STUDENT_URL) {
      try {
        const u = new URL('/auth/callback', process.env.PORTAL_STUDENT_URL).toString();
        baseUris.push(u);
      } catch {}
    }
    if (process.env.ALLOWED_SSO_REDIRECT_URIS) {
      const additional = process.env.ALLOWED_SSO_REDIRECT_URIS.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      baseUris.push(...additional);
    }

    return Array.from(new Set(baseUris));
  }

  /**
   * Validates client_id and redirect_uri against strict whitelists.
   */
  validateClientAndRedirectUri(clientId: string, redirectUri: string): void {
    if (!this.VALID_CLIENT_IDS.has(clientId)) {
      throw new BadRequestException(`Unauthorized client_id: "${clientId}"`);
    }

    const allowed = this.getAllowedRedirectUris();
    const isAllowed = allowed.includes(redirectUri);

    if (!isAllowed) {
      this.logger.warn(
        `Rejected redirect_uri "${redirectUri}" for client_id "${clientId}". Allowed: ${allowed.join(', ')}`,
      );
      throw new BadRequestException('Invalid or unapproved redirect_uri');
    }
  }

  /**
   * Generates a 60-second single-use authorization code for an authenticated user.
   */
  async generateAuthorizationCode(
    user: { id: string },
    dto: SsoAuthorizeDto,
  ): Promise<{ code: string; state: string; redirect_uri: string; expires_in: number }> {
    this.validateClientAndRedirectUri(dto.client_id, dto.redirect_uri);

    if (dto.code_challenge_method !== 'S256') {
      throw new BadRequestException('Only S256 code_challenge_method is permitted');
    }

    // Cryptographically secure 256-bit random authorization code
    const code = crypto.randomBytes(32).toString('base64url');
    const redisKey = `sso:code:${code}`;
    const ttlSeconds = 60; // 60 seconds strict expiry

    const payload: SsoStoredCode = {
      userId: user.id,
      clientId: dto.client_id,
      redirectUri: dto.redirect_uri,
      codeChallenge: dto.code_challenge,
      codeChallengeMethod: dto.code_challenge_method,
      state: dto.state,
      scope: dto.scope,
      createdAt: Date.now(),
    };

    let savedToRedis = false;
    if (this.redisService) {
      try {
        await this.redisService.set(redisKey, payload, ttlSeconds);
        savedToRedis = true;
      } catch (err: any) {
        this.logger.warn(`Failed to store SSO code in Redis: ${err.message}. Using fallback.`);
      }
    }

    if (!savedToRedis) {
      // Store in memory with auto-expiration
      this.fallbackCodeMap.set(code, {
        data: payload,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      // Schedule cleanup with unref so it does not block process/test shutdown
      const timer = setTimeout(() => this.fallbackCodeMap.delete(code), ttlSeconds * 1000);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    }

    return {
      code,
      state: dto.state,
      redirect_uri: dto.redirect_uri,
      expires_in: ttlSeconds,
    };
  }

  /**
   * Exchanges an authorization code and PKCE code_verifier for a valid JWT session.
   * Atomically burns the code on read (GETDEL) to guarantee single-use and replay protection.
   */
  async exchangeAuthorizationCode(
    dto: SsoExchangeDto,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    this.validateClientAndRedirectUri(dto.client_id, dto.redirect_uri);

    const redisKey = `sso:code:${dto.code}`;
    let stored: SsoStoredCode | null = null;

    // 1. Atomic Burn-On-Read from Redis (GETDEL)
    if (this.redisService) {
      try {
        stored = await this.redisService.getDel<SsoStoredCode>(redisKey);
      } catch (err: any) {
        this.logger.warn(`Redis getDel error during SSO exchange: ${err.message}`);
      }
    }

    // 2. Fallback to memory map if Redis was offline or not populated
    if (!stored) {
      const fallbackEntry = this.fallbackCodeMap.get(dto.code);
      if (fallbackEntry) {
        // Atomic delete in fallback
        this.fallbackCodeMap.delete(dto.code);
        if (fallbackEntry.expiresAt > Date.now()) {
          stored = fallbackEntry.data;
        }
      }
    }

    // If still null, the code was either never issued, already consumed, or expired
    if (!stored) {
      this.logger.warn(
        `SSO Code exchange failed: Code not found, expired, or replayed. (Client: ${dto.client_id})`,
      );
      throw new UnauthorizedException(
        'Invalid, expired, or already used authorization code',
      );
    }

    // 3. Verify client_id matches
    if (stored.clientId !== dto.client_id) {
      this.logger.warn(
        `SSO Code exchange client mismatch: Stored=${stored.clientId}, Received=${dto.client_id}`,
      );
      throw new UnauthorizedException('client_id does not match authorization request');
    }

    // 4. Verify redirect_uri matches
    if (stored.redirectUri !== dto.redirect_uri) {
      this.logger.warn(
        `SSO Code exchange redirect_uri mismatch: Stored=${stored.redirectUri}, Received=${dto.redirect_uri}`,
      );
      throw new UnauthorizedException('redirect_uri does not match authorization request');
    }

    // 5. Verify OAuth state matches stored state (Anti-CSRF protection)
    if (!dto.state || stored.state !== dto.state) {
      this.logger.warn(
        `SSO Code exchange state mismatch: Stored="${stored.state}", Received="${dto.state}"`,
      );
      throw new UnauthorizedException(
        'Invalid or mismatched state parameter (CSRF validation failed)',
      );
    }

    // 6. Verify PKCE code_verifier (RFC 7636 Section 4.6)
    // S256: code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
    const computedChallenge = crypto
      .createHash('sha256')
      .update(dto.code_verifier)
      .digest('base64url');

    if (computedChallenge.length !== stored.codeChallenge.length) {
      throw new UnauthorizedException('Invalid code_verifier (PKCE verification failed)');
    }

    const isPkceValid = crypto.timingSafeEqual(
      Buffer.from(computedChallenge),
      Buffer.from(stored.codeChallenge),
    );

    if (!isPkceValid) {
      this.logger.warn('PKCE verification failed: computed challenge does not match stored challenge');
      throw new UnauthorizedException('Invalid code_verifier (PKCE verification failed)');
    }

    // 6. Retrieve User and verify status
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: {
        orgStaffRoles: {
          where: { deletedAt: null },
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (
      !user ||
      user.deletedAt ||
      user.accountStatus === AccountStatus.SUSPENDED ||
      user.accountStatus === AccountStatus.DEACTIVATED
    ) {
      throw new UnauthorizedException('User account is invalid, suspended, or deactivated');
    }

    // 7. Create persistent database session with 7-day expiration
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.userAgent,
      },
    });

    const activeStaffRoles = (user.orgStaffRoles || []).filter(
      (r) => !r.deletedAt && (!r.organization || !r.organization.deletedAt),
    );

    const activeRole = activeStaffRoles.length > 0 ? activeStaffRoles[0] : undefined;
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
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
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
        businessRoleCount: activeStaffRoles.length,
      },
    };
  }

  /**
   * Verifies if a user has active business organization credentials.
   * Enforces backend authorization so non-business users cannot access the Business Portal.
   */
  async checkBusinessAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgStaffRoles: {
          where: {
            deletedAt: null,
            organization: { deletedAt: null },
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                businessCategory: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    const staffRoles = ((user as any)?.orgStaffRoles || []) as Array<any>;
    const activeOrgs = staffRoles.map((staff) => ({
      organizationId: staff.organizationId,
      organizationName: staff.organization?.name,
      orgType: staff.organization?.type,
      businessCategory: staff.organization?.businessCategory,
      status: staff.organization?.status,
      role: staff.role,
      permissions: staff.permissions,
      retailBranchId: staff.retailBranchId,
    }));

    const hasBusinessAccess = isAdmin || activeOrgs.length > 0;

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      hasBusinessAccess,
      isAdmin,
      organizations: activeOrgs,
      activeOrganization: activeOrgs.length > 0 ? activeOrgs[0] : null,
    };
  }

  /**
   * Revokes the user session on logout.
   */
  async logoutSession(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all active sessions for this user
      await this.prisma.session.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return { success: true, message: 'Session successfully revoked' };
  }
}
