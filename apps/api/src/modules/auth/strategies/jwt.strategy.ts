import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Extracts JWT token from either __Host-* session cookies or fallback session cookies.
 * Disambiguates based on trusted portal host and rejects ambiguous conflicting inputs.
 */
export const extractJwtFromCookie = (req: any): string | null => {
  if (!req) return null;
  const cookieHeader = req.headers?.cookie || req.headers?.['cookie'];
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const cookieMap: Record<string, string> = {};
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=');
    const cookieName = rawName?.trim();
    if (cookieName) {
      const val = rest.join('=').trim();
      cookieMap[cookieName] = val ? decodeURIComponent(val) : '';
    }
  }

  const businessToken =
    cookieMap['__Host-business-session'] || cookieMap['business-session'];
  const studentToken =
    cookieMap['__Host-student-session'] || cookieMap['student-session'];
  const fallbackToken =
    cookieMap['jesmond_session'] || cookieMap['jesmond_token'];

  // Inspect trusted host / origin headers (validated against approved whitelist)
  const hostHeader = (
    (req.headers?.host as string) ||
    (req.headers?.['x-forwarded-host'] as string) ||
    ''
  ).toLowerCase().trim();

  const originHeader = (
    (req.headers?.origin as string) ||
    (req.headers?.referer as string) ||
    ''
  ).toLowerCase().trim();

  const isTrustedBusinessHost =
    /^business\.jesmond\.com\.au(:[0-9]+)?$/.test(hostHeader) ||
    /^business\.localhost(:[0-9]+)?$/.test(hostHeader) ||
    originHeader.startsWith('https://business.jesmond.com.au') ||
    originHeader.startsWith('http://business.localhost');

  const isTrustedStudentHost =
    /^(www\.)?jesmond\.com\.au(:[0-9]+)?$/.test(hostHeader) ||
    /^(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(hostHeader) ||
    originHeader.startsWith('https://jesmond.com.au') ||
    originHeader.startsWith('http://localhost') ||
    originHeader.startsWith('http://127.0.0.1');

  // If conflicting, different cookies are provided for both portals
  if (businessToken && studentToken && businessToken !== studentToken) {
    if (isTrustedBusinessHost) {
      return businessToken;
    }
    if (isTrustedStudentHost) {
      return studentToken;
    }
    // Ambiguous and untrusted host: reject ambiguous conflicting session cookies
    return null;
  }

  if (isTrustedBusinessHost && businessToken) {
    return businessToken;
  }

  if (isTrustedStudentHost && studentToken) {
    return studentToken;
  }

  // Single portal cookie present
  return businessToken || studentToken || fallbackToken || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error(
        'JWT_SECRET must be explicitly configured in production environment.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret || 'fallback-secret-for-dev',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        orgStaffRoles: {
          where: {
            deletedAt: null,
            organization: { deletedAt: null },
          },
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (
      !user ||
      user.deletedAt ||
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DEACTIVATED'
    ) {
      throw new UnauthorizedException();
    }

    if (payload.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session revoked or expired');
      }
    }

    const activeStaffRoles = (user.orgStaffRoles || []).filter(
      (r) => !r.deletedAt && (!r.organization || !r.organization.deletedAt),
    );

    let activeRole: (typeof user.orgStaffRoles)[number] | undefined = undefined;

    const requestedOrgId = (
      (req?.headers?.['x-organization-id'] as string) ||
      (typeof req?.header === 'function'
        ? req.header('x-organization-id')
        : undefined) ||
      (typeof req?.get === 'function'
        ? req.get('x-organization-id')
        : undefined)
    )?.trim();

    if (requestedOrgId) {
      const matched = activeStaffRoles.find(
        (r) => r.organizationId === requestedOrgId,
      );
      if (!matched) {
        throw new ForbiddenException(
          'You do not have access to the requested organization.',
        );
      }
      activeRole = matched;
    } else if (activeStaffRoles.length === 1) {
      // Exactly one active membership: automatic selection is safe and permissible
      activeRole = activeStaffRoles[0];
    } else if (activeStaffRoles.length > 1) {
      // Multiple active memberships: require explicit organization selection
      throw new ForbiddenException(
        'Multiple active organization memberships found. Explicit organization selection is required via the X-Organization-Id header.',
      );
    }

    const organizationId = activeRole?.organizationId;
    const orgType = activeRole?.organization?.type;
    const businessCategory = activeRole?.organization?.businessCategory;
    const orgRole = activeRole?.role;
    const permissions = activeRole?.permissions || [];
    const retailBranchId = activeRole?.retailBranchId;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      organizationId,
      orgType,
      businessCategory,
      orgRole,
      permissions,
      retailBranchId,
    };
  }
}
