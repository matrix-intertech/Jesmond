import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BusinessCapability,
  CategoryCapabilities,
} from '../business-capabilities';
import { CAPABILITIES_KEY } from '../decorators/require-capability.decorator';

@Injectable()
export class BusinessCapabilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCapabilities = this.reflector.getAllAndOverride<
      BusinessCapability[]
    >(CAPABILITIES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organizationId) {
      throw new ForbiddenException('User or organization context missing');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { businessCategory: true },
    });

    if (!org || !org.businessCategory) {
      throw new ForbiddenException('Organization not found');
    }

    const allowedCapabilities =
      CategoryCapabilities[org.businessCategory] || [];

    const hasAllRequired = requiredCapabilities.every((cap) =>
      allowedCapabilities.includes(cap),
    );

    if (!hasAllRequired) {
      throw new ForbiddenException(
        'This business type does not support this feature.',
      );
    }

    return true;
  }
}
