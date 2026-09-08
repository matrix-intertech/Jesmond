import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('JWT_SECRET must be explicitly configured in production environment.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
          where: { deletedAt: null },
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DEACTIVATED') {
      throw new UnauthorizedException();
    }

    if (payload.sessionId) {
      const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session revoked or expired');
      }
    }

    let activeRole: (typeof user.orgStaffRoles)[number] | undefined = undefined;

    if (user.orgStaffRoles && user.orgStaffRoles.length > 0) {
      const requestedOrgId = (
        (req?.headers?.['x-organization-id'] as string) ||
        (typeof req?.header === 'function' ? req.header('x-organization-id') : undefined) ||
        (typeof req?.get === 'function' ? req.get('x-organization-id') : undefined)
      )?.trim();

      if (requestedOrgId) {
        const matched = user.orgStaffRoles.find((r) => r.organizationId === requestedOrgId);
        if (!matched) {
          throw new ForbiddenException('You do not have access to the requested organization.');
        }
        activeRole = matched;
      } else {
        // Deterministic primary organization (earliest created active membership)
        activeRole = [...user.orgStaffRoles].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];
      }
    }

    const organizationId = activeRole?.organizationId;
    const orgType = activeRole?.organization?.type;
    const orgRole = activeRole?.role;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId,
      orgType,
      orgRole,
    };
  }
}
