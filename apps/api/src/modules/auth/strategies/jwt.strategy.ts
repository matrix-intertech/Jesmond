import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        orgStaffRoles: {
          include: { organization: true }
        },
      }
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
    
    const organizationId = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organizationId : undefined;
    const orgType = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organization.type : undefined;

    return { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      organizationId,
      orgType,
    };
  }
}
