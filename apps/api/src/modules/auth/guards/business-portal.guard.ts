import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

/**
 * Enforces business organization membership and permissions on the backend.
 * Never grants business portal access based solely on successful authentication.
 *
 * Allowed:
 * 1. Global ADMIN / SUPER_ADMIN.
 * 2. Any user with an active, non-deleted OrgStaff role in an active Organization.
 *
 * Denied:
 * - General students/customers without an associated business organization.
 */
@Injectable()
export class BusinessPortalGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // 1. Super Admins and Platform Admins have unrestricted administrative access
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // 2. If the user object in the request already has an active verified organization context
    if (user.organizationId && user.orgRole) {
      return true;
    }

    // 3. Query database to verify if user has at least one active, non-deleted OrgStaff membership
    const activeStaffMembership = await this.prisma.orgStaff.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        organization: { deletedAt: null },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (activeStaffMembership && activeStaffMembership.organization) {
      // Attach active organization context to request for downstream handlers if missing
      if (!user.organizationId) {
        user.organizationId = activeStaffMembership.organizationId;
        user.orgRole = activeStaffMembership.role;
        user.permissions = activeStaffMembership.permissions || [];
        user.retailBranchId = activeStaffMembership.retailBranchId;
      }
      return true;
    }

    throw new ForbiddenException(
      'Access denied: You do not have an active business organization membership. Please register or join an organization to access the Business Portal.',
    );
  }
}
