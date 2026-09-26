import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgencyPermission } from '../agency-permissions.enum';
import { AGENCY_PERMISSIONS_KEY } from '../decorators/require-agency-permissions.decorator';
import { UserRole, AgencyRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AgencyPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<AgencyPermission[]>(AGENCY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id || !user.organizationId) {
      throw new ForbiddenException('User or organization context missing');
    }

    // Global admin override
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Agency staff lookup
    let orgStaff = user.orgStaff;
    if (!orgStaff) {
       orgStaff = await this.prisma.orgStaff.findUnique({
         where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId } }
       });
       request.user.orgStaff = orgStaff;
    }

    if (!orgStaff) {
      throw new ForbiddenException('Employee record not found for this organization');
    }

    // Org owner or Agency Admin override
    if (orgStaff.role === UserRole.ADMIN || orgStaff.agencyRole === AgencyRole.AGENCY_ADMIN) {
      return true;
    }

    // Check specific permissions
    const userPermissions: string[] = orgStaff.permissions || [];
    const hasAllRequired = requiredPermissions.every((perm) =>
      userPermissions.includes('*') || userPermissions.includes(perm)
    );

    if (!hasAllRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
