import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORG_TYPES_KEY } from '../decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Injectable()
export class OrgTypesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<OrgType[]>(ORG_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredTypes) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    // If the user's role is not ORG_STAFF, we assume they don't have an orgType or bypass it via other guards?
    // Wait, SUPER_ADMIN might want to access things. But usually SUPER_ADMIN doesn't have an orgType.
    // The requirement says: "Retail-only backend modules must reject PROVIDER. Accommodation-only backend modules must reject RETAIL."
    // If user is SUPER_ADMIN, user.orgType might be undefined. Let's allow if they are SUPER_ADMIN or let RolesGuard handle that?
    // If the user is ORG_STAFF, orgType MUST match.
    if (user.role !== 'ORG_STAFF') {
      return true; // Let RolesGuard handle access for non-org staff (e.g. SUPER_ADMIN)
    }

    // Default to 'PROVIDER' if orgType is missing for legacy users (as done in frontend)
    const userOrgType = user.orgType || 'PROVIDER';
    
    return requiredTypes.includes(userOrgType as OrgType);
  }
}
