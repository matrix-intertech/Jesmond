import { OrgType, UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  orgType?: OrgType;
  orgRole?: UserRole;
  permissions: string[];
  retailBranchId?: string | null;
}
