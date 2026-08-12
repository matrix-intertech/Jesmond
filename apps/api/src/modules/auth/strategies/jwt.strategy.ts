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
        orgStaffRoles: true,
      }
    });
    
    if (!user) {
      throw new UnauthorizedException();
    }
    
    const organizationId = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organizationId : undefined;

    return { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      organizationId,
    };
  }
}
