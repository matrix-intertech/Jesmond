import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RetailPermission } from '../retail-permissions.enum';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RetailPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RetailPermission[]>(PERMISSIONS_KEY, [
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

    // Owner override: if the user is an ADMIN of the organization, allow all.
    // We assume the auth middleware or other guards have attached orgStaff details to req.user.
    // If not, we look it up.
    let orgStaff = user.orgStaff;
    if (!orgStaff) {
       orgStaff = await this.prisma.orgStaff.findUnique({
         where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId } }
       });
       // Attach to request for downstream usage
       request.user.orgStaff = orgStaff;
    }

    if (!orgStaff) {
      throw new ForbiddenException('Employee record not found for this organization');
    }

    if (orgStaff.role === UserRole.ADMIN) {
      return true; // Owner override
    }

    // Check specific permissions
    const userPermissions: string[] = orgStaff.permissions || [];
    const hasAllRequired = requiredPermissions.every((perm) =>
      userPermissions.includes('*') || userPermissions.includes(perm)
    );

    if (!hasAllRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Branch scoping
    // If the employee is locked to a branch, restrict params or body if they attempt cross-branch.
    // This is typically handled at the service level, but we can set `req.user.retailBranchId`
    // to simplify downstream enforcement.
    request.user.retailBranchId = orgStaff.retailBranchId;

    return true;
  }
}
